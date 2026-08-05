import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Card } from '../src/cards.js';
import { makeRuleSet, type RuleSet } from '../src/ruleset.js';
import {
  type RoundState,
  apply,
  createRound,
  currentActor,
  legalBids,
  legalPlays,
} from '../src/round.js';
import { bidAll, c, withHands } from './helpers.js';

const SEATS = [0, 1, 2, 3];

/**
 * Sucht den ersten Zahlen-Seed, dessen Aufdeckkarte zum Wunsch passt. So
 * bleiben die Tests deterministisch, ohne den Zustand von Hand zu basteln.
 */
function roundMitAufdeck(
  rs: RuleSet,
  passt: (card: Card | null) => boolean,
  roundNumber = 3,
): RoundState {
  for (let seed = 1; seed < 4000; seed++) {
    const state = createRound(rs, SEATS, 0, roundNumber, seed);
    if (passt(state.upcard)) return state;
  }
  throw new Error('Kein passender Seed gefunden');
}

// --- Trumpf -----------------------------------------------------------------

test('Farbkarte aufgedeckt: diese Farbe ist Trumpf, es wird sofort angesagt', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'H');
  assert.equal(state.trump, 'H');
  assert.equal(state.phase, 'bidding');
  assert.equal(state.turn, 1); // links vom Geber
});

test('Narr aufgedeckt: kein Trumpf', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'N');
  assert.equal(state.trump, null);
  assert.equal(state.phase, 'bidding');
});

test('Zauberer aufgedeckt: der Geber waehlt die Trumpffarbe', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'Z');
  assert.equal(state.phase, 'trump');
  assert.equal(state.turn, 0);
  assert.equal(currentActor(state), 0);

  const gewaehlt = apply(state, { type: 'chooseTrump', seat: 0, suit: 'D' });
  assert.equal(gewaehlt.trump, 'D');
  assert.equal(gewaehlt.phase, 'bidding');
  assert.equal(gewaehlt.turn, 1);
});

test('Nur der Geber waehlt den Trumpf, und nur solange er dran ist', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'Z');
  assert.throws(() => apply(state, { type: 'chooseTrump', seat: 2, suit: 'D' }));
  const gewaehlt = apply(state, { type: 'chooseTrump', seat: 0, suit: 'D' });
  assert.throws(() => apply(gewaehlt, { type: 'chooseTrump', seat: 0, suit: 'H' }));
});

test('Hausregel "Narr = Geber waehlt" laesst auch beim Narren waehlen', () => {
  const rs = makeRuleSet({ jesterPicksTrump: true });
  const state = roundMitAufdeck(rs, (card) => card?.suit === 'N');
  assert.equal(state.phase, 'trump');
  assert.equal(apply(state, { type: 'chooseTrump', seat: 0, suit: 'S' }).trump, 'S');
});

test('Trumpffrei deckt gar nicht erst auf', () => {
  const state = createRound(makeRuleSet({ noTrump: true }), SEATS, 0, 3, 7);
  assert.equal(state.upcard, null);
  assert.equal(state.trump, null);
  assert.equal(state.phase, 'bidding');
});

test('Letzte Runde einer vollen Partie: kein Rest, kein Trumpf', () => {
  const state = createRound(makeRuleSet({ rounds: 15 }), SEATS, 0, 15, 7);
  assert.equal(state.upcard, null);
  assert.equal(state.trump, null);
});

// --- Ansagen ----------------------------------------------------------------

test('Angesagt wird reihum links vom Geber, danach wird gespielt', () => {
  const start = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'H');
  assert.deepEqual(legalBids(start, 1), [0, 1, 2, 3]);
  assert.deepEqual(legalBids(start, 2), []); // noch nicht dran

  const nach = bidAll(start, [1, 0, 2, 0]);
  assert.deepEqual(nach.bids, { 1: 1, 2: 0, 3: 2, 0: 0 });
  assert.equal(nach.phase, 'playing');
  assert.equal(nach.turn, 1); // Vorhand spielt aus
});

test('Eine Ansage ausserhalb der Handgroesse wird abgewiesen', () => {
  const start = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'H');
  assert.throws(() => apply(start, { type: 'bid', seat: 1, tricks: 4 }));
  assert.throws(() => apply(start, { type: 'bid', seat: 1, tricks: -1 }));
});

test('Wer nicht dran ist, sagt nicht an', () => {
  const start = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'H');
  assert.throws(() => apply(start, { type: 'bid', seat: 2, tricks: 1 }));
});

test('"Es darf nicht aufgehen": dem letzten Ansager fehlt genau eine Zahl', () => {
  const rs = makeRuleSet({ bidSumForbidden: true });
  const start = roundMitAufdeck(rs, (card) => card?.suit === 'H');

  const nachDrei = bidAll(start, [1, 1, 0]);
  assert.equal(nachDrei.turn, 0);
  // Summe 2, Handgroesse 3 - die 1 wuerde aufgehen und fehlt deshalb.
  assert.deepEqual(legalBids(nachDrei, 0), [0, 2, 3]);
  assert.throws(() => apply(nachDrei, { type: 'bid', seat: 0, tricks: 1 }));
});

test('"Es darf nicht aufgehen" trifft nur den letzten Ansager', () => {
  const rs = makeRuleSet({ bidSumForbidden: true });
  const start = roundMitAufdeck(rs, (card) => card?.suit === 'H');
  assert.deepEqual(legalBids(start, 1), [0, 1, 2, 3]);
  assert.deepEqual(legalBids(bidAll(start, [3]), 2), [0, 1, 2, 3]);
});

test('Verdeckte Ansagen werden erst am Ende aufgedeckt', () => {
  const rs = makeRuleSet({ hiddenBids: true });
  const start = roundMitAufdeck(rs, (card) => card?.suit === 'H');
  assert.equal(start.bidsRevealed, false);
  assert.equal(bidAll(start, [1, 1]).bidsRevealed, false);
  assert.equal(bidAll(start, [1, 1, 0, 0]).bidsRevealed, true);
});

// --- Stiche -----------------------------------------------------------------

/** Runde mit gesetzten Haenden, Trumpf Herz, alle haben angesagt. */
function gespielteRunde(hands: Record<number, Card[]>, rs = makeRuleSet()): RoundState {
  const roh = createRound(rs, SEATS, 0, 2, 11);
  const state: RoundState = {
    ...withHands(roh, hands),
    trump: 'H',
    upcard: c('H4'),
    phase: 'bidding',
    turn: 1,
  };
  return bidAll(state, [1, 1, 0, 0]);
}

test('Ein voller Stich geht an den Gewinner, der danach ausspielt', () => {
  let state = gespielteRunde({
    0: [c('D2'), c('D3')],
    1: [c('D9'), c('D4')],
    2: [c('D13'), c('D5')],
    // Ohne Karo darf hier gestochen werden - mit Karo waere Herz verboten.
    3: [c('H2'), c('S6')],
  });

  state = apply(state, { type: 'playCard', seat: 1, cardId: state.hands[1]![0]!.id });
  state = apply(state, { type: 'playCard', seat: 2, cardId: state.hands[2]![0]!.id });
  state = apply(state, { type: 'playCard', seat: 3, cardId: state.hands[3]![0]!.id });
  assert.equal(state.currentTrick.length, 3);
  state = apply(state, { type: 'playCard', seat: 0, cardId: state.hands[0]![0]!.id });

  // Sitz 3 hat mit Herz gestochen.
  assert.equal(state.tricks[3], 1);
  assert.equal(state.currentTrick.length, 0);
  assert.equal(state.lastTrick?.winnerSeat, 3);
  assert.equal(state.turn, 3);
});

test('Bedienpflicht gilt auch gegen den Server: eine falsche Karte wird abgewiesen', () => {
  const state = gespielteRunde({
    0: [c('D2'), c('D3')],
    1: [c('D9'), c('S4')],
    2: [c('D13'), c('D5')],
    3: [c('H2'), c('D6')],
  });
  const nach = apply(state, { type: 'playCard', seat: 1, cardId: state.hands[1]![0]!.id });
  // Sitz 2 haelt Karo und darf deshalb kein anderes Blatt legen.
  const falsch = nach.hands[2]![1]!;
  assert.equal(falsch.suit, 'D'); // Kontrolle des Aufbaus
  const pik = c('S7');
  const manipuliert = { ...nach, hands: { ...nach.hands, 2: [...nach.hands[2]!, pik] } };
  assert.throws(() => apply(manipuliert, { type: 'playCard', seat: 2, cardId: pik.id }));
});

test('Eine Karte, die nicht auf der Hand liegt, wird abgewiesen', () => {
  const state = gespielteRunde({
    0: [c('D2'), c('D3')],
    1: [c('D9'), c('D4')],
    2: [c('D13'), c('D5')],
    3: [c('H2'), c('D6')],
  });
  assert.throws(() => apply(state, { type: 'playCard', seat: 1, cardId: 999999 }));
});

test('Nach dem letzten Stich ist die Runde abgerechnet', () => {
  let state = gespielteRunde({
    0: [c('D2'), c('D3')],
    1: [c('Z1'), c('D4')],
    2: [c('D13'), c('D5')],
    3: [c('N1'), c('D6')],
  });
  let schutz = 0;
  while (state.phase === 'playing') {
    const seat = state.turn;
    const karte = legalPlays(state, seat)[0]!;
    state = apply(state, { type: 'playCard', seat, cardId: karte.id });
    if (++schutz > 20) throw new Error('Runde laeuft nicht zu Ende');
  }
  assert.equal(state.phase, 'finished');
  assert.equal(currentActor(state), null);
  assert.ok(state.result);
  assert.equal(
    Object.values(state.result!.tricks).reduce((a, b) => a + b, 0),
    2,
  );
});

test('Hausregel "Der letzte sticht" gilt auch am Tisch, nicht nur in der Funktion', () => {
  const rs = makeRuleSet({ lastSpecialWins: true });
  let state = gespielteRunde(
    {
      0: [c('Z1'), c('D3')],
      1: [c('D9'), c('D4')],
      2: [c('Z2'), c('D5')],
      3: [c('D2'), c('S6')],
    },
    rs,
  );

  // Sitz 1 spielt an, Sitz 2 legt einen Zauberer, Sitz 0 einen zweiten.
  state = apply(state, { type: 'playCard', seat: 1, cardId: state.hands[1]![0]!.id });
  state = apply(state, { type: 'playCard', seat: 2, cardId: state.hands[2]![0]!.id });
  // Sitz 3 haelt Karo und muss bedienen.
  state = apply(state, { type: 'playCard', seat: 3, cardId: state.hands[3]![0]!.id });
  state = apply(state, { type: 'playCard', seat: 0, cardId: state.hands[0]![0]!.id });

  // Der spaetere Zauberer (Sitz 0) nimmt den Stich.
  assert.equal(state.lastTrick?.winnerSeat, 0);
  assert.equal(state.tricks[0], 1);
});

// --- Blinde erste Runde -----------------------------------------------------

test('Blinde erste Runde: gespielt wird ohne Kartenwahl', () => {
  const rs = makeRuleSet({ blindFirstRound: true });
  const start = createRound(rs, SEATS, 0, 1, 5);
  assert.equal(start.blind, true);

  const nachAnsage = bidAll(start, [0, 0, 1, 0]);
  assert.equal(nachAnsage.phase, 'playing');

  let state = nachAnsage;
  for (let i = 0; i < 4; i++) {
    state = apply(state, { type: 'playBlind', seat: state.turn });
  }
  assert.equal(state.phase, 'finished');
});

test('Blind gespielt wird nur, wo es die Regel gibt', () => {
  const start = createRound(makeRuleSet(), SEATS, 0, 1, 5);
  const nach = bidAll(start, [0, 0, 1, 0]);
  assert.throws(() => apply(nach, { type: 'playBlind', seat: nach.turn }));
});

test('Blind gilt nur in Runde 1', () => {
  const rs = makeRuleSet({ blindFirstRound: true });
  assert.equal(createRound(rs, SEATS, 0, 2, 5).blind, false);
});
