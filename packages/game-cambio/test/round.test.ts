import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRound, apply, legalActions, topDiscard, weiss } from '../src/round.js';
import { makeRuleSet } from '../src/ruleset.js';
import { c, run, withDiscard, withHands, withStock } from './helpers.js';

const SEATS = [0, 1, 2, 3];

function runde(patch = {}) {
  return createRound(makeRuleSet({ tableSize: 4, rounds: 4, ...patch }), SEATS, 0, 42);
}

test('gegeben wird vier mal vier, Ablage offen, Rest verdeckt', () => {
  const st = runde();
  for (const seat of SEATS) assert.equal(st.hands[seat]!.length, 4);
  assert.equal(st.discard.length, 1);
  // 52 minus 16 gegeben minus 1 offen
  assert.equal(st.stock.length, 35);
});

test('links vom Geber faengt an', () => {
  const st = runde();
  assert.equal(st.dealer, 0);
  assert.equal(st.turn, 1);
});

test('zu Beginn kennt jeder genau seine beiden aeusseren Karten', () => {
  const st = runde();
  for (const seat of SEATS) {
    assert.equal(weiss(st, seat, { seat, index: 0 }), true);
    assert.equal(weiss(st, seat, { seat, index: 3 }), true);
    assert.equal(weiss(st, seat, { seat, index: 1 }), false);
    assert.equal(weiss(st, seat, { seat, index: 2 }), false);
    // Fremde Karten kennt niemand.
    const fremd = seat === 0 ? 1 : 0;
    assert.equal(weiss(st, seat, { seat: fremd, index: 0 }), false);
  }
});

test('ohne die Hausregel kennt zu Beginn niemand etwas', () => {
  const st = runde({ peekTwoAtStart: false });
  for (const seat of SEATS) assert.deepEqual(st.known[seat], []);
});

test('ziehen fuehrt in die Entscheidungsphase, der Sitz bleibt am Zug', () => {
  const st = runde();
  const nach = apply(st, { type: 'drawStock', seat: 1 });

  assert.equal(nach.phase, 'decide');
  assert.equal(nach.turn, 1, 'derselbe Sitz ist weiter am Zug');
  assert.notEqual(nach.drawn, null);
  assert.equal(nach.stock.length, st.stock.length - 1);
});

test('wer nicht an der Reihe ist, kommt nicht durch', () => {
  const st = runde();
  assert.throws(() => apply(st, { type: 'drawStock', seat: 2 }), /nicht an der Reihe/);
});

test('tauschen legt die alte Karte offen ab und macht den Platz bekannt', () => {
  const st = withStock(withHands(runde(), { 0: [c('C2'), c('C3'), c('C4'), c('C5')], 1: [c('S9'), c('S8'), c('S7'), c('S6')], 2: [c('H2'), c('H3'), c('H4'), c('H5')], 3: [c('D2'), c('D3'), c('D4'), c('D5')] }), [c('C1')]);

  const gezogen = apply(st, { type: 'drawStock', seat: 1 });
  const nach = apply(gezogen, { type: 'swap', seat: 1, index: 1 });

  assert.equal(nach.hands[1]![1]!.rank, '1', 'die gezogene Karte liegt jetzt dort');
  assert.equal(topDiscard(nach).rank, '8', 'die alte liegt offen oben auf');
  assert.equal(weiss(nach, 1, { seat: 1, index: 1 }), true);
  assert.equal(nach.turn, 2, 'danach ist der naechste dran');
});

test('vom Ablagestapel nehmen loest keine Aktion aus', () => {
  // Sonst liesse sich dieselbe Dame beliebig oft spielen: aufnehmen, ablegen,
  // aufnehmen, ablegen.
  const st = withDiscard(
    withHands(runde(), {
      0: [c('C2'), c('C3'), c('C4'), c('C5')],
      1: [c('S9'), c('S8'), c('S7'), c('S6')],
      2: [c('H2'), c('H3'), c('H4'), c('H5')],
      3: [c('D2'), c('D3'), c('D4'), c('D5')],
    }),
    [c('C12')],
  );

  const nach = apply(st, { type: 'takeDiscard', seat: 1, index: 0 });

  assert.equal(nach.phase, 'turn', 'kein Aktionsschritt');
  assert.equal(nach.pendingAction, null);
  assert.equal(nach.turn, 2);
  assert.equal(nach.hands[1]![0]!.rank, '12');
});

test('eine abgeworfene Sieben laesst eine eigene Karte ansehen', () => {
  const st = withStock(runde(), [c('C7')]);
  const gezogen = apply(st, { type: 'drawStock', seat: 1 });
  const geworfen = apply(gezogen, { type: 'discardDrawn', seat: 1 });

  assert.equal(geworfen.phase, 'action');
  assert.equal(geworfen.pendingAction, 'peekOwn');
  assert.equal(geworfen.turn, 1, 'der Sitz ist weiter am Zug');

  // Nur eigene Plaetze sind Ziel.
  const ziele = legalActions(geworfen, 1).filter((a) => a.type === 'resolveAction');
  assert.ok(ziele.length > 0);
  assert.ok(ziele.every((a) => a.type === 'resolveAction' && a.targets[0]!.seat === 1));

  const fertig = apply(geworfen, { type: 'resolveAction', seat: 1, targets: [{ seat: 1, index: 2 }] });
  assert.equal(weiss(fertig, 1, { seat: 1, index: 2 }), true);
  assert.equal(fertig.phase, 'turn');
  assert.equal(fertig.turn, 2);
});

test('eine abgeworfene Neun laesst nur FREMDE Karten ansehen', () => {
  const st = withStock(runde(), [c('C9')]);
  const geworfen = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
  ]);

  assert.equal(geworfen.pendingAction, 'peekOther');
  const ziele = legalActions(geworfen, 1).filter((a) => a.type === 'resolveAction');
  assert.ok(ziele.every((a) => a.type === 'resolveAction' && a.targets[0]!.seat !== 1));
});

test('abgeschaltete Aktionskarten wirken nicht', () => {
  const st = withStock(runde({ peekOwn: false }), [c('C7')]);
  const geworfen = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
  ]);

  assert.equal(geworfen.phase, 'turn', 'kein Aktionsschritt');
  assert.equal(geworfen.turn, 2);
});

test('der Bube tauscht zwei Karten blind', () => {
  const st = withStock(
    withHands(runde(), {
      0: [c('C2'), c('C3'), c('C4'), c('C5')],
      1: [c('S9'), c('S8'), c('S7'), c('S6')],
      2: [c('H2'), c('H3'), c('H4'), c('H5')],
      3: [c('D2'), c('D3'), c('D4'), c('D5')],
    }),
    [c('C11')],
  );

  const offen = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
  ]);
  assert.equal(offen.pendingAction, 'blindSwap');

  const fertig = apply(offen, {
    type: 'resolveAction',
    seat: 1,
    targets: [
      { seat: 1, index: 0 },
      { seat: 2, index: 0 },
    ],
  });

  assert.equal(fertig.hands[1]![0]!.rank, '2', 'Karte von Sitz 2 ist da');
  assert.equal(fertig.hands[2]![0]!.rank, '9', 'Karte von Sitz 1 ist dort');
});

test('nach einem Tausch weiss niemand mehr, was auf den Plaetzen liegt', () => {
  // Sonst "wuessten" Mitspieler dauerhaft Falsches - dann waere es kein
  // Gedaechtnisspiel mehr, sondern Zufall mit Zusatzschritten.
  const st = withStock(
    withHands(runde(), {
      0: [c('C2'), c('C3'), c('C4'), c('C5')],
      1: [c('S9'), c('S8'), c('S7'), c('S6')],
      2: [c('H2'), c('H3'), c('H4'), c('H5')],
      3: [c('D2'), c('D3'), c('D4'), c('D5')],
    }),
    [c('C11')],
  );

  // Sitz 2 kennt seinen Platz 0 (Startblick).
  assert.equal(weiss(st, 2, { seat: 2, index: 0 }), true);

  const fertig = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
    {
      type: 'resolveAction',
      seat: 1,
      targets: [
        { seat: 1, index: 0 },
        { seat: 2, index: 0 },
      ],
    },
  ]);

  assert.equal(weiss(fertig, 2, { seat: 2, index: 0 }), false, 'Wissen ist ungueltig geworden');
  assert.equal(weiss(fertig, 1, { seat: 1, index: 0 }), false, 'blind getauscht heisst blind');
});

test('die Dame sieht erst an, dann darf getauscht oder verzichtet werden', () => {
  const st = withStock(
    withHands(runde(), {
      0: [c('C2'), c('C3'), c('C4'), c('C5')],
      1: [c('S9'), c('S8'), c('S7'), c('S6')],
      2: [c('H2'), c('H3'), c('H4'), c('H5')],
      3: [c('D2'), c('D3'), c('D4'), c('D5')],
    }),
    [c('C12')],
  );

  const offen = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
  ]);
  assert.equal(offen.pendingAction, 'lookAndSwap');

  // Schritt 1: fremde Karte ansehen.
  const gesehen = apply(offen, {
    type: 'resolveAction',
    seat: 1,
    targets: [{ seat: 2, index: 1 }],
  });
  assert.equal(gesehen.phase, 'action', 'noch nicht fertig');
  assert.deepEqual(gesehen.lookedAt, { seat: 2, index: 1 });
  assert.equal(weiss(gesehen, 1, { seat: 2, index: 1 }), true);

  // Jetzt sind nur eigene Plaetze Ziel - plus der Verzicht.
  const moeglich = legalActions(gesehen, 1);
  assert.ok(moeglich.some((a) => a.type === 'skipAction'));
  assert.ok(
    moeglich
      .filter((a) => a.type === 'resolveAction')
      .every((a) => a.type === 'resolveAction' && a.targets[0]!.seat === 1),
  );

  // Schritt 2: tauschen.
  const fertig = apply(gesehen, {
    type: 'resolveAction',
    seat: 1,
    targets: [{ seat: 1, index: 0 }],
  });
  assert.equal(fertig.hands[1]![0]!.rank, '3', 'die gesehene Karte ist herueber');
  assert.equal(fertig.phase, 'turn');
});

test('bei der Dame darf man nach dem Ansehen verzichten', () => {
  const st = withStock(runde(), [c('C12')]);
  const gesehen = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
    { type: 'resolveAction', seat: 1, targets: [{ seat: 2, index: 1 }] },
  ]);

  const fertig = apply(gesehen, { type: 'skipAction', seat: 1 });
  assert.equal(fertig.phase, 'turn');
  assert.equal(fertig.turn, 2);
  assert.equal(weiss(fertig, 1, { seat: 2, index: 1 }), true, 'gesehen bleibt gesehen');
});

test('vor dem Ansehen darf man bei der Dame nicht verzichten', () => {
  const st = withStock(runde(), [c('C12')]);
  const offen = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
  ]);
  assert.throws(() => apply(offen, { type: 'skipAction', seat: 1 }), /nach dem Ansehen/);
});

test('Cambio gibt jedem anderen genau noch einen Zug', () => {
  const st = runde();
  let s = apply(st, { type: 'callCambio', seat: 1 });
  assert.equal(s.caller, 1);
  assert.equal(s.phase, 'turn');
  assert.equal(s.turn, 2);

  // Sitze 2, 3, 0 sind noch einmal dran. Bewusst ueber den Ablagestapel
  // gespielt: Ziehen koennte eine Aktionskarte bringen, und dann ist der Zug
  // nach dem Abwerfen noch nicht vorbei.
  for (const seat of [2, 3, 0]) {
    assert.equal(s.turn, seat);
    assert.equal(s.phase, 'turn');
    s = apply(s, { type: 'takeDiscard', seat, index: 0 });
  }

  assert.equal(s.phase, 'finished');
  assert.notEqual(s.result, null);
});

test('nach dem Ruf darf niemand mehr rufen', () => {
  const st = apply(runde(), { type: 'callCambio', seat: 1 });
  const moeglich = legalActions(st, 2);
  assert.ok(!moeglich.some((a) => a.type === 'callCambio'));
});

test('leerer Nachziehstapel: der Ablagestapel wird neu gemischt', () => {
  const st = withDiscard(withStock(runde(), []), [c('C2'), c('C3'), c('C4'), c('C5')]);
  const nach = apply(st, { type: 'drawStock', seat: 1 });

  assert.equal(nach.phase, 'decide');
  assert.notEqual(nach.drawn, null);
  assert.equal(nach.discard.length, 1, 'nur die oberste bleibt liegen');
  // 4 im Ablagestapel: 1 bleibt oben liegen, 3 wandern zurueck, davon 1 gezogen
  assert.equal(nach.stock.length, 2);
});
