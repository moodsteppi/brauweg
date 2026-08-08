import { test } from 'node:test';
import assert from 'node:assert/strict';

import { actionOf, createDeck, isRed, points } from '../src/cards.js';
import { c } from './helpers.js';

test('das Blatt hat 52 verschiedene Karten', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((k) => k.id)).size, 52);
  assert.equal(new Set(deck.map((k) => `${k.suit}${k.rank}`)).size, 52);
});

test('der rote Koenig zaehlt null, der schwarze dreizehn', () => {
  // Das ist die Regel, um die sich das ganze Spiel dreht: zwei Karten mit
  // demselben Rang und dem groesstmoeglichen Wertunterschied.
  assert.equal(points(c('H13'), true), 0);
  assert.equal(points(c('D13'), true), 0);
  assert.equal(points(c('S13'), true), 13);
  assert.equal(points(c('C13'), true), 13);
});

test('ohne die Hausregel zaehlt auch der rote Koenig dreizehn', () => {
  assert.equal(points(c('H13'), false), 13);
  assert.equal(points(c('S13'), false), 13);
});

test('Ass zaehlt eins, Zahlen ihren Wert, Bube und Dame elf und zwoelf', () => {
  assert.equal(points(c('C1'), true), 1);
  assert.equal(points(c('C7'), true), 7);
  assert.equal(points(c('C11'), true), 11);
  assert.equal(points(c('C12'), true), 12);
});

test('rot sind Herz und Karo', () => {
  assert.equal(isRed(c('H5')), true);
  assert.equal(isRed(c('D5')), true);
  assert.equal(isRed(c('S5')), false);
  assert.equal(isRed(c('C5')), false);
});

test('die Aktionskarten haengen am Rang, nicht an der Farbe', () => {
  assert.equal(actionOf(c('C7')), 'peekOwn');
  assert.equal(actionOf(c('H8')), 'peekOwn');
  assert.equal(actionOf(c('S9')), 'peekOther');
  assert.equal(actionOf(c('D10')), 'peekOther');
  assert.equal(actionOf(c('C11')), 'blindSwap');
  assert.equal(actionOf(c('C12')), 'lookAndSwap');
  assert.equal(actionOf(c('C13')), null);
  assert.equal(actionOf(c('C1')), null);
  assert.equal(actionOf(c('C6')), null);
});
