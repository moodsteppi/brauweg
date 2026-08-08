import { test } from 'node:test';
import assert from 'node:assert/strict';

import { botAction } from '../src/bot.js';
import { createParty, standings } from '../src/party.js';
import { apply, createRound, legalActions } from '../src/round.js';
import { makeRuleSet } from '../src/ruleset.js';
import { viewFor } from '../src/view.js';
import { c, playOut, run, withDiscard, withHands, withStock } from './helpers.js';

const SEATS = [0, 1, 2, 3];

function runde(patch = {}) {
  return createRound(makeRuleSet({ tableSize: 4, rounds: 4, ...patch }), SEATS, 0, 99);
}

/** Prueft, dass eine Aktion tatsaechlich in der erlaubten Liste steht. */
function istErlaubt(state: ReturnType<typeof runde>, seat: number, action: unknown): boolean {
  return legalActions(state, seat).some(
    (a) => JSON.stringify(a) === JSON.stringify(action),
  );
}

test('der Bot waehlt immer eine erlaubte Aktion', () => {
  // Ueber viele Zuege hinweg, quer durch alle Phasen. Das ist die eine
  // Eigenschaft, die niemals brechen darf: Ein Bot, der Unerlaubtes
  // vorschlaegt, bringt den Tisch zum Stehen.
  let st = runde();
  for (let i = 0; i < 400 && st.phase !== 'finished'; i++) {
    const seat = st.turn;
    const action = botAction(viewFor(st, seat));
    assert.notEqual(action, null, `kein Vorschlag in Phase ${st.phase}`);
    assert.ok(istErlaubt(st, seat, action), `unerlaubt in Phase ${st.phase}: ${JSON.stringify(action)}`);
    st = apply(st, action!);
  }
});

test('der Bot schlaegt nichts vor, wenn er nicht am Zug ist', () => {
  const st = runde();
  assert.equal(botAction(viewFor(st, 2)), null);
});

test('der Bot tauscht eine gezogene gute Karte gegen eine bekannte schlechte', () => {
  const st = withStock(
    withHands(runde(), {
      0: [c('C2'), c('C3'), c('C4'), c('C5')],
      // Platz 0 und 3 kennt er (Startblick): Pik-Koenig = 13, sehr teuer.
      1: [c('S13'), c('S8'), c('S7'), c('S6')],
      2: [c('H2'), c('H3'), c('H4'), c('H5')],
      3: [c('D2'), c('D3'), c('D4'), c('D5')],
    }),
    [c('C1')],
  );

  const gezogen = apply(st, { type: 'drawStock', seat: 1 });
  const action = botAction(viewFor(gezogen, 1));

  assert.equal(action?.type, 'swap');
  assert.equal(action?.type === 'swap' && action.index, 0, 'ersetzt die teuerste bekannte');
});

test('der Bot wirft eine gezogene schlechte Karte ab', () => {
  const st = withStock(
    withHands(runde(), {
      0: [c('C2'), c('C3'), c('C4'), c('C5')],
      // Bekannt sind Platz 0 und 3: beide billig.
      1: [c('S1'), c('S8'), c('S7'), c('S2')],
      2: [c('H2'), c('H3'), c('H4'), c('H5')],
      3: [c('D2'), c('D3'), c('D4'), c('D5')],
    }),
    [c('C13')], // Pik-Koenig waere 13 - schlechter als alles Bekannte
  );

  const gezogen = apply(st, { type: 'drawStock', seat: 1 });
  const action = botAction(viewFor(gezogen, 1));

  assert.equal(action?.type, 'discardDrawn');
});

test('der Bot ruft Cambio, wenn seine Hand gut ist und er sie kennt', () => {
  // Alle vier Plaetze bekannt und zusammen sehr billig.
  const st = {
    ...withHands(runde(), {
      0: [c('C9'), c('C9'), c('C9'), c('C9')],
      1: [c('H13'), c('D13'), c('C1'), c('C2')], // 0+0+1+2 = 3
      2: [c('H9'), c('H9'), c('H9'), c('H9')],
      3: [c('D9'), c('D9'), c('D9'), c('D9')],
    }),
    known: { 0: [], 1: ['1:0', '1:1', '1:2', '1:3'], 2: [], 3: [] },
  };

  const action = botAction(viewFor(st, 1));
  assert.equal(action?.type, 'callCambio');
});

test('der Bot ruft NICHT, wenn er seine Hand kaum kennt', () => {
  // Dieselbe billige Hand, aber er kennt nur einen Platz. Eine niedrige
  // Schaetzung aus lauter Unbekannten ist Wunschdenken, keine Auskunft.
  const st = {
    ...withHands(runde(), {
      0: [c('C9'), c('C9'), c('C9'), c('C9')],
      1: [c('H13'), c('D13'), c('C1'), c('C2')],
      2: [c('H9'), c('H9'), c('H9'), c('H9')],
      3: [c('D9'), c('D9'), c('D9'), c('D9')],
    }),
    known: { 0: [], 1: ['1:0'], 2: [], 3: [] },
  };

  const action = botAction(viewFor(st, 1));
  assert.notEqual(action?.type, 'callCambio');
});

test('der Bot nimmt eine gute offene Karte gegen einen teuren Platz', () => {
  const st = withDiscard(
    withHands(runde(), {
      0: [c('C2'), c('C3'), c('C4'), c('C5')],
      1: [c('S13'), c('S8'), c('S7'), c('S6')], // Platz 0 bekannt, 13 Punkte
      2: [c('H2'), c('H3'), c('H4'), c('H5')],
      3: [c('D2'), c('D3'), c('D4'), c('D5')],
    }),
    [c('C1')], // offen liegt ein Ass
  );

  const action = botAction(viewFor(st, 1));
  assert.equal(action?.type, 'takeDiscard');
  assert.equal(action?.type === 'takeDiscard' && action.index, 0);
});

test('mit der Sieben sieht der Bot einen unbekannten eigenen Platz an', () => {
  const st = withStock(runde(), [c('C7')]);
  const offen = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
  ]);

  const action = botAction(viewFor(offen, 1));
  assert.equal(action?.type, 'resolveAction');
  const ziel = action?.type === 'resolveAction' ? action.targets[0]! : null;
  assert.equal(ziel?.seat, 1, 'ein eigener Platz');
  assert.ok(ziel && [1, 2].includes(ziel.index), 'einer der beiden unbekannten');
});

test('mit der Neun sieht der Bot eine fremde Karte an', () => {
  const st = withStock(runde(), [c('C9')]);
  const offen = run(st, [
    { type: 'drawStock', seat: 1 },
    { type: 'discardDrawn', seat: 1 },
  ]);

  const action = botAction(viewFor(offen, 1));
  assert.equal(action?.type, 'resolveAction');
  const ziel = action?.type === 'resolveAction' ? action.targets[0]! : null;
  assert.notEqual(ziel?.seat, 1, 'eine fremde Karte');
});

test('vier Bots beenden eine volle Partie', () => {
  const party = playOut(createParty(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, 123));

  assert.equal(party.finished, true);
  assert.equal(party.history.length, 4);
  for (const seat of SEATS) assert.equal(typeof party.scores[seat], 'number');
});

test('am Zweiertisch laeuft es genauso durch', () => {
  const party = playOut(createParty(makeRuleSet({ tableSize: 2, rounds: 2 }), [0, 1], 7));
  assert.equal(party.finished, true);
  assert.equal(party.history.length, 2);
});

test('mit sechs Sitzen ebenfalls', () => {
  const seats = [0, 1, 2, 3, 4, 5];
  const party = playOut(createParty(makeRuleSet({ tableSize: 6, rounds: 6 }), seats, 5));
  assert.equal(party.finished, true);
  assert.equal(party.history.length, 6);
});

test('auch ohne jede Aktionskarte laeuft eine Partie durch', () => {
  const rs = makeRuleSet({
    tableSize: 4,
    rounds: 4,
    peekOwn: false,
    peekOther: false,
    blindSwap: false,
    lookAndSwap: false,
  });
  const party = playOut(createParty(rs, SEATS, 11));
  assert.equal(party.finished, true);
});

test('beim Endstand gewinnt die NIEDRIGSTE Punktzahl', () => {
  // Die Umkehrung ist die eine Stelle, an der man den Fehler einbaut.
  const party = playOut(createParty(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, 321));
  const tabelle = standings(party);

  const erster = tabelle.find((s) => s.place === 1)!;
  for (const s of tabelle) {
    assert.ok(erster.points <= s.points, 'Platz 1 hat die wenigsten Punkte');
  }
});
