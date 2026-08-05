/**
 * Kartenmodell.
 *
 * 60 Karten, jede genau einmal: vier Farben zu je dreizehn Werten, dazu vier
 * Zauberer und vier Narren. Dass es 60 sind, ist keine Laune - die Zahl ist
 * durch 3, 4, 5 und 6 teilbar, und genau daraus ergibt sich die Rundenzahl
 * einer Partie (60 / Spielerzahl). In der letzten Runde ist der Stapel leer.
 *
 * Zauberer und Narren tragen einen Rang von '1' bis '4', obwohl er fuer die
 * Regeln bedeutungslos ist: Es gewinnt der ZUERST gespielte Zauberer, nie der
 * hoechste. Der Rang unterscheidet nur die vier gemalten Motive. Wer aus ihm
 * eine Staerke ableitet, hat einen Fehler gebaut.
 */

/** Farben des Blatts: Kreuz, Pik, Herz, Karo. */
export type Suit = 'C' | 'S' | 'H' | 'D';

/** Zauberer und Narr stehen ausserhalb der Farben. */
export type SpecialSuit = 'Z' | 'N';

export type CardSuit = Suit | SpecialSuit;

export interface Card {
  readonly suit: CardSuit;
  /** '1'..'13' bei Farbkarten, '1'..'4' bei Zauberern und Narren. */
  readonly rank: string;
  /** Laufende Nummer im ungemischten Deck. Aktionen zeigen nur hierauf. */
  readonly id: number;
}

export const SUITS: readonly Suit[] = ['C', 'S', 'H', 'D'];

export const DECK_SIZE = 60;

/** Wie viele Runden eine volle Partie hat: das ganze Blatt, restlos verteilt. */
export function fullRounds(seats: number): number {
  return Math.floor(DECK_SIZE / seats);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let value = 1; value <= 13; value++) {
      deck.push({ suit, rank: String(value), id: id++ });
    }
  }
  for (let n = 1; n <= 4; n++) deck.push({ suit: 'Z', rank: String(n), id: id++ });
  for (let n = 1; n <= 4; n++) deck.push({ suit: 'N', rank: String(n), id: id++ });
  return deck;
}

export const isWizard = (card: Card): boolean => card.suit === 'Z';
export const isJester = (card: Card): boolean => card.suit === 'N';

/** Farbkarte, also weder Zauberer noch Narr. */
export function isSuitCard(card: Card): card is Card & { suit: Suit } {
  return card.suit !== 'Z' && card.suit !== 'N';
}

/** Zahlenwert einer Farbkarte; Zauberer und Narren haben keinen. */
export function value(card: Card): number {
  return isSuitCard(card) ? Number(card.rank) : 0;
}

export function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

export function isSuit(value: string): value is Suit {
  return value === 'C' || value === 'S' || value === 'H' || value === 'D';
}
