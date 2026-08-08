/**
 * Abrechnung einer Runde.
 *
 * Jeder bekommt die Summe seiner vier Karten - WENIG IST GUT. Das dreht die
 * uebliche Richtung um und ist die haeufigste Fehlerquelle beim Anschliessen
 * an die Plattform: `standings` muss aufsteigend sortieren, nicht absteigend.
 *
 * Die einzige Sonderregel ist der Ruf. Sie ist der Grund, warum das Spiel
 * ueberhaupt eine Entscheidung enthaelt: Cambio zu rufen lohnt nur, wenn man
 * wirklich vorn liegt.
 */

import { type Card, points } from './cards.js';
import type { RuleSet } from './ruleset.js';

export interface RoundResult {
  /** Summe der Handkarten je Sitz, vor der Rufer-Sonderregel. */
  readonly raw: Readonly<Record<number, number>>;
  /** Punkte dieser Runde je Sitz, nach der Sonderregel. */
  readonly scores: Readonly<Record<number, number>>;
  readonly caller: number | null;
  /** Ob der Ruf aufging. Null, wenn niemand gerufen hat. */
  readonly callSucceeded: boolean | null;
  /** Aufgedeckte Haende - nach dem Ende darf jeder alles sehen. */
  readonly hands: Readonly<Record<number, readonly Card[]>>;
}

export function handValue(hand: readonly Card[], rs: RuleSet): number {
  return hand.reduce((summe, card) => summe + points(card, rs.redKingZero), 0);
}

export function scoreRound(
  rs: RuleSet,
  seats: readonly number[],
  hands: Readonly<Record<number, readonly Card[]>>,
  caller: number | null,
): RoundResult {
  const raw: Record<number, number> = {};
  for (const seat of seats) raw[seat] = handValue(hands[seat] ?? [], rs);

  const scores: Record<number, number> = { ...raw };
  let callSucceeded: boolean | null = null;

  if (caller !== null) {
    const eigene = raw[caller] ?? 0;
    const andere = seats.filter((seat) => seat !== caller).map((seat) => raw[seat] ?? 0);
    // Ohne Mitspieler gibt es nichts zu unterbieten - dann gilt der Ruf.
    const bestesAnderes = andere.length > 0 ? Math.min(...andere) : Number.POSITIVE_INFINITY;

    callSucceeded = rs.callerMustBeStrictlyLower
      ? eigene < bestesAnderes
      : eigene <= bestesAnderes;

    scores[caller] = callSucceeded ? 0 : eigene + rs.failPenalty;
  }

  return { raw, scores, caller, callSucceeded, hands };
}
