/**
 * Koenig des Huegels (Modus 'huegel', seit dem 17.11.2026 — Projekt „BroChess
 * Spezial-Modi", Tom; wie „King of the Hill" bei Lichess).
 *
 * Normales Schach, dazu: Wer seinen König LEGAL auf eines der vier
 * Mittelfelder d4, e4, d5, e5 zieht, gewinnt sofort. Die Zuege sind dieselben
 * wie im normalen Schach — der Koenig darf also nicht in ein Schach ziehen,
 * auch nicht auf den Huegel. Hier steht nur, welche Felder der Huegel sind
 * und wer ihn erreicht hat. Den Zug selbst fuehrt partie.ts aus.
 *
 * Gewonnen hat, wer seinen König auf den Huegel ZIEHT. Steht ein König dort
 * von Anfang an (nur in Teststellungen), zaehlt das nicht — und er muss
 * nicht erst herunter: Jeder Zug eines Koenigs auf ein Huegelfeld gewinnt,
 * auch von einem Huegelfeld auf das nächste.
 */

import { feldIndex } from './brett.js';

/** d4, e4, d5, e5 — in dieser Schreibweise steht der Huegel auch in der Sicht. */
export const HUEGEL_FELDER: readonly string[] = ['d4', 'e4', 'd5', 'e5'];

const HUEGEL_INDIZES: readonly number[] = HUEGEL_FELDER.map((f) => feldIndex(f));

export const istHuegel = (index: number): boolean => HUEGEL_INDIZES.includes(index);

/**
 * Hat dieser Zug einen König auf den Huegel gebracht? `figurAmStart` ist die
 * Figur auf dem Startfeld VOR dem Zug.
 */
export function zugErreichtHuegel(figurAmStart: string, nach: number): boolean {
  return figurAmStart.toLowerCase() === 'k' && istHuegel(nach);
}

/**
 * Wie viele Koenigsschritte (Felder, auch schraeg) es von `index` bis zum
 * naechsten Huegelfeld sind; 0 auf dem Huegel selbst. Fuer den Bot: Wer
 * nah dran ist, droht, und wer den Gegner davon fernhalten will, muss das
 * wissen.
 */
export function abstandZumHuegel(index: number): number {
  const datei = index % 8;
  const reihe = Math.floor(index / 8);
  return Math.max(Math.max(0, 3 - datei, datei - 4), Math.max(0, 3 - reihe, reihe - 4));
}
