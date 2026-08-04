import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DECK_SIZE,
  cardKey,
  createDeck,
  fullRounds,
  isJester,
  isSuitCard,
  isWizard,
  value,
} from '../src/cards.js';
import { buildOrder } from '../src/order.js';
import { deal } from '../src/deal.js';
import { c } from './helpers.js';

test('Deck: 60 Karten, jede genau einmal', () => {
  const deck = createDeck();
  assert.equal(deck.length, DECK_SIZE);
  assert.equal(new Set(deck.map(cardKey)).size, DECK_SIZE);
  assert.equal(new Set(deck.map((card) => card.id)).size, DECK_SIZE);
});

test('Deck: 52 Farbkarten, 4 Zauberer, 4 Narren', () => {
  const deck = createDeck();
  assert.equal(deck.filter(isSuitCard).length, 52);
  assert.equal(deck.filter(isWizard).length, 4);
  assert.equal(deck.filter(isJester).length, 4);
});

test('Deck: jede Farbe hat die Werte 1 bis 13', () => {
  const deck = createDeck();
  for (const suit of ['C', 'S', 'H', 'D']) {
    const werte = deck
      .filter((card) => card.suit === suit)
      .map(value)
      .sort((a, b) => a - b);
    assert.deepEqual(werte, Array.from({ length: 13 }, (_, i) => i + 1));
  }
});

test('Volle Partie: 60 Karten gehen bei 3 bis 6 Spielern restlos auf', () => {
  assert.equal(fullRounds(3), 20);
  assert.equal(fullRounds(4), 15);
  assert.equal(fullRounds(5), 12);
  assert.equal(fullRounds(6), 10);
});

test('Zauberer und Narren haben keinen Zahlenwert', () => {
  assert.equal(value(c('Z1')), 0);
  assert.equal(value(c('N3')), 0);
  assert.equal(value(c('H13')), 13);
});

test('Geben: jede Karte hoechstens einmal, Aufdeckkarte kommt aus dem Rest', () => {
  const { hands, upcard } = deal(4, 5, 'a1b2c3d4e5f60718293a4b5c6d7e8f90');
  const ids = hands.flat().map((card) => card.id);
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20);
  assert.ok(upcard);
  assert.ok(!ids.includes(upcard!.id));
});

test('Geben: letzte Runde einer vollen Partie hat keine Aufdeckkarte', () => {
  assert.equal(deal(4, 15, 12345).upcard, null);
  assert.equal(deal(6, 10, 12345).upcard, null);
  assert.equal(deal(3, 20, 12345).upcard, null);
});

test('Geben: gleicher Seed gibt dieselbe Gabe, anderer eine andere', () => {
  const a = deal(4, 6, 'feedfacefeedfacefeedfacefeedface');
  const b = deal(4, 6, 'feedfacefeedfacefeedfacefeedface');
  const d = deal(4, 6, 'feedfacefeedfacefeedfacefeedfacf');
  assert.deepEqual(a.hands, b.hands);
  assert.notDeepEqual(a.hands, d.hands);
});

test('Rangfolge deckt das ganze Deck ab, ohne Doppelte', () => {
  for (const trump of [null, 'C', 'S', 'H', 'D'] as const) {
    const order = buildOrder(trump);
    const alle = [...order.trumps, ...Object.values(order.fehl).flat()];
    assert.equal(new Set(alle).size, alle.length, `Doppelte bei Trumpf ${trump}`);
    assert.deepEqual(
      new Set(alle),
      new Set(createDeck().map(cardKey)),
      `Unvollstaendig bei Trumpf ${trump}`,
    );
  }
});

test('Rangfolge: Zauberer stehen vorn, Narren in der eigenen Gruppe', () => {
  const order = buildOrder('H');
  assert.deepEqual(order.trumps.slice(0, 4), ['Z1', 'Z2', 'Z3', 'Z4']);
  assert.equal(order.trumps[4], 'H13');
  assert.deepEqual(order.fehl.N, ['N1', 'N2', 'N3', 'N4']);
  assert.equal(order.fehl.H, undefined);
});

test('Rangfolge ohne Trumpf: nur Zauberer sind stechende Karten', () => {
  const order = buildOrder(null);
  assert.equal(order.trumps.length, 4);
});
