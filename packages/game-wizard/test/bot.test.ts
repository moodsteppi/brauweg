import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Card } from '../src/cards.js';
import { botAction } from '../src/bot.js';
import { makeRuleSet, type RuleSet } from '../src/ruleset.js';
import { type RoundState, apply, createRound, legalBids, legalPlays } from '../src/round.js';
import { act, createParty, startRound } from '../src/party.js';
import { spectatorView, viewFor } from '../src/view.js';
import { bidAll, c, playOut, withHands } from './helpers.js';

const SEATS = [0, 1, 2, 3];

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

test('Der Bot sagt nur Erlaubtes an', () => {
  for (let seed = 1; seed <= 60; seed++) {
    let state = createRound(makeRuleSet({ bidSumForbidden: true }), SEATS, 0, 5, seed);
    if (state.phase === 'trump') {
      const wahl = botAction(viewFor(state, state.turn))!;
      state = apply(state, wahl);
    }
    while (state.phase === 'bidding') {
      const seat = state.turn;
      const erlaubt = legalBids(state, seat);
      const action = botAction(viewFor(state, seat))!;
      assert.equal(action.type, 'bid');
      assert.ok(
        erlaubt.includes((action as { tricks: number }).tricks),
        `Seed ${seed}: unzulaessige Ansage`,
      );
      state = apply(state, action);
    }
  }
});

test('Der Bot spielt nie eine unerlaubte Karte', () => {
  for (let seed = 1; seed <= 40; seed++) {
    let party = startRound(createParty(makeRuleSet({ rounds: 5 }), SEATS, seed));
    let schutz = 0;
    while (!party.finished) {
      if (!party.current) {
        party = startRound(party);
        continue;
      }
      const state = party.current;
      const seat = state.turn;
      const action = botAction(viewFor(state, seat))!;
      if (action.type === 'playCard') {
        const erlaubt = legalPlays(state, seat).map((card) => card.id);
        assert.ok(erlaubt.includes(action.cardId), `Seed ${seed}: unerlaubte Karte`);
      }
      party = act(party, action);
      if (++schutz > 5000) throw new Error('kein Ende');
    }
  }
});

test('Eine Hand voller Zauberer wird hoch angesagt, eine voller Narren mit null', () => {
  const roh = createRound(makeRuleSet(), SEATS, 0, 4, 3);
  const state: RoundState = { ...roh, phase: 'bidding', turn: 1, trump: 'H' };

  const zauberer = withHands(state, {
    ...state.hands,
    1: [c('Z1'), c('Z2'), c('Z3'), c('Z4')],
  });
  const hoch = botAction(viewFor(zauberer, 1))! as { tricks: number };
  assert.equal(hoch.tricks, 4);

  const narren = withHands(state, {
    ...state.hands,
    1: [c('N1'), c('N2'), c('N3'), c('N4')],
  });
  const null_ = botAction(viewFor(narren, 1))! as { tricks: number };
  assert.equal(null_.tricks, 0);
});

test('Der Bot waehlt als Geber eine Trumpffarbe, in der er stark ist', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'Z', 4);
  const stark = withHands(state, {
    ...state.hands,
    0: [c('S13'), c('S12'), c('S11'), c('D2')],
  });
  const action = botAction(viewFor(stark, 0))! as { type: string; suit: string };
  assert.equal(action.type, 'chooseTrump');
  assert.equal(action.suit, 'S');
});

test('Blind waehlt der Bot trotzdem eine Farbe', () => {
  const rs = makeRuleSet({ dealerPicksBlind: true });
  const state = roundMitAufdeck(rs, (card) => card?.suit === 'Z');
  const action = botAction(viewFor(state, 0))!;
  assert.equal(action.type, 'chooseTrump');
});

test('In der blinden Runde spielt der Bot ohne Kartenwahl', () => {
  const rs = makeRuleSet({ blindFirstRound: true });
  const state = bidAll(createRound(rs, SEATS, 0, 1, 5), [0, 0, 1, 0]);
  assert.equal(botAction(viewFor(state, state.turn))!.type, 'playBlind');
});

test('Wer genug Stiche hat, nimmt keinen weiteren mit, wenn er ihn abwerfen kann', () => {
  const roh = createRound(makeRuleSet(), SEATS, 0, 3, 11);
  const state: RoundState = {
    ...withHands(roh, {
      0: [c('D2'), c('D3'), c('D4')],
      1: [c('D13'), c('D5'), c('C7')],
      2: [c('D12'), c('D6'), c('C8')],
      3: [c('D11'), c('D7'), c('C9')],
    }),
    trump: 'H',
    upcard: c('H4'),
    phase: 'playing',
    turn: 1,
    bids: { 0: 0, 1: 0, 2: 0, 3: 0 },
    bidsRevealed: true,
    tricks: { 0: 0, 1: 0, 2: 0, 3: 0 },
    currentTrick: [{ seat: 0, card: c('D9') }],
  };

  // Soll 0, bisher 0 Stiche: der Bot darf den Stich nicht nehmen und wirft
  // die hoechste Karte ab, die noch verliert.
  const action = botAction(viewFor(state, 1))! as { cardId: number };
  const gespielt = state.hands[1]!.find((card) => card.id === action.cardId)!;
  assert.equal(gespielt.suit + gespielt.rank, 'D5');
});

test('Wer Stiche braucht, gewinnt so billig wie moeglich', () => {
  const roh = createRound(makeRuleSet(), SEATS, 0, 3, 11);
  const state: RoundState = {
    ...withHands(roh, {
      0: [c('D2')],
      1: [c('D10'), c('D13'), c('Z1')],
      2: [c('D3')],
      3: [c('D4')],
    }),
    trump: 'H',
    upcard: c('H4'),
    phase: 'playing',
    turn: 1,
    bids: { 0: 0, 1: 2, 2: 0, 3: 0 },
    bidsRevealed: true,
    tricks: { 0: 0, 1: 0, 2: 0, 3: 0 },
    currentTrick: [{ seat: 0, card: c('D9') }],
  };

  const action = botAction(viewFor(state, 1))! as { cardId: number };
  const gespielt = state.hands[1]!.find((card) => card.id === action.cardId)!;
  assert.equal(gespielt.suit + gespielt.rank, 'D10');
});

test('Gleiche Sicht, gleiche Aktion', () => {
  const state = createRound(makeRuleSet(), SEATS, 0, 6, 77);
  const view = viewFor(state, state.turn);
  assert.deepEqual(botAction(view), botAction(view));
});

test('Der Bot laeuft nicht auf der Zuschauersicht', () => {
  const state = createRound(makeRuleSet(), SEATS, 0, 3, 5);
  assert.throws(() => botAction(spectatorView(state)));
});

test('Der Bot spielt jede Tischgroesse zu Ende, ohne haengenzubleiben', () => {
  for (const seats of [3, 4, 5, 6]) {
    const sitze = Array.from({ length: seats }, (_, i) => i);
    const rs = makeRuleSet({ tableSize: seats, rounds: 6 });
    const fertig = playOut(createParty(rs, sitze, 55 + seats));
    assert.equal(fertig.finished, true, `${seats} Spieler`);
  }
});
