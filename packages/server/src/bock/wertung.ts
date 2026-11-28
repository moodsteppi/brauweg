/**
 * Die Wertung des BroweG-Bocks — reine Funktionen, keine Datenbank.
 *
 * Getrennt vom Dienst, damit Punkte, Gleichstand und Belohnung ohne Tisch
 * und ohne Bot-Partie pruefbar sind (test/bock.test.ts).
 */

import type { BockStationPlatz } from '../db/schema.js';
import { awardForParty, type TrophyAward } from '../trophies.js';

/**
 * Stationspunkte fuer einen Platz bei `n` Sitzen: der Sieger n, dann n−2,
 * n−3 … 0. Zu dritt 3/1/0, zu viert 4/2/1/0 (der Vorschlag aus dem Plan),
 * zu fuenft 5/3/2/1/0.
 *
 * Warum der Sieger einen Sprung bekommt und nicht einfach n−1: Ein Bock
 * soll von Stationssiegen leben. Mit gleichmaessigen Abstaenden gewinnt, wer
 * ueberall Zweiter wird, gegen jemanden, der zwei von drei Stationen gewinnt
 * und einmal Letzter wird (3·2 = 6 gegen 3+3+0 = 6 — Gleichstand). Mit dem
 * Sprung liegt der Sieger vorn (4+4+0 = 8 gegen 2·3 = 6).
 */
export function punkteFuerPlatz(platz: number, n: number): number {
  if (platz <= 1) return n;
  return Math.max(0, n - platz);
}

/**
 * Die Punkte einer Station. `plaetze` traegt je Bock-Sitz den Platz, den das
 * Modul am Tisch vergeben hat (`standings`, Gleichstand = gleiche Ziffer).
 *
 * Gleichstand teilt: Zwei auf Platz 2 bekommen zusammen, was Platz 2 und 3
 * gebracht haetten, je zur Haelfte — dieselbe Regel wie bei den Trophaeen
 * (`awardForParty`). Dabei kann ein halber Punkt entstehen; er bleibt stehen
 * und wird nicht gerundet, sonst entschiede die Rundung einen Bock.
 */
export function stationsPunkte(plaetze: readonly { sitz: number; platz: number }[]): BockStationPlatz[] {
  const n = plaetze.length;
  return plaetze.map(({ sitz, platz }) => {
    const gleich = plaetze.filter((p) => p.platz === platz).length;
    let summe = 0;
    for (let i = 0; i < gleich; i += 1) summe += punkteFuerPlatz(platz + i, n);
    return { sitz, platz, punkte: summe / gleich };
  });
}

/** Muenzen nach Endplatz (Robin, 28.11.2026, „Selbst entschieden" im Plan). */
export const BOCK_MUENZEN: readonly number[] = [50, 25, 10];

export interface EndZeile {
  readonly sitz: number;
  readonly punkte: number;
  readonly siege: number;
  readonly platz: number;
  readonly verlassen: boolean;
}

/**
 * Der Endstand: meiste Punkte vorn, bei Gleichstand mehr Stationssiege, sonst
 * derselbe Platz. Wer den Bock verlassen hat, steht hinter allen anderen
 * (Plan: „Station verlassen = Bot uebernimmt, im Bock Letzter") — unter sich
 * wieder nach Punkten.
 */
export function endstand(
  punkte: readonly number[],
  stationen: readonly (readonly BockStationPlatz[])[],
  verlassen: readonly boolean[],
): EndZeile[] {
  const zeilen = punkte.map((p, sitz) => ({
    sitz,
    punkte: p,
    siege: stationen.filter((st) => st.some((z) => z.sitz === sitz && z.platz === 1)).length,
    verlassen: verlassen[sitz] === true,
  }));
  const vor = (a: (typeof zeilen)[number], b: (typeof zeilen)[number]): number =>
    Number(a.verlassen) - Number(b.verlassen) || b.punkte - a.punkte || b.siege - a.siege;
  const sortiert = [...zeilen].sort(vor);
  return sortiert.map((zeile) => ({
    ...zeile,
    // Platz = 1 + Zahl derer, die echt davor liegen.
    platz: 1 + sortiert.filter((andere) => vor(andere, zeile) < 0).length,
  }));
}

/**
 * Trophaeen und Muenzen je Sitz.
 *
 * Trophaeen wie an einem Tisch dieser Sitzzahl (`awardForParty`, samt
 * Verlassen-Strafe obendrauf) — Bots sitzen in der Verteilung mit, gebucht
 * wird nur auf Konten. Muenzen nach Platz; bei Gleichstand teilen sich die
 * Beteiligten die Plaetze wie bei den Trophaeen, gerundet auf ganze Muenzen.
 * Trophaeen werden je Buchung gerundet, genau wie in `awardTrophies` am Tisch.
 */
export interface Belohnung {
  readonly trophaeen: number;
  readonly muenzen: number;
  /** Die einzelnen Buchungen fuer das Trophaeenbuch (Ergebnis, Strafe). */
  readonly buchungen: readonly { delta: number; grund: TrophyAward['reason'] }[];
}

export function belohnung(end: readonly EndZeile[]): Map<number, Belohnung> {
  const awards = awardForParty(end.map((z) => ({ seat: z.sitz, place: z.platz, left: z.verlassen })));
  const ergebnis = new Map<number, Belohnung>();
  for (const zeile of end) {
    const buchungen = awards
      .filter((a) => a.seat === zeile.sitz)
      .map((a) => ({ delta: Math.round(a.delta), grund: a.reason }));
    const trophaeen = buchungen.reduce((summe, b) => summe + b.delta, 0);
    const gleich = end.filter((z) => z.platz === zeile.platz).length;
    let summe = 0;
    for (let i = 0; i < gleich; i += 1) summe += BOCK_MUENZEN[zeile.platz - 1 + i] ?? 0;
    // Wer gegangen ist, bekommt keine Muenzen — auch nicht die zehn fuer
    // Platz drei, auf dem er zu dritt sonst automatisch landete.
    ergebnis.set(zeile.sitz, {
      trophaeen,
      muenzen: zeile.verlassen ? 0 : Math.round(summe / gleich),
      buchungen,
    });
  }
  return ergebnis;
}
