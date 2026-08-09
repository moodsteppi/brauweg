/**
 * Kartenmodell.
 *
 * 52 Karten, ein franzoesisches Blatt ohne Joker. Anders als bei Stichspielen
 * gibt es hier keine Farbrangfolge - eine Karte ist nur so viel wert, wie sie
 * am Ende Punkte kostet. Und weniger ist besser.
 *
 * Die eine Ausnahme, die das ganze Spiel traegt: Der ROTE Koenig zaehlt null.
 * Er ist damit die beste Karte im Blatt, waehrend der schwarze mit dreizehn
 * die schlechteste ist. Zwei Karten mit demselben Rang und voellig
 * gegensaetzlichem Wert - wer sie verwechselt, verliert die Runde.
 */

/** Farben des Blatts: Kreuz, Pik, Herz, Karo. */
export type Suit = 'C' | 'S' | 'H' | 'D';

export const SUITS: readonly Suit[] = ['C', 'S', 'H', 'D'];

export interface Card {
  readonly suit: Suit;
  /** '1' (Ass) bis '13' (Koenig). */
  readonly rank: string;
  /** Laufende Nummer im ungemischten Deck. Aktionen zeigen nur hierauf. */
  readonly id: number;
}

export const DECK_SIZE = 52;

/** Rot sind Herz und Karo. Entscheidet beim Koenig ueber 0 oder 13 Punkte. */
export function isRed(card: Card): boolean {
  return card.suit === 'H' || card.suit === 'D';
}

export function isKing(card: Card): boolean {
  return card.rank === '13';
}

/**
 * Punktwert einer Karte.
 *
 * `redKingZero` kommt aus dem Regelsatz und nicht aus der Karte: Ohne die
 * Hausregel ist auch der rote Koenig dreizehn wert, und dann ist es ein
 * anderes, deutlich flacheres Spiel.
 */
export function points(card: Card, redKingZero: boolean): number {
  if (redKingZero && isKing(card) && isRed(card)) return 0;
  return Number(card.rank);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank: String(rank), id: id++ });
    }
  }
  return deck;
}

export function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

// ---------------------------------------------------------------------------
// Aktionskarten
// ---------------------------------------------------------------------------

/**
 * Was eine Karte ausloest, wenn sie GEZOGEN und dann ABGEWORFEN wird.
 *
 * Beim Nehmen vom Ablagestapel loest nichts aus - sonst liesse sich dieselbe
 * Aktion beliebig oft wiederholen, indem man die Karte immer wieder aufnimmt
 * und ablegt.
 */
export type ActionKind = 'peekOwn' | 'peekOther' | 'blindSwap' | 'lookAndSwap';

/**
 * Aktion einer Karte, unabhaengig vom Regelsatz. Ob sie auch WIRKT, entscheidet
 * `effectOf` - der Regelsatz kann jede einzeln abschalten.
 */
export function actionOf(card: Card): ActionKind | null {
  switch (card.rank) {
    case '7':
    case '8':
      return 'peekOwn';
    case '9':
    case '10':
      return 'peekOther';
    case '11':
      return 'blindSwap';
    case '12':
      return 'lookAndSwap';
    default:
      return null;
  }
}
