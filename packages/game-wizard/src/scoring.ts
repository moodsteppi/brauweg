/**
 * Wertung einer Runde.
 *
 * Getroffen: 20 + 10 je gemachtem Stich. Daneben: -10 je Stich Abweichung.
 * Punkte werden negativ, und das ist kein Sonderfall, sondern der
 * Normalzustand einer schlechten Runde.
 *
 * Fuer die Plattform zaehlt am Ende nur die Platzierung, nie die Punktzahl.
 * Genau deshalb darf die Wertung hier hausregelabhaengig sein, ohne dass die
 * spieluebergreifende Rangliste davon etwas mitbekommt.
 */

import type { RuleSet } from './ruleset.js';

export const HIT_BASE = 20;
export const PER_TRICK = 10;
export const MISS_PER_TRICK = -10;

export interface RoundResult {
  /** Ansage je Sitz. */
  readonly bids: Readonly<Record<number, number>>;
  /** Gemachte Stiche je Sitz. */
  readonly tricks: Readonly<Record<number, number>>;
  /** Punkte dieser Runde je Sitz. */
  readonly scores: Readonly<Record<number, number>>;
}

/**
 * Punkte eines Sitzes.
 *
 * `roundNumber` ist 1-basiert und wird nur fuer den Null-Bonus gebraucht: Eine
 * gehaltene Null in Runde 12 ist die schwerere Leistung als in Runde 1.
 */
export function scoreFor(
  bid: number,
  tricks: number,
  roundNumber: number,
  rs: RuleSet,
): number {
  if (bid !== tricks) return MISS_PER_TRICK * Math.abs(bid - tricks);
  if (bid === 0 && rs.zeroBonus) return PER_TRICK * roundNumber;
  return HIT_BASE + PER_TRICK * tricks;
}

export function scoreRound(
  seats: readonly number[],
  bids: Readonly<Record<number, number>>,
  tricks: Readonly<Record<number, number>>,
  roundNumber: number,
  rs: RuleSet,
): RoundResult {
  const scores: Record<number, number> = {};
  for (const seat of seats) {
    scores[seat] = scoreFor(bids[seat] ?? 0, tricks[seat] ?? 0, roundNumber, rs);
  }
  return { bids, tricks, scores };
}
