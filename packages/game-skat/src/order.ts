/**
 * Kartenordnung und Stichlogik — das Herz der Regelkorrektheit.
 *
 * Skat kennt drei Ordnungsfamilien:
 *
 *  - **Farbspiel** (`suit`): Die vier Buben sind die hoechsten Truempfe, in
 *    der Reihenfolge Kreuz > Pik > Herz > Karo, darunter die sieben Karten der
 *    Trumpffarbe. Zusammen elf Truempfe. Die Fehlfarben laufen A > 10 > K > D
 *    > 9 > 8 > 7.
 *  - **Grand** (`grand`) und **Ramsch** (`ramsch`): Nur die vier Buben sind
 *    Trumpf, sonst nichts. Ramsch spielt sich wie Grand.
 *  - **Saechsische Spitze** (`saechsisch`): wie Grand nur mit Buben als
 *    Trumpf, aber die ganze Ordnung steht auf dem Kopf. Der Karo-Bube ist der
 *    hoechste Trumpf und der Kreuz-Bube der niedrigste; unter den Farbkarten
 *    ist die Sieben die staerkste und das Ass die schwaechste
 *    (7 > 8 > 9 > 10 > D > K > A). Eine schaltbare Tischvariante.
 *  - **Null** (`null`): Kein Trumpf. Die Buben sind gewoehnliche Karten ihrer
 *    Farbe, und die Reihenfolge ist A > K > D > B > 10 > 9 > 8 > 7 — die Zehn
 *    steht also NICHT mehr oben. Das ist die eigene Falle des Nullspiels.
 */

import { type Card, type Suit, SUITS, isJack } from './cards.js';

export type GameType =
  | { readonly kind: 'suit'; readonly trump: Suit }
  | { readonly kind: 'grand' }
  | { readonly kind: 'saechsisch' }
  | { readonly kind: 'null' }
  | { readonly kind: 'ramsch' };

export function isTrump(card: Card, gt: GameType): boolean {
  if (gt.kind === 'null') return false;
  if (isJack(card)) return true;
  if (gt.kind === 'suit') return card.suit === gt.trump;
  return false; // grand/saechsisch/ramsch: nur Buben
}

/**
 * Die Farbe, mit der eine Karte fuer die Bedienpflicht zaehlt. Ein Bube gehoert
 * im Farb- und Grandspiel zu 'trumpf', nicht zu seiner aufgedruckten Farbe —
 * wer Trumpf anspielt, verlangt einen Buben oder eine Trumpffarbkarte.
 */
export function effectiveSuit(card: Card, gt: GameType): Suit | 'trumpf' {
  if (isTrump(card, gt)) return 'trumpf';
  return card.suit;
}

// Fehlfarben-Rangfolge (kein Trumpf) im Farb-/Grandspiel: A hoch, dann Zehn.
const FARB_RANG: Record<string, number> = { A: 6, T: 5, K: 4, Q: 3, '9': 2, '8': 1, '7': 0 };
// Null: Zehn faellt zwischen 9 und Bube zurueck, der Bube ist eine normale Karte.
const NULL_RANG: Record<string, number> = {
  A: 7,
  K: 6,
  Q: 5,
  J: 4,
  T: 3,
  '9': 2,
  '8': 1,
  '7': 0,
};
// Saechsische Spitze: die Farbreihe steht auf dem Kopf — die Sieben schlaegt
// alles, das Ass verliert gegen alles. Die Augen bleiben davon unberuehrt: Ein
// Ass ist weiterhin elf Augen wert, es sticht nur nichts mehr.
const SAECHS_RANG: Record<string, number> = { '7': 6, '8': 5, '9': 4, T: 3, Q: 2, K: 1, A: 0 };

/** Rangtafel der Farbkarten fuer diese Spielart. */
function farbRang(gt: GameType): Record<string, number> {
  if (gt.kind === 'null') return NULL_RANG;
  if (gt.kind === 'saechsisch') return SAECHS_RANG;
  return FARB_RANG;
}

/**
 * Trumpfstaerke. Buben liegen ueber allen Trumpffarbkarten; unter den Buben
 * gewinnt Kreuz — in der Saechsischen Spitze dagegen Karo, weil dort die
 * ganze Ordnung gedreht ist. Nur fuer Truempfe aufrufen (sonst -1).
 */
function trumpStrength(card: Card, gt: GameType): number {
  if (!isTrump(card, gt)) return -1;
  if (isJack(card)) {
    const i = SUITS.indexOf(card.suit); // C=0 … D=3
    return gt.kind === 'saechsisch' ? 97 + i : 100 - i;
  }
  return 50 + (farbRang(gt)[card.rank] ?? 0); // Trumpffarbkarte, stets unter den Buben
}

/** Rang einer Fehlfarbkarte innerhalb ihrer Farbe. */
function suitStrength(card: Card, gt: GameType): number {
  return farbRang(gt)[card.rank] ?? 0;
}

/**
 * Schlaegt `cand` die bisher fuehrende Karte `best`, wenn `best` mit
 * `ledEff` angespielt wurde? Trumpf schlaegt jede Fehlfarbe; unter Truempfen
 * und innerhalb der angespielten Farbe entscheidet die Staerke; eine
 * abgeworfene Fehlfarbe gewinnt nie.
 */
function beats(cand: Card, best: Card, gt: GameType, ledEff: Suit | 'trumpf'): boolean {
  const candTrump = isTrump(cand, gt);
  const bestTrump = isTrump(best, gt);
  if (candTrump || bestTrump) {
    if (candTrump && bestTrump) return trumpStrength(cand, gt) > trumpStrength(best, gt);
    return candTrump; // genau einer ist Trumpf: der gewinnt
  }
  // Beide Fehlfarbe: nur die angespielte Farbe kann stechen.
  if (effectiveSuit(cand, gt) !== ledEff) return false;
  if (effectiveSuit(best, gt) !== ledEff) return true;
  return suitStrength(cand, gt) > suitStrength(best, gt);
}

/** Index der gewinnenden Karte in der Reihenfolge, in der gespielt wurde. */
export function winningIndex(cards: readonly Card[], gt: GameType): number {
  if (cards.length === 0) return -1;
  const ledEff = effectiveSuit(cards[0]!, gt);
  let bestIdx = 0;
  for (let i = 1; i < cards.length; i++) {
    if (beats(cards[i]!, cards[bestIdx]!, gt, ledEff)) bestIdx = i;
  }
  return bestIdx;
}

/**
 * Welche Karten aus der Hand jetzt zulaessig sind (Bedienpflicht). Wer die
 * angespielte Farbe hat, muss sie bekennen; sonst ist alles frei. Trumpf
 * anspielen zwingt zu Trumpf.
 */
export function legalCards(hand: readonly Card[], trick: readonly Card[], gt: GameType): Card[] {
  if (trick.length === 0) return [...hand];
  const ledEff = effectiveSuit(trick[0]!, gt);
  const bedienbar = hand.filter((c) => effectiveSuit(c, gt) === ledEff);
  return bedienbar.length > 0 ? bedienbar : [...hand];
}

/**
 * Anzeigeordnung einer Hand: Truempfe zuerst (staerkster links), dann die
 * Fehlfarben nach Farben gruppiert. Dieselbe Ordnung liefert die Sicht dem
 * Client, damit er nichts nachrechnet.
 */
export function sortHand(cards: readonly Card[], gt: GameType): Card[] {
  const rangGruppe = (c: Card): number => {
    if (isTrump(c, gt)) return 0;
    // Fehlfarben in fester Farbreihenfolge, aber ohne die Trumpffarbe (die
    // steckt in Gruppe 0). Kreuz, Pik, Herz, Karo.
    return 1 + SUITS.indexOf(c.suit);
  };
  return [...cards].sort((a, b) => {
    const ga = rangGruppe(a);
    const gb = rangGruppe(b);
    if (ga !== gb) return ga - gb;
    const sa = isTrump(a, gt) ? trumpStrength(a, gt) : suitStrength(a, gt);
    const sb = isTrump(b, gt) ? trumpStrength(b, gt) : suitStrength(b, gt);
    return sb - sa; // staerkste links
  });
}

/** Trumpfkarten in absteigender Staerke — fuer die Client-Sortierung (`order`). */
export function trumpKeys(gt: GameType, deck: readonly Card[]): string[] {
  return deck
    .filter((c) => isTrump(c, gt))
    .sort((a, b) => trumpStrength(b, gt) - trumpStrength(a, gt))
    .map((c) => `${c.suit}${c.rank}`);
}
