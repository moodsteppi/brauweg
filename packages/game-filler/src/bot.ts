/**
 * Der Bot.
 *
 * Er bekommt NICHTS ausser der gefilterten Sicht (game-api) und sieht damit
 * genau so wenig wie ein Mensch: sein Gebiet und dessen Rand. Das ist bei
 * diesem Spiel keine Formalie, sondern der Grund, warum er ueberhaupt fair
 * sein kann — auf dem Partiezustand haette er das ganze Brett und gewaenne
 * jede Partie.
 *
 * Seine Strategie ist gierig, und im Nebel ist das auch die einzige ehrliche:
 * Was hinter dem Rand liegt, weiss er nicht, also kann er nichts vorausplanen.
 * Er nimmt die Farbe, die JETZT am meisten Felder einbringt.
 *
 * Die Spielstaerke (`level`) wertet er nicht aus. Das ist ausdruecklich
 * erlaubt (siehe BotLevel in game-api) und hier auch ehrlich: Ein schwaecherer
 * Bot muesste absichtlich schlechter ziehen, und "nimm die zweitbeste Farbe"
 * ist kein Anfaenger, sondern ein kaputter Experte.
 */

import type { FillerAktion } from './partie.js';
import type { FillerSicht } from './sicht.js';

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

export function botZug(sicht: FillerSicht): FillerAktion {
  const { spalten, zeilen, farbzahl, feld, besitzer, farbe } = sicht;
  const ich = sicht.ich ?? 0;

  const gesperrt = new Set(Object.values(farbe));
  const erlaubt: number[] = [];
  for (let f = 0; f < farbzahl; f++) if (!gesperrt.has(f)) erlaubt.push(f);
  // Kann nicht vorkommen, solange es mehr Farben als Sitze gibt (regeln.ts
  // erzwingt das) — aber ein Bot, der `undefined` zurueckgibt, reisst den
  // Tisch mit, und das waere ein teurer Weg, das zu erfahren.
  if (erlaubt.length === 0) return { typ: 'faerben', farbe: 0 };

  /**
   * Der eigene Rand: freie Nachbarfelder des eigenen Gebiets.
   *
   * Nur EIN Ring — was dahinter liegt, steht in der Sicht als null. Der Bot
   * unterschaetzt damit jeden Zug, der eine grosse gleichfarbige Flaeche
   * anschneidet. Das ist kein Fehler, sondern derselbe blinde Fleck, den der
   * Mensch am anderen Ende auch hat.
   */
  const rand = new Set<number>();
  for (let platz = 0; platz < besitzer.length; platz++) {
    if (besitzer[platz] !== ich) continue;
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (besitzer[n] === null && feld[n] !== null) rand.add(n);
    }
  }

  let beste = erlaubt[0]!;
  let bestesMass = -1;
  let besteTiefe = -1;
  for (const f of erlaubt) {
    let mass = 0;
    let tiefe = 0;
    for (const platz of rand) {
      if (feld[platz] !== f) continue;
      mass++;
      /*
       * Gleichstand aufloesen ueber den Blick nach vorn: Ein Feld, hinter dem
       * noch Nebel liegt, ist mehr wert als eines an der Wand — es macht den
       * naechsten Rand groesser. Ohne dieses zweite Mass zoege der Bot bei
       * Gleichstand immer die kleinste Farbnummer und liefe damit gern in
       * Sackgassen.
       */
      for (const n of nachbarn(platz, spalten, zeilen)) {
        if (feld[n] === null) tiefe++;
      }
    }
    if (mass > bestesMass || (mass === bestesMass && tiefe > besteTiefe)) {
      beste = f;
      bestesMass = mass;
      besteTiefe = tiefe;
    }
  }

  return { typ: 'faerben', farbe: beste };
}
