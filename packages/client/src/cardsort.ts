/**
 * Sichtbare Reihenfolge der Handkarten.
 *
 * Die Staerke liefert die Engine als `order` mit der Sicht (Truempfe und je
 * Fehlfarbe stark nach schwach). Hier wird die Hand allein danach sortiert —
 * staerkste Karte zuerst, also am Tisch spaeter ganz links. Das ist reine
 * Darstellung: Welche Karte welche schlaegt, entscheidet der Server, nie der
 * Client. Und weil ein Solo `order` aendert, ordnet sich die Hand von selbst
 * neu, ohne dass diese Datei ueberhaupt weiss, was ein Solo ist.
 */

import type { Card } from './protocol';

/** Teilmenge von RoundView.order, die fuer die Sortierung reicht. */
type CardOrder = { trumps: string[]; fehl?: Record<string, string[]> };

/** Reihenfolge der Fehlfarben untereinander, nur fuer eine stabile Anzeige. */
const SUIT_SEQUENCE = ['C', 'S', 'H', 'D'];

function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

/** Kleinere Zahl = staerker = weiter links. */
function rankOf(card: Card, order: CardOrder): number {
  const key = cardKey(card);

  const trumpIndex = order.trumps.indexOf(key);
  if (trumpIndex !== -1) return trumpIndex;

  // Keine Trumpfkarte: hinter alle Truempfe, dann nach Fehlfarbe gruppiert.
  let base = order.trumps.length;
  for (const suit of SUIT_SEQUENCE) {
    const list = order.fehl?.[suit] ?? [];
    if (suit === card.suit) {
      const within = list.indexOf(key);
      return base + (within === -1 ? 900 : within);
    }
    base += list.length;
  }
  return base + 900;
}

export function sortByOrder(hand: readonly Card[], order?: CardOrder): Card[] {
  if (!order) return [...hand];
  return [...hand].sort((a, b) => rankOf(a, order) - rankOf(b, order));
}
