/**
 * Rangfolge der Karten je Spielart.
 *
 * Der Kern ist eine CardOrder: eine Trumpfliste (stark nach schwach) und je
 * Fehlfarbe eine Liste. Alles weitere (Stichgewinn, Bedienzwang) arbeitet nur
 * noch mit dieser Struktur, damit Solovarianten keine Sonderfaelle im
 * Stichcode erzeugen.
 */

import { type Card, type Suit, SUITS, cardKey } from './cards.js';
import type { RuleSet, SoloKind } from './ruleset.js';

export type GameType =
  | { kind: 'normal' }
  | { kind: 'hochzeit' }
  | { kind: 'armut' }
  | { kind: 'solo'; solo: SoloKind };

export interface CardOrder {
  /** Trumpfkarten, stark nach schwach. Leer bei Fleischlos. */
  readonly trumps: readonly string[];
  /** Fehlkarten je Farbe, stark nach schwach. */
  readonly fehl: Readonly<Record<Suit, readonly string[]>>;
}

export interface OrderContext {
  /** Zwei Karo-Ass auf einer Hand. */
  readonly schweinchenActive?: boolean;
  /** Zusaetzlich das niedrigste Trumpfpaar auf derselben Hand. */
  readonly superSchweinActive?: boolean;
}

/** Karte des Superschweins: die Neun, bei Scharfem Doko der Koenig. */
export function superSchweinKey(rs: RuleSet): string {
  return rs.deck === 'with9' ? 'D9' : 'DK';
}

export interface SchweinchenStatus {
  readonly schweinchen: boolean;
  readonly superschwein: boolean;
}

/**
 * Erkennt Schweinchen und Superschwein aus einer Hand.
 *
 * Beides gilt AUTOMATISCH, ohne Ansage, und ist ab Rundenbeginn fuer alle
 * sichtbar. Superschwein setzt voraus, dass derselbe Spieler beide Paare haelt.
 * Beides greift nur, wenn Karo Trumpf ist.
 */
export function detectSchweinchen(
  hand: readonly Card[],
  rs: RuleSet,
  gameType: GameType,
): SchweinchenStatus {
  const karoIsTrump =
    gameType.kind !== 'solo' || gameType.solo === 'suitD';
  if (!karoIsTrump || !rs.schweinchen) {
    return { schweinchen: false, superschwein: false };
  }

  const count = (key: string) =>
    hand.filter((c) => cardKey(c) === key).length;

  const schweinchen = count('DA') === 2;
  const superschwein =
    rs.superSchweine && schweinchen && count(superSchweinKey(rs)) === 2;

  return { schweinchen, superschwein };
}

const SUIT_SOLO: Partial<Record<SoloKind, Suit>> = {
  suitC: 'C',
  suitS: 'S',
  suitH: 'H',
  suitD: 'D',
};

/** Ranghoehe innerhalb einer Fehlfarbe, abhaengig davon, was Trumpf ist. */
function fehlRanks(
  suit: Suit,
  opts: { queensAreTrump: boolean; jacksAreTrump: boolean; dulleIsTrump: boolean },
  deckHas9: boolean,
): string[] {
  const out: string[] = [`${suit}A`];
  // Die Herz-Zehn ist Fehlkarte, sobald sie nicht Trumpf ist.
  if (!(suit === 'H' && opts.dulleIsTrump)) out.push(`${suit}T`);
  out.push(`${suit}K`);
  if (!opts.queensAreTrump) out.push(`${suit}Q`);
  if (!opts.jacksAreTrump) out.push(`${suit}J`);
  if (deckHas9) out.push(`${suit}9`);
  return out;
}

export function buildOrder(
  gameType: GameType,
  rs: RuleSet,
  ctx: OrderContext = {},
): CardOrder {
  const deckHas9 = rs.deck === 'with9';
  const nine = (s: Suit) => (deckHas9 ? [`${s}9`] : []);

  let trumps: string[] = [];
  let trumpSuit: Suit | null = null;
  let queensAreTrump = true;
  let jacksAreTrump = true;
  let dulleIsTrump = true;

  if (gameType.kind === 'solo') {
    const solo = gameType.solo;
    if (solo === 'queens') {
      jacksAreTrump = false;
      dulleIsTrump = false;
      trumps = ['CQ', 'SQ', 'HQ', 'DQ'];
    } else if (solo === 'jacks') {
      queensAreTrump = false;
      dulleIsTrump = false;
      trumps = ['CJ', 'SJ', 'HJ', 'DJ'];
    } else if (solo === 'fleshless') {
      queensAreTrump = false;
      jacksAreTrump = false;
      dulleIsTrump = false;
      trumps = [];
    } else {
      trumpSuit = SUIT_SOLO[solo]!;
    }
  } else {
    trumpSuit = 'D';
  }

  if (trumpSuit) {
    // Entschaerfte Dullen: die Herz-Zehn ist kein Trumpf mehr. Im Herz-Solo
    // bleibt sie Trumpf, weil dort ohnehin die ganze Farbe Trumpf ist; sie
    // rutscht dann aber auf ihren normalen Platz zwischen Ass und Koenig.
    dulleIsTrump = !rs.defusedDullen;

    const suitSequence: string[] = [
      `${trumpSuit}A`,
      ...(trumpSuit === 'H' && dulleIsTrump ? [] : [`${trumpSuit}T`]),
      `${trumpSuit}K`,
      ...nine(trumpSuit),
    ];

    trumps = [
      ...(dulleIsTrump ? ['HT'] : []), // Dulle
      'CQ',
      'SQ',
      'HQ',
      'DQ',
      'CJ',
      'SJ',
      'HJ',
      'DJ',
      ...suitSequence,
    ];
    // Schweinchen: die beiden Karo-Ass werden hoechster Trumpf.
    // Superschwein: zusaetzlich das NIEDRIGSTE Trumpfpaar der Trumpffarbe
    // (Neunen, bei Scharfem Doko die Koenige). Es steht ueber den Schweinchen,
    // der Spieler haelt damit die vier hoechsten Karten des Spiels.
    if (trumpSuit === 'D') {
      if (ctx.schweinchenActive) {
        trumps = ['DA', ...trumps.filter((k) => k !== 'DA')];
      }
      if (ctx.superSchweinActive) {
        const low = superSchweinKey(rs);
        trumps = [low, ...trumps.filter((k) => k !== low)];
      }
    }
  }

  const fehl = {} as Record<Suit, readonly string[]>;
  for (const suit of SUITS) {
    fehl[suit] = fehlRanks(
      suit,
      { queensAreTrump, jacksAreTrump, dulleIsTrump },
      deckHas9,
    ).filter((k) => !trumps.includes(k));
  }

  return { trumps, fehl };
}

export function isTrump(card: Card, order: CardOrder): boolean {
  return order.trumps.includes(cardKey(card));
}

/**
 * "Farbe" im Sinne des Bedienzwangs. Trumpf ist eine eigene Farbe.
 */
export function servingSuit(card: Card, order: CardOrder): Suit | 'T' {
  return isTrump(card, order) ? 'T' : card.suit;
}

/**
 * Staerke einer Karte. Hoeher ist besser. Truempfe liegen ueber allen
 * Fehlkarten. Karten anderer Fehlfarben sind im Stich wertlos und erhalten -1.
 */
export function strength(card: Card, order: CardOrder, lead: Suit | 'T'): number {
  const key = cardKey(card);
  const t = order.trumps.indexOf(key);
  if (t >= 0) return 1000 - t;
  if (lead === 'T') return -1;
  if (card.suit !== lead) return -1;
  const f = order.fehl[card.suit].indexOf(key);
  return f >= 0 ? 500 - f : -1;
}

/** Karten der Hand, die im aktuellen Stich bedient werden muessen. */
export function legalCards(
  hand: readonly Card[],
  order: CardOrder,
  leadCard: Card | null,
): Card[] {
  if (!leadCard) return [...hand];
  const lead = servingSuit(leadCard, order);
  const matching = hand.filter((c) => servingSuit(c, order) === lead);
  return matching.length > 0 ? matching : [...hand];
}
