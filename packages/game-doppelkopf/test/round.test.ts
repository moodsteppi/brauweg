import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sumValues } from '../src/cards.js';
import { makeRuleSet } from '../src/ruleset.js';
import { makeRng } from '../src/deal.js';
import { isTrump } from '../src/order.js';
import {
  type RoundState,
  RuleViolation,
  allowedVorbehalte,
  apply,
  createRound,
  currentActor,
  viewFor,
  vorbehaltTurn,
} from '../src/round.js';
import type { AbsageLevel } from '../src/scoring.js';

const SEATS = [0, 1, 2, 3];

/**
 * Spielt eine Runde mit zufaelligen, aber stets legalen Aktionen durch.
 * Wirft der Automat eine RuleViolation, ist das ein Fehler im Automaten:
 * der Treiber waehlt ausschliesslich aus den angebotenen Moeglichkeiten.
 */
function playRandomRound(state: RoundState, rng: () => number): RoundState {
  let steps = 0;

  while (state.phase !== 'finished' && state.phase !== 'redeal') {
    if (steps++ > 500) throw new Error('Automat terminiert nicht');

    const actor = currentActor(state);
    assert.notEqual(actor, null, `Kein Akteur in Phase ${state.phase}`);
    const seat = actor as number;

    if (state.pendingPflichtansage) {
      const canDecline = state.pendingPflichtansage.canDecline;
      state = apply(state, {
        type: 'confirmPflichtansage',
        seat,
        accept: canDecline ? rng() < 0.5 : true,
      });
      continue;
    }

    if (state.phase === 'vorbehalt') {
      const options = allowedVorbehalte(state, seat);
      // Bewusst selten, sonst bestehen fast alle Runden aus Solos und das
      // Normalspiel bleibt untergetestet.
      const takes = options.length > 0 && rng() < 0.12;
      const kind = takes ? options[Math.floor(rng() * options.length)] : null;
      const solo =
        kind === 'solo'
          ? state.rs.solos[Math.floor(rng() * state.rs.solos.length)]
          : undefined;
      state = apply(state, { type: 'vorbehalt', seat, kind, solo });
      continue;
    }

    if (state.phase === 'armutExchange') {
      const armut = state.armut!;
      if (armut.partnerSeat === null) {
        state = apply(state, {
          type: rng() < 0.6 ? 'armutAccept' : 'armutDecline',
          seat,
        });
        continue;
      }
      if (armut.given === null) {
        const poor = state.hands[armut.seat];
        const trumps = poor.filter((c) => isTrump(c, state.order));
        const cards =
          trumps.length > 0
            ? trumps.map((c) => c.id)
            : poor.slice(0, 3).map((c) => c.id);
        state = apply(state, { type: 'armutHandover', seat: armut.seat, cards });
        continue;
      }
      const back = state.hands[armut.partnerSeat]
        .slice(0, armut.given.length)
        .map((c) => c.id);
      state = apply(state, {
        type: 'armutReturn',
        seat: armut.partnerSeat,
        cards: back,
      });
      continue;
    }

    // Spielphase: gelegentlich ansagen, sonst eine legale Karte spielen.
    if (rng() < 0.12) {
      const level = Math.floor(rng() * 3) as AbsageLevel;
      try {
        state = apply(state, { type: 'announce', seat, level });
        continue;
      } catch (e) {
        // Frist abgelaufen oder Stufe uebersprungen: dann eben eine Karte.
        if (!(e instanceof RuleViolation)) throw e;
      }
    }

    const view = viewFor(state, seat);
    assert.ok(view.legal.length > 0, 'Kein legaler Zug verfuegbar');
    const card = view.legal[Math.floor(rng() * view.legal.length)];
    state = apply(state, { type: 'playCard', seat, cardId: card.id });
  }

  return state;
}

test('Fuzz: 1000 Runden laufen ohne ungueltigen Zustand durch', () => {
  const rng = makeRng(31337);
  let finished = 0;
  let redeals = 0;
  const seenGameTypes = new Set<string>();
  const kindCounts: Record<string, number> = {};

  for (let i = 0; i < 1000; i++) {
    const rs = makeRuleSet({
      deck: rng() < 0.5 ? 'with9' : 'without9',
      secondDulleBeatsFirst: rng() < 0.5,
      defusedDullen: rng() < 0.3,
      schweinchen: rng() < 0.5,
      superSchweine: rng() < 0.3,
      schmeiss5Luschen: rng() < 0.4,
      schmeiss7Volle: rng() < 0.4,
      pflichtansage: rng() < 0.5,
      spCharlieGefangen: rng() < 0.5,
      spHerzdurchlauf: rng() < 0.5,
      spInSolo: rng() < 0.5,
    });

    let state = createRound(rs, SEATS, i % 4, i);
    state = playRandomRound(state, rng);

    if (state.phase === 'redeal') {
      redeals++;
      continue;
    }

    finished++;
    const kind =
      state.gameType.kind === 'solo'
        ? `solo:${state.gameType.solo}`
        : state.stilleHochzeit
          ? 'stilleHochzeit'
          : state.gameType.kind;
    seenGameTypes.add(kind);
    kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;

    const cardsPerHand = rs.deck === 'with9' ? 12 : 10;
    assert.equal(state.tricks.length, cardsPerHand);
    for (const s of SEATS) assert.equal(state.hands[s].length, 0);

    const total = state.tricks.reduce(
      (a, t) => a + sumValues(t.played.map((p) => p.card)),
      0,
    );
    assert.equal(total, 240);

    const res = state.result!;
    assert.equal(res.rePoints + res.kontraPoints, 240);
    assert.equal(Object.values(res.scores).reduce((a, b) => a + b, 0), 0);
  }

  assert.ok(finished > 800, `Zu wenige beendete Runden: ${finished}`);
  assert.ok(redeals > 0, 'Kein einziges Neugeben aufgetreten');

  // Jede Spielart muss ausreichend oft vorkommen, sonst testet das Fuzzing
  // vor allem eine einzige Codepfad-Familie.
  assert.ok(seenGameTypes.has('hochzeit'), 'Keine angesagte Hochzeit');
  assert.ok(seenGameTypes.has('stilleHochzeit'), 'Keine stille Hochzeit');
  assert.ok(
    (kindCounts['normal'] ?? 0) > 300,
    `Zu wenige Normalspiele: ${kindCounts['normal'] ?? 0}`,
  );
  const soloKinds = [...seenGameTypes].filter((k) => k.startsWith('solo:'));
  assert.ok(soloKinds.length >= 5, `Nur ${soloKinds.length} Solovarianten getestet`);
});

test('Sichtbarkeit: fremde Handkarten tauchen in keiner Sicht auf', () => {
  const rng = makeRng(4711);
  const rs = makeRuleSet({ pflichtansage: true });

  for (let i = 0; i < 50; i++) {
    let state = createRound(rs, SEATS, i % 4, 1000 + i);

    // Mitten im Spiel pruefen, nicht erst am Ende.
    let steps = 0;
    while (state.phase !== 'finished' && state.phase !== 'redeal' && steps++ < 20) {
      for (const seat of SEATS) {
        const view = viewFor(state, seat);
        const visibleIds = new Set(view.hand.map((c) => c.id));
        for (const other of SEATS) {
          if (other === seat) continue;
          for (const card of state.hands[other]) {
            assert.ok(
              !visibleIds.has(card.id),
              `Karte von Sitz ${other} in der Sicht von Sitz ${seat}`,
            );
          }
        }
        assert.equal(view.handCounts[seat], state.hands[seat].length);
        const serialized = JSON.stringify(view);
        for (const other of SEATS) {
          if (other === seat) continue;
          for (const card of state.hands[other]) {
            // Ein Treffer waere nur zufaellig, wenn die Karte oeffentlich liegt.
            const onTable =
              state.currentTrick.some((p) => p.card.id === card.id) ||
              state.tricks.some((t) => t.played.some((p) => p.card.id === card.id));
            if (!onTable) {
              // Wortgrenze noetig, sonst matcht "id":3 auch "id":34.
              const pattern = new RegExp(`"id":${card.id}(?![0-9])`);
              assert.ok(
                !pattern.test(serialized),
                `id ${card.id} von Sitz ${other} im JSON fuer Sitz ${seat}`,
              );
            }
          }
        }
      }
      state = playOneStep(state, rng);
    }
  }
});

function playOneStep(state: RoundState, rng: () => number): RoundState {
  const actor = currentActor(state);
  if (actor === null) return state;
  const seat = actor;

  if (state.pendingPflichtansage) {
    return apply(state, {
      type: 'confirmPflichtansage',
      seat,
      accept: true,
    });
  }
  if (state.phase === 'vorbehalt') {
    return apply(state, { type: 'vorbehalt', seat, kind: null });
  }
  const view = viewFor(state, seat);
  const card = view.legal[Math.floor(rng() * view.legal.length)];
  return apply(state, { type: 'playCard', seat, cardId: card.id });
}

test('Automat weist illegale Aktionen zurueck', () => {
  const rs = makeRuleSet();
  let state = createRound(rs, SEATS, 0, 5);

  // Falscher Sitz in der Vorbehaltsabfrage.
  assert.throws(
    () => apply(state, { type: 'vorbehalt', seat: 2, kind: null }),
    RuleViolation,
  );
  // Karte spielen, bevor die Abfrage durch ist.
  assert.throws(
    () => apply(state, { type: 'playCard', seat: 0, cardId: state.hands[0][0].id }),
    RuleViolation,
  );

  for (const seat of SEATS) {
    state = apply(state, { type: 'vorbehalt', seat, kind: null });
  }
  assert.equal(state.phase, 'playing');

  // Fremde Karte spielen.
  assert.throws(
    () =>
      apply(state, {
        type: 'playCard',
        seat: state.turn,
        cardId: state.hands[(state.turn + 1) % 4][0].id,
      }),
    RuleViolation,
  );
});

test('countPoints steuert die Zaehlhilfe in der Sicht', () => {
  // Mit Regel: Die Augen der gewonnenen Stiche stehen in der Sicht, und am
  // Rundenende summieren sie sich auf die vollen 240.
  const mit = makeRuleSet({ countPoints: true });
  let state = playRandomRound(createRound(mit, SEATS, 0, 42), makeRng(42));
  if (state.phase === 'finished') {
    const sicht = viewFor(state, 0);
    const summe = Object.values(sicht.standings).reduce((a, b) => a + b, 0);
    assert.equal(summe, 240);
  }

  // Ohne Regel bleiben die Staende leer - fuer jeden Sitz, in jeder Phase.
  const ohne = makeRuleSet({ countPoints: false });
  state = playRandomRound(createRound(ohne, SEATS, 0, 42), makeRng(42));
  for (const seat of SEATS) {
    assert.deepEqual(viewFor(state, seat).standings, {});
  }
});

// --- Pflichtansage: die zusaetzlichen Ausloeser ---

/**
 * Sucht einen Seed, bei dem ein Sitz die Schweine haelt, und bringt die Runde
 * in die Spielphase (alle gesund).
 *
 * Ueber einen Seed statt ueber eine gestellte Hand: `createRound` gibt selbst,
 * und eine von Hand gesetzte Hand wuerde am Automaten vorbeigehen — genau das
 * soll hier aber mitgeprueft werden.
 */
function rundeMitSchweinen(patch = {}) {
  const rs = makeRuleSet({
    schweinchen: true,
    pflichtansage: true,
    pflichtansageSchweine: true,
    hochzeit: false,
    armut: false,
    pflichtsolo: false,
    ...patch,
  });
  for (let seed = 0; seed < 4000; seed++) {
    let state = createRound(rs, SEATS, 0, seed);
    if (!SEATS.some((s) => state.schweinchen[s])) continue;
    while (state.phase === 'vorbehalt') {
      const seat = currentActor(state) as number;
      state = apply(state, { type: 'vorbehalt', seat, kind: null });
    }
    if (state.phase === 'playing') return state;
  }
  throw new Error('Kein Seed mit Schweinen gefunden');
}

test('Pflichtansage: Schweine verpflichten den Halter schon vor dem ersten Stich', () => {
  const state = rundeMitSchweinen();
  const halter = SEATS.find((s) => state.schweinchen[s])!;

  assert.notEqual(state.pendingPflichtansage, null, 'Die Pflicht muss offen sein');
  assert.equal(state.pendingPflichtansage!.seat, halter);
  assert.equal(state.pendingPflichtansage!.reason, 'schweine');
  assert.equal(
    state.pendingPflichtansage!.canDecline,
    false,
    'Eine Tatsache auf der Hand kennt keine moralische Zwischenstufe',
  );
  assert.equal(currentActor(state), halter, 'Er ist am Zug, nicht die Vorhand');
});

test('Pflichtansage: Schweine ohne den Ausloeser verpflichten niemanden', () => {
  const state = rundeMitSchweinen({ pflichtansageSchweine: false });
  assert.equal(state.pendingPflichtansage, null);
});

test('Pflichtansage: der Schweine-Halter steht dauerhaft in der Sicht', () => {
  const state = rundeMitSchweinen();
  const halter = SEATS.find((s) => state.schweinchen[s])!;
  for (const seat of SEATS) {
    assert.deepEqual(
      viewFor(state, seat).schweineSeats,
      [halter],
      `Sitz ${seat} muss den Halter sehen`,
    );
  }
});

test('Pflichtansage: ohne den Ausloeser bleibt der Halter geheim', () => {
  const state = rundeMitSchweinen({ pflichtansageSchweine: false });
  for (const seat of SEATS) {
    assert.deepEqual(viewFor(state, seat).schweineSeats, []);
  }
});

test('Pflichtansage: die Schweine-Pflicht sagt Re oder Kontra an', () => {
  let state = rundeMitSchweinen();
  const halter = state.pendingPflichtansage!.seat;
  const party = state.reSeats.includes(halter) ? 're' : 'kontra';

  state = apply(state, { type: 'confirmPflichtansage', seat: halter, accept: true });
  assert.equal(state.pendingPflichtansage, null, 'Danach ist nichts mehr offen');
  assert.equal(
    party === 're' ? state.announcements.re : state.announcements.kontra,
    true,
  );
  assert.equal(
    party === 're' ? state.announcements.reAbsage : state.announcements.kontraAbsage,
    0,
    'Der erste Ausloeser ergibt Re, keine Absage',
  );
});

test('Vorbehalt: die Sicht liefert je Solo eine Vorschau-Ordnung', () => {
  const rs = makeRuleSet({ solos: ['suitH', 'queens', 'jacks'] });
  const state = createRound(rs, SEATS, 0, 77);
  const dran = currentActor(state) as number;

  const sicht = viewFor(state, dran);
  assert.deepEqual(
    Object.keys(sicht.soloVorschau).sort(),
    ['jacks', 'queens', 'suitH'],
    'Je waehlbares Solo eine Ordnung',
  );

  // Die Ordnungen muessen sich wirklich unterscheiden — sonst zeigt die
  // Vorschau ueberall dasselbe und ist wertlos.
  assert.equal(sicht.soloVorschau.queens!.trumps[0], 'CQ');
  assert.equal(sicht.soloVorschau.jacks!.trumps[0], 'CJ');
  assert.notDeepEqual(
    sicht.soloVorschau.queens!.trumps,
    sicht.soloVorschau.jacks!.trumps,
  );

  // Wer nicht dran ist, braucht keine Vorschau und bekommt keine.
  const anderer = SEATS.find((s) => s !== dran)!;
  assert.deepEqual(viewFor(state, anderer).soloVorschau, {});
});

test('Vorbehalt: nach der Abfrage gibt es keine Vorschau mehr', () => {
  const rs = makeRuleSet({ pflichtsolo: false, armut: false, hochzeit: false });
  let state = createRound(rs, SEATS, 0, 77);
  while (state.phase === 'vorbehalt') {
    const seat = currentActor(state) as number;
    state = apply(state, { type: 'vorbehalt', seat, kind: null });
  }
  assert.deepEqual(viewFor(state, 0).soloVorschau, {});
});

test('Pflichtsolo: die Sicht sagt, wer es noch offen hat', () => {
  const rs = makeRuleSet({ pflichtsolo: true });
  const offen = createRound(rs, SEATS, 0, 5, { soloPlayed: [1, 3] });
  assert.deepEqual(viewFor(offen, 0).pflichtsoloOffen, [0, 2]);

  // Ohne die Regel gibt es keine Pflicht und deshalb auch keine Liste.
  const ohne = createRound(makeRuleSet({ pflichtsolo: false }), SEATS, 0, 5, {
    soloPlayed: [1, 3],
  });
  assert.deepEqual(viewFor(ohne, 0).pflichtsoloOffen, []);
});

test('Pflichtansage: die Folgeansage ist ein eigener Schalter', () => {
  const rs = makeRuleSet({ pflichtansage: true });
  assert.equal(
    rs.pflichtansageFolge,
    false,
    'Wer die Pflichtansage anschaltet, bekommt die Kette nicht ungefragt dazu',
  );

  const mit = makeRuleSet({ pflichtansage: true, pflichtansageFolge: true });
  assert.equal(mit.pflichtansageFolge, true);
});

test('Pflichtansage: Schweine verlaengern die Kette nicht', () => {
  let state = rundeMitSchweinen();
  const halter = state.pendingPflichtansage!.seat;
  state = apply(state, { type: 'confirmPflichtansage', seat: halter, accept: true });
  assert.equal(
    state.pflichtansageKette,
    false,
    'Nur eine Pflicht am Bezugsstich verlaengert — Schweine liegen davor',
  );
});

test('eine gespielte Kreuz-Dame deckt die Partei dauerhaft auf', () => {
  const rs = makeRuleSet({ pflichtsolo: false, armut: false, hochzeit: false });
  let state = createRound(rs, SEATS, 0, 4242);

  // Alle gesund, damit ein Normalspiel zustande kommt.
  while (state.phase === 'vorbehalt') {
    const seat = currentActor(state)!;
    state = apply(state, { type: 'vorbehalt', seat, kind: null });
  }
  if (state.gameType.kind !== 'normal') return; // stille Hochzeit: anderer Fall

  // Vor der ersten Kreuz-Dame weiss niemand etwas ueber fremde Parteien.
  for (const seat of SEATS) {
    const fremde = Object.keys(viewFor(state, seat).knownParties).map(Number);
    assert.deepEqual(fremde, [], `Sitz ${seat} sieht zu frueh eine Partei`);
  }

  // Bis zur ersten gespielten Kreuz-Dame durchspielen.
  let leger: number | null = null;
  let steps = 0;
  while (state.phase === 'playing' && leger === null && steps++ < 200) {
    const seat = currentActor(state)!;
    const view = viewFor(state, seat);
    const dame = view.legal.find((c) => c.suit === 'C' && c.rank === 'Q');
    const card = dame ?? view.legal[0];
    state = apply(state, { type: 'playCard', seat, cardId: card.id });
    if (dame) leger = seat;
  }
  assert.notEqual(leger, null, 'In dieser Verteilung wurde keine Kreuz-Dame gespielt');

  // Ab jetzt gilt sie als aufgedeckt - und bleibt es, egal wie viele
  // Stiche noch folgen. Genau das war vorher nicht so.
  const merke = () =>
    SEATS.every((seat) => viewFor(state, seat).knownParties[leger!] === 're');
  assert.ok(merke(), 'direkt nach dem Legen nicht aufgedeckt');

  while (state.phase === 'playing' && steps++ < 400) {
    const seat = currentActor(state)!;
    const view = viewFor(state, seat);
    state = apply(state, { type: 'playCard', seat, cardId: view.legal[0].id });
    assert.ok(merke(), 'die Kreuz-Dame wurde spaeter wieder vergessen');
  }
});

test('Sicht: fremde Vorbehalts-Art und Schweine bleiben bis zum Ende der Gesund-Runde verdeckt', () => {
  // Der Reihe nach sagt einer ein Solo an, waehrend die anderen noch nicht
  // erklaert haben. Ein Mitspieler, der selbst noch ein Solo erwaegt, darf
  // daran nicht ablesen, wer was hat - erst wenn alle durch sind.
  const rs = makeRuleSet({ pflichtansageSchweine: true });
  let state = createRound(rs, SEATS, 0, 42);
  assert.equal(state.phase, 'vorbehalt');

  const erster = vorbehaltTurn(state)!;
  const sichtErster = viewFor(state, erster);
  assert.ok(sichtErster.allowedVorbehalte.includes('solo'), 'Aufbau: Solo muss ansagbar sein');
  const solo = sichtErster.soloOptions[0]!;
  state = apply(state, { type: 'vorbehalt', seat: erster, kind: 'solo', solo });

  // Die Abfrage laeuft noch: der Ansager sieht sein Solo, ein anderer nur,
  // DASS ein Vorbehalt da ist ('verdeckt'), nicht welcher. Und die Schweine
  // nennt die Sicht noch niemandem.
  assert.equal(state.phase, 'vorbehalt');
  const anderer = SEATS.find((s) => s !== erster)!;
  const fremd = viewFor(state, anderer).vorbehalte.find((v) => v.seat === erster);
  assert.equal(fremd?.kind, 'verdeckt', 'die Art bleibt fremden Sitzen verborgen');
  const eigen = viewFor(state, erster).vorbehalte.find((v) => v.seat === erster);
  assert.equal(eigen?.kind, 'solo', 'der Ansager sieht seine eigene Wahl');
  assert.deepEqual(viewFor(state, anderer).schweineSeats, [], 'Schweine erst nach der Runde');

  // Die restlichen Sitze sagen gesund - danach ist die Abfrage vorbei.
  while (state.phase === 'vorbehalt') {
    const dran = vorbehaltTurn(state)!;
    state = apply(state, { type: 'vorbehalt', seat: dran, kind: null });
  }

  // Jetzt liegt die Art offen: aus dem Solo ist ein Solo geworden, und ein
  // Mitspieler sieht das auch.
  assert.notEqual(state.phase, 'vorbehalt');
  const offen = viewFor(state, anderer).vorbehalte.find((v) => v.seat === erster);
  assert.equal(offen?.kind, 'solo', 'nach der Gesund-Runde ist die Art offen');
});
