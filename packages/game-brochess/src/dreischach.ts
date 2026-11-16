/**
 * Drei-Schach (Modus 'dreiSchach', seit dem 14.11.2026 — Projekt „BroChess
 * Spezial-Modi", Tom; wie „Three-check" bei Lichess).
 *
 * Normales Schach, dazu: Wer dem Gegner zum DRITTEN Mal Schach gibt, gewinnt.
 * Matt gewinnt weiterhin sofort. Die Zuege sind dieselben wie im normalen
 * Schach — hier steht nur die Buchhaltung der Schachgebote und was sie an den
 * Remisregeln aendert. Den Zug selbst fuehrt partie.ts aus.
 *
 * Gezaehlt wird je Farbe, wie oft SIE Schach GEGEBEN hat. Der Bildschirm
 * zeigt daraus die „Leben" des Gegners (Ziel minus gegebene Schachs).
 */

import type { Farbe } from './brett.js';

/** Das dritte Schach gewinnt. */
export const SCHACH_ZIEL = 3;

export interface DreiSchachStand {
  /** Wie oft die Farbe dem Gegner schon Schach gegeben hat. */
  readonly gegeben: { readonly w: number; readonly b: number };
}

export function neuerDreiSchachStand(): DreiSchachStand {
  return { gegeben: { w: 0, b: 0 } };
}

/** Der Stand nach einem Zug von `zieher`; `gibtSchach`, wenn der Gegner danach im Schach steht. */
export function zaehleSchach(stand: DreiSchachStand, zieher: Farbe, gibtSchach: boolean): DreiSchachStand {
  if (!gibtSchach) return stand;
  return { gegeben: { ...stand.gegeben, [zieher]: stand.gegeben[zieher] + 1 } };
}

/** Hat `farbe` ihr drittes Schach gegeben? */
export function dreiSchachErreicht(stand: DreiSchachStand, farbe: Farbe): boolean {
  return stand.gegeben[farbe] >= SCHACH_ZIEL;
}

/**
 * Der Wiederholungsschluessel samt Zaehler. Zwei Stellungen mit gleichen
 * Figuren, aber verschiedenem Zaehlerstand sind NICHT dieselbe Stellung —
 * wie verschiedene Rochaderechte: Wer zweimal Schach gegeben hat, steht
 * anders als vorher. Ohne den Zaehler endete ein Dauerschach als Remis durch
 * Wiederholung, obwohl schon das dritte Schach gewonnen hat (Lichess
 * zaehlt ebenso mit).
 */
export function dreiSchachSchluessel(stellungsSchluessel: string, stand: DreiSchachStand): string {
  return `${stellungsSchluessel} +${stand.gegeben.w}+${stand.gegeben.b}`;
}

/**
 * Kann `farbe` noch Schach geben? Ja, solange sie irgendeine Figur ausser
 * dem König hat — ein einsamer Laeufer setzt nie matt, gibt aber Schach,
 * und drei davon gewinnen. Darum gilt im Modus „zu wenig Material" erst,
 * wenn nur noch die Könige stehen, und eine Zeitueberschreitung verliert,
 * solange der Gegner noch eine Figur hat (wie bei Lichess).
 */
export function kannSchachGeben(brett: readonly string[], farbe: Farbe): boolean {
  return brett.some((f) => f !== '' && f.toLowerCase() !== 'k' && (f === f.toUpperCase()) === (farbe === 'w'));
}

/** Nur noch die beiden Könige: Niemand kann mehr Schach geben, die Partie ist remis. */
export function nurKoenige(brett: readonly string[]): boolean {
  return !kannSchachGeben(brett, 'w') && !kannSchachGeben(brett, 'b');
}
