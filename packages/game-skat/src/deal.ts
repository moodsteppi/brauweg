/**
 * Geben.
 *
 * Deterministisch aus einem Seed, damit jede Partie reproduzierbar ist
 * (Tests, Nachspielen, Fehlerberichte). Der Zufallsgenerator steht — wie in
 * jedem Spielmodul — hier noch einmal fuer sich: Ein Modul haengt an keinem
 * anderen, sonst aenderte eine Verbesserung anderswo die Gaben und alte
 * Partien liessen sich nicht mehr nachspielen.
 *
 * Drei Haende zu je zehn Karten, zwei bleiben im Skat.
 */

import { type Card, createDeck } from './cards.js';

export type Seed = number | string;

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
  for (let i = 0; i < 12; i++) rng();
  return rng;
}

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
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface SkatDeal {
  /** Drei Haende zu je zehn Karten, in Sitzreihenfolge 0..2. */
  readonly hands: readonly (readonly Card[])[];
  /** Die beiden Karten im Skat. */
  readonly skat: readonly Card[];
}

export function deal(seed: Seed): SkatDeal {
  const g = shuffle(createDeck(), makeRng(seed));
  return {
    hands: [g.slice(0, 10), g.slice(10, 20), g.slice(20, 30)],
    skat: g.slice(30, 32),
  };
}
