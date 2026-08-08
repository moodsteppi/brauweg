/** Gemeinsame Testhelfer. */

import type { Card } from '../src/cards.js';
import { type RoundState, apply } from '../src/round.js';
import { type PartyState, act, endePause, startRound } from '../src/party.js';
import { botAction } from '../src/bot.js';
import { viewFor } from '../src/view.js';

/**
 * Karte aus Kurzschreibweise: c('H13') ist der Herz-Koenig (rot, null Punkte),
 * c('S13') der Pik-Koenig (dreizehn). Die id ist frei, aber eindeutig.
 */
let nextId = 5000;
export function c(key: string): Card {
  return { suit: key[0] as Card['suit'], rank: key.slice(1), id: nextId++ };
}

/** Setzt Haende von Hand, damit Tests nicht am Seed haengen. */
export function withHands(state: RoundState, hands: Record<number, Card[]>): RoundState {
  return { ...state, hands };
}

/** Setzt den Nachziehstapel; oberste Karte zuletzt. */
export function withStock(state: RoundState, stock: Card[]): RoundState {
  return { ...state, stock };
}

/** Setzt den Ablagestapel; oberste Karte zuletzt. */
export function withDiscard(state: RoundState, discard: Card[]): RoundState {
  return { ...state, discard };
}

/** Lässt einen Sitz alles wissen - fuer Tests, die den Bot fuettern. */
export function allesWissen(state: RoundState, seat: number): RoundState {
  const keys: string[] = [];
  for (const besitzer of state.seats) {
    for (let i = 0; i < 4; i++) keys.push(`${besitzer}:${i}`);
  }
  return { ...state, known: { ...state.known, [seat]: keys } };
}

/**
 * Spielt eine ganze Partie mit dem Bot zu Ende.
 *
 * Beendet dabei auch die Rundenpausen sofort - im Betrieb misst die Plattform
 * die Zeit, im Test soll es nicht zwoelf Sekunden je Runde dauern.
 */
export function playOut(party: PartyState, maxSteps = 20000): PartyState {
  let current = party.current ? party : startRound(party);
  let steps = 0;
  while (!current.finished) {
    if (current.pause) {
      const nach = endePause(current);
      current = nach.finished ? nach : startRound(nach);
      continue;
    }
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

/** Fuehrt eine Aktionsfolge aus. */
export function run(state: RoundState, actions: Parameters<typeof apply>[1][]): RoundState {
  return actions.reduce((s, a) => apply(s, a), state);
}
