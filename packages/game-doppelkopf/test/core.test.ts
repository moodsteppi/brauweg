import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDeck, sumValues, type Card } from '../src/cards.js';
import { makeRuleSet } from '../src/ruleset.js';
import { validateRuleSet, isValid } from '../src/validator.js';
import { buildOrder, isTrump, legalCards, detectSchweinchen } from '../src/order.js';
import { resolveTrick, type PlayedCard } from '../src/trick.js';
import { deal } from '../src/deal.js';
import { createParty, startRound } from '../src/party.js';
import {
  RuleViolation,
  allowedVorbehalte,
  apply,
  createRound,
  currentActor,
} from '../src/round.js';
import { handoverSize } from '../src/armut.js';

/** Testhelfer: Karte aus Kurzschreibweise, z.B. c('HT'). */
let nextId = 1000;
function c(key: string): Card {
  return {
    suit: key[0] as Card['suit'],
    rank: key.slice(1) as Card['rank'],
    id: nextId++,
  };
}

test('Deck: 48 Karten mit Neunen, 240 Augen', () => {
  const d = createDeck('with9');
  assert.equal(d.length, 48);
  assert.equal(sumValues(d), 240);
});

test('Deck: 40 Karten ohne Neunen, ebenfalls 240 Augen', () => {
  const d = createDeck('without9');
  assert.equal(d.length, 40);
  assert.equal(sumValues(d), 240);
});

test('Normalspiel: Trumpfreihenfolge und Herz-Fehlfarbe', () => {
  const order = buildOrder({ kind: 'normal' }, makeRuleSet());
  assert.deepEqual(order.trumps, [
    'HT', 'CQ', 'SQ', 'HQ', 'DQ', 'CJ', 'SJ', 'HJ', 'DJ', 'DA', 'DT', 'DK', 'D9',
  ]);
  // Herz-Zehn ist Trumpf, darf also nicht in der Fehlfarbe auftauchen.
  assert.deepEqual(order.fehl.H, ['HA', 'HK', 'H9']);
  assert.deepEqual(order.fehl.C, ['CA', 'CT', 'CK', 'C9']);
  assert.deepEqual(order.fehl.D, []);
});

test('Herz-Solo: Dulle bleibt hoechster Trumpf, Herz-Zehn nicht doppelt', () => {
  const order = buildOrder({ kind: 'solo', solo: 'suitH' }, makeRuleSet());
  assert.equal(order.trumps[0], 'HT');
  assert.equal(order.trumps.filter((k) => k === 'HT').length, 1);
  assert.deepEqual(order.fehl.H, []);
});

test('Damensolo: nur Damen sind Trumpf, Dulle wird Fehlkarte', () => {
  const order = buildOrder({ kind: 'solo', solo: 'queens' }, makeRuleSet());
  assert.deepEqual(order.trumps, ['CQ', 'SQ', 'HQ', 'DQ']);
  assert.ok(order.fehl.H.includes('HT'));
  assert.ok(order.fehl.C.includes('CJ'));
});

test('Fleischlos: kein Trumpf, Damen und Buben bleiben in der Farbe', () => {
  const order = buildOrder({ kind: 'solo', solo: 'fleshless' }, makeRuleSet());
  assert.deepEqual(order.trumps, []);
  assert.deepEqual(order.fehl.C, ['CA', 'CT', 'CK', 'CQ', 'CJ', 'C9']);
});

test('Schweinchen heben die Karo-Ass ueber die Dulle', () => {
  const rs = makeRuleSet({ schweinchen: true });
  const order = buildOrder({ kind: 'normal' }, rs, { schweinchenActive: true });
  assert.equal(order.trumps[0], 'DA');
  assert.equal(order.trumps[1], 'HT');
});

test('Stich: Trumpf sticht Fehl', () => {
  const order = buildOrder({ kind: 'normal' }, makeRuleSet());
  const played: PlayedCard[] = [
    { card: c('CA'), seat: 0 },
    { card: c('CT'), seat: 1 },
    { card: c('D9'), seat: 2 },
    { card: c('CK'), seat: 3 },
  ];
  const r = resolveTrick(played, order, { secondDulleBeatsFirst: false });
  assert.equal(r.winnerSeat, 2);
  assert.equal(r.points, 11 + 10 + 0 + 4);
});

test('Stich: nicht bediente Fremdfarbe gewinnt nie', () => {
  const order = buildOrder({ kind: 'normal' }, makeRuleSet());
  const played: PlayedCard[] = [
    { card: c('CK'), seat: 0 },
    { card: c('SA'), seat: 1 },
    { card: c('HA'), seat: 2 },
    { card: c('C9'), seat: 3 },
  ];
  const r = resolveTrick(played, order, { secondDulleBeatsFirst: false });
  assert.equal(r.winnerSeat, 0);
});

test('Stich: bei gleichen Karten gewinnt standardmaessig die erste', () => {
  const order = buildOrder({ kind: 'normal' }, makeRuleSet());
  const played: PlayedCard[] = [
    { card: c('HT'), seat: 0 },
    { card: c('HT'), seat: 1 },
    { card: c('DA'), seat: 2 },
    { card: c('DK'), seat: 3 },
  ];
  const r = resolveTrick(played, order, { secondDulleBeatsFirst: false });
  assert.equal(r.winnerSeat, 0);
});

test('Stich: Zweite Dulle sticht Erste, wenn aktiviert', () => {
  const order = buildOrder({ kind: 'normal' }, makeRuleSet());
  const played: PlayedCard[] = [
    { card: c('HT'), seat: 0 },
    { card: c('HT'), seat: 1 },
    { card: c('DA'), seat: 2 },
    { card: c('DK'), seat: 3 },
  ];
  const r = resolveTrick(played, order, { secondDulleBeatsFirst: true });
  assert.equal(r.winnerSeat, 1);
});

test('Zweite-Dulle-Regel gilt nur fuer Dullen, nicht fuer andere Paare', () => {
  const order = buildOrder({ kind: 'normal' }, makeRuleSet());
  const played: PlayedCard[] = [
    { card: c('CQ'), seat: 0 },
    { card: c('CQ'), seat: 1 },
    { card: c('DA'), seat: 2 },
    { card: c('DK'), seat: 3 },
  ];
  const r = resolveTrick(played, order, { secondDulleBeatsFirst: true });
  assert.equal(r.winnerSeat, 0);
});

test('Bedienzwang: Trumpf ist eine eigene Farbe', () => {
  const order = buildOrder({ kind: 'normal' }, makeRuleSet());
  const hand = [c('CA'), c('DA'), c('CQ'), c('SK')];
  // Trumpf angespielt: nur Truempfe sind erlaubt (DA und CQ).
  const legal = legalCards(hand, order, c('DK'));
  assert.deepEqual(legal.map((x) => x.suit + x.rank).sort(), ['CQ', 'DA']);
});

test('Bedienzwang: ohne bedienbare Karte ist alles erlaubt', () => {
  const order = buildOrder({ kind: 'normal' }, makeRuleSet());
  const hand = [c('CA'), c('DA')];
  const legal = legalCards(hand, order, c('SK'));
  assert.equal(legal.length, 2);
});

test('Geben ist deterministisch und vollstaendig', () => {
  const rs = makeRuleSet();
  const a = deal(rs, 42);
  const b = deal(rs, 42);
  assert.deepEqual(a.hands, b.hands);
  assert.equal(a.hands.length, 4);
  for (const h of a.hands) assert.equal(h.length, 12);
  const total = a.hands.flat();
  assert.equal(new Set(total.map((x) => x.id)).size, 48);
});

test('Validator: Rundenzahl muss Vielfaches der Tischgroesse sein', () => {
  assert.ok(isValid(makeRuleSet({ tableSize: 5, rounds: 10 })));
  const issues = validateRuleSet(makeRuleSet({ tableSize: 5, rounds: 8 }));
  assert.ok(issues.some((i) => i.code === 'ROUNDS_MULTIPLE' && i.severity === 'error'));
});

test('Validator: Abhaengigkeiten werden geblockt', () => {
  const cases: Array<[Parameters<typeof makeRuleSet>[0], string]> = [
    [{ superSchweine: true, schweinchen: false }, 'SUPERSCHWEIN_NEEDS_SCHWEINCHEN'],
    [{ absagen: true, announcements: false }, 'ABSAGEN_NEED_ANNOUNCEMENTS'],
    [{ pflichtsolo: true, solos: [] }, 'PFLICHTSOLO_NEEDS_SOLO'],
    [{ bock: true, bockTriggers: [] }, 'BOCK_NO_TRIGGER'],
    [{ schmeissConsequence: 'redealAndBock', bock: false }, 'SCHMEISS_NEEDS_BOCK'],
  ];
  for (const [patch, code] of cases) {
    const issues = validateRuleSet(makeRuleSet(patch));
    assert.ok(
      issues.some((i) => i.code === code && i.severity === 'error'),
      `erwartet: ${code}`,
    );
  }
});

// --- Schweinchen und Superschwein ---

test('Superschwein steht ueber den Schweinchen und ueber der Dulle', () => {
  const rs = makeRuleSet({ schweinchen: true, superSchweine: true });
  const order = buildOrder({ kind: 'normal' }, rs, {
    schweinchenActive: true,
    superSchweinActive: true,
  });
  assert.deepEqual(order.trumps.slice(0, 4), ['D9', 'DA', 'HT', 'CQ']);
});

test('Superschwein bei Scharfem Doko ist der Karo-Koenig', () => {
  const rs = makeRuleSet({ deck: 'without9', schweinchen: true, superSchweine: true });
  const order = buildOrder({ kind: 'normal' }, rs, {
    schweinchenActive: true,
    superSchweinActive: true,
  });
  assert.deepEqual(order.trumps.slice(0, 4), ['DK', 'DA', 'HT', 'CQ']);
});

test('Erkennung: Superschwein braucht beide Paare auf derselben Hand', () => {
  const rs = makeRuleSet({ schweinchen: true, superSchweine: true });
  const gt = { kind: 'normal' } as const;

  const nurSchweine = [c('DA'), c('DA'), c('D9'), c('CQ')];
  assert.deepEqual(detectSchweinchen(nurSchweine, rs, gt), {
    schweinchen: true,
    superschwein: false,
  });

  const beide = [c('DA'), c('DA'), c('D9'), c('D9')];
  assert.deepEqual(detectSchweinchen(beide, rs, gt), {
    schweinchen: true,
    superschwein: true,
  });

  const nurNeunen = [c('D9'), c('D9'), c('CQ'), c('SQ')];
  assert.deepEqual(detectSchweinchen(nurNeunen, rs, gt), {
    schweinchen: false,
    superschwein: false,
  });
});

test('Erkennung: Schweinchen gibt es nur im Normalspiel, in keinem Solo', () => {
  const rs = makeRuleSet({ schweinchen: true, superSchweine: true });
  const hand = [c('DA'), c('DA'), c('D9'), c('D9')];

  assert.deepEqual(detectSchweinchen(hand, rs, { kind: 'normal' }), {
    schweinchen: true,
    superschwein: true,
  });
  // Hochzeit und Armut spielen die normale Trumpfordnung, also gelten sie mit.
  assert.deepEqual(detectSchweinchen(hand, rs, { kind: 'hochzeit' }), {
    schweinchen: true,
    superschwein: true,
  });

  assert.deepEqual(detectSchweinchen(hand, rs, { kind: 'solo', solo: 'suitH' }), {
    schweinchen: false,
    superschwein: false,
  });
  // Auch im Karo-Solo nicht, obwohl dort Karo Trumpf ist: Die Spielart hat
  // sich einer ausgesucht, die Faeuste kommen aus dem Geben.
  assert.deepEqual(detectSchweinchen(hand, rs, { kind: 'solo', solo: 'suitD' }), {
    schweinchen: false,
    superschwein: false,
  });
});

test('Superschwein sticht die Dulle im Stich', () => {
  const rs = makeRuleSet({ schweinchen: true, superSchweine: true });
  const order = buildOrder({ kind: 'normal' }, rs, {
    schweinchenActive: true,
    superSchweinActive: true,
  });
  const r = resolveTrick(
    [
      { card: c('HT'), seat: 0 },
      { card: c('DA'), seat: 1 },
      { card: c('D9'), seat: 2 },
      { card: c('DK'), seat: 3 },
    ],
    order,
    { secondDulleBeatsFirst: false },
  );
  assert.equal(r.winnerSeat, 2);
});

test('der Hex-Seed macht jedes Geben unabhaengig', () => {
  // Mit Hex-Seed gibt jede Runde anders - und aus einer Gabe laesst sich
  // die naechste nicht ausrechnen.
  const rs = makeRuleSet();
  const seats = [0, 1, 2, 3];
  const basis = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

  const eins = createParty(rs, seats, 1, [], basis);
  const runde1 = startRound(eins).current!;
  const runde2 = startRound({ ...eins, roundIndex: 1, current: null }).current!;

  const hand = (r: typeof runde1, seat: number) =>
    r.hands[seat].map((c) => `${c.suit}${c.rank}`).join(',');
  assert.notEqual(hand(runde1, 0), hand(runde2, 0), 'zwei Runden, zwei Gaben');

  // Gleiche Basis, gleiche Runde: reproduzierbar (Nachspielen bleibt moeglich).
  const nochmal = startRound(createParty(rs, seats, 999, [], basis)).current!;
  assert.equal(hand(runde1, 0), hand(nochmal, 0), 'die Basis bestimmt die Gabe');

  // Andere Basis, voellig andere Gabe - der Zahlen-Seed spielt keine Rolle mehr.
  const andere = startRound(
    createParty(rs, seats, 1, [], 'ffffffffffffffffffffffffffffffff'),
  ).current!;
  assert.notEqual(hand(runde1, 0), hand(andere, 0));

  // Alle Karten genau einmal im Spiel.
  const alle = seats.flatMap((s) => runde1.hands[s].map((c) => c.id));
  assert.equal(new Set(alle).size, alle.length);
});

test('doppelte Karten beim Armut-Tausch werden abgewiesen', () => {
  // Mit [7,7,7] verlor der Ansager frueher EINE Karte und der Partner bekam
  // DREI Kopien - die Augenrechnung der Runde war damit manipuliert.
  const rs = makeRuleSet({ armut: true });
  const seats = [0, 1, 2, 3];

  // Ein Blatt suchen, das eine Armut ueberhaupt zulaesst.
  let state = null;
  for (let seed = 1; seed < 400 && !state; seed++) {
    const kandidat = createRound(rs, seats, 0, seed);
    const dran = currentActor(kandidat)!;
    if (allowedVorbehalte(kandidat, dran).includes('armut')) state = kandidat;
  }
  assert.ok(state, 'kein Blatt mit Armut gefunden');

  const armer = currentActor(state)!;
  state = apply(state, { type: 'vorbehalt', seat: armer, kind: 'armut' });
  while (state.phase === 'vorbehalt') {
    state = apply(state, { type: 'vorbehalt', seat: currentActor(state)!, kind: null });
  }
  assert.equal(state.phase, 'armutExchange');

  // Annehmen, bis jemand die Armut nimmt.
  while (state.armut!.partnerSeat === null && state.phase === 'armutExchange') {
    state = apply(state, { type: 'armutAccept', seat: currentActor(state)! });
  }
  assert.notEqual(state.armut!.partnerSeat, null);

  const groesse = handoverSize(state.hands[armer], state.order);
  const eine = state.hands[armer][0].id;
  assert.throws(
    () =>
      apply(state, {
        type: 'armutHandover',
        seat: armer,
        cards: Array.from({ length: groesse }, () => eine),
      }),
    RuleViolation,
    'dieselbe Karte darf nicht mehrfach abgegeben werden',
  );
});
