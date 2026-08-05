/**
 * Kartenmodell.
 *
 * Eine Karte ist ein reiner Wert (Farbe + Rang). Da im Doppelkopf jede Karte
 * doppelt vorkommt, tragen die Instanzen im Deck zusaetzlich eine laufende id,
 * damit einzelne Exemplare unterscheidbar bleiben (z.B. erste/zweite Dulle).
 */

export type Suit = 'C' | 'S' | 'H' | 'D'; // Kreuz, Pik, Herz, Karo
export type Rank = '9' | 'K' | 'Q' | 'J' | 'A' | 'T'; // T = Zehn

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
  /** Laufende Nummer im Deck, unterscheidet die beiden Exemplare. */
  readonly id: number;
}

export const SUITS: readonly Suit[] = ['C', 'S', 'H', 'D'];

/** Augenwerte. Summe ueber das gesamte Deck ist in beiden Blattvarianten 240. */
export const CARD_VALUE: Record<Rank, number> = {
  A: 11,
  T: 10,
  K: 4,
  Q: 3,
  J: 2,
  '9': 0,
};

export type DeckVariant = 'with9' | 'without9';

const RANKS_WITH_9: readonly Rank[] = ['9', 'J', 'Q', 'K', 'T', 'A'];
const RANKS_WITHOUT_9: readonly Rank[] = ['J', 'Q', 'K', 'T', 'A'];

/** Erzeugt ein vollstaendiges, ungemischtes Deck (48 bzw. 40 Karten). */
export function createDeck(variant: DeckVariant): Card[] {
  const ranks = variant === 'with9' ? RANKS_WITH_9 : RANKS_WITHOUT_9;
  const deck: Card[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ suit, rank, id: id++ });
      deck.push({ suit, rank, id: id++ });
    }
  }
  return deck;
}

export function cardValue(card: Card): number {
  return CARD_VALUE[card.rank];
}

export function sumValues(cards: readonly Card[]): number {
  return cards.reduce((acc, c) => acc + cardValue(c), 0);
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

export function formatCard(card: Card): string {
  return cardKey(card);
}

// Haeufig gebrauchte Einzelkarten als Praedikate.
export const isDulle = (c: Card) => c.suit === 'H' && c.rank === 'T';
export const isFuchs = (c: Card) => c.suit === 'D' && c.rank === 'A';
export const isCharlie = (c: Card) => c.suit === 'C' && c.rank === 'J';
export const isClubQueen = (c: Card) => c.suit === 'C' && c.rank === 'Q';
