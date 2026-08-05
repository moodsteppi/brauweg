import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Card } from '../src/cards.js';
import { makeRuleSet, type RuleSet } from '../src/ruleset.js';
import { type RoundState, createRound } from '../src/round.js';
import { spectatorView, viewFor } from '../src/view.js';
import { bidAll } from './helpers.js';

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

/** Alle Karten, die irgendwo in der Sicht auftauchen. */
function alleKartenIn(view: unknown): number[] {
  const ids: number[] = [];
  const gehe = (wert: unknown): void => {
    if (Array.isArray(wert)) {
      wert.forEach(gehe);
      return;
    }
    if (wert && typeof wert === 'object') {
      const obj = wert as Record<string, unknown>;
      if (typeof obj.id === 'number' && typeof obj.suit === 'string') {
        ids.push(obj.id);
        return;
      }
      Object.values(obj).forEach(gehe);
    }
  };
  gehe(view);
  return ids;
}

test('Die Sicht zeigt die eigene Hand und keine fremde', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'H');
  const view = viewFor(state, 1);

  assert.deepEqual(view.hand, state.hands[1]);
  const fremde = [0, 2, 3].flatMap((seat) => state.hands[seat]!.map((card) => card.id));
  const gezeigt = alleKartenIn(view);
  for (const id of fremde) {
    assert.ok(!gezeigt.includes(id), `Fremde Karte ${id} steht in der Sicht`);
  }
});

test('Die Sicht zaehlt fremde Karten, ohne sie zu zeigen', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'H');
  const view = viewFor(state, 1);
  assert.deepEqual(view.handCounts, { 0: 3, 1: 3, 2: 3, 3: 3 });
});

test('Zuschauer bekommen keine einzige Hand', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'H');
  const view = spectatorView(state);

  assert.equal(view.seat, null);
  assert.deepEqual(view.hand, []);
  assert.deepEqual(view.legal, []);
  assert.deepEqual(view.legalBids, []);
  assert.equal(view.isMyTurn, false);

  const alleHaende = SEATS.flatMap((seat) => state.hands[seat]!.map((card) => card.id));
  const gezeigt = alleKartenIn(view);
  for (const id of alleHaende) {
    assert.ok(!gezeigt.includes(id), `Zuschauer sieht Karte ${id}`);
  }
});

test('Offene Ansagen stehen sofort in der Sicht, verdeckte nicht', () => {
  const offen = bidAll(roundMitAufdeck(makeRuleSet(), (c) => c?.suit === 'H'), [1, 2]);
  assert.deepEqual(viewFor(offen, 3).bids, { 1: 1, 2: 2 });
  assert.equal(viewFor(offen, 3).bidTotal, 3);

  const rs = makeRuleSet({ hiddenBids: true });
  const verdeckt = bidAll(roundMitAufdeck(rs, (c) => c?.suit === 'H'), [1, 2]);
  // Sitz 3 hat selbst noch nicht angesagt und sieht deshalb gar nichts.
  assert.deepEqual(viewFor(verdeckt, 3).bids, {});
  assert.equal(viewFor(verdeckt, 3).bidTotal, null);
  // Die eigene Ansage bleibt sichtbar, sonst weiss man nicht, was man sagte.
  assert.deepEqual(viewFor(verdeckt, 1).bids, { 1: 1 });
});

test('Nach der letzten verdeckten Ansage liegen alle offen', () => {
  const rs = makeRuleSet({ hiddenBids: true });
  const fertig = bidAll(roundMitAufdeck(rs, (c) => c?.suit === 'H'), [1, 2, 0, 0]);
  const view = viewFor(fertig, 3);
  assert.deepEqual(view.bids, { 1: 1, 2: 2, 3: 0, 0: 0 });
  assert.equal(view.bidTotal, 3);
});

test('Blinde Runde: fremde Karten sichtbar, die eigene nirgends', () => {
  const rs = makeRuleSet({ blindFirstRound: true });
  const state = createRound(rs, SEATS, 0, 1, 5);
  const view = viewFor(state, 2);

  assert.equal(view.blind, true);
  assert.deepEqual(view.hand, []);
  assert.deepEqual(view.legal, []);
  assert.equal(Object.keys(view.blindHands ?? {}).length, 3);

  const eigene = state.hands[2]![0]!.id;
  assert.ok(!alleKartenIn(view).includes(eigene), 'Die eigene Karte steht in der Sicht');
});

test('Blinde Runde: Zuschauer sehen auch dort keine Hand', () => {
  const rs = makeRuleSet({ blindFirstRound: true });
  const state = createRound(rs, SEATS, 0, 1, 5);
  const view = spectatorView(state);
  assert.equal(view.blindHands, null);
  assert.equal(alleKartenIn(view).length, view.upcard ? 1 : 0);
});

test('Geber waehlt blind: waehrend der Wahl sieht er seine Hand nicht', () => {
  const rs = makeRuleSet({ dealerPicksBlind: true });
  const state = roundMitAufdeck(rs, (card) => card?.suit === 'Z');

  const geber = viewFor(state, 0);
  assert.equal(geber.phase, 'trump');
  assert.deepEqual(geber.hand, []);
  assert.equal(geber.awaitingTrump, 0);

  // Die anderen sehen ihre Haende ganz normal - sie waehlen ja nicht.
  assert.equal(viewFor(state, 1).hand.length, 3);
});

test('Nach der Wahl bekommt der Geber seine Hand zurueck', () => {
  const rs = makeRuleSet({ dealerPicksBlind: true });
  const state = roundMitAufdeck(rs, (card) => card?.suit === 'Z');
  const nach = { ...state, phase: 'bidding' as const, trump: 'H' as const, turn: 1 };
  assert.equal(viewFor(nach, 0).hand.length, 3);
});

test('Ohne die Hausregel sieht der Geber beim Waehlen seine Karten', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'Z');
  assert.equal(viewFor(state, 0).hand.length, 3);
});

test('Die Rangfolge in der Sicht passt zum gueltigen Trumpf', () => {
  const state = roundMitAufdeck(makeRuleSet(), (card) => card?.suit === 'H');
  const view = viewFor(state, 1);
  assert.equal(view.order.trumps[0], 'Z1');
  assert.equal(view.order.trumps[4], 'H13');
});
