import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Card } from '../src/cards.js';
import { makeRuleSet } from '../src/ruleset.js';
import { buildOrder } from '../src/order.js';
import type { TrickRecord } from '../src/scoring.js';
import {
  isBride,
  resolveHochzeit,
  hochzeitReSeats,
  stilleHochzeit,
} from '../src/hochzeit.js';
import {
  canAnnounceArmut,
  countTrumps,
  handoverSize,
  handoverCards,
  exchange,
  resolveAcceptance,
} from '../src/armut.js';
import {
  countLuschen,
  countVolle,
  luscheRank,
  schmeissOption,
  applySchmeiss,
} from '../src/schmeiss.js';

let nextId = 9000;
function c(key: string): Card {
  return {
    suit: key[0] as Card['suit'],
    rank: key.slice(1) as Card['rank'],
    id: nextId++,
  };
}

/** Stich, dessen Karten egal sind; nur der Gewinner zaehlt. */
function trick(winnerSeat: number): TrickRecord {
  return {
    played: [
      { card: c('C9'), seat: 0 },
      { card: c('CK'), seat: 1 },
      { card: c('CT'), seat: 2 },
      { card: c('CA'), seat: 3 },
    ],
    winnerSeat,
  };
}

// --- Hochzeit ---

test('Braut haelt beide Kreuz-Damen', () => {
  assert.equal(isBride([c('CQ'), c('CQ'), c('HT')]), true);
  assert.equal(isBride([c('CQ'), c('SQ'), c('HT')]), false);
});

test('Hochzeit: erster fremder Stich klaert die Partnerschaft', () => {
  const rs = makeRuleSet();
  // Braut sitzt auf 0 und gewinnt den ersten Stich selbst.
  const out = resolveHochzeit([trick(0), trick(2), trick(3)], 0, rs);
  assert.equal(out.partnerSeat, 2);
  assert.equal(out.clarifiedAtTrick, 1);
  assert.equal(out.becameSolo, false);
  assert.deepEqual(hochzeitReSeats(0, out).sort(), [0, 2]);
});

test('Hochzeit: bleibt sie drei Stiche ungeklaert, spielt die Braut allein', () => {
  const rs = makeRuleSet();
  const out = resolveHochzeit([trick(0), trick(0), trick(0), trick(1)], 0, rs);
  assert.equal(out.partnerSeat, null);
  assert.equal(out.becameSolo, true);
  assert.deepEqual(hochzeitReSeats(0, out), [0]);
});

test('Hochzeit: kuerzere Klaerungsfrist wird respektiert', () => {
  const rs = makeRuleSet({ hochzeitClarifyTricks: 1 });
  const out = resolveHochzeit([trick(0), trick(2)], 0, rs);
  assert.equal(out.becameSolo, true);
});

test('Stille Hochzeit: zaehlt als Solo, erfuellt Pflichtsolo, kein Aufspiel', () => {
  const s = stilleHochzeit(2);
  assert.equal(s.scoresAsSolo, true);
  assert.equal(s.fulfillsPflichtsolo, true);
  assert.equal(s.leadsOut, false);
});

// --- Armut ---

test('Armut: ansagbar mit hoechstens drei Truempfen', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);
  const drei = [c('DA'), c('CQ'), c('DK'), c('CA'), c('SA'), c('HA')];
  const vier = [...drei, c('HJ')];
  assert.equal(countTrumps(drei, order), 3);
  assert.equal(canAnnounceArmut(drei, order), true);
  assert.equal(canAnnounceArmut(vier, order), false);
});

test('Armut: abgegeben werden genau alle Truempfe', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);
  const hand = [c('DA'), c('CQ'), c('CA'), c('SA')];
  assert.equal(handoverSize(hand, order), 2);
  const given = handoverCards(hand, order);
  assert.deepEqual(given.map((x) => x.suit + x.rank).sort(), ['CQ', 'DA']);
});

test('Armut: ohne Trumpf werden drei frei gewaehlte Karten abgegeben', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);
  const hand = [c('CA'), c('CK'), c('SA'), c('SK'), c('HA')];
  assert.equal(handoverSize(hand, order), 3);
  const choice = [hand[0], hand[1], hand[2]];
  assert.equal(handoverCards(hand, order, choice).length, 3);
  assert.throws(() => handoverCards(hand, order, [hand[0]]));
});

test('Armut: Rueckgabe muss gleich gross sein, Truempfe werden gezaehlt', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);
  const given = [c('DA'), c('CQ')];
  const returned = [c('CA'), c('DK')]; // ein Trumpf dabei
  const ex = exchange(given, returned, order);
  assert.equal(ex.returnedTrumps, 1);
  assert.throws(() => exchange(given, [c('CA')], order));
});

test('Armut: es nimmt an, wer zuerst annimmt; sonst wird neu gegeben', () => {
  assert.deepEqual(resolveAcceptance([3, 1]), { kind: 'accepted', partnerSeat: 3 });
  assert.deepEqual(resolveAcceptance([]), { kind: 'redeal' });
});

// --- Schmeissen ---

test('Lusche ist die Neun, bei Scharfem Doko der Koenig', () => {
  assert.equal(luscheRank(makeRuleSet({ deck: 'with9' })), '9');
  assert.equal(luscheRank(makeRuleSet({ deck: 'without9' })), 'K');
});

test('Schmeissen: fuenf Luschen loesen aus', () => {
  const rs = makeRuleSet({ schmeiss5Luschen: true });
  const hand = [c('C9'), c('S9'), c('H9'), c('D9'), c('D9'), c('CA')];
  assert.equal(countLuschen(hand, rs), 5);
  const opt = schmeissOption(hand, rs);
  assert.equal(opt.allowed, true);
  assert.deepEqual(opt.reasons, ['luschen']);
});

test('Schmeissen: bei Scharfem Doko zaehlen stattdessen die Koenige', () => {
  const rs = makeRuleSet({ deck: 'without9', schmeiss5Luschen: true });
  const koenige = [c('CK'), c('CK'), c('SK'), c('SK'), c('HK'), c('CA')];
  assert.equal(countLuschen(koenige, rs), 5);
  assert.equal(schmeissOption(koenige, rs).allowed, true);
  // Neunen gibt es dort nicht, sie duerfen also nichts ausloesen.
  const neunen = [c('C9'), c('S9'), c('H9'), c('D9'), c('D9'), c('CA')];
  assert.equal(countLuschen(neunen, rs), 0);
});

test('Schmeissen: sieben Volle loesen aus, Damen und Buben nicht', () => {
  const rs = makeRuleSet({ schmeiss7Volle: true });
  const hand = [
    c('CA'), c('CT'), c('SA'), c('ST'), c('HA'), c('HT'), c('DA'),
    c('CQ'), c('CJ'),
  ];
  assert.equal(countVolle(hand), 7);
  assert.deepEqual(schmeissOption(hand, rs).reasons, ['volle']);
});

test('Schmeissen: deaktivierte Bedingung loest nicht aus', () => {
  const rs = makeRuleSet({ schmeiss5Luschen: false, schmeiss7Volle: true });
  const hand = [c('C9'), c('S9'), c('H9'), c('D9'), c('D9'), c('CA')];
  assert.equal(schmeissOption(hand, rs).allowed, false);
});

test('Schmeissen: Konsequenz folgt der Konfiguration', () => {
  assert.deepEqual(applySchmeiss(makeRuleSet({ schmeissConsequence: 'redeal' })), {
    redeal: true,
    triggersBock: false,
  });
  assert.deepEqual(
    applySchmeiss(makeRuleSet({ bock: true, schmeissConsequence: 'redealAndBock' })),
    { redeal: true, triggersBock: true },
  );
});
