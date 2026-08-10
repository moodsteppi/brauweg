/**
 * Kartenmodell fuer Skat.
 *
 * 32 Karten: vier Farben zu je acht Werten (Sieben bis Ass). Kein Zufall und
 * keine Uhr hier drin — eine reine Bibliothek, wie jedes Spielmodul.
 *
 * Die Augen (Kartenpunkte) sind der Kern der Wertung und stehen deshalb an
 * der Karte selbst: Ass 11, Zehn 10, Koenig 4, Dame 3, Bube 2, der Rest null.
 * Alle 32 zusammen ergeben 120 Augen — die Zahl, gegen die 61 „gewonnen" und
 * 30 „Schneider" gemessen werden.
 */

/** Farben: Kreuz, Pik, Herz, Karo. Reihenfolge ist die Trumpfstaerke der Buben. */
export type Suit = 'C' | 'S' | 'H' | 'D';

/**
 * Werte. `T` ist die Zehn (nicht `10`, damit der Dateiname und der Schluessel
 * einstellig bleiben wie beim Doppelkopf-Modul). `J` ist der Bube, `Q` die
 * Dame, `K` der Koenig, `A` das Ass.
 */
export type Rank = '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
  /** Laufende Nummer im ungemischten Blatt. Aktionen zeigen nur hierauf. */
  readonly id: number;
}

export const SUITS: readonly Suit[] = ['C', 'S', 'H', 'D'];
export const RANKS: readonly Rank[] = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const DECK_SIZE = 32;

/** Augen (Kartenpunkte) je Wert. Zusammen ueber das ganze Blatt: 120. */
export function augen(card: Card): number {
  switch (card.rank) {
    case 'A':
      return 11;
    case 'T':
      return 10;
    case 'K':
      return 4;
    case 'Q':
      return 3;
    case 'J':
      return 2;
    default:
      return 0;
  }
}

/** Summe der Augen einer Kartenmenge. */
export function sumAugen(cards: readonly Card[]): number {
  return cards.reduce((s, c) => s + augen(c), 0);
}

export const isJack = (card: Card): boolean => card.rank === 'J';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: id++ });
    }
  }
  return deck;
}

export function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

/** Karte aus einem Schluessel wie `CA` (Kreuz-Ass). Fuer Tests und Ansichten. */
export function cardFromKey(key: string, deck: readonly Card[]): Card | undefined {
  return deck.find((c) => cardKey(c) === key);
}
