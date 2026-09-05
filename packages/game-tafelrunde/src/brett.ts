/**
 * Die Geometrie des Bretts.
 *
 * Ein Sechseckraster, versetzt gestapelt ("odd-r"): Jede ungerade Reihe liegt
 * eine halbe Zelle weiter rechts. Deshalb hat ein Feld sechs Nachbarn und
 * nicht vier — und deshalb steht die Nachbarschaft hier und nicht im Client:
 * Wer sie dort nachbaut, baut sie beim ersten Kampf ein zweites Mal, und dann
 * gibt es zwei Wahrheiten (CLAUDE.md: der Client bildet keine Regel nach).
 *
 * Gespeichert wird ein Feld als PLATZNUMMER (`reihe * SPALTEN + spalte`) und
 * nicht als Paar. Ein Paar in einem JSON-Snapshot waere ein Objekt je Feld,
 * und der Snapshot geht nach jeder Aktion in die Datenbank.
 *
 * HIER STEHT NUR DIE EIGENE HAELFTE — vier Reihen zu fuenf Spalten, und nur
 * darauf darf man aufstellen. Die KAMPFARENA ist etwas anderes: die eigenen
 * vier Reihen, die vier gespiegelten des Gegners und zwei leere Reihen
 * dazwischen (arena.ts). Sie entsteht erst in Phase 2, wenn es einen Kampf
 * gibt.
 */

/** Spalten der eigenen Haelfte. */
export const BRETT_SPALTEN = 5;

/**
 * Reihen der eigenen Haelfte.
 *
 * SEIT DEM 06.09.2026 VIER STATT ZWEI — Robins Entscheidung nach der Messung
 * in docs/TAFELRUNDE-LAUFWEGE.md: "dann bewegen sie sich auch mehr und man
 * kann taktischer aufstellen". Mit zwei Reihen lag die hintere zwei Felder vom
 * Gegner entfernt, und damit stand jeder Schuetze vom ersten Takt an im Ziel.
 *
 * DIE ZAHL MUSS GERADE BLEIBEN. Die Punktspiegelung in arena.ts ist nur bei
 * gerader Reihenzahl abstandstreu; die Probe "erhaelt alle Abstaende" in
 * test/arena.test.ts faellt bei drei Reihen fuer 160 von 450 Feldpaaren. Wer
 * die Bretthoehe aendert, aendert sie in Zweierschritten.
 */
export const BRETT_REIHEN = 4;

/** Felder der eigenen Haelfte: 20. Mehr Einheiten als das passen nie darauf. */
export const BRETT_FELDER = BRETT_SPALTEN * BRETT_REIHEN;

export interface Hexfeld {
  readonly reihe: number;
  readonly spalte: number;
}

export function platzNummer(reihe: number, spalte: number): number {
  return reihe * BRETT_SPALTEN + spalte;
}

export function hexfeld(platz: number): Hexfeld {
  return { reihe: Math.floor(platz / BRETT_SPALTEN), spalte: platz % BRETT_SPALTEN };
}

export function istBrettplatz(platz: unknown): boolean {
  return (
    typeof platz === 'number' &&
    Number.isInteger(platz) &&
    platz >= 0 &&
    platz < BRETT_FELDER
  );
}

/**
 * Die sechs Nachbarn eines Feldes, soweit sie auf dem Raster liegen.
 *
 * Die beiden Faelle sind kein Schoenheitsfehler, sondern das Wesen des
 * versetzten Rasters: In einer geraden Reihe liegen die diagonalen Nachbarn
 * links versetzt, in einer ungeraden rechts. Wer nur einen Fall schreibt,
 * bekommt ein Brett, auf dem jede zweite Reihe schief benachbart ist — und
 * merkt es erst, wenn im Kampf Einheiten aneinander vorbeilaufen.
 *
 * `reihen` ist ein Parameter und keine Konstante, weil dieselbe Rechnung
 * spaeter fuer die vier Reihen der Arena gebraucht wird.
 */
export function hexNachbarn(
  platz: number,
  reihen: number = BRETT_REIHEN,
  spalten: number = BRETT_SPALTEN,
): number[] {
  const reihe = Math.floor(platz / spalten);
  const spalte = platz % spalten;
  const ungerade = reihe % 2 === 1;
  const versatz: readonly (readonly [number, number])[] = ungerade
    ? [
        [0, -1],
        [0, +1],
        [-1, 0],
        [-1, +1],
        [+1, 0],
        [+1, +1],
      ]
    : [
        [0, -1],
        [0, +1],
        [-1, -1],
        [-1, 0],
        [+1, -1],
        [+1, 0],
      ];

  const raus: number[] = [];
  for (const [dr, ds] of versatz) {
    const r = reihe + dr;
    const s = spalte + ds;
    if (r < 0 || r >= reihen) continue;
    if (s < 0 || s >= spalten) continue;
    raus.push(r * spalten + s);
  }
  return raus;
}

/**
 * Achsen-Koordinaten eines Platzes.
 *
 * Gespeichert wird ein Feld als Platznummer und damit als Reihe und Spalte —
 * das ist die Form, in der es der Bildschirm zeichnet. Fuer den ABSTAND
 * zweier Felder taugt sie nicht: In einem versetzten Raster haengt jeder
 * Schritt davon ab, ob die Reihe gerade oder ungerade ist, und eine
 * Abstandsformel darueber ist eine Fallgrube (siehe `hexNachbarn`, das die
 * beiden Faelle ausschreiben muss).
 *
 * In Achsen-Koordinaten ist der Abstand dagegen eine Zeile. Umgerechnet wird
 * mit `q = spalte - floor(reihe / 2)` — genau die Umkehrung des Versatzes,
 * den das odd-r-Raster einbaut.
 */
function achsen(platz: number, spalten: number): { q: number; r: number } {
  const reihe = Math.floor(platz / spalten);
  return { q: (platz % spalten) - Math.floor(reihe / 2), r: reihe };
}

/**
 * Abstand zweier Plaetze in Feldern.
 *
 * Die Kubus-Formel ueber die dritte Achse (s = -q - r). Gebraucht wird sie von
 * der Reichweite im Kampf; sie steht hier, weil sie zur Geometrie gehoert und
 * nicht zur Kampfschleife.
 *
 * `spalten` ist wie bei `hexNachbarn` ein Parameter: Die Kampfarena ist
 * dasselbe Raster mit doppelt so vielen Reihen, und eine zweite Formel dort
 * waere die klassische Stelle, an der zwei Geometrien auseinanderlaufen.
 */
export function hexAbstand(a: number, b: number, spalten: number = BRETT_SPALTEN): number {
  const eins = achsen(a, spalten);
  const zwei = achsen(b, spalten);
  const dq = eins.q - zwei.q;
  const dr = eins.r - zwei.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}
