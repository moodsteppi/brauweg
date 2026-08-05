/**
 * Schmeissen.
 *
 * Lusche: die Neun. Bei Scharfem Doko gibt es keine Neunen, dort gilt der
 * Koenig. Die Definition wird also aus der Blattvariante abgeleitet, genau wie
 * beim Superschwein.
 *
 * Volle: Ass und Zehn.
 *
 * Schmeissen wird als Vorbehalt in der normalen Abfrage angemeldet und steht in
 * der Rangfolge hinter dem Solo, aber vor Armut und Hochzeit.
 */

import type { Card, Rank } from './cards.js';
import type { RuleSet, SchmeissConsequence } from './ruleset.js';

/** Rang, der in dieser Blattvariante als Lusche gilt. */
export function luscheRank(rs: RuleSet): Rank {
  return rs.deck === 'with9' ? '9' : 'K';
}

export function countLuschen(hand: readonly Card[], rs: RuleSet): number {
  const r = luscheRank(rs);
  return hand.filter((c) => c.rank === r).length;
}

export function countVolle(hand: readonly Card[]): number {
  return hand.filter((c) => c.rank === 'A' || c.rank === 'T').length;
}

export const SCHMEISS_LUSCHEN_THRESHOLD = 5;
export const SCHMEISS_VOLLE_THRESHOLD = 7;

export interface SchmeissOption {
  readonly allowed: boolean;
  readonly reasons: readonly ('luschen' | 'volle')[];
  readonly luschen: number;
  readonly volle: number;
}

export function schmeissOption(
  hand: readonly Card[],
  rs: RuleSet,
): SchmeissOption {
  const luschen = countLuschen(hand, rs);
  const volle = countVolle(hand);
  const reasons: ('luschen' | 'volle')[] = [];

  if (rs.schmeiss5Luschen && luschen >= SCHMEISS_LUSCHEN_THRESHOLD) {
    reasons.push('luschen');
  }
  if (rs.schmeiss7Volle && volle >= SCHMEISS_VOLLE_THRESHOLD) {
    reasons.push('volle');
  }

  return { allowed: reasons.length > 0, reasons, luschen, volle };
}

export interface SchmeissOutcome {
  readonly redeal: true;
  readonly triggersBock: boolean;
}

export function applySchmeiss(rs: RuleSet): SchmeissOutcome {
  const consequence: SchmeissConsequence = rs.schmeissConsequence;
  return { redeal: true, triggersBock: consequence === 'redealAndBock' };
}
