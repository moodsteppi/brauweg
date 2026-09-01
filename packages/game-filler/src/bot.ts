/**
 * Der Bot.
 *
 * Er bekommt NICHTS ausser der gefilterten Sicht (game-api) und sieht damit
 * genau so wenig wie ein Mensch: sein Gebiet und dessen Rand. Das ist bei
 * diesem Spiel keine Formalie, sondern der Grund, warum er ueberhaupt fair
 * sein kann — auf dem Partiezustand haette er das ganze Brett und gewaenne
 * jede Partie.
 *
 * Seine Strategie ist gierig: Er nimmt die Farbe, die JETZT am meisten Felder
 * einbringt. Im Nebel ist das auch die einzige ehrliche Strategie — was hinter
 * dem Rand liegt, weiss er nicht, also kann er nichts vorausplanen.
 *
 * Gezaehlt wird mit DERSELBEN Schleife wie im Zustand: ein Flutfuellen, das
 * nur durch bekannte Felder laeuft. In der offenen Spielart faerbt das die
 * ganze zusammenhaengende Flaeche und der Bot sieht den grossen Zug; im Nebel
 * stoesst es nach einem Ring auf `null` und hoert von selbst auf. Ein zweiter
 * Zaehlweg je Spielart waere zwei Wege, die auseinanderlaufen koennen.
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

  /** Die eigenen Felder — Ausgangspunkt jeder Zaehlung. */
  const eigen: number[] = [];
  for (let platz = 0; platz < besitzer.length; platz++) {
    if (besitzer[platz] === ich) eigen.push(platz);
  }

  /**
   * Wie viele Felder Farbe `f` einbraechte, und wie viel Nebel danach ans
   * eigene Gebiet grenzte.
   *
   * Der zweite Wert loest Gleichstaende auf: Ein Feld, hinter dem noch Nebel
   * liegt, ist mehr wert als eines an der Wand — es macht den naechsten Rand
   * groesser. Ohne ihn zoege der Bot bei Gleichstand immer die kleinste
   * Farbnummer und liefe damit gern in Sackgassen. In der offenen Spielart
   * ist er stets 0 und damit wirkungslos, was richtig ist: Dort gibt es
   * nichts aufzudecken.
   */
  function bewerte(f: number): { mass: number; tiefe: number } {
    const genommen = new Set(eigen);
    const rand = [...eigen];
    let mass = 0;
    while (rand.length > 0) {
      const platz = rand.pop()!;
      for (const n of nachbarn(platz, spalten, zeilen)) {
        if (genommen.has(n)) continue;
        if (besitzer[n] !== null) continue;
        // `null` ist Nebel: Was der Bot nicht sieht, zaehlt er nicht mit.
        if (feld[n] !== f) continue;
        genommen.add(n);
        rand.push(n);
        mass++;
      }
    }
    let tiefe = 0;
    for (const platz of genommen) {
      for (const n of nachbarn(platz, spalten, zeilen)) {
        if (!genommen.has(n) && feld[n] === null) tiefe++;
      }
    }
    return { mass, tiefe };
  }

  let beste = erlaubt[0]!;
  let bestesMass = -1;
  let besteTiefe = -1;
  for (const f of erlaubt) {
    const { mass, tiefe } = bewerte(f);
    if (mass > bestesMass || (mass === bestesMass && tiefe > besteTiefe)) {
      beste = f;
      bestesMass = mass;
      besteTiefe = tiefe;
    }
  }

  return { typ: 'faerben', farbe: beste };
}
