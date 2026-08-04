/**
 * Rangfolge fuer die Anzeige.
 *
 * Die Engine entscheidet, was staerker ist; der Client liest es nur ab und
 * sortiert die Hand danach. Dieselbe Struktur wie beim Doppelkopf
 * (`{ trumps, fehl }`), damit `cardsort.ts` unveraendert weiterlaeuft.
 *
 * Zauberer stehen in `trumps` ganz vorn. Sie sind keine Trumpffarbe, aber sie
 * stechen alles - auch in einer Runde ganz ohne Trumpf. Am Tisch bekommen sie
 * damit denselben Balken wie Trumpfkarten, und das ist ehrlich: Was sticht,
 * ist markiert.
 *
 * Narren stehen als eigene Gruppe 'N' ganz hinten. Sie gewinnen nie.
 */

import { type Card, SUITS, type Suit, cardKey, createDeck, isSuitCard } from './cards.js';

export interface CardOrder {
  /** Staerkste zuerst: Zauberer, dann die Trumpffarbe von 13 nach 1. */
  readonly trumps: string[];
  /** Je Gruppe stark nach schwach. Enthaelt auch 'N' fuer die Narren. */
  readonly fehl: Record<string, string[]>;
}

const DECK = createDeck();

function keysOf(filter: (card: Card) => boolean): string[] {
  return DECK.filter(filter).map(cardKey);
}

/** Farbkarten einer Farbe, 13 nach 1. */
function suitKeys(suit: Suit): string[] {
  return keysOf((card) => isSuitCard(card) && card.suit === suit).reverse();
}

export function buildOrder(trump: Suit | null): CardOrder {
  const zauberer = keysOf((card) => card.suit === 'Z');
  const narren = keysOf((card) => card.suit === 'N');

  const trumps = [...zauberer, ...(trump ? suitKeys(trump) : [])];

  const fehl: Record<string, string[]> = {};
  for (const suit of SUITS) {
    if (suit === trump) continue;
    fehl[suit] = suitKeys(suit);
  }
  fehl.N = narren;

  return { trumps, fehl };
}
