/**
 * Kartenblaetter.
 *
 * Ein Blatt ist reine Darstellung. Der Server speichert nur die Kennung, hier
 * steht, wie sie aussieht — Bilder liegen unter `public/karten/<kennung>/`.
 *
 * `text` ist die Vorgabe und bleibt vollwertig: Es laedt nichts nach, bleibt
 * auf schmaler Leitung sofort da und ist auf kleinen Bildschirmen die
 * kompakteste Darstellung. Die Bildblaetter sind eine Wahl, kein Ersatz.
 *
 * Die Dateinamen sind deutsch (`kreuz_9`, `herz_b`), das Protokoll benennt
 * Karten englisch (`H`/`J`). Die Uebersetzung passiert genau hier, damit sie
 * nur an einer Stelle steht.
 */

export type DeckId = 'text' | 'minimal2' | 'minimal4' | 'klassisch';

export interface Deck {
  readonly id: DeckId;
  readonly nameKey: string;
  readonly hintKey: string;
  /** Ohne Verzeichnis wird der Kartenname gesetzt statt ein Bild geladen. */
  readonly dir?: string;
  readonly ext?: 'svg' | 'png';
}

export const DECKS: readonly Deck[] = [
  { id: 'text', nameKey: 'deck.text', hintKey: 'deck.text.hint' },
  {
    id: 'minimal2',
    nameKey: 'deck.minimal2',
    hintKey: 'deck.minimal2.hint',
    dir: 'minimal2',
    ext: 'svg',
  },
  {
    id: 'minimal4',
    nameKey: 'deck.minimal4',
    hintKey: 'deck.minimal4.hint',
    dir: 'minimal4',
    ext: 'svg',
  },
  {
    id: 'klassisch',
    nameKey: 'deck.klassisch',
    hintKey: 'deck.klassisch.hint',
    dir: 'klassisch',
    ext: 'png',
  },
];

export const DEFAULT_DECK: DeckId = 'text';

export function deckById(id: string | null | undefined): Deck {
  return DECKS.find((deck) => deck.id === id) ?? DECKS[0]!;
}

const SUIT_DIR: Record<string, string> = { C: 'kreuz', S: 'pik', H: 'herz', D: 'karo' };
const RANK_DIR: Record<string, string> = {
  '9': '9',
  T: '10',
  J: 'b',
  Q: 'd',
  K: 'k',
  A: 'a',
};

/** Null, wenn das Blatt ohne Bilder auskommt oder die Karte unbekannt ist. */
export function cardImage(deck: Deck, card: { suit: string; rank: string }): string | null {
  if (!deck.dir) return null;
  const suit = SUIT_DIR[card.suit];
  const rank = RANK_DIR[card.rank];
  // Ein spaeteres Spiel kann Farben oder Raenge mitbringen, fuer die es hier
  // kein Bild gibt. Dann faellt die Karte auf die Textdarstellung zurueck,
  // statt ein kaputtes Bild zu zeigen.
  if (!suit || !rank) return null;
  return `/karten/${deck.dir}/${suit}_${rank}.${deck.ext}`;
}

export function deckBack(deck: Deck): string | null {
  return deck.dir ? `/karten/${deck.dir}/ruecken.${deck.ext}` : null;
}
