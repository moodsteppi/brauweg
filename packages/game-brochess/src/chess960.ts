/**
 * Chess960 / Fischer-Random (Modus 'chess960', seit dem 16.11.2026 — Projekt
 * „BroChess Spezial-Modi", Tom).
 *
 * Die Figuren der Grundreihe stehen in einer von 960 gueltigen Anordnungen
 * (Laeufer auf verschiedenfarbigen Feldern, König zwischen den Tuermen);
 * Schwarz spiegelt Weiss. Alles andere ist normales Schach, bis auf die
 * Rochade (brett.ts, `rochade960`): König und Turm landen immer auf c/d bzw.
 * g/f, eingegeben wird sie als „König auf den eigenen Turm".
 *
 * Die Nummer 0 bis 959 folgt dem Verfahren von Reinhard Scharnhorst, wie es
 * auch Lichess und Wikipedia nennen — 518 ist die klassische Grundstellung.
 * So findet man dieselbe Stellung in jedem anderen Programm unter derselben
 * Nummer.
 *
 * Zufall: Das Modul hat keinen eigenen (CLAUDE.md). Die Nummer kommt aus der
 * Saat der Partie, und der Server zieht die Saat mit `crypto.randomInt`
 * (packages/server/src/runtime/party.ts) — sicherer Zufall, serverseitig, vom
 * Client nicht beeinflussbar. Die Saat steuert schon, wer Weiss spielt (Bit 0);
 * die Nummer nimmt die uebrigen Bits, die beiden Entscheidungen sind also
 * unabhaengig voneinander.
 */

import { type Stellung, ausFen } from './brett.js';

/** Wie viele Grundreihen es gibt. */
export const ANZAHL_STELLUNGEN = 960;

/** Nummer der klassischen Grundstellung RNBQKBNR. */
export const KLASSISCHE_NUMMER = 518;

/** Die Springer-Plaetze unter den fuenf uebrigen Feldern, je Rest 0 bis 9 (Scharnhorst). */
const SPRINGER_PLAETZE: readonly (readonly [number, number])[] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],
];

/** Die Grundreihe der Nummer als acht Grossbuchstaben, a-Linie zuerst ('RNBQKBNR'). */
export function grundreihe(nummer: number): string {
  if (!Number.isInteger(nummer) || nummer < 0 || nummer >= ANZAHL_STELLUNGEN) {
    throw new Error(`Chess960-Nummer ausserhalb von 0 bis 959: ${nummer}`);
  }
  const reihe: string[] = Array.from({ length: 8 }, () => '');
  let n = nummer;
  // Weissfeldriger Laeufer auf b, d, f oder h (b1 ist hell), dunkelfeldriger auf a, c, e oder g.
  reihe[[1, 3, 5, 7][n % 4]!] = 'B';
  n = Math.floor(n / 4);
  reihe[[0, 2, 4, 6][n % 4]!] = 'B';
  n = Math.floor(n / 4);
  const frei = (): number[] => reihe.flatMap((f, i) => (f === '' ? [i] : []));
  reihe[frei()[n % 6]!] = 'Q';
  n = Math.floor(n / 6);
  const rest = frei();
  for (const i of SPRINGER_PLAETZE[n]!) reihe[rest[i]!] = 'N';
  // Auf den drei uebrigen Feldern: Turm, König, Turm.
  const drei = frei();
  reihe[drei[0]!] = 'R';
  reihe[drei[1]!] = 'K';
  reihe[drei[2]!] = 'R';
  return reihe.join('');
}

/**
 * Die Nummer einer Grundreihe, oder -1, wenn sie keine der 960 ist. Die
 * Umkehrung von `grundreihe`; die Tests pruefen beide gegeneinander und
 * damit, dass alle 960 gueltig und verschieden sind.
 */
export function nummerVon(reihe: string): number {
  if (!/^[RNBQK]{8}$/.test(reihe)) return -1;
  // Suchen statt die Rechnung umzukehren: 960 Vergleiche, und es gibt nur eine Wahrheit (`grundreihe`).
  for (let kandidat = 0; kandidat < ANZAHL_STELLUNGEN; kandidat += 1) {
    if (grundreihe(kandidat) === reihe) return kandidat;
  }
  return -1;
}

/**
 * Die Stellung der Nummer als Shredder-FEN: Rochaderechte heissen nach der
 * Linie des Turms (etwa „HAha"). Schwarz spiegelt Weiss.
 */
export function startFen960(nummer: number): string {
  const weiss = grundreihe(nummer);
  const schwarz = weiss.toLowerCase();
  const turm = [...weiss].flatMap((f, i) => (f === 'R' ? [i] : []));
  const [q, k] = [turm[0]!, turm[1]!];
  const linie = (i: number): string => 'ABCDEFGH'[i]!;
  const rechte = `${linie(k)}${linie(q)}${linie(k).toLowerCase()}${linie(q).toLowerCase()}`;
  return `${schwarz}/pppppppp/8/8/8/8/PPPPPPPP/${weiss} w ${rechte} - 0 1`;
}

/** Die Startstellung der Nummer als Stellung des Kerns. */
export function startStellung960(nummer: number): Stellung {
  return ausFen(startFen960(nummer));
}

/** Die Nummer, die eine Saat bestimmt (siehe Kopf: Bit 0 gehoert der Farbwahl). */
export function nummerAusSaat(seed: number): number {
  return Math.floor(Math.abs(Math.trunc(seed)) / 2) % ANZAHL_STELLUNGEN;
}
