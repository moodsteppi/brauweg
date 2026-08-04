/**
 * Rundenmaschine.
 *
 * Rein funktional: Zustand plus Aktion ergibt neuen Zustand. Kein Zufall ausser
 * dem uebergebenen Seed, keine Uhr, kein Netz.
 *
 * Eine Runde laeuft durch bis zu vier Phasen:
 *
 *   trump    nur wenn der Geber die Trumpffarbe nennen muss
 *   bidding  reihum ansagen, 0 bis Handgroesse
 *   playing  Handgroesse viele Stiche
 *   finished abgerechnet
 */

import { type Card, type Suit, isSuit } from './cards.js';
import { type Seed, deal } from './deal.js';
import { type RoundResult, scoreRound } from './scoring.js';
import { type Played, legalCards, winnerOf } from './trick.js';
import type { RuleSet } from './ruleset.js';

export type Phase = 'trump' | 'bidding' | 'playing' | 'finished';

export type RoundAction =
  | { readonly type: 'chooseTrump'; readonly seat: number; readonly suit: Suit }
  | { readonly type: 'bid'; readonly seat: number; readonly tricks: number }
  | { readonly type: 'playCard'; readonly seat: number; readonly cardId: number }
  | { readonly type: 'playBlind'; readonly seat: number };

export interface RoundState {
  readonly rs: RuleSet;
  /** Alle Sitze in Tischreihenfolge. */
  readonly seats: readonly number[];
  readonly dealer: number;
  /** Links vom Geber: sagt zuerst an und spielt den ersten Stich aus. */
  readonly vorhand: number;
  /** 1-basiert. Zugleich die Handgroesse. */
  readonly roundNumber: number;
  readonly handSize: number;

  readonly hands: Readonly<Record<number, readonly Card[]>>;
  /** Aufgedeckte Karte des Rests. Null heisst: kein Rest, also kein Trumpf. */
  readonly upcard: Card | null;
  readonly trump: Suit | null;
  /** Blinde erste Runde: jeder sieht die Karten der anderen, nicht die eigene. */
  readonly blind: boolean;

  readonly phase: Phase;
  readonly turn: number;

  readonly bids: Readonly<Record<number, number>>;
  /** Bei verdeckten Ansagen erst wahr, wenn alle angesagt haben. */
  readonly bidsRevealed: boolean;

  readonly tricks: Readonly<Record<number, number>>;
  readonly currentTrick: readonly Played[];
  readonly lastTrick: { readonly winnerSeat: number; readonly played: readonly Played[] } | null;

  readonly result: RoundResult | null;
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

function nextSeat(seats: readonly number[], seat: number): number {
  const index = seats.indexOf(seat);
  if (index === -1) throw new Error(`Sitz ${seat} sitzt nicht an diesem Tisch`);
  return seats[(index + 1) % seats.length]!;
}

/**
 * Wer nach dem Aufdecken die Trumpffarbe nennen muss - oder niemand.
 *
 * Zauberer aufgedeckt: der Geber waehlt. Narr aufgedeckt: ohne Trumpf, es sei
 * denn die Hausregel sagt, auch dann waehlt der Geber.
 */
function needsChoice(upcard: Card | null, rs: RuleSet): boolean {
  if (!upcard || rs.noTrump) return false;
  if (upcard.suit === 'Z') return true;
  return upcard.suit === 'N' && rs.jesterPicksTrump;
}

export function createRound(
  rs: RuleSet,
  seats: readonly number[],
  dealer: number,
  roundNumber: number,
  seed: Seed,
): RoundState {
  const handSize = roundNumber;
  const gegeben = deal(seats.length, handSize, seed);

  const hands: Record<number, readonly Card[]> = {};
  seats.forEach((seat, index) => {
    hands[seat] = gegeben.hands[index]!;
  });

  // Trumpffrei deckt gar nicht erst auf: Eine Karte zu zeigen, die nichts
  // bedeutet, waere am Tisch nur verwirrend.
  const upcard = rs.noTrump ? null : gegeben.upcard;
  const waehlt = needsChoice(upcard, rs);
  const trump: Suit | null =
    !upcard || rs.noTrump || waehlt ? null : upcard.suit === 'N' ? null : (upcard.suit as Suit);

  const vorhand = nextSeat(seats, dealer);

  return {
    rs,
    seats,
    dealer,
    vorhand,
    roundNumber,
    handSize,
    hands,
    upcard,
    trump,
    blind: rs.blindFirstRound && roundNumber === 1,
    phase: waehlt ? 'trump' : 'bidding',
    turn: waehlt ? dealer : vorhand,
    bids: {},
    // Offen angesagt wird von Anfang an mitgelesen; verdeckt erst am Ende.
    bidsRevealed: !rs.hiddenBids,
    tricks: Object.fromEntries(seats.map((seat) => [seat, 0])),
    currentTrick: [],
    lastTrick: null,
    result: null,
  };
}

// ---------------------------------------------------------------------------
// Erlaubtes
// ---------------------------------------------------------------------------

/**
 * Zulaessige Ansagen des Sitzes, der gerade ansagt.
 *
 * Bei "Es darf nicht aufgehen" fehlt dem letzten Ansager genau eine Zahl: die,
 * mit der die Summe aller Ansagen die Stichzahl treffen wuerde.
 */
export function legalBids(state: RoundState, seat: number): number[] {
  if (state.phase !== 'bidding' || state.turn !== seat) return [];

  const alle = Array.from({ length: state.handSize + 1 }, (_, i) => i);
  if (!state.rs.bidSumForbidden) return alle;

  const gesetzt = Object.keys(state.bids).length;
  const istLetzter = gesetzt === state.seats.length - 1;
  if (!istLetzter) return alle;

  const summe = Object.values(state.bids).reduce((acc, bid) => acc + bid, 0);
  const verboten = state.handSize - summe;
  return alle.filter((bid) => bid !== verboten);
}

/** Spielbare Karten des Sitzes, der gerade am Zug ist. */
export function legalPlays(state: RoundState, seat: number): Card[] {
  if (state.phase !== 'playing' || state.turn !== seat) return [];
  return legalCards(state.hands[seat] ?? [], state.currentTrick, state.trump);
}

export function currentActor(state: RoundState): number | null {
  return state.phase === 'finished' ? null : state.turn;
}

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------

export function apply(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'chooseTrump':
      return chooseTrump(state, action.seat, action.suit);
    case 'bid':
      return bid(state, action.seat, action.tricks);
    case 'playCard':
      return play(state, action.seat, action.cardId);
    case 'playBlind':
      return playBlind(state, action.seat);
  }
}

function chooseTrump(state: RoundState, seat: number, suit: Suit): RoundState {
  if (state.phase !== 'trump') throw new Error('Der Trumpf steht schon fest');
  if (seat !== state.dealer) throw new Error('Nur der Geber waehlt den Trumpf');
  if (!isSuit(suit)) throw new Error('Das ist keine Farbe');

  return { ...state, trump: suit, phase: 'bidding', turn: state.vorhand };
}

function bid(state: RoundState, seat: number, tricks: number): RoundState {
  if (state.phase !== 'bidding') throw new Error('Es wird gerade nicht angesagt');
  if (state.turn !== seat) throw new Error('Ein anderer Sitz sagt an');
  if (!legalBids(state, seat).includes(tricks)) {
    throw new Error(`Ansage ${tricks} ist hier nicht erlaubt`);
  }

  const bids = { ...state.bids, [seat]: tricks };
  const vollstaendig = Object.keys(bids).length === state.seats.length;

  return {
    ...state,
    bids,
    bidsRevealed: state.bidsRevealed || vollstaendig,
    phase: vollstaendig ? 'playing' : 'bidding',
    turn: vollstaendig ? state.vorhand : nextSeat(state.seats, seat),
  };
}

function play(state: RoundState, seat: number, cardId: number): RoundState {
  if (state.phase !== 'playing') throw new Error('Es wird gerade nicht gespielt');
  if (state.turn !== seat) throw new Error('Ein anderer Sitz ist am Zug');

  const hand = state.hands[seat] ?? [];
  const card = hand.find((entry) => entry.id === cardId);
  if (!card) throw new Error('Diese Karte liegt nicht auf der Hand');
  if (!legalCards(hand, state.currentTrick, state.trump).some((c) => c.id === cardId)) {
    throw new Error('Du musst bedienen');
  }

  return afterPlay(state, seat, card);
}

/**
 * Die blinde erste Runde.
 *
 * Der Spieler kennt seine Karte nicht, kann also auch nicht auf sie zeigen.
 * Er spielt "die Karte" - es ist ohnehin genau eine.
 */
function playBlind(state: RoundState, seat: number): RoundState {
  if (!state.blind) throw new Error('Diese Runde wird nicht blind gespielt');
  if (state.phase !== 'playing') throw new Error('Es wird gerade nicht gespielt');
  if (state.turn !== seat) throw new Error('Ein anderer Sitz ist am Zug');

  const card = (state.hands[seat] ?? [])[0];
  if (!card) throw new Error('Keine Karte mehr auf der Hand');
  return afterPlay(state, seat, card);
}

function afterPlay(state: RoundState, seat: number, card: Card): RoundState {
  const hands = {
    ...state.hands,
    [seat]: (state.hands[seat] ?? []).filter((entry) => entry.id !== card.id),
  };
  const currentTrick = [...state.currentTrick, { seat, card }];

  // Stich noch nicht voll: der naechste Sitz ist dran.
  if (currentTrick.length < state.seats.length) {
    return { ...state, hands, currentTrick, turn: nextSeat(state.seats, seat) };
  }

  const winnerSeat = winnerOf(currentTrick, state.trump);
  const tricks = { ...state.tricks, [winnerSeat]: (state.tricks[winnerSeat] ?? 0) + 1 };
  const fertig = state.seats.every((s) => (hands[s] ?? []).length === 0);

  const abgeraeumt: RoundState = {
    ...state,
    hands,
    tricks,
    currentTrick: [],
    lastTrick: { winnerSeat, played: currentTrick },
    // Der Gewinner spielt den naechsten Stich an.
    turn: winnerSeat,
  };

  if (!fertig) return abgeraeumt;

  return {
    ...abgeraeumt,
    phase: 'finished',
    result: scoreRound(state.seats, state.bids, tricks, state.roundNumber, state.rs),
  };
}
