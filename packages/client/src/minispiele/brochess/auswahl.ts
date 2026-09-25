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
