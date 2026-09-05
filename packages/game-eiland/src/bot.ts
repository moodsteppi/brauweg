/**
 * Der Bot.
 *
 * Er bekommt NICHTS ausser der gefilterten Sicht (game-api) und sieht damit
 * genau so wenig wie ein Mensch: sein Gebiet und drei Schritte darueber
 * hinaus. Das ist bei diesem Spiel keine Formalie, sondern der Grund, warum er
 * ueberhaupt fair sein kann — auf dem Partiezustand haette er die ganze Karte
 * samt aller Ornamente und wuesste immer, wohin.
 *
 * Er gibt seine ganze Runde in EINEM Zug ab. Das ist keine Bequemlichkeit,
 * sondern der Unterschied zwischen fluessig und zaeh: Die Plattform laesst
 * zwischen zwei Botzuegen 0,8 Sekunden vergehen, und solange sie laufen,
 * sitzt der Mensch vor einem Brett, auf dem nichts passiert. Feld fuer Feld
 * waeren das bei einem Kontingent von sechs fast fuenf Sekunden je Runde —
 * genau das Stocken, das man beim Spielen merkt.
 *
 * Die Spielstaerke (`level`) wertet er nicht aus — ausdruecklich erlaubt (siehe
 * BotLevel in game-api) und hier auch ehrlich: Ein schwaecherer Bot muesste
 * absichtlich in Sackgassen laufen, und das ist kein Anfaenger, sondern ein
 * kaputter Experte.
 */

import { GRAS, umfeld } from './karte.js';
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
  const { spalten, zeilen, gelaende, ornament, bauwerk, besitzer, heimat } = sicht;
  const stufen = sicht.stufe;
  const ich = sicht.ich ?? 0;

  /** Alles, was schon mir gehoert oder in dieser Runde dazukommen soll. */
  const mein = new Set<number>(sicht.wahl);
  for (let platz = 0; platz < besitzer.length; platz++) {
    if (besitzer[platz] === ich) mein.add(platz);
  }

  /*
   * Das erste Feld steht als `waehlbar` in der Sicht — der Server hat es
   * gerade erst ausgerechnet. Ab dem zweiten muss der Bot selbst weiter
   * rechnen: Was nach dem ersten Feld anwaehlbar ist, haengt an einer Wahl,
   * die der Server noch gar nicht kennt. Die Regel dafuer ist EINE Zeile —
   * frei, Gras, grenzt an das eigene Gebiet einschliesslich der eben
   * gewaehlten Felder — und `fuehreAus` prueft die fertige Auswahl ohnehin
   * noch einmal.
   */
  const genommen: number[] = [...sicht.wahl];
  const offen = Math.max(0, (sicht.kontingent[ich] ?? 1) - genommen.length);

  /*
   * Angriffe kommen fertig vom Server (`angreifbar`) und bleiben die ganze
   * Runde dieselben: Sie haengen am Stand der Karte, nicht am Zettel. Ein
   * angegriffenes Feld verlaengert den Zettel nicht (siehe pruefeWahl) —
   * deshalb wandert es unten nicht in `mein`.
   *
   * Nur HALTBARE Angriffe: Ein Feld, das der Gegner in der naechsten Runde
   * zurueckholen kann, ist kein Gewinn, sondern ein Hin und Her — gemessen:
   * Ohne diesen Filter endeten 29 von 30 Bot-Partien erst an der Notbremse,
   * mit ueber hundert Eroberungen je Partie. Die Heimat ist die Ausnahme,
   * sie beendet die Partie auf der Stelle.
   */
  const angriffe = sicht.angreifbar.filter(
    (platz) => !genommen.includes(platz) && (istHeimat(platz) || haltbar(platz)),
  );

  function istHeimat(platz: number): boolean {
    const gegner = besitzer[platz];
    return gegner !== null && gegner !== undefined && heimat[gegner] === platz;
  }

  /**
   * Bleibt ein erobertes Feld meins? Seine Stufe waere danach die Zahl
   * meiner Felder in seinem Umfeld. Jedes fremde Feld an seiner Kante
   * verliert mit ihm einen Nachbarn — hat danach trotzdem eines eine
   * hoehere Stufe, holt der Gegner es sich zurueck.
   */
  function haltbar(platz: number): boolean {
    const gegner = besitzer[platz];
    let meineStufe = 0;
    for (const n of umfeld(platz, spalten, zeilen)) {
      if (besitzer[n] === ich) meineStufe++;
    }
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (besitzer[n] !== gegner) continue;
      if ((stufen[n] ?? 0) - 1 > meineStufe) return false;
    }
    return true;
  }

  for (let i = 0; i < offen; i++) {
    const frei = i === 0 ? [...sicht.waehlbar] : nachschub();
    const kandidaten = [...frei, ...angriffe.filter((platz) => !genommen.includes(platz))];
    if (kandidaten.length === 0) break;

    let bester = -1;
    let bestesMass = -Infinity;
    for (const platz of kandidaten.sort((a, b) => a - b)) {
      const mass = besitzer[platz] === null ? bewerte(platz) : bewerteAngriff(platz);
      // Gleichstand geht an die kleinere Platznummer, weil die Liste sortiert
      // ist und nur ein echtes ">" gewinnt. Ein Bot ohne Zufall muss bei
      // Gleichstand irgendetwas nehmen, und "irgendetwas" soll wiederholbar
      // sein: Ein Modul kennt keinen Zufall ausser dem Seed (Grundsatz 1).
      if (mass > bestesMass) {
        bestesMass = mass;
        bester = platz;
      }
    }
    if (bester < 0) break;
    if (besitzer[bester] === null) mein.add(bester);
    genommen.push(bester);
  }

  /** Was nach den bisher gewaehlten Feldern anwaehlbar ist. */
  function nachschub(): number[] {
    const raus = new Set<number>();
    for (const platz of mein) {
      for (const n of nachbarn(platz, spalten, zeilen)) {
        if (mein.has(n)) continue;
        // Nebel (`null`) ist kein Grasland: Was er nicht sieht, kann er nicht
        // nehmen. Angrenzende Felder liegen immer im Blick, dieser Zweig
        // greift also nur bei Sichtweite 0.
        if (gelaende[n] !== GRAS) continue;
        if (besitzer[n] !== null) continue;
        raus.add(n);
      }
    }
    return [...raus];
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

  /**
   * Was ein Angriff wert ist.
   *
   * Ein erobertes Feld zaehlt doppelt — eins fuer mich, eins weniger fuer
   * ihn —, deshalb steht es ueber jedem freien Feld ohne Ornament, aber unter
   * dem Ornament selbst: Das bringt in JEDER folgenden Runde ein Feld. Die
   * Heimat des Gegners schlaegt alles, sie ist der Sieg. Ein Bauwerk nimmt
   * ihm das Kontingent und gibt es mir. Und je mehr eigene Felder um das Ziel
   * herum liegen, desto hoeher seine Stufe, sobald es meins ist — und desto
   * eher bleibt es das auch.
   */
  function bewerteAngriff(platz: number): number {
    const gegner = besitzer[platz];
    let mass = 14;
    if (gegner !== null && gegner !== undefined && heimat[gegner] === platz) mass += 1000;
    if (bauwerk[platz] !== null && bauwerk[platz] !== undefined) mass += 40;
    for (const n of umfeld(platz, spalten, zeilen)) {
      if (mein.has(n)) mass += 3;
    }
    mass -= 2 * (stufen[platz] ?? 0);
    return mass;
  }

  /*
   * Ein Feld zurueckhalten, wenn es Streit geben kann.
   *
   * Was ein Sitz nicht setzt, setzt er auf die Streitfelder (siehe loeseAuf):
   * Wer allein einen Einsatz hat, gewinnt das Feld sicher. Grenzt eines der
   * gewaehlten freien Felder an den Gegner, kann der es ebenfalls wollen —
   * dann ist ein zurueckgehaltenes Feld mehr wert als das letzte, schwaechste
   * Feld der Liste. Das LETZTE, weil kein frueher gewaehltes Feld je an einem
   * spaeteren haengt (Kandidaten grenzen immer an das, was schon da war): Es
   * ist das einzige, das ohne Loch im Zettel wegkann. Bei einem Kontingent
   * von eins hiesse Zurueckhalten Passen — dann lieber das Feld.
   *
   * Nur ein FREIES Feld wird zurueckgehalten: Um ein angegriffenes gibt es
   * keinen Streit, es gehoert schon jemandem — der Einsatz nuetzte dort nichts.
   */
  if (genommen.length >= 2 && besitzer[genommen[genommen.length - 1]!] === null) {
    const amGegner = genommen.some(
      (platz) =>
        besitzer[platz] === null &&
        nachbarn(platz, spalten, zeilen).some((n) => besitzer[n] !== null && besitzer[n] !== ich),
    );
    if (amGegner) genommen.pop();
  }

  // Eine leere Liste ist das Passen. Von selbst kommt der Bot da kaum je an —
  // ein Sitz ohne waehlbare Felder gilt bereits als bereit und wird gar nicht
  // erst gefragt (siehe istBereit).
  return { typ: 'plan', felder: genommen };
}
