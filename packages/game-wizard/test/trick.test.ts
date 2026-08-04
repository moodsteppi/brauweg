import { test } from 'node:test';
import assert from 'node:assert/strict';

import { type Played, leadSuit, legalCards, winnerOf } from '../src/trick.js';
import { c } from './helpers.js';

function stich(...eintraege: [number, string][]): Played[] {
  return eintraege.map(([seat, key]) => ({ seat, card: c(key) }));
}

// --- Gewinner ---------------------------------------------------------------

test('Der zuerst gespielte Zauberer gewinnt, nicht der hoechste', () => {
  const played = stich([0, 'H13'], [1, 'Z3'], [2, 'Z1'], [3, 'H12']);
  assert.equal(winnerOf(played, 'H'), 1);
});

test('Ein Zauberer schlaegt auch den hoechsten Trumpf', () => {
  const played = stich([0, 'C13'], [1, 'Z1']);
  assert.equal(winnerOf(played, 'C'), 1);
});

test('Ohne Zauberer gewinnt der hoechste Trumpf', () => {
  const played = stich([0, 'H13'], [1, 'C2'], [2, 'C9'], [3, 'H12']);
  assert.equal(winnerOf(played, 'C'), 2);
});

test('Ohne Trumpf im Stich gewinnt die hoechste Karte der angespielten Farbe', () => {
  const played = stich([0, 'H7'], [1, 'H13'], [2, 'D13'], [3, 'H9']);
  assert.equal(winnerOf(played, 'C'), 1);
});

test('Eine hohe Fehlfarbe gewinnt nie gegen die angespielte Farbe', () => {
  const played = stich([0, 'H2'], [1, 'D13'], [2, 'S13']);
  assert.equal(winnerOf(played, null), 0);
});

test('Nur Narren: der erste gewinnt', () => {
  const played = stich([2, 'N1'], [3, 'N4'], [0, 'N2']);
  assert.equal(winnerOf(played, 'H'), 2);
});

test('Narr angespielt: die naechste echte Karte setzt die Farbe', () => {
  const played = stich([0, 'N1'], [1, 'D5'], [2, 'H13'], [3, 'D9']);
  assert.equal(leadSuit(played), 'D');
  assert.equal(winnerOf(played, null), 3);
});

test('Zauberer angespielt: es gibt keine zu bedienende Farbe', () => {
  const played = stich([0, 'Z1'], [1, 'D5']);
  assert.equal(leadSuit(played), null);
  assert.equal(winnerOf(played, 'D'), 0);
});

test('Ein Narr gewinnt nie gegen eine echte Karte', () => {
  const played = stich([0, 'D2'], [1, 'N1']);
  assert.equal(winnerOf(played, 'N' as never), 0);
});

test('Trumpf sticht, auch wenn er als letzte Karte kommt', () => {
  const played = stich([0, 'H13'], [1, 'H12'], [2, 'C1']);
  assert.equal(winnerOf(played, 'C'), 2);
});

test('Leerer Stich hat keinen Gewinner', () => {
  assert.throws(() => winnerOf([], 'H'));
});

// --- Hausregel "Der letzte sticht" -----------------------------------------

test('Hausregel: der zuletzt gelegte Zauberer gewinnt', () => {
  const played = stich([0, 'H13'], [1, 'Z3'], [2, 'Z1'], [3, 'H12']);
  assert.equal(winnerOf(played, 'H', true), 2);
  // Gegenprobe: ohne die Regel gewinnt der erste.
  assert.equal(winnerOf(played, 'H', false), 1);
});

test('Hausregel: bei lauter Narren gewinnt der letzte', () => {
  const played = stich([2, 'N1'], [3, 'N4'], [0, 'N2']);
  assert.equal(winnerOf(played, 'H', true), 0);
  assert.equal(winnerOf(played, 'H', false), 2);
});

test('Hausregel: ein einzelner Zauberer gewinnt so oder so', () => {
  const played = stich([0, 'H13'], [1, 'Z1'], [2, 'H12']);
  assert.equal(winnerOf(played, 'H', true), 1);
  assert.equal(winnerOf(played, 'H', false), 1);
});

test('Hausregel laesst Trumpf und Farbe unberuehrt', () => {
  // Bei Trumpf und Fehlfarbe entscheidet die Hoehe, nie die Reihenfolge.
  const truempfe = stich([0, 'C9'], [1, 'C13'], [2, 'C2']);
  assert.equal(winnerOf(truempfe, 'C', true), 1);
  const farbe = stich([0, 'H7'], [1, 'H13'], [2, 'H9']);
  assert.equal(winnerOf(farbe, 'D', true), 1);
});

test('Hausregel: Narr und Zauberer im selben Stich - der Zauberer schlaegt', () => {
  const played = stich([0, 'N1'], [1, 'Z1'], [2, 'N2']);
  assert.equal(winnerOf(played, null, true), 1);
});

// --- Bedienpflicht ----------------------------------------------------------

const hand = [c('H5'), c('H12'), c('D3'), c('Z1'), c('N1')];

test('Wer bedienen kann, muss - Zauberer und Narr bleiben trotzdem erlaubt', () => {
  const legal = legalCards(hand, stich([3, 'H9']), 'C').map((card) => card.suit + card.rank);
  assert.deepEqual(new Set(legal), new Set(['H5', 'H12', 'Z1', 'N1']));
});

test('Wer die Farbe nicht hat, darf alles spielen', () => {
  const legal = legalCards(hand, stich([3, 'S9']), 'C');
  assert.equal(legal.length, hand.length);
});

test('Bei leerem Stich ist alles erlaubt', () => {
  assert.equal(legalCards(hand, [], 'C').length, hand.length);
});

test('Nach angespieltem Zauberer ist alles erlaubt', () => {
  assert.equal(legalCards(hand, stich([3, 'Z2']), 'C').length, hand.length);
});

test('Nach angespieltem Narren gilt erst die naechste echte Karte', () => {
  assert.equal(legalCards(hand, stich([3, 'N2']), 'C').length, hand.length);
  const legal = legalCards(hand, stich([3, 'N2'], [0, 'H4']), 'C');
  assert.deepEqual(
    new Set(legal.map((card) => card.suit + card.rank)),
    new Set(['H5', 'H12', 'Z1', 'N1']),
  );
});

test('Trumpf muss nie bedient werden', () => {
  const nurFehl = [c('D3'), c('S8')];
  assert.equal(legalCards(nurFehl, stich([3, 'H9']), 'H').length, 2);
});
