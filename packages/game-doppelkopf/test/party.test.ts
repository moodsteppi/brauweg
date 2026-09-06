import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeRuleSet } from '../src/ruleset.js';
import { makeRng } from '../src/deal.js';
import { validateRuleSet } from '../src/validator.js';
import { isTrump } from '../src/order.js';
import {
  type PartyState,
  act,
  createParty,
  forcedSoloSeat,
  inRundenpause,
  markLeft,
  pauseSeats,
  seating,
  startRound,
  upcomingMultiplier,
} from '../src/party.js';
import { allowedVorbehalte, currentActor, viewFor } from '../src/round.js';
import { amZug } from './vorbehaltshilfe.js';

const FOUR = [0, 1, 2, 3];

/**
 * Die Trophaeensumme muss null sein. Bei Gleichstand entstehen durch die
 * Mittelwertbildung Kommazahlen (etwa 8 und 3 geteilt durch zwei), deshalb
 * wird mit Toleranz statt exakt verglichen.
 */
function assertZeroSum(trophies: readonly { trophies: number }[]): void {
  const total = trophies.reduce((a, t) => a + t.trophies, 0);
  assert.ok(Math.abs(total) < 1e-9, `Troph\u00e4ensumme ${total} statt 0`);
}
const FIVE = [0, 1, 2, 3, 4];

/** Spielt die laufende Runde mit legalen Zufallszuegen zu Ende. */
function finishRound(party: PartyState, rng: () => number): PartyState {
  let steps = 0;
  while (party.current && steps++ < 500) {
    const st = party.current;
    const seat = amZug(st);
    if (seat === null) break;

    if (st.pendingPflichtansage) {
      party = act(party, { type: 'confirmPflichtansage', seat, accept: true });
      continue;
    }
    if (st.phase === 'vorbehalt') {
      const options = allowedVorbehalte(st, seat);
      const forced = st.forcedSoloSeat === seat;
      const takes = forced || (options.length > 0 && rng() < 0.15);
      const kind = takes ? options[Math.floor(rng() * options.length)] : null;
      party = act(party, {
        type: 'vorbehalt',
        seat,
        kind: kind ?? null,
        solo:
          kind === 'solo'
            ? st.rs.solos[Math.floor(rng() * st.rs.solos.length)]
            : undefined,
      });
      continue;
    }
    if (st.phase === 'armutExchange') {
      const a = st.armut!;
      if (a.partnerSeat === null) {
        party = act(party, {
          type: rng() < 0.6 ? 'armutAccept' : 'armutDecline',
          seat,
        });
        continue;
      }
      if (a.given === null) {
        const poor = st.hands[a.seat];
        const trumps = poor.filter((c) => isTrump(c, st.order));
        const cards =
          trumps.length > 0 ? trumps.map((c) => c.id) : poor.slice(0, 3).map((c) => c.id);
        party = act(party, { type: 'armutHandover', seat: a.seat, cards });
        continue;
      }
      const back = st.hands[a.partnerSeat].slice(0, a.given.length).map((c) => c.id);
      party = act(party, { type: 'armutReturn', seat: a.partnerSeat, cards: back });
      continue;
    }
    const view = viewFor(st, seat);
    const card = view.legal[Math.floor(rng() * view.legal.length)];
    party = act(party, { type: 'playCard', seat, cardId: card.id });
  }
  return party;
}

/** Beendet die Rundenpause, wie es Spieler taeten: jeder tippt "Weiter". */
function alleWeiter(party: PartyState): PartyState {
  let guard = 0;
  while (inRundenpause(party) && guard++ < 10) {
    const offen = pauseSeats(party).filter((s) => !party.weiter.includes(s));
    party = act(party, { type: 'weiter', seat: offen[0]! });
  }
  return party;
}

function playParty(party: PartyState, rng: () => number): PartyState {
  let guard = 0;
  while (!party.finished && guard++ < 200) {
    party = startRound(party);
    party = finishRound(party, rng);
    party = alleWeiter(party);
  }
  return party;
}

test('Geberrotation: am 4er-Tisch wandert der Geber, Vorhand sitzt links davon', () => {
  const rs = makeRuleSet({ rounds: 4 });
  let party = createParty(rs, FOUR, 1);

  const seen: number[] = [];
  for (let i = 0; i < 4; i++) {
    const s = seating(party);
    seen.push(s.dealer);
    assert.equal(s.active.length, 4);
    assert.equal(s.vorhand, (s.dealer + 1) % 4);
    party = { ...party, dealerIndex: party.dealerIndex + 1 };
  }
  assert.deepEqual(seen, [0, 1, 2, 3]);
});

test('Geberrotation: am 5er-Tisch setzt der Geber aus', () => {
  const rs = makeRuleSet({ tableSize: 5, rounds: 5 });
  let party = createParty(rs, FIVE, 1);

  for (let i = 0; i < 5; i++) {
    const s = seating(party);
    assert.equal(s.active.length, 4);
    assert.ok(!s.active.includes(s.dealer), 'Geber darf nicht mitspielen');
    party = { ...party, dealerIndex: party.dealerIndex + 1 };
  }
});

test('Rundenzahl richtet sich nach der Geberrotation, nicht nach der Tischgroesse', () => {
  // 3er-Tisch: ein Bot sitzt mit, die Rotation umfasst vier Sitze.
  const issues = validateRuleSet(makeRuleSet({ tableSize: 3, rounds: 3 }));
  assert.ok(issues.some((i) => i.code === 'ROUNDS_MULTIPLE'));
  assert.ok(
    !validateRuleSet(makeRuleSet({ tableSize: 3, rounds: 8 })).some(
      (i) => i.code === 'ROUNDS_MULTIPLE',
    ),
  );
  assert.throws(() => createParty(makeRuleSet({ tableSize: 3, rounds: 3 }), FOUR, 1));
});

test('Partie: acht Runden laufen durch, Punktesumme bleibt null', () => {
  const rng = makeRng(1234);
  const rs = makeRuleSet({ rounds: 8, pflichtansage: true });
  let party = createParty(rs, FOUR, 7);

  party = playParty(party, rng);

  assert.equal(party.finished, true);
  assert.equal(party.history.length, 8);
  assert.equal(Object.values(party.scores).reduce((a, b) => a + b, 0), 0);
  assertZeroSum(party.trophies!);
});

test('Pflichtsolo: nach acht Runden hat jeder Spieler ein Solo gespielt', () => {
  const rng = makeRng(555);
  const rs = makeRuleSet({ rounds: 8, pflichtsolo: true });
  let party = createParty(rs, FOUR, 3);

  party = playParty(party, rng);

  assert.equal(party.finished, true);
  assert.deepEqual([...party.soloPlayed].sort(), FOUR);
});

test('Pflichtsolo: Vorfuehrung greift erst, wenn die Runden knapp werden', () => {
  const rs = makeRuleSet({ rounds: 4, pflichtsolo: true });
  const base = createParty(rs, FOUR, 9);

  // Noch vier Runden, vier offene Pflichtsolos: es wird vorgefuehrt.
  assert.notEqual(forcedSoloSeat(base), null);

  // Zwei bereits gespielt, noch vier Runden offen: kein Zwang.
  const relaxed = { ...base, soloPlayed: [0, 1], roundIndex: 0 };
  assert.equal(forcedSoloSeat(relaxed), null);
});

test('Vorgefuehrter Spieler kann nichts anderes als Solo ansagen', () => {
  const rs = makeRuleSet({ rounds: 4, pflichtsolo: true });
  let party = startRound(createParty(rs, FOUR, 11));
  const forced = party.current!.forcedSoloSeat;
  assert.notEqual(forced, null);

  assert.deepEqual(allowedVorbehalte(party.current!, forced!), ['solo']);
  assert.throws(() =>
    act(party, { type: 'vorbehalt', seat: forced!, kind: null }),
  );
});

test('Bock: ein Ausloeser wirkt auf die vier folgenden Runden der Partie', () => {
  const rs = makeRuleSet({ rounds: 8, bock: true, bockTriggers: ['solo'] });
  let party = createParty(rs, FOUR, 21);

  assert.equal(upcomingMultiplier(party), 1);
  party.bock.trigger(0);
  assert.equal(upcomingMultiplier({ ...party, roundIndex: 1 }), 2);
  assert.equal(upcomingMultiplier({ ...party, roundIndex: 4 }), 2);
  assert.equal(upcomingMultiplier({ ...party, roundIndex: 5 }), 1);
});

test('Bock verlaengert die Partie nicht', () => {
  const rng = makeRng(88);
  const rs = makeRuleSet({
    rounds: 4,
    bock: true,
    bockTriggers: ['solo', 'zeroResult', 'reAndKontra'],
    pflichtsolo: true,
  });
  let party = createParty(rs, FOUR, 31);
  party = playParty(party, rng);

  assert.equal(party.history.length, 4);
  assert.equal(party.finished, true);
});

test('Neugabe wiederholt dieselbe Runde mit neuem Seed', () => {
  const rs = makeRuleSet({ rounds: 4, schmeiss5Luschen: true, pflichtsolo: false });
  let party = createParty(rs, FOUR, 41);
  party = startRound(party);

  const seedBefore = party.current!.seed;
  const dealerBefore = seating(party).dealer;

  // Vorbehalt "Schmeissen" durch den ersten Spieler, der ihn hat.
  let handled = false;
  for (let i = 0; i < 4 && !handled; i++) {
    const st = party.current!;
    const seat = amZug(st)!;
    const options = allowedVorbehalte(st, seat);
    if (options.includes('schmeiss')) {
      party = act(party, { type: 'vorbehalt', seat, kind: 'schmeiss' });
      handled = true;
    } else {
      party = act(party, { type: 'vorbehalt', seat, kind: null });
    }
  }

  if (!handled) return; // in dieser Verteilung kein Schmeissen moeglich

  assert.equal(party.current, null);
  assert.equal(party.roundIndex, 0, 'Neugabe darf die Runde nicht weiterzaehlen');
  assert.equal(party.attempt, 1);

  party = startRound(party);
  assert.notEqual(party.current!.seed, seedBefore);
  assert.equal(seating(party).dealer, dealerBefore, 'Geber bleibt bei Neugabe gleich');
});

test('Aussteiger wird als Letzter gewertet und zahlt die Strafe', () => {
  const rng = makeRng(600);
  const rs = makeRuleSet({ rounds: 4, pflichtsolo: false });
  let party = createParty(rs, FOUR, 61);
  party = playParty(markLeft(party, 2), rng);

  const t = party.trophies!.find((x) => x.seat === 2)!;
  assert.equal(t.place, 4);
  assert.equal(t.trophies, -19); // letzter Platz (-9) plus Strafe (-10)
});

test('Trainingsmodus vergibt keine Trophaeen', () => {
  const rng = makeRng(700);
  const rs = makeRuleSet({ rounds: 4, training: true, pflichtsolo: false });
  let party = playParty(createParty(rs, FOUR, 71), rng);
  assert.deepEqual(party.trophies, []);
});

test('Fuzz: 200 vollstaendige Partien laufen sauber durch', () => {
  const rng = makeRng(24680);

  for (let i = 0; i < 200; i++) {
    const rs = makeRuleSet({
      deck: rng() < 0.5 ? 'with9' : 'without9',
      rounds: 4,
      pflichtsolo: rng() < 0.6,
      pflichtansage: rng() < 0.5,
      bock: true,
      bockTriggers: ['zeroResult', 'reAndKontra', 'solo'],
      schmeiss5Luschen: rng() < 0.3,
      schmeiss7Volle: rng() < 0.3,
      schweinchen: rng() < 0.5,
      superSchweine: rng() < 0.3,
    });

    let party = playParty(createParty(rs, FOUR, 5000 + i), rng);

    assert.equal(party.finished, true, `Partie ${i} nicht beendet`);
    assert.equal(party.history.length, rs.rounds);
    assert.equal(Object.values(party.scores).reduce((a, b) => a + b, 0), 0);
    assertZeroSum(party.trophies!);

    if (rs.pflichtsolo) {
      assert.deepEqual(
        [...party.soloPlayed].sort(),
        FOUR,
        `Partie ${i}: nicht alle Pflichtsolos gespielt`,
      );
    }
  }
});
