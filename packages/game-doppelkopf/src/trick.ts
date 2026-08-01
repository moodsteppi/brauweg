/**
 * Stichauswertung.
 *
 * Standardregel: Bei zwei gleichwertigen Karten gewinnt die zuerst gespielte.
 * Ausnahme ist die schaltbare Regel "Zweite Dulle sticht Erste", die
 * ausschliesslich fuer die Herz-Zehn gilt.
 */

import { type Card, isDulle, sumValues } from './cards.js';
import { type CardOrder, isTrump, servingSuit, strength } from './order.js';

export interface PlayedCard {
  readonly card: Card;
  /** Sitzplatz des Spielers, der die Karte gelegt hat. */
  readonly seat: number;
}

export interface TrickResult {
  readonly winnerSeat: number;
  readonly winningIndex: number;
  readonly points: number;
}

export function resolveTrick(
  played: readonly PlayedCard[],
  order: CardOrder,
  opts: { secondDulleBeatsFirst: boolean },
): TrickResult {
  if (played.length === 0) throw new Error('Leerer Stich');

  const lead = servingSuit(played[0].card, order);

  let bestIndex = 0;
  let bestStrength = strength(played[0].card, order, lead);

  for (let i = 1; i < played.length; i++) {
    const s = strength(played[i].card, order, lead);
    if (s > bestStrength) {
      bestIndex = i;
      bestStrength = s;
      continue;
    }
    // Gleichstand: normalerweise gewinnt die erste Karte.
    if (s === bestStrength && s > 0) {
      const isDulleDuel =
        isDulle(played[i].card) &&
        isDulle(played[bestIndex].card) &&
        isTrump(played[i].card, order);
      if (isDulleDuel && opts.secondDulleBeatsFirst) {
        bestIndex = i;
      }
    }
  }

  return {
    winnerSeat: played[bestIndex].seat,
    winningIndex: bestIndex,
    points: sumValues(played.map((p) => p.card)),
  };
}
