import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeRuleSet } from '../src/ruleset.js';
import { createParty, dealerOf, markLeft, standings, startRound } from '../src/party.js';
import { validateRuleSet } from '../src/validator.js';
import { playOut } from './helpers.js';

const SEATS = [0, 1, 2, 3];

test('Eine Partie beginnt mit einer Karte und waechst je Runde', () => {
  const party = startRound(createParty(makeRuleSet({ rounds: 4 }), SEATS, 1));
  assert.equal(party.current?.handSize, 1);
  assert.equal(party.current?.roundNumber, 1);

  const fertig = playOut(party);
  assert.equal(fertig.history.length, 4);
  assert.deepEqual(
    fertig.history.map((h) => h.roundNumber),
    [1, 2, 3, 4],
  );
});

test('Der Geber wechselt nach jeder Runde', () => {
  const party = createParty(makeRuleSet({ rounds: 6 }), SEATS, 3);
  assert.equal(dealerOf(party), 0);
  const fertig = playOut(party);
  assert.deepEqual(
    fertig.history.map((h) => h.dealer),
    [0, 1, 2, 3, 0, 1],
  );
});

test('Jede Runde verteilt genau so viele Stiche, wie sie Karten hat', () => {
  const fertig = playOut(createParty(makeRuleSet({ rounds: 8 }), SEATS, 42));
  for (const runde of fertig.history) {
    const summe = Object.values(runde.tricks).reduce((a, b) => a + b, 0);
    assert.equal(summe, runde.roundNumber, `Runde ${runde.roundNumber}`);
  }
});

test('Der Gesamtstand ist die Summe der Rundenpunkte', () => {
  const fertig = playOut(createParty(makeRuleSet({ rounds: 6 }), SEATS, 7));
  for (const seat of SEATS) {
    const summe = fertig.history.reduce((acc, runde) => acc + (runde.scores[seat] ?? 0), 0);
    assert.equal(fertig.scores[seat], summe);
    assert.equal(fertig.history[fertig.history.length - 1]!.totals[seat], summe);
  }
});

test('Nach der letzten Runde ist die Partie beendet', () => {
  const fertig = playOut(createParty(makeRuleSet({ rounds: 3 }), SEATS, 9));
  assert.equal(fertig.finished, true);
  assert.equal(fertig.current, null);
  assert.throws(() => startRound(fertig));
});

test('Platzierung: bester Punktestand ist Platz 1', () => {
  const fertig = playOut(createParty(makeRuleSet({ rounds: 5 }), SEATS, 4));
  const tabelle = standings(fertig);
  const sortiert = [...tabelle].sort((a, b) => a.place - b.place);
  for (let i = 1; i < sortiert.length; i++) {
    assert.ok(sortiert[i - 1]!.points >= sortiert[i]!.points);
  }
  assert.equal(sortiert[0]!.place, 1);
});

test('Gleichstand teilt sich denselben Platz', () => {
  const party = createParty(makeRuleSet({ rounds: 2 }), SEATS, 1);
  const gleich = { ...party, scores: { 0: 30, 1: 30, 2: 10, 3: -20 }, finished: true };
  const tabelle = standings(gleich);
  assert.equal(tabelle.find((s) => s.seat === 0)!.place, 1);
  assert.equal(tabelle.find((s) => s.seat === 1)!.place, 1);
  assert.equal(tabelle.find((s) => s.seat === 2)!.place, 3);
  assert.equal(tabelle.find((s) => s.seat === 3)!.place, 4);
});

test('Ein Aussteiger wird in der Platzierung vermerkt', () => {
  const party = markLeft(createParty(makeRuleSet({ rounds: 2 }), SEATS, 1), 2);
  assert.deepEqual(party.leftSeats, [2]);
  assert.equal(standings(party).find((s) => s.seat === 2)!.left, true);
  // Zweimal melden aendert nichts.
  assert.deepEqual(markLeft(party, 2).leftSeats, [2]);
});

test('Zu viele Runden fuer das Blatt werden abgewiesen', () => {
  assert.throws(() => createParty(makeRuleSet({ rounds: 16 }), SEATS, 1));
  assert.throws(() => createParty(makeRuleSet({ rounds: 0 }), SEATS, 1));
  // 15 ist bei vier Spielern genau das ganze Blatt.
  assert.ok(createParty(makeRuleSet({ rounds: 15 }), SEATS, 1));
});

test('Die Sitzzahl muss zur Tischgroesse passen', () => {
  assert.throws(() => createParty(makeRuleSet({ tableSize: 5, rounds: 4 }), SEATS, 1));
});

test('Alle Tischgroessen spielen eine volle Partie durch', () => {
  for (const seats of [3, 4, 5, 6]) {
    const sitze = Array.from({ length: seats }, (_, i) => i);
    const rounds = Math.floor(60 / seats);
    const rs = makeRuleSet({ tableSize: seats, rounds });
    const fertig = playOut(createParty(rs, sitze, 100 + seats));
    assert.equal(fertig.history.length, rounds, `${seats} Spieler`);
    // Letzte Runde: das ganze Blatt ist verteilt, es gibt keinen Trumpf.
    assert.equal(fertig.history[rounds - 1]!.trump, null);
  }
});

test('Der Validator meldet widerspruechliche Hausregeln', () => {
  const codes = (rs: Parameters<typeof validateRuleSet>[0]): string[] =>
    validateRuleSet(rs).map((i) => i.code);

  assert.deepEqual(codes(makeRuleSet()), []);
  assert.ok(codes(makeRuleSet({ noTrump: true, jesterPicksTrump: true })).includes('noTrumpVsJesterPicks'));
  assert.ok(codes(makeRuleSet({ noTrump: true, dealerPicksBlind: true })).includes('noTrumpVsDealerPicks'));
  assert.ok(codes(makeRuleSet({ hiddenBids: true, bidSumForbidden: true })).includes('hiddenBidsVsBidSum'));
  assert.ok(codes(makeRuleSet({ tableSize: 7 })).includes('tableSizeUnsupported'));
  assert.ok(codes(makeRuleSet({ rounds: 99 })).includes('roundsOutOfRange'));
});

test('Alle Hausregeln zusammen, soweit sie sich vertragen', () => {
  const rs = makeRuleSet({
    zeroBonus: true,
    blindFirstRound: true,
    bidSumForbidden: true,
    dealerPicksBlind: true,
    lastSpecialWins: true,
    rounds: 6,
  });
  assert.deepEqual(validateRuleSet(rs), []);
  const fertig = playOut(createParty(rs, SEATS, 21));
  assert.equal(fertig.history.length, 6);
});
