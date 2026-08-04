/** Gemeinsame Testhelfer. */

import type { Card } from '../src/cards.js';
import { type RoundState, apply } from '../src/round.js';
import { type PartyState, act, startRound } from '../src/party.js';
import { botAction } from '../src/bot.js';
import { viewFor } from '../src/view.js';

/**
 * Karte aus Kurzschreibweise: c('H13') ist die Herz-Dreizehn, c('Z1') ein
 * Zauberer, c('N2') ein Narr. Die id ist frei, aber eindeutig.
 */
let nextId = 5000;
export function c(key: string): Card {
  return { suit: key[0] as Card['suit'], rank: key.slice(1), id: nextId++ };
}

/** Setzt eine Runde von Hand auf, damit Tests nicht am Seed haengen. */
export function withHands(
  state: RoundState,
  hands: Record<number, Card[]>,
): RoundState {
  return { ...state, hands };
}

/** Sagt reihum an, beginnend beim aktuellen Sitz. */
export function bidAll(state: RoundState, bids: number[]): RoundState {
  let current = state;
  for (const tricks of bids) {
    current = apply(current, { type: 'bid', seat: current.turn, tricks });
  }
  return current;
}

/** Spielt eine ganze Partie mit dem Bot zu Ende. */
export function playOut(party: PartyState, maxSteps = 20000): PartyState {
  let current = party.current ? party : startRound(party);
  let steps = 0;
  while (!current.finished) {
    if (!current.current) {
      current = startRound(current);
      continue;
    }
    const seat = current.current.turn;
    const action = botAction(viewFor(current.current, seat));
    if (!action) throw new Error(`Bot fand keine Aktion fuer Sitz ${seat}`);
    current = act(current, action);
    if (++steps > maxSteps) throw new Error('Partie laeuft nicht zu Ende');
  }
  return current;
}
