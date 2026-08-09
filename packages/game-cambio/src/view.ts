/**
 * Sichtbarkeitsfilter.
 *
 * Hier - und nur hier - entsteht, was ein Sitz sehen darf. Der Client bekommt
 * nie den vollen Zustand und blendet nichts selbst aus. Der Bot bekommt
 * dieselbe Sicht und kann deshalb bauartbedingt nicht schummeln.
 *
 * Bei Cambio ist das strenger als bei einem Stichspiel, denn WISSEN IST DAS
 * SPIEL. Drei Dinge sind nicht verhandelbar:
 *
 *   1. Eine Karte geht nur an den Sitz, der sie kennt. Die eigene Hand ist
 *      keine Ausnahme - wer seine dritte Karte nie angesehen hat, sieht sie
 *      auch hier nicht.
 *   2. Was ein Sitz weiss, geht nur an ihn. Aus fremdem Wissen liesse sich
 *      zurueckrechnen, was ein Gegner vorhat.
 *   3. Erst nach dem Abrechnen liegen alle Haende offen.
 */

import type { Card } from './cards.js';
import {
  type Phase,
  type RoundAction,
  type RoundState,
  type Slot,
  legalActions,
  slotKey,
  topDiscard,
} from './round.js';
import type { RoundResult } from './scoring.js';
import { HAND_SIZE, type RuleSet } from './ruleset.js';

/**
 * Ein Platz aus Sicht eines Betrachters: die Karte, wenn er sie kennt, sonst
 * nur die Auskunft, dass dort etwas liegt.
 */
export interface SeenSlot {
  readonly index: number;
  /** Null heisst: verdeckt fuer diesen Betrachter. */
  readonly card: Card | null;
}

export interface PlayerView {
  /** Null bei Zuschauern. */
  readonly seat: number | null;
  readonly phase: Phase;
  readonly seats: readonly number[];
  readonly dealer: number;
  readonly rs: RuleSet;

  /** Alle Haende, aber je Karte nur sichtbar, wenn dieser Sitz sie kennt. */
  readonly hands: Readonly<Record<number, readonly SeenSlot[]>>;

  readonly stockCount: number;
  readonly topDiscard: Card;

  /** Gezogene Karte - nur fuer den, der sie gerade in der Hand haelt. */
  readonly drawn: Card | null;
  readonly pendingAction: string | null;
  readonly lookedAt: Slot | null;

  readonly turn: number;
  readonly isMyTurn: boolean;
  readonly legal: readonly RoundAction[];

  readonly caller: number | null;
  /** Sitze, die nach dem Ruf ihren letzten Zug schon hatten. */
  readonly afterCall: readonly number[];

  readonly result: RoundResult | null;
}

function sichtbareHaende(
  state: RoundState,
  seat: number | null,
): Record<number, SeenSlot[]> {
  const offen = state.phase === 'finished';
  const known = seat === null ? [] : (state.known[seat] ?? []);

  const out: Record<number, SeenSlot[]> = {};
  for (const besitzer of state.seats) {
    const hand = state.hands[besitzer] ?? [];
    out[besitzer] = Array.from({ length: HAND_SIZE }, (_, index) => {
      const karte = hand[index] ?? null;
      const sichtbar = offen || known.includes(slotKey(besitzer, index));
      return { index, card: sichtbar ? karte : null };
    });
  }
  return out;
}

export function viewFor(state: RoundState, seat: number): PlayerView {
  return {
    seat,
    phase: state.phase,
    seats: state.seats,
    dealer: state.dealer,
    rs: state.rs,

    hands: sichtbareHaende(state, seat),

    stockCount: state.stock.length,
    topDiscard: topDiscard(state),

    // Die gezogene Karte sieht nur, wer sie gezogen hat.
    drawn: state.turn === seat ? state.drawn : null,
    pendingAction: state.turn === seat ? state.pendingAction : null,
    lookedAt: state.turn === seat ? state.lookedAt : null,

    turn: state.turn,
    isMyTurn: state.phase !== 'finished' && state.turn === seat,
    legal: legalActions(state, seat),

    caller: state.caller,
    afterCall: state.afterCall,

    result: state.result,
  };
}

/**
 * Neutrale Zuschauersicht, OHNE jede Karte.
 *
 * Ein Zuschauer, der einem Spieler zuruft, was auf dessen drittem Platz liegt,
 * ist genauso ein Betrug wie ein Blick in fremde Karten. Deshalb sieht ein
 * Zuschauer bis zur Abrechnung gar nichts.
 */
export function spectatorView(state: RoundState): PlayerView {
  return {
    seat: null,
    phase: state.phase,
    seats: state.seats,
    dealer: state.dealer,
    rs: state.rs,

    hands: sichtbareHaende(state, null),

    stockCount: state.stock.length,
    topDiscard: topDiscard(state),

    drawn: null,
    pendingAction: null,
    lookedAt: null,

    turn: state.turn,
    isMyTurn: false,
    legal: [],

    caller: state.caller,
    afterCall: state.afterCall,

    result: state.result,
  };
}
