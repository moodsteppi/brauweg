/**
 * Was ein Klick auf dem Brett bedeutet.
 *
 * Hier steht KEINE Schachregel. Alles, was erlaubt ist, kommt fertig als
 * `legalActions` vom Server; diese Funktionen suchen darin nur aus, was zu
 * einem angeklickten Feld gehoert. Getrennt vom Bildschirm, damit sie ohne
 * React geprueft werden koennen.
 */

import type { BroChessZug, Farbe } from './sicht';

const LINIEN = 'abcdefgh';

export function feldName(index: number): string {
  return `${LINIEN[index % 8]}${Math.floor(index / 8) + 1}`;
}

/**
 * Die 64 Feldnummern in Anzeigereihenfolge, links oben zuerst. Schwarz sieht
 * das Brett von der anderen Seite — wie am echten Tisch, wo die eigenen
 * Figuren unten stehen. Zuschauer sehen es von Weiss aus.
 */
export function anzeigeReihenfolge(sicht: Farbe | null): number[] {
  const felder: number[] = [];
  for (let zeile = 7; zeile >= 0; zeile--) {
    for (let linie = 0; linie < 8; linie++) felder.push(zeile * 8 + linie);
  }
  return sicht === 'b' ? felder.reverse() : felder;
}

/** Felder, von denen aus es einen legalen Zug gibt. */
export function beweglicheFelder(zuege: readonly BroChessZug[]): Set<string> {
  return new Set(zuege.map((z) => z.von));
}

/** Zielfelder der Figur auf `von`. */
export function zielfelder(zuege: readonly BroChessZug[], von: string | null): Set<string> {
  if (!von) return new Set();
  return new Set(zuege.filter((z) => z.von === von).map((z) => z.nach));
}

/**
 * Die Zuege von `von` nach `nach` — einer, oder vier, wenn ein Bauer
 * umwandelt. Bei vieren fragt der Bildschirm nach der Figur.
 */
export function zuegeNach(zuege: readonly BroChessZug[], von: string, nach: string): BroChessZug[] {
  return zuege.filter((z) => z.von === von && z.nach === nach);
}

/**
 * Welches Feld liegt unter einem Punkt auf dem Brett? Fuer das Ziehen mit
 * dem Finger: `x`/`y` relativ zur linken oberen Ecke, `seite` die Kante des
 * quadratischen Bretts. Ausserhalb: null.
 */
export function feldAnPunkt(x: number, y: number, seite: number, unten: Farbe | null): string | null {
  if (seite <= 0 || x < 0 || y < 0 || x >= seite || y >= seite) return null;
  const spalte = Math.floor((x / seite) * 8);
  const zeile = Math.floor((y / seite) * 8);
  const index = anzeigeReihenfolge(unten)[zeile * 8 + spalte];
  return index === undefined ? null : feldName(index);
}

/** Zeile und Spalte eines Feldes in der Anzeige (0 = oben bzw. links). */
export function anzeigePosition(name: string, unten: Farbe | null): { zeile: number; spalte: number } {
  const index = (Number(name[1]) - 1) * 8 + LINIEN.indexOf(name[0]!);
  const stelle = anzeigeReihenfolge(unten).indexOf(index);
  return { zeile: Math.floor(stelle / 8), spalte: stelle % 8 };
}

/**
 * Ein vorgemerkter Zug, sobald man dran ist: der passende Eintrag aus
 * `legalActions`, bei einer Umwandlung die Dame — fuer eine Rueckfrage ist
 * im Bullet keine Zeit. Geht der Zug nicht mehr (der Gegner hat die Linie
 * zugestellt), null: Dann verfaellt er.
 */
export function vorabZug(zuege: readonly BroChessZug[], von: string, nach: string): BroChessZug | null {
  const passend = zuegeNach(zuege, von, nach);
  return passend.find((z) => z.umwandlung === 'q') ?? passend[0] ?? null;
}
