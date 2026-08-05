/**
 * Geben.
 *
 * Deterministisch aus einem Seed. Die Engine wuerfelt nichts selbst, damit
 * jede Runde exakt reproduzierbar ist (Tests, Nachspielen, Fehlerberichte).
 */

import { type Card, createDeck } from './cards.js';
import type { RuleSet } from './ruleset.js';

/**
 * Seed eines Gebens.
 *
 * Eine Zahl ist ein 32-Bit-Seed: reproduzierbar und praktisch fuer Tests,
 * aber viel zu klein fuer den Ernstfall - wer seine eigenen zwoelf Karten
 * sieht, kann 2^32 Seeds durchprobieren und kennt danach alle Haende. Im
 * Betrieb kommt deshalb immer ein 128-Bit-Seed als Hexkette vom Server.
 */
export type Seed = number | string;

/** mulberry32, klein - nur fuer Tests mit festem Zahlen-Seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** sfc32: 128 Bit Zustand, damit ein Geben nicht durchprobierbar ist. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Vier 32-Bit-Woerter aus einer Hexkette; fehlende Stellen werden gefuellt. */
function worte(hex: string): [number, number, number, number] {
  const sauber = hex.replace(/[^0-9a-f]/gi, '').padEnd(32, '0').slice(0, 32);
  return [
    Number.parseInt(sauber.slice(0, 8), 16) >>> 0,
    Number.parseInt(sauber.slice(8, 16), 16) >>> 0,
    Number.parseInt(sauber.slice(16, 24), 16) >>> 0,
    Number.parseInt(sauber.slice(24, 32), 16) >>> 0,
  ];
}

export function makeRng(seed: Seed): () => number {
  if (typeof seed === 'number') return mulberry32(seed);
  const [a, b, c, d] = worte(seed);
  const rng = sfc32(a, b, c, d);
  // sfc32 braucht einen kurzen Anlauf, sonst haengen die ersten Werte am Seed.
  for (let i = 0; i < 12; i++) rng();
  return rng;
}

/**
 * Seed fuer ein einzelnes Geben aus dem geheimen Partie-Seed.
 *
 * Der Zaehler unterscheidet die Gaben; die Basis bleibt geheim. Wer einen
 * abgeleiteten Seed erraet, lernt daraus nichts ueber die anderen Gaben,
 * weil er dafuer die 128-Bit-Basis braeuchte.
 */
export function dealSeed(basis: string, zaehler: number): string {
  const [a, b, c, d] = worte(basis);
  const rng = sfc32(a ^ (zaehler + 1), b ^ ((zaehler + 1) * 0x9e3779b1), c, d);
  for (let i = 0; i < 20; i++) rng();
  let hex = '';
  for (let i = 0; i < 4; i++) {
    hex += Math.floor(rng() * 4294967296)
      .toString(16)
      .padStart(8, '0');
  }
  return hex;
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface Deal {
  /** Haende der vier aktiven Spieler, Index = Sitzplatz am Spieltisch. */
  readonly hands: readonly (readonly Card[])[];
}

/**
 * Verteilt an genau vier aktive Spieler. Bei 5er-Tischen setzt der Geber aus;
 * die Auswahl der aktiven Sitze passiert eine Ebene hoeher.
 */
export function deal(rs: RuleSet, seed: Seed): Deal {
  const deck = createDeck(rs.deck);
  const shuffled = shuffle(deck, makeRng(seed));
  const perHand = deck.length / 4;
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < shuffled.length; i++) {
    hands[Math.floor(i / perHand)].push(shuffled[i]);
  }
  return { hands };
}
