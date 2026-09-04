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
 * Das Konzept nennt vier Reihen zu fuenf Spalten. Das ist die KAMPFARENA:
 * zwei eigene Reihen und die zwei gespiegelten des Gegners. Aufstellen darf
 * man nur in der eigenen Haelfte, und genau die steht hier. Die Arena entsteht
 * erst in Phase 2, wenn es einen Kampf gibt.
 */

/** Spalten der eigenen Haelfte. */
export const BRETT_SPALTEN = 5;

/** Reihen der eigenen Haelfte. Die Arena hat spaeter doppelt so viele. */
export const BRETT_REIHEN = 2;

/** Felder der eigenen Haelfte: 10. Mehr Einheiten als das passen nie darauf. */
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
