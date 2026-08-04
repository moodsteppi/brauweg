import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreFor, scoreRound } from '../src/scoring.js';
import { makeRuleSet } from '../src/ruleset.js';

const standard = makeRuleSet();
const mitBonus = makeRuleSet({ zeroBonus: true });

test('Getroffen: 20 plus 10 je Stich', () => {
  assert.equal(scoreFor(0, 0, 5, standard), 20);
  assert.equal(scoreFor(1, 1, 5, standard), 30);
  assert.equal(scoreFor(3, 3, 5, standard), 50);
});

test('Daneben: 10 Minuspunkte je Stich Abweichung', () => {
  assert.equal(scoreFor(3, 5, 5, standard), -20);
  assert.equal(scoreFor(3, 0, 5, standard), -30);
  assert.equal(scoreFor(0, 2, 5, standard), -20);
});

test('Null-Bonus: gehaltene Null zaehlt nach Rundennummer', () => {
  assert.equal(scoreFor(0, 0, 1, mitBonus), 10);
  assert.equal(scoreFor(0, 0, 12, mitBonus), 120);
  // Verfehlt bleibt verfehlt, auch mit Bonus.
  assert.equal(scoreFor(0, 1, 12, mitBonus), -10);
  // Andere Ansagen ruehrt der Bonus nicht an.
  assert.equal(scoreFor(2, 2, 12, mitBonus), 40);
});

test('Ohne Bonus ist die gehaltene Null in jeder Runde 20 wert', () => {
  assert.equal(scoreFor(0, 0, 1, standard), 20);
  assert.equal(scoreFor(0, 0, 12, standard), 20);
});

test('Rundenabrechnung deckt alle Sitze ab', () => {
  const result = scoreRound(
    [0, 1, 2, 3],
    { 0: 2, 1: 0, 2: 1, 3: 0 },
    { 0: 2, 1: 1, 2: 0, 3: 0 },
    3,
    standard,
  );
  assert.deepEqual(result.scores, { 0: 40, 1: -10, 2: -10, 3: 20 });
});

test('Die Stichsumme einer Runde ist die Handgroesse', () => {
  const tricks = { 0: 2, 1: 1, 2: 0, 3: 0 };
  assert.equal(Object.values(tricks).reduce((a, b) => a + b, 0), 3);
});
