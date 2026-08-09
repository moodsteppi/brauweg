import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handValue, scoreRound } from '../src/scoring.js';
import { makeRuleSet } from '../src/ruleset.js';
import { c } from './helpers.js';

const SEATS = [0, 1, 2, 3];
const rs = makeRuleSet();

test('die Handsumme zaehlt alle vier Karten', () => {
  assert.equal(handValue([c('C1'), c('C2'), c('C3'), c('C4')], rs), 10);
});

test('der rote Koenig macht die Hand billig', () => {
  const hand = [c('H13'), c('D13'), c('C1'), c('C2')];
  assert.equal(handValue(hand, rs), 3);
  assert.equal(handValue(hand, makeRuleSet({ redKingZero: false })), 29);
});

test('ohne Ruf bekommt jeder schlicht seine Summe', () => {
  const hands = {
    0: [c('C1'), c('C1'), c('C1'), c('C1')],
    1: [c('C5'), c('C5'), c('C5'), c('C5')],
    2: [c('C2'), c('C2'), c('C2'), c('C2')],
    3: [c('C3'), c('C3'), c('C3'), c('C3')],
  };
  const r = scoreRound(rs, SEATS, hands, null);

  assert.deepEqual(r.scores, { 0: 4, 1: 20, 2: 8, 3: 12 });
  assert.equal(r.callSucceeded, null);
});

test('ein gelungener Ruf bringt null statt der Summe', () => {
  const hands = {
    0: [c('C1'), c('C1'), c('C1'), c('C1')], // 4, der Rufer
    1: [c('C5'), c('C5'), c('C5'), c('C5')], // 20
    2: [c('C2'), c('C2'), c('C2'), c('C2')], // 8
    3: [c('C3'), c('C3'), c('C3'), c('C3')], // 12
  };
  const r = scoreRound(rs, SEATS, hands, 0);

  assert.equal(r.callSucceeded, true);
  assert.equal(r.scores[0], 0, 'der Rufer bekommt null');
  assert.equal(r.raw[0], 4, 'die Rohsumme bleibt nachvollziehbar');
  assert.equal(r.scores[1], 20, 'die anderen unveraendert');
});

test('ein misslungener Ruf kostet die Summe plus Strafe', () => {
  const hands = {
    0: [c('C5'), c('C5'), c('C5'), c('C5')], // 20, der Rufer
    1: [c('C1'), c('C1'), c('C1'), c('C1')], // 4 - besser
    2: [c('C9'), c('C9'), c('C9'), c('C9')],
    3: [c('C9'), c('C9'), c('C9'), c('C9')],
  };
  const r = scoreRound(rs, SEATS, hands, 0);

  assert.equal(r.callSucceeded, false);
  assert.equal(r.scores[0], 25, '20 plus 5 Strafe');
});

test('bei Gleichstand misslingt der Ruf - so ist die Vorgabe', () => {
  const hands = {
    0: [c('C2'), c('C2'), c('C2'), c('C2')], // 8, der Rufer
    1: [c('C2'), c('C2'), c('C2'), c('C2')], // 8 - gleichauf
    2: [c('C9'), c('C9'), c('C9'), c('C9')],
    3: [c('C9'), c('C9'), c('C9'), c('C9')],
  };
  const r = scoreRound(rs, SEATS, hands, 0);

  assert.equal(r.callSucceeded, false);
  assert.equal(r.scores[0], 13, '8 plus 5');
});

test('mit der milderen Hausregel genuegt Gleichstand', () => {
  const hands = {
    0: [c('C2'), c('C2'), c('C2'), c('C2')],
    1: [c('C2'), c('C2'), c('C2'), c('C2')],
    2: [c('C9'), c('C9'), c('C9'), c('C9')],
    3: [c('C9'), c('C9'), c('C9'), c('C9')],
  };
  const r = scoreRound(makeRuleSet({ callerMustBeStrictlyLower: false }), SEATS, hands, 0);

  assert.equal(r.callSucceeded, true);
  assert.equal(r.scores[0], 0);
});

test('die Strafhoehe kommt aus dem Regelsatz', () => {
  const hands = {
    0: [c('C5'), c('C5'), c('C5'), c('C5')],
    1: [c('C1'), c('C1'), c('C1'), c('C1')],
    2: [c('C9'), c('C9'), c('C9'), c('C9')],
    3: [c('C9'), c('C9'), c('C9'), c('C9')],
  };
  const r = scoreRound(makeRuleSet({ failPenalty: 10 }), SEATS, hands, 0);
  assert.equal(r.scores[0], 30, '20 plus 10');
});
