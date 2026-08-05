/**
 * Sichtbarkeitsfilter.
 *
 * Hier - und nur hier - entsteht, was ein Sitz sehen darf. Der Client bekommt
 * nie den vollen Zustand und blendet nichts selbst aus. Der Bot bekommt
 * ebenfalls nur diese Sicht und kann deshalb bauartbedingt nicht schummeln.
 *
 * Drei Dinge sind hier nicht verhandelbar:
 *
 *   1. Fremde Haende gehen nie an den Client. Einzige Ausnahme ist die blinde
 *      erste Runde, wo genau das die Regel ist - und dort fehlt dafuer die
 *      eigene Karte.
 *   2. Verdeckte Ansagen bleiben verdeckt, bis alle angesagt haben. Auch die
 *      Summe, denn aus ihr liesse sich zurueckrechnen.
 *   3. Waehlt der Geber blind den Trumpf, sieht er waehrend der Wahl seine
 *      eigene Hand nicht. Sonst waere die Hausregel eine Absichtserklaerung
 *      statt einer Regel.
 */

import type { Card, Suit } from './cards.js';
import { type CardOrder, buildOrder } from './order.js';
import { type Phase, type RoundState, legalBids, legalPlays } from './round.js';
import type { RoundResult } from './scoring.js';
import type { Played } from './trick.js';

export interface PlayerView {
  /** Null bei Zuschauern. */
  readonly seat: number | null;
  readonly phase: Phase;
  readonly roundNumber: number;
  readonly handSize: number;
  readonly seats: readonly number[];
  readonly dealer: number;

  readonly hand: readonly Card[];
  readonly legal: readonly Card[];
  readonly legalBids: readonly number[];

  /** Blinde erste Runde: fremde Karten sichtbar, die eigene nicht. */
  readonly blind: boolean;
  readonly blindHands: Readonly<Record<number, readonly Card[]>> | null;

  readonly handCounts: Readonly<Record<number, number>>;
  /** Solange verdeckt angesagt wird, steht hier hoechstens die eigene Ansage. */
  readonly bids: Readonly<Record<number, number>>;
  readonly bidsRevealed: boolean;
  /** Summe aller Ansagen gegen die Stichzahl - null, solange verdeckt. */
  readonly bidTotal: number | null;

  readonly tricks: Readonly<Record<number, number>>;
  readonly currentTrick: readonly Played[];
  readonly lastTrick: { readonly winnerSeat: number; readonly played: readonly Played[] } | null;

  readonly turn: number;
  readonly isMyTurn: boolean;

  readonly upcard: Card | null;
  readonly trump: Suit | null;
  /** Sitz, der gerade die Trumpffarbe nennen muss, sonst null. */
  readonly awaitingTrump: number | null;
  /**
   * Hausregel "Der letzte sticht". Gehoert in die Sicht, weil ohne sie kein
   * Spieler und kein Bot beurteilen kann, wem der laufende Stich gerade
   * gehoert.
   */
  readonly lastSpecialWins: boolean;

  readonly order: CardOrder;
  readonly result: RoundResult | null;
}

/** Sieht dieser Sitz gerade seine eigene Hand nicht? */
function handVerdeckt(state: RoundState, seat: number): boolean {
  if (state.blind) return true;
  return state.phase === 'trump' && state.rs.dealerPicksBlind && seat === state.dealer;
}

export function viewFor(state: RoundState, seat: number): PlayerView {
  const verdeckt = handVerdeckt(state, seat);
  const hand = verdeckt ? [] : (state.hands[seat] ?? []);

  const blindHands = state.blind
    ? Object.fromEntries(
        state.seats
          .filter((other) => other !== seat)
          .map((other) => [other, state.hands[other] ?? []]),
      )
    : null;

  return {
    seat,
    phase: state.phase,
    roundNumber: state.roundNumber,
    handSize: state.handSize,
    seats: state.seats,
    dealer: state.dealer,

    hand,
    // In der blinden Runde gibt es nichts auszuwaehlen: Es ist genau eine
    // Karte, und sie wird ueber 'playBlind' gespielt.
    legal: verdeckt ? [] : legalPlays(state, seat),
    legalBids: legalBids(state, seat),

    blind: state.blind,
    blindHands,

    handCounts: Object.fromEntries(
      state.seats.map((other) => [other, (state.hands[other] ?? []).length]),
    ),
    bids: sichtbareAnsagen(state, seat),
    bidsRevealed: state.bidsRevealed,
    bidTotal: state.bidsRevealed
      ? Object.values(state.bids).reduce((acc, bid) => acc + bid, 0)
      : null,

    tricks: state.tricks,
    currentTrick: state.currentTrick,
    lastTrick: state.lastTrick,

    turn: state.turn,
    isMyTurn: state.phase !== 'finished' && state.turn === seat,

    upcard: state.upcard,
    trump: state.trump,
    awaitingTrump: state.phase === 'trump' ? state.dealer : null,
    lastSpecialWins: state.rs.lastSpecialWins,

    order: buildOrder(state.trump),
    result: state.result,
  };
}

/**
 * Neutrale Zuschauersicht, OHNE jede Hand.
 *
 * Bei Zauberer gibt es zwar keine verdeckte Partnerschaft, an der ein
 * Zuschauer zum Komplizen werden koennte - aber ein Zuschauer, der die Hand
 * des Gegenuebers ansagt, ist genauso ein Betrug. Die Trennung bleibt.
 */
export function spectatorView(state: RoundState): PlayerView {
  return {
    ...viewFor(state, state.seats[0]!),
    seat: null,
    hand: [],
    legal: [],
    legalBids: [],
    blindHands: null,
    bids: state.bidsRevealed ? state.bids : {},
    isMyTurn: false,
  };
}

function sichtbareAnsagen(
  state: RoundState,
  seat: number,
): Readonly<Record<number, number>> {
  if (state.bidsRevealed) return state.bids;
  // Verdeckt: nur die eigene Ansage, damit man weiss, was man selbst gesagt hat.
  const eigene = state.bids[seat];
  return eigene === undefined ? {} : { [seat]: eigene };
}
