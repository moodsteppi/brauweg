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

export type DeckId =
  | 'text'
  | 'minimal2'
  | 'minimal4'
  | 'klassisch'
  | 'eiche'
  | 'winterhof'
  | 'sommerwiese'
  | 'nachthimmel'
  | 'rubin'
  | 'smaragd'
  | 'kupferstich'
  | 'koeniglich'
  | 'schiefer'
  | 'pinguin'
  | 'zauberwald';

export interface Deck {
  readonly id: DeckId;
  readonly nameKey: string;
  readonly hintKey: string;
  /** Ohne Verzeichnis wird der Kartenname gesetzt statt ein Bild geladen. */
  readonly dir?: string;
  readonly ext?: 'svg' | 'png' | 'webp';
  /**
   * Spiele, zu denen dieses Blatt passt. Fehlt die Angabe, passt es ueberall.
   *
   * Notwendig, seit es zwei Blattarten gibt: Ein Zauberblatt hat keine Karte
   * fuer Bube, Dame und Koenig, ein Doppelkopfblatt keine fuer die Zwei bis
   * Acht. Wer das falsche waehlt, saesse vor lauter kaputten Bildern.
   */
  readonly games?: readonly string[];
  /**
   * Die App zeichnet die Ecken-Anzeige (Wert + Farbe) selbst als Chip, statt
   * sie im Bild zu erwarten. Fuer das Zauberwald-Blatt: dort liegt ein flaches
   * weisses Kaestchen im Bild, das der Chip verdeckt; auf spaeteren
   * kaestchenfreien Bildern sitzt derselbe Chip einfach auf der Malerei.
   */
  readonly eigeneEcke?: boolean;
  /**
   * Abweichende Rueckseite, ueberschreibt die des Blattes.
   *
   * Steht am Deck-Objekt und nicht als zweiter Prop an jeder Karte: Die
   * Rueckseite wird an einem halben Dutzend Stellen gezeichnet (Haende der
   * Gegner, Austeilzeremonie, Zaubertisch), und jede einzelne haette sonst
   * einen weiteren Durchreiche-Prop bekommen.
   */
  readonly backSrc?: string;
}

export const DECKS: readonly Deck[] = [
  { id: 'text', nameKey: 'deck.text', hintKey: 'deck.text.hint' },
  // Die beiden Minimal-Blaetter haben nur Neun bis Ass - ein Doppelkopfblatt.
  {
    id: 'minimal2',
    nameKey: 'deck.minimal2',
    hintKey: 'deck.minimal2.hint',
    dir: 'minimal2',
    ext: 'svg',
    games: ['doppelkopf'],
  },
  {
    id: 'minimal4',
    nameKey: 'deck.minimal4',
    hintKey: 'deck.minimal4.hint',
    dir: 'minimal4',
    ext: 'svg',
    games: ['doppelkopf'],
  },
  {
    id: 'klassisch',
    nameKey: 'deck.klassisch',
    hintKey: 'deck.klassisch.hint',
    dir: 'klassisch',
    ext: 'png',
    // Kein Zauberblatt: keine Karte fuer Eins bis Acht, kein Zauberer, kein Narr.
    games: ['doppelkopf'],
  },
  {
    id: 'eiche',
    nameKey: 'deck.eiche',
    hintKey: 'deck.eiche.hint',
    dir: 'eiche',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'winterhof',
    nameKey: 'deck.winterhof',
    hintKey: 'deck.winterhof.hint',
    dir: 'winterhof',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'sommerwiese',
    nameKey: 'deck.sommerwiese',
    hintKey: 'deck.sommerwiese.hint',
    dir: 'sommerwiese',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'nachthimmel',
    nameKey: 'deck.nachthimmel',
    hintKey: 'deck.nachthimmel.hint',
    dir: 'nachthimmel',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'rubin',
    nameKey: 'deck.rubin',
    hintKey: 'deck.rubin.hint',
    dir: 'rubin',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'smaragd',
    nameKey: 'deck.smaragd',
    hintKey: 'deck.smaragd.hint',
    dir: 'smaragd',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'kupferstich',
    nameKey: 'deck.kupferstich',
    hintKey: 'deck.kupferstich.hint',
    dir: 'kupferstich',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'koeniglich',
    nameKey: 'deck.koeniglich',
    hintKey: 'deck.koeniglich.hint',
    dir: 'koeniglich',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'schiefer',
    nameKey: 'deck.schiefer',
    hintKey: 'deck.schiefer.hint',
    dir: 'schiefer',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'pinguin',
    nameKey: 'deck.pinguin',
    hintKey: 'deck.pinguin.hint',
    dir: 'pinguin',
    ext: 'webp',
    // Doppelkopfblatt: Neun bis Ass, keine Karte fuer Zwei bis Acht.
    games: ['doppelkopf'],
  },
  {
    id: 'zauberwald',
    nameKey: 'deck.zauberwald',
    hintKey: 'deck.zauberwald.hint',
    dir: 'zauberwald',
    ext: 'webp',
    games: ['wizard'],
    eigeneEcke: true,
  },
];

export const DEFAULT_DECK: DeckId = 'text';

export function deckById(id: string | null | undefined): Deck {
  return DECKS.find((deck) => deck.id === id) ?? DECKS[0]!;
}

/** Blaetter, die zu diesem Spiel passen. Das Textblatt passt immer. */
export function decksFor(gameId: string): Deck[] {
  return DECKS.filter((deck) => !deck.games || deck.games.includes(gameId));
}

/**
 * Blatt fuer einen Tisch dieses Spiels.
 *
 * Faellt auf Text zurueck, wenn das gespeicherte Blatt nicht zum Spiel passt.
 * Der Fall ist selten, aber real: Ein Konto kann ein Blatt gespeichert haben,
 * bevor es die Zuordnung gab, und die Einstellung geht auch ueber die API. Ein
 * Tisch voller kaputter Bilder waere die schlechteste aller Antworten.
 */
export function deckForGame(gameId: string, id: string | null | undefined): Deck {
  const deck = deckById(id);
  return !deck.games || deck.games.includes(gameId) ? deck : DECKS[0]!;
}

const SUIT_DIR: Record<string, string> = {
  C: 'kreuz',
  S: 'pik',
  H: 'herz',
  D: 'karo',
  // Zauberer und Narr haben keine Farbe; ihr Name IST das Verzeichnisstueck.
  Z: 'zauberer',
  N: 'narr',
};
const RANK_DIR: Record<string, string> = {
  '9': '9',
  T: '10',
  J: 'b',
  Q: 'd',
  K: 'k',
  A: 'a',
};

// Zahlenwerte 1 bis 13 heissen im Dateinamen wie im Protokoll. Sie stehen
// hier zusaetzlich, damit die Tabelle die einzige Wahrheit bleibt.
for (let wert = 1; wert <= 13; wert++) RANK_DIR[String(wert)] = String(wert);

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
  if (deck.backSrc) return deck.backSrc;
  return deck.dir ? `/karten/${deck.dir}/ruecken.${deck.ext}` : null;
}

/**
 * Kartenrueckseiten, getrennt vom Blatt.
 *
 * Die Rueckseite ist das, was alle am Tisch sehen; die Vorderseiten sieht
 * nur die eigene Hand. Wer eine schoene Rueckseite kauft, will sie herzeigen,
 * ohne dafuer sein gewohntes Blatt aufzugeben — deshalb ist das ein eigener
 * Schalter und keine Eigenschaft des Blattes.
 *
 * `standard` heisst: die Rueckseite des gewaehlten Blattes.
 */
export interface Ruecken {
  readonly id: string;
  readonly name: string;
}

export const RUECKEN: readonly Ruecken[] = [
  { id: 'standard', name: 'Zum Blatt passend' },
  { id: 'eiche', name: 'Eiche' },
  { id: 'winterhof', name: 'Winterhof' },
  { id: 'sommerwiese', name: 'Sommerwiese' },
  { id: 'nachthimmel', name: 'Nachthimmel' },
  { id: 'rubin', name: 'Rubin' },
  { id: 'smaragd', name: 'Smaragd' },
  { id: 'kupferstich', name: 'Kupferstich' },
  { id: 'koeniglich', name: 'Königlich' },
  { id: 'schiefer', name: 'Schiefer' },
  { id: 'pinguin', name: 'Pinguin' },
];

export const STANDARD_RUECKEN = 'standard';

/**
 * Bild der gewaehlten Rueckseite, oder null fuer "zum Blatt passend".
 *
 * Null heisst nicht "kein Bild": Der Aufrufer faellt dann auf `deckBack`
 * zurueck, und beim Textblatt auf das gezeichnete Muster.
 */
export function rueckenBild(id: string | null | undefined): string | null {
  if (!id || id === STANDARD_RUECKEN) return null;
  return RUECKEN.some((r) => r.id === id) ? `/karten/${id}/ruecken.png` : null;
}

/**
 * Blatt mit der gewaehlten Rueckseite.
 *
 * Bei `standard` kommt dasselbe Objekt zurueck — dann aendert sich nichts,
 * und React rendert nicht unnoetig neu.
 */
export function deckMitRuecken(deck: Deck, ruecken: string | null | undefined): Deck {
  const src = rueckenBild(ruecken);
  return src ? { ...deck, backSrc: src } : deck;
}
