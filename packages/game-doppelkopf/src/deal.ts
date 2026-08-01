/**
 * Geben.
 *
 * Deterministisch aus einem Seed. Die Engine wuerfelt nichts selbst, damit
 * jede Runde exakt reproduzierbar ist (Tests, Nachspielen, Fehlerberichte).
 */

import { type Card, createDeck } from './cards.js';
import type { RuleSet } from './ruleset.js';

/** mulberry32, klein und ausreichend fuer Kartenmischen. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
export function deal(rs: RuleSet, seed: number): Deal {
  const deck = createDeck(rs.deck);
  const shuffled = shuffle(deck, makeRng(seed));
  const perHand = deck.length / 4;
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < shuffled.length; i++) {
    hands[Math.floor(i / perHand)].push(shuffled[i]);
  }
  return { hands };
}
