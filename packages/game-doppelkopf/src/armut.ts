/**
 * Armut (Trumpfabgabe).
 *
 * Ansagbar mit hoechstens drei Truempfen. Der Ansager gibt ALLE seine Truempfe
 * ab; hat er keinen, gibt er drei beliebige Karten. Der annehmende Partner gibt
 * genauso viele Karten seiner Wahl zurueck. Optional wird oeffentlich angesagt,
 * wie viele Truempfe dabei zurueckkamen.
 *
 * Angenommen wird von dem Spieler, der zuerst annimmt. Nimmt niemand an, wird
 * neu gegeben.
 */

import type { Card } from './cards.js';
import { type CardOrder, isTrump } from './order.js';

export const ARMUT_MAX_TRUMPS = 3;
/** Abgabegroesse, wenn der Ansager gar keinen Trumpf hat. */
export const ARMUT_FALLBACK_CARDS = 3;

export function countTrumps(hand: readonly Card[], order: CardOrder): number {
  return hand.filter((c) => isTrump(c, order)).length;
}

export function canAnnounceArmut(
  hand: readonly Card[],
  order: CardOrder,
): boolean {
  return countTrumps(hand, order) <= ARMUT_MAX_TRUMPS;
}

/** Wie viele Karten der Ansager abgibt. */
export function handoverSize(hand: readonly Card[], order: CardOrder): number {
  const t = countTrumps(hand, order);
  return t === 0 ? ARMUT_FALLBACK_CARDS : t;
}

/**
 * Die abzugebenden Karten. Bei vorhandenen Truempfen sind das zwingend ALLE
 * Truempfe; ohne Trumpf waehlt der Ansager drei Karten frei.
 */
export function handoverCards(
  hand: readonly Card[],
  order: CardOrder,
  freeChoice: readonly Card[] = [],
): Card[] {
  const trumps = hand.filter((c) => isTrump(c, order));
  if (trumps.length > 0) return trumps;

  if (freeChoice.length !== ARMUT_FALLBACK_CARDS) {
    throw new Error(
      `Ohne Trumpf muessen genau ${ARMUT_FALLBACK_CARDS} Karten gewaehlt werden`,
    );
  }
  return [...freeChoice];
}

export interface ArmutExchange {
  readonly given: readonly Card[];
  readonly returned: readonly Card[];
  /** Anzahl Truempfe in der Rueckgabe, nur relevant bei aktivierter Ansage. */
  readonly returnedTrumps: number;
}

export function exchange(
  given: readonly Card[],
  returned: readonly Card[],
  order: CardOrder,
): ArmutExchange {
  if (given.length !== returned.length) {
    throw new Error('Rueckgabe muss genauso viele Karten umfassen wie die Abgabe');
  }
  return {
    given,
    returned,
    returnedTrumps: returned.filter((c) => isTrump(c, order)).length,
  };
}

export type ArmutResult =
  | { readonly kind: 'accepted'; readonly partnerSeat: number }
  | { readonly kind: 'redeal' };

/** Es nimmt an, wer zuerst annimmt. Meldet sich niemand, wird neu gegeben. */
export function resolveAcceptance(
  acceptancesInOrder: readonly number[],
): ArmutResult {
  return acceptancesInOrder.length > 0
    ? { kind: 'accepted', partnerSeat: acceptancesInOrder[0] }
    : { kind: 'redeal' };
}
