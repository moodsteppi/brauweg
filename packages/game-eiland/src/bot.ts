/**
 * Der Bot.
 *
 * Er bekommt NICHTS ausser der gefilterten Sicht (game-api) und sieht damit
 * genau so wenig wie ein Mensch: sein Gebiet und drei Schritte darueber
 * hinaus. Das ist bei diesem Spiel keine Formalie, sondern der Grund, warum er
 * ueberhaupt fair sein kann — auf dem Partiezustand haette er die ganze Karte
 * samt aller Ornamente und wuesste immer, wohin.
 *
 * Er waehlt je Aufruf EIN Feld, so wie ein Mensch auch. Eine Aktion "ganze
 * Auswahl auf einmal" waere schneller, aber die Plattform prueft, dass jede
 * Bot-Aktion in `legalActions` steht (plattform-invarianten.test.ts) — und
 * aufzaehlen liesse sich so eine Aktion nur als Liste aller
 * Feldkombinationen. Die Plattform ruft ihn einfach erneut auf, solange sein
 * Zettel offen ist.
 *
 * Die Spielstaerke (`level`) wertet er nicht aus — ausdruecklich erlaubt (siehe
 * BotLevel in game-api) und hier auch ehrlich: Ein schwaecherer Bot muesste
 * absichtlich in Sackgassen laufen, und das ist kein Anfaenger, sondern ein
 * kaputter Experte.
 */

import { GRAS } from './karte.js';
import type { EilandAktion } from './partie.js';
import type { EilandSicht } from './sicht.js';

/** Orthogonale Nachbarn — dieselbe Rechnung wie im Zustand, nur auf der Sicht. */
function nachbarn(platz: number, spalten: number, zeilen: number): number[] {
  const x = platz % spalten;
  const y = Math.floor(platz / spalten);
  const raus: number[] = [];
  if (x > 0) raus.push(platz - 1);
  if (x < spalten - 1) raus.push(platz + 1);
  if (y > 0) raus.push(platz - spalten);
  if (y < zeilen - 1) raus.push(platz + spalten);
  return raus;
}

export function botZug(sicht: EilandSicht): EilandAktion {
  const { spalten, zeilen, gelaende, ornament, besitzer } = sicht;
  const ich = sicht.ich ?? 0;

  /** Alles, was schon mir gehoert oder in dieser Runde dazukommen soll. */
  const mein = new Set<number>(sicht.wahl);
  for (let platz = 0; platz < besitzer.length; platz++) {
    if (besitzer[platz] === ich) mein.add(platz);
  }

  /*
   * Die Kandidaten stehen als `waehlbar` in der Sicht — der Server hat sie
   * gerade erst ausgerechnet. Sie noch einmal herzuleiten waere dieselbe Regel
   * ein zweites Mal, und die zweite waere die, die niemand testet.
   */
  let bester = -1;
  let bestesMass = -Infinity;
  for (const platz of [...sicht.waehlbar].sort((a, b) => a - b)) {
    const mass = bewerte(platz);
    // Gleichstand geht an die kleinere Platznummer, weil die Liste sortiert
    // ist und nur ein echtes ">" gewinnt. Ein Bot ohne Zufall muss bei
    // Gleichstand irgendetwas nehmen, und "irgendetwas" soll wiederholbar
    // sein: Ein Modul kennt keinen Zufall ausser dem Seed (Grundsatz 1).
    if (mass > bestesMass) {
      bestesMass = mass;
      bester = platz;
    }
  }

  /**
   * Was ein Feld wert ist.
   *
   * Ein Ornament schlaegt alles: Es ist ein Feld mehr in JEDER folgenden
   * Runde, waehrend ein gewoehnliches Feld einmal zaehlt. Danach zaehlt, wie
   * viel Unbekanntes dahinter liegt — wer sich in eine Sackgasse baut, hat in
   * fuenf Runden nichts mehr zu waehlen.
   *
   * Der Abzug an der Grenze ist die einzige Stelle, an der er den Gegner
   * einrechnet: Ein Feld direkt an dessen Gebiet will der andere mit einiger
   * Wahrscheinlichkeit auch, und ein verlorener Muenzwurf nimmt nicht nur
   * dieses Feld, sondern alles, was in diesem Zug dahinter liegen sollte.
   */
  function bewerte(platz: number): number {
    let mass = 0;
    if (ornament[platz] !== null && ornament[platz] !== undefined) mass += 60;
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (mein.has(n)) continue;
      const art = gelaende[n];
      if (art === null || art === undefined) {
        mass += 5; // Nebel: Dahinter geht es weiter.
        continue;
      }
      if (besitzer[n] !== null && besitzer[n] !== ich) {
        mass -= 8; // Grenze zum Gegner.
        continue;
      }
      if (art !== GRAS) continue; // Wasser und Berg bringen nichts ein.
      mass += 2;
      if (ornament[n] !== null && ornament[n] !== undefined) mass += 12;
    }
    return mass;
  }

  /*
   * Nichts mehr zu holen: abgeben. Von selbst kommt der Bot hier kaum je an —
   * ein Sitz ohne waehlbare Felder gilt bereits als bereit und wird gar nicht
   * erst gefragt (siehe istBereit). Uebrig bleibt der Fall, dass die Plattform
   * ihn fuer einen abwesenden Menschen einspringen laesst, dessen Zettel voll
   * ist.
   */
  if (bester < 0) return { typ: 'bereit' };
  return { typ: 'waehlen', platz: bester };
}
