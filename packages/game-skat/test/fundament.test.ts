import { test } from 'node:test';
import assert from 'node:assert/strict';

import { type Card, augen, cardFromKey, createDeck, sumAugen } from '../src/cards.js';
import { type GameType, effectiveSuit, isTrump, legalCards, winningIndex } from '../src/order.js';
import { farbGrandWert, naechsterReiz, reizLeiter, spitzen } from '../src/spielwert.js';

const DECK = createDeck();
const k = (key: string): Card => {
  const c = cardFromKey(key, DECK);
  if (!c) throw new Error(`Karte ${key} gibt es nicht`);
  return c;
};

test('Augen: das ganze Blatt sind 120', () => {
  assert.equal(sumAugen(DECK), 120);
  assert.equal(augen(k('CA')), 11);
  assert.equal(augen(k('CT')), 10);
  assert.equal(augen(k('CK')), 4);
  assert.equal(augen(k('CQ')), 3);
  assert.equal(augen(k('CJ')), 2);
  assert.equal(augen(k('C7')), 0);
});

const HERZ: GameType = { kind: 'suit', trump: 'H' };
const GRAND: GameType = { kind: 'grand' };
const NULL: GameType = { kind: 'null' };

test('Farbspiel: Buben sind Trumpf, Kreuz-Bube schlaegt alle', () => {
  assert.equal(isTrump(k('CJ'), HERZ), true);
  assert.equal(isTrump(k('DJ'), HERZ), true);
  assert.equal(isTrump(k('HA'), HERZ), true); // Trumpffarbe
  assert.equal(isTrump(k('SA'), HERZ), false); // Fehlfarbe
  assert.equal(effectiveSuit(k('DJ'), HERZ), 'trumpf');
  // Kreuz-Bube gegen Pik-Bube: Kreuz gewinnt.
  assert.equal(winningIndex([k('SJ'), k('CJ')], HERZ), 1);
  // Bube schlaegt Trumpf-Ass.
  assert.equal(winningIndex([k('HA'), k('DJ')], HERZ), 1);
  // Innerhalb der Trumpffarbe: Ass ueber Zehn ueber Koenig.
  assert.equal(winningIndex([k('HK'), k('HT'), k('HA')], HERZ), 2);
  assert.equal(winningIndex([k('HK'), k('HT')], HERZ), 1);
});

test('Grand: nur Buben stechen', () => {
  assert.equal(isTrump(k('HA'), GRAND), false);
  assert.equal(isTrump(k('DJ'), GRAND), true);
  // Ass angespielt, ein Bube sticht.
  assert.equal(winningIndex([k('SA'), k('S7'), k('DJ')], GRAND), 2);
  // Ohne Bube gewinnt das hoechste der angespielten Farbe.
  assert.equal(winningIndex([k('SK'), k('SA'), k('S7')], GRAND), 1);
});

test('Null: kein Trumpf, Zehn faellt zurueck, Bube ist normal', () => {
  assert.equal(isTrump(k('CJ'), NULL), false);
  // Angespielt Pik: Koenig schlaegt Zehn (Zehn steht unter Bube).
  assert.equal(winningIndex([k('SK'), k('ST')], NULL), 0);
  // Ass ueber Koenig.
  assert.equal(winningIndex([k('SK'), k('SA')], NULL), 1);
  // Bube schlaegt Zehn, aber nicht Dame.
  assert.equal(winningIndex([k('SJ'), k('ST')], NULL), 0);
  assert.equal(winningIndex([k('SQ'), k('SJ')], NULL), 0);
});

test('Bedienpflicht: angespielte Farbe muss bekannt werden', () => {
  const hand = [k('SA'), k('S7'), k('HK'), k('DJ')];
  // Pik angespielt: nur die beiden Pik sind zulaessig.
  const zuPik = legalCards(hand, [k('SK')], HERZ);
  assert.deepEqual(new Set(zuPik.map((c) => c.id)), new Set([k('SA').id, k('S7').id]));
  // Trumpf angespielt (Herz): Herz-Koenig UND der Bube (Bube ist Trumpf).
  const zuTrumpf = legalCards(hand, [k('HA')], HERZ);
  assert.deepEqual(new Set(zuTrumpf.map((c) => c.id)), new Set([k('HK').id, k('DJ').id]));
  // Karo angespielt, keins auf der Hand: alles frei.
  assert.equal(legalCards(hand, [k('DA')], HERZ).length, 4);
});

test('Spitzen: mit und ohne, an der Bubenreihe gezaehlt', () => {
  // Haelt Kreuz- und Pik-Bube, nicht Herz-Bube: mit 2.
  assert.equal(spitzen([k('CJ'), k('SJ'), k('S7')], GRAND, DECK), 2);
  // Ohne Kreuz-Bube, haelt Pik-Bube: ohne 1.
  assert.equal(spitzen([k('SJ'), k('HJ')], GRAND, DECK), 1);
  // Gar kein Bube: ohne 4.
  assert.equal(spitzen([k('SA'), k('HA')], GRAND, DECK), 4);
  // Alle vier Buben: mit 4.
  assert.equal(spitzen([k('CJ'), k('SJ'), k('HJ'), k('DJ')], GRAND, DECK), 4);
});

test('Spielwert: Grundwert mal Stufe', () => {
  // Kreuz mit 2, Hand: (2 + 1 Spiel + 1 Hand) = 4, mal 12 = 48.
  assert.equal(
    farbGrandWert(
      { kind: 'suit', trump: 'C' },
      {
        spitzenN: 2,
        hand: true,
        schneider: false,
        schneiderAngesagt: false,
        schwarz: false,
        schwarzAngesagt: false,
        ouvert: false,
      },
    ),
    48,
  );
  // Grand ohne 1, einfaches Spiel: (1 + 1) = 2, mal 24 = 48.
  assert.equal(
    farbGrandWert(GRAND, {
      spitzenN: 1,
      hand: false,
      schneider: false,
      schneiderAngesagt: false,
      schwarz: false,
      schwarzAngesagt: false,
      ouvert: false,
    }),
    48,
  );
});

test('Reizleiter: die kleinen Werte stehen drin, in der richtigen Folge', () => {
  const leiter = reizLeiter();
  for (const w of [18, 20, 22, 23, 24, 27, 30, 33, 35, 36]) {
    assert.ok(leiter.includes(w), `${w} fehlt in der Reizleiter`);
  }
  assert.equal(naechsterReiz(18), 20);
  assert.equal(naechsterReiz(24), 27);
});
