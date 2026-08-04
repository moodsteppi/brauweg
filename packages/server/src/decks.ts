/**
 * Zulaessige Kartenblaetter.
 *
 * Wie ein Blatt aussieht, ist ausschliesslich Sache des Clients — die Bilder
 * liegen dort, die Namen stehen dort im Woerterbuch. Der Server kennt nur die
 * Kennungen, und zwar aus einem einzigen Grund: Eine Einstellung, die
 * ungeprueft aus dem Netz in die Datenbank wandert, ist keine Einstellung,
 * sondern ein Freitextfeld.
 *
 * `text` ist die Vorgabe und bleibt es: Es braucht keine Bilddateien und
 * funktioniert auch dort, wo die Leitung schmal ist.
 */

export const CARD_DECKS = [
  'text',
  'minimal2',
  'minimal4',
  'klassisch',
  'zauberwald',
] as const;

export type CardDeck = (typeof CARD_DECKS)[number];

export const DEFAULT_CARD_DECK: CardDeck = 'text';

/**
 * Zulaessige Kartenrueckseiten.
 *
 * Getrennt vom Blatt, weil die Rueckseite das ist, was alle am Tisch sehen —
 * die Vorderseiten sieht nur die eigene Hand. `standard` heisst: die
 * Rueckseite des gewaehlten Blattes.
 */
export const CARD_BACKS = [
  'standard',
  'eiche',
  'winterhof',
  'sommerwiese',
  'nachthimmel',
  'rubin',
  'smaragd',
  'kupferstich',
  'pinguin',
  'koeniglich',
  'schiefer',
] as const;

export type CardBack = (typeof CARD_BACKS)[number];

export const DEFAULT_CARD_BACK: CardBack = 'standard';
