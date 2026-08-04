/**
 * Eigenschaften, die ueber viele Gaben gelten muessen.
 *
 * Einzelfaelle pruefen die anderen Dateien. Hier laufen ganze Partien mit
 * wechselnden Seeds, Tischgroessen und Hausregeln durch - was hier bricht,
 * bricht auch am echten Tisch, nur seltener.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DECK_SIZE, cardKey, createDeck } from '../src/cards.js';
import { deal, makeRng, shuffle } from '../src/deal.js';
import { makeRuleSet, suggestedRounds } from '../src/ruleset.js';
import { createParty } from '../src/party.js';
import { scoreFor } from '../src/scoring.js';
import { playOut } from './helpers.js';

test('Invariante: jedes Geben benutzt jede Karte hoechstens einmal', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const seats of [3, 4, 5, 6]) {
      const handSize = 1 + (seed % Math.floor(DECK_SIZE / seats));
      const { hands, upcard } = deal(seats, handSize, `${seed.toString(16)}beef`);
      const ids = hands.flat().map((card) => card.id);
      if (upcard) ids.push(upcard.id);
      assert.equal(new Set(ids).size, ids.length, `Seed ${seed}, ${seats} Sitze`);
      assert.ok(ids.length <= DECK_SIZE);
      for (const hand of hands) assert.equal(hand.length, handSize);
    }
  }
});

test('Invariante: Mischen erhaelt das Deck vollstaendig', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const gemischt = shuffle(createDeck(), makeRng(seed));
    assert.equal(gemischt.length, DECK_SIZE);
    assert.equal(new Set(gemischt.map(cardKey)).size, DECK_SIZE);
  }
});

test('Invariante: jede gespielte Partie rechnet nach der Formel ab', () => {
  const varianten = [
    makeRuleSet({ rounds: 5 }),
    makeRuleSet({ rounds: 5, zeroBonus: true }),
    makeRuleSet({ rounds: 5, bidSumForbidden: true }),
    makeRuleSet({ rounds: 5, hiddenBids: true }),
    makeRuleSet({ rounds: 5, noTrump: true }),
    makeRuleSet({ rounds: 5, blindFirstRound: true, dealerPicksBlind: true }),
    makeRuleSet({ rounds: 5, jesterPicksTrump: true }),
    makeRuleSet({ rounds: 5, lastSpecialWins: true }),
  ];

  for (const rs of varianten) {
    for (let seed = 1; seed <= 12; seed++) {
      const fertig = playOut(createParty(rs, [0, 1, 2, 3], seed));
      assert.equal(fertig.history.length, rs.rounds);

      for (const runde of fertig.history) {
        // Stiche summieren sich auf die Handgroesse.
        assert.equal(
          Object.values(runde.tricks).reduce((a, b) => a + b, 0),
          runde.roundNumber,
        );
        // Punkte folgen der Wertung, ohne Ausnahme.
        for (const seat of [0, 1, 2, 3]) {
          assert.equal(
            runde.scores[seat],
            scoreFor(runde.bids[seat]!, runde.tricks[seat]!, runde.roundNumber, rs),
            `Seed ${seed}, Runde ${runde.roundNumber}, Sitz ${seat}`,
          );
        }
        // Jeder hat angesagt, und niemand mehr als moeglich.
        for (const seat of [0, 1, 2, 3]) {
          const bid = runde.bids[seat];
          assert.ok(bid !== undefined && bid >= 0 && bid <= runde.roundNumber);
        }
      }
    }
  }
});

test('Invariante: "Es darf nicht aufgehen" geht nie auf', () => {
  const rs = makeRuleSet({ rounds: 6, bidSumForbidden: true });
  for (let seed = 1; seed <= 25; seed++) {
    const fertig = playOut(createParty(rs, [0, 1, 2, 3], seed));
    for (const runde of fertig.history) {
      const summe = Object.values(runde.bids).reduce((a, b) => a + b, 0);
      assert.notEqual(summe, runde.roundNumber, `Seed ${seed}, Runde ${runde.roundNumber}`);
    }
  }
});

test('Invariante: ohne diese Hausregel darf es sehr wohl aufgehen', () => {
  // Gegenprobe - sonst wuerde der Test darueber auch dann gruen bleiben, wenn
  // die Summe aus einem ganz anderen Grund nie passt.
  let gesehen = false;
  const rs = makeRuleSet({ rounds: 8 });
  for (let seed = 1; seed <= 40 && !gesehen; seed++) {
    const fertig = playOut(createParty(rs, [0, 1, 2, 3], seed));
    gesehen = fertig.history.some(
      (runde) =>
        Object.values(runde.bids).reduce((a, b) => a + b, 0) === runde.roundNumber,
    );
  }
  assert.ok(gesehen, 'In keiner Runde ging die Ansagesumme auf');
});

test('Invariante: alle vorgeschlagenen Rundenzahlen sind spielbar', () => {
  for (const seats of [3, 4, 5, 6]) {
    const sitze = Array.from({ length: seats }, (_, i) => i);
    for (const rounds of suggestedRounds(seats)) {
      const fertig = playOut(createParty(makeRuleSet({ tableSize: seats, rounds }), sitze, 3));
      assert.equal(fertig.history.length, rounds, `${seats} Sitze, ${rounds} Runden`);
    }
  }
});

test('Invariante: die Punktesumme einer Runde ist nie zufaellig hoch', () => {
  // Obergrenze: Alle treffen. Untergrenze: alle verfehlen um das Aeusserste.
  const rs = makeRuleSet({ rounds: 10 });
  for (let seed = 1; seed <= 10; seed++) {
    const fertig = playOut(createParty(rs, [0, 1, 2, 3], seed));
    for (const runde of fertig.history) {
      const summe = Object.values(runde.scores).reduce((a, b) => a + b, 0);
      assert.ok(summe <= 4 * (20 + 10 * runde.roundNumber));
      assert.ok(summe >= -4 * 10 * runde.roundNumber);
    }
  }
});
