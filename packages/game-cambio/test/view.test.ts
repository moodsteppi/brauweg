import { test } from 'node:test';
import assert from 'node:assert/strict';

import { apply, createRound } from '../src/round.js';
import { makeRuleSet } from '../src/ruleset.js';
import { spectatorView, viewFor } from '../src/view.js';
import { c, run, withHands, withStock } from './helpers.js';

const SEATS = [0, 1, 2, 3];

function runde(patch = {}) {
  return createRound(makeRuleSet({ tableSize: 4, rounds: 4, ...patch }), SEATS, 0, 7);
}

const HAENDE = {
  0: [c('C2'), c('C3'), c('C4'), c('C5')],
  1: [c('S9'), c('S8'), c('S7'), c('S6')],
  2: [c('H2'), c('H3'), c('H4'), c('H5')],
  3: [c('D2'), c('D3'), c('D4'), c('D5')],
};

test('man sieht nur die eigenen Karten, die man kennt', () => {
  const v = viewFor(withHands(runde(), HAENDE), 1);

  // Startblick: Plaetze 0 und 3.
  assert.notEqual(v.hands[1]![0]!.card, null);
  assert.notEqual(v.hands[1]![3]!.card, null);
  assert.equal(v.hands[1]![1]!.card, null, 'die eigene Mitte bleibt verdeckt');
  assert.equal(v.hands[1]![2]!.card, null);
});

test('fremde Karten sind alle verdeckt', () => {
  const v = viewFor(withHands(runde(), HAENDE), 1);
  for (const fremd of [0, 2, 3]) {
    for (const slot of v.hands[fremd]!) {
      assert.equal(slot.card, null, `Sitz ${fremd} Platz ${slot.index} darf nicht sichtbar sein`);
    }
  }
});

test('die Sicht verraet trotzdem, dass dort Karten liegen', () => {
  const v = viewFor(withHands(runde(), HAENDE), 1);
  for (const seat of SEATS) assert.equal(v.hands[seat]!.length, 4);
});

test('was ein anderer gesehen hat, steht nicht in meiner Sicht', () => {
  // Sitz 1 sieht mit der Neun eine Karte von Sitz 2 an. Sitz 3 darf davon
  // nichts mitbekommen - sonst liesse sich zurueckrechnen, was Sitz 1 weiss.
  const st = withStock(withHands(runde(), HAENDE), [c('C9')]);
  const nach = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
    { type: 'resolveAction', seat: 1, targets: [{ seat: 2, index: 1 }] },
  ]);

  assert.notEqual(viewFor(nach, 1).hands[2]![1]!.card, null, 'Sitz 1 sieht sie');
  assert.equal(viewFor(nach, 3).hands[2]![1]!.card, null, 'Sitz 3 nicht');
  assert.equal(viewFor(nach, 2).hands[2]![1]!.card, null, 'auch der Besitzer nicht');
});

test('die gezogene Karte sieht nur, wer sie gezogen hat', () => {
  const st = withStock(withHands(runde(), HAENDE), [c('C12')]);
  const gezogen = apply(st, { type: 'drawStock', seat: 1 });

  assert.notEqual(viewFor(gezogen, 1).drawn, null);
  assert.equal(viewFor(gezogen, 2).drawn, null);
  assert.equal(viewFor(gezogen, 0).drawn, null);
});

test('Zuschauer sehen ueberhaupt keine Karte', () => {
  const v = spectatorView(withHands(runde(), HAENDE));

  assert.equal(v.seat, null);
  assert.equal(v.isMyTurn, false);
  assert.deepEqual(v.legal, []);
  for (const seat of SEATS) {
    for (const slot of v.hands[seat]!) assert.equal(slot.card, null);
  }
});

test('nach dem Abrechnen liegen alle Haende offen', () => {
  let st = apply(withHands(runde(), HAENDE), { type: 'callCambio', seat: 1 });
  // Ueber den Ablagestapel, damit keine gezogene Aktionskarte den Zug
  // verlaengert und der Test an etwas anderem haengt als am Aufdecken.
  for (const seat of [2, 3, 0]) {
    st = apply(st, { type: 'takeDiscard', seat, index: 0 });
  }
  assert.equal(st.phase, 'finished');

  const v = viewFor(st, 1);
  for (const seat of SEATS) {
    for (const slot of v.hands[seat]!) {
      assert.notEqual(slot.card, null, 'am Ende darf jeder alles sehen');
    }
  }
  // Auch der Zuschauer.
  const z = spectatorView(st);
  assert.notEqual(z.hands[0]![0]!.card, null);
});

test('die erlaubten Aktionen stehen nur beim Sitz am Zug', () => {
  const st = withHands(runde(), HAENDE);
  assert.ok(viewFor(st, 1).legal.length > 0, 'Sitz 1 ist am Zug');
  assert.deepEqual(viewFor(st, 2).legal, [], 'Sitz 2 nicht');
});
