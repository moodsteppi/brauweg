import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDeck, sumValues } from '../src/cards.js';
import { makeRuleSet, type BockTrigger, type SoloKind } from '../src/ruleset.js';
import { validateRuleSet } from '../src/validator.js';
import { buildOrder } from '../src/order.js';
import { deal, makeRng } from '../src/deal.js';
import { awardTrophies } from '../src/trophies.js';
import { scoreRound, NO_ANNOUNCEMENTS, type TrickRecord } from '../src/scoring.js';

test('Invariante: jede Kartenordnung deckt das Deck vollstaendig und ueberschneidungsfrei ab', () => {
  const solos: SoloKind[] = [
    'suitC', 'suitS', 'suitH', 'suitD', 'queens', 'jacks', 'fleshless',
  ];
  for (const deckVariant of ['with9', 'without9'] as const) {
   for (const defusedDullen of [false, true]) {
    const rs = makeRuleSet({ deck: deckVariant, defusedDullen });
    const deckKeys = new Set(createDeck(deckVariant).map((c) => c.suit + c.rank));
    const types = [
      { kind: 'normal' } as const,
      ...solos.map((s) => ({ kind: 'solo', solo: s }) as const),
    ];
    for (const gt of types) {
      const order = buildOrder(gt, rs);
      const all = [...order.trumps, ...Object.values(order.fehl).flat()];
      assert.equal(
        new Set(all).size,
        all.length,
        `Doppelte Karte in ${gt.kind}/${'solo' in gt ? gt.solo : ''}`,
      );
      assert.deepEqual(
        new Set(all),
        deckKeys,
        `Unvollstaendige Ordnung in ${gt.kind}/${'solo' in gt ? gt.solo : ''}`,
      );
    }
   }
  }
});

test('Invariante: Geben verteilt jede Karte genau einmal, ueber viele Seeds', () => {
  for (const variant of ['with9', 'without9'] as const) {
    const rs = makeRuleSet({ deck: variant });
    const size = variant === 'with9' ? 48 : 40;
    for (let seed = 0; seed < 200; seed++) {
      const d = deal(rs, seed);
      const flat = d.hands.flat();
      assert.equal(flat.length, size);
      assert.equal(new Set(flat.map((c) => c.id)).size, size);
      assert.equal(sumValues(flat), 240);
    }
  }
});

test('Invariante: Trophaeensumme ist bei jeder Konstellation null', () => {
  const rng = makeRng(7);
  for (let i = 0; i < 300; i++) {
    for (const n of [3, 4, 5]) {
      const standings = Array.from({ length: n }, (_, seat) => ({
        seat,
        // Bewusst grobe Werte, damit Gleichstaende haeufig vorkommen.
        score: Math.floor(rng() * 5) - 2,
      }));
      const total = awardTrophies(standings).reduce((a, x) => a + x.trophies, 0);
      assert.ok(Math.abs(total) < 1e-9, `Summe ${total} bei ${n} Spielern`);
    }
  }
});

test('Invariante: Sitzpunkte einer Runde summieren sich immer zu null', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);
  const rng = makeRng(99);

  for (let i = 0; i < 100; i++) {
    const deck = createDeck('with9');
    const tricks: TrickRecord[] = [];
    for (let k = 0; k < deck.length; k += 4) {
      const chunk = deck.slice(k, k + 4);
      tricks.push({
        played: chunk.map((card, s) => ({ card, seat: s })),
        winnerSeat: Math.floor(rng() * 4),
      });
    }
    const res = scoreRound({
      rs,
      gameType: { kind: 'normal' },
      order,
      reSeats: [0, 2],
      tricks,
      announcements: NO_ANNOUNCEMENTS,
      multiplier: 1,
    });
    assert.equal(res.rePoints + res.kontraPoints, 240);
    assert.equal(Object.values(res.scores).reduce((a, b) => a + b, 0), 0);
  }
});

test('Fuzzing: der Validator bricht bei keinem Regelsatz ab', () => {
  const rng = makeRng(2024);
  const bool = () => rng() < 0.5;
  const triggers: BockTrigger[] = ['zeroResult', 'reAndKontra', 'solo', 'lostRe', 'schmeiss'];
  const solos: SoloKind[] = ['suitC', 'suitS', 'suitH', 'suitD', 'queens', 'jacks', 'fleshless'];

  for (let i = 0; i < 2000; i++) {
    const rs = makeRuleSet({
      deck: bool() ? 'with9' : 'without9',
      secondDulleBeatsFirst: bool(),
      schweinchen: bool(),
      superSchweine: bool(),
      spFuchsGefangen: bool(),
      spKarlchen: bool(),
      spDoppelkopf: bool(),
      spCharlieGefangen: bool(),
      spHerzdurchlauf: bool(),
      spInSolo: bool(),
      solos: solos.filter(() => bool()),
      soloLeadsOut: bool(),
      hochzeit: bool(),
      hochzeitClarifyTricks: 1 + Math.floor(rng() * 4),
      stilleHochzeit: bool(),
      armut: bool(),
      armutAnnounceReturnedTrumps: bool(),
      schmeiss5Luschen: bool(),
      schmeiss7Volle: bool(),
      schmeissConsequence: bool() ? 'redeal' : 'redealAndBock',
      announcements: bool(),
      absagen: bool(),
      pflichtansage: bool(),
      bock: bool(),
      bockTriggers: triggers.filter(() => bool()),
      pflichtsolo: bool(),
      tableSize: ([3, 4, 5] as const)[Math.floor(rng() * 3)],
      rounds: 1 + Math.floor(rng() * 20),
      training: bool(),
    });
    const issues = validateRuleSet(rs);
    assert.ok(Array.isArray(issues));
    for (const issue of issues) {
      assert.ok(issue.code.length > 0);
      assert.ok(['error', 'warning'].includes(issue.severity));
    }
  }
});

test('Absage-Komplement: Re sagt keine 90 an und erfuellt sie', () => {
  const rs = makeRuleSet({ spDoppelkopf: false, spFuchsGefangen: false, spKarlchen: false });
  const order = buildOrder({ kind: 'normal' }, rs);
  const deck = createDeck('with9');
  const tricks: TrickRecord[] = [];
  let re = 0;
  for (let k = 0; k < deck.length; k += 4) {
    const chunk = deck.slice(k, k + 4);
    const pts = sumValues(chunk);
    const toRe = re + pts <= 160;
    if (toRe) re += pts;
    tricks.push({
      played: chunk.map((card, s) => ({ card, seat: s })),
      winnerSeat: toRe ? 0 : 1,
    });
  }
  const res = scoreRound({
    rs,
    gameType: { kind: 'normal' },
    order,
    reSeats: [0, 2],
    tricks,
    announcements: { re: true, kontra: false, reAbsage: 1, kontraAbsage: 0 },
    multiplier: 1,
  });
  assert.ok(res.rePoints >= 151, `Re hatte nur ${res.rePoints}`);
  assert.equal(res.winner, 're');
  // Additiv: Grundwert 1, keine 90 erreicht +1, Absage keine 90 +1 = 3.
  // Ansage Re verdoppelt: 3 * 2 = 6.
  assert.equal(res.value, 6);
});

test('Beide Absagen verfehlt: die Runde endet mit 0 und loest damit Bock aus', () => {
  const rs = makeRuleSet({ spDoppelkopf: false, spFuchsGefangen: false, spKarlchen: false });
  const order = buildOrder({ kind: 'normal' }, rs);
  const deck = createDeck('with9');
  const tricks: TrickRecord[] = [];
  let re = 0;
  for (let k = 0; k < deck.length; k += 4) {
    const chunk = deck.slice(k, k + 4);
    const pts = sumValues(chunk);
    const toRe = re + pts <= 120;
    if (toRe) re += pts;
    tricks.push({
      played: chunk.map((card, s) => ({ card, seat: s })),
      winnerSeat: toRe ? 0 : 1,
    });
  }
  const res = scoreRound({
    rs,
    gameType: { kind: 'normal' },
    order,
    reSeats: [0, 2],
    tricks,
    // Beide sagen keine 90 an, beide koennen 151 nicht erreichen.
    announcements: { re: true, kontra: true, reAbsage: 1, kontraAbsage: 1 },
    multiplier: 1,
  });
  assert.equal(res.winner, null);
  assert.equal(res.value, 0);
  assert.ok(Object.values(res.scores).every((v) => v === 0));
});

test('Invariante: Troph\u00e4en sind bei jedem Gleichstandsmuster ganzzahlig', () => {
  // Alle moeglichen Gleichstandsmuster durchspielen: jede Komposition von n
  // beschreibt die Gruppengroessen der gleichauf liegenden Spieler.
  function compositions(n: number): number[][] {
    if (n === 0) return [[]];
    const out: number[][] = [];
    for (let first = 1; first <= n; first++) {
      for (const rest of compositions(n - first)) out.push([first, ...rest]);
    }
    return out;
  }

  for (const n of [3, 4, 5]) {
    for (const groups of compositions(n)) {
      const standings: { seat: number; score: number }[] = [];
      let seat = 0;
      let score = groups.length * 10;
      for (const size of groups) {
        for (let i = 0; i < size; i++) standings.push({ seat: seat++, score });
        score -= 10;
      }

      const result = awardTrophies(standings);
      const total = result.reduce((a, x) => a + x.trophies, 0);
      assert.equal(total, 0, `Nicht nullsummig bei ${n}/${groups.join('-')}`);
      for (const r of result) {
        assert.ok(
          Number.isInteger(r.trophies),
          `Gebrochener Wert ${r.trophies} bei ${n} Spielern, Muster ${groups.join('-')}`,
        );
      }
    }
  }
});
