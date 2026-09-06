/**
 * Regressionstests: je ein Fund aus der Partiesimulation, mit dem Aufbau, der
 * ihn ausloest. Jeder Test hier ist einmal rot gewesen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isClubQueen } from '../src/cards.js';
import { isTrump, servingSuit, strength } from '../src/order.js';
import { makeRuleSet } from '../src/ruleset.js';
import {
  type RoundState,
  allowedVorbehalte,
  apply,
  createRound,
  currentActor,
  viewFor,
  vorbehaltOffen,
} from '../src/round.js';

const SEATS = [0, 1, 2, 3];

/**
 * Sucht einen Keim, bei dem eine Armut angesagt, angenommen und getauscht
 * wird, und spielt sie bis zum Tausch durch.
 *
 * `bedingung` filtert zusaetzlich - ein Test, der eine Kreuz-Dame in der
 * Kontra-Hand braucht, kommt sonst nicht zuverlaessig dorthin.
 */
function armutRunde(
  bedingung: (state: RoundState) => boolean = () => true,
): RoundState {
  const rs = makeRuleSet({ armut: true, hochzeit: false, pflichtsolo: false });

  for (let seed = 0; seed < 20000; seed++) {
    let state = createArmut(rs, seed);
    if (state === null) continue;
    if (!bedingung(state)) continue;
    return state;
  }
  throw new Error('Kein Keim mit durchgespielter Armut gefunden');
}

function createArmut(rs: ReturnType<typeof makeRuleSet>, seed: number): RoundState | null {
  let state = createRound(rs, SEATS, 0, seed);
  const armer = SEATS.find((s) => allowedVorbehalte(state, s).includes('armut'));
  if (armer === undefined) return null;

  while (state.phase === 'vorbehalt') {
    const dran = vorbehaltOffen(state)[0]!;
    state = apply(state, {
      type: 'vorbehalt',
      seat: dran,
      kind: dran === armer ? 'armut' : null,
    });
  }
  if (state.phase !== 'armutExchange') return null;

  const annehmer = currentActor(state)!;
  state = apply(state, { type: 'armutAccept', seat: annehmer });

  const hand = state.hands[armer];
  const truempfe = hand.filter((c) => isTrump(c, state.order));
  const abgabe = truempfe.length > 0 ? truempfe : hand.slice(0, 3);
  state = apply(state, {
    type: 'armutHandover',
    seat: armer,
    cards: abgabe.map((c) => c.id),
  });

  const partner = state.armut!.partnerSeat!;
  state = apply(state, {
    type: 'armutReturn',
    seat: partner,
    cards: state.hands[partner].slice(0, abgabe.length).map((c) => c.id),
  });
  return state.phase === 'playing' ? state : null;
}

test('Armut: die gespielte Runde ist eine Armut, kein Normalspiel', () => {
  // Gefunden in der Partiesimulation (Keim 20029, Runde 7): Der Vorbehalt
  // "Armut" setzte Phase und Parteien, liess `gameType` aber auf 'normal'
  // stehen. Die Spielart 'armut' wurde damit NIE vergeben - der Oberflaechen-
  // text "Armut" war unerreichbar, und schlimmer: alles, was am Normalspiel
  // haengt, griff mitten in der Armut (siehe naechster Test).
  const state = armutRunde();
  assert.equal(state.gameType.kind, 'armut', 'Armut wird als Normalspiel gefuehrt');
  assert.deepEqual(
    [...state.reSeats].sort((a, b) => a - b),
    [state.armut!.seat, state.armut!.partnerSeat!].sort((a, b) => a - b),
    'Re ist das Armut-Paar',
  );
});

test('Armut: eine gespielte Kreuz-Dame deckt keine Partei auf', () => {
  // Im Normalspiel ist Re, wer eine Kreuz-Dame haelt - eine gelegte Dame ist
  // deshalb eine oeffentliche Auskunft. In der Armut gilt das gerade NICHT:
  // Dort bilden Ansager und Annehmer die Re-Partei, die Damen sind beliebig
  // verteilt. Weil die Armut als Normalspiel gefuehrt wurde, verriet die erste
  // gelegte Kreuz-Dame trotzdem die wahre Partei ihres Spielers - an alle,
  // Bots eingeschlossen.
  let state = armutRunde((s) =>
    // Nur brauchbar, wenn eine Kreuz-Dame bei der Kontra-Partei liegt.
    SEATS.some((seat) => !s.reSeats.includes(seat) && s.hands[seat].some(isClubQueen)),
  );

  const paar = [state.armut!.seat, state.armut!.partnerSeat!].sort((a, b) => a - b);
  let dameGelegt = false;

  while (state.phase === 'playing') {
    const seat = currentActor(state)!;
    const legal = viewFor(state, seat).legal;
    // Die Kreuz-Dame bevorzugen, damit der Fall ueberhaupt eintritt.
    const karte = legal.find(isClubQueen) ?? legal[0]!;
    if (isClubQueen(karte) && !paar.includes(seat)) dameGelegt = true;
    state = apply(state, { type: 'playCard', seat, cardId: karte.id });

    if (state.phase !== 'playing') break;
    for (const beobachter of SEATS) {
      const bekannt = Object.keys(viewFor(state, beobachter).knownParties)
        .map(Number)
        .sort((a, b) => a - b);
      assert.deepEqual(
        bekannt,
        paar,
        `Sitz ${beobachter} sieht in der Armut fremde Parteien`,
      );
    }
  }

  assert.ok(dameGelegt, 'Der Fall ist nicht eingetreten: keine Kreuz-Dame der Kontra-Partei gelegt');
});

// --- Hochzeit ---------------------------------------------------------------

/**
 * Die Hochzeit haengt am Blatt: Ein Sitz muss beide Kreuz-Damen halten, und
 * das ist selten (nachgemessen ueber 400 Gaben zu viert wird sie in 94 von
 * 1600 Sitz-Gelegenheiten angeboten, knapp sechs Prozent). Deshalb wird sie
 * hier GESTELLT statt erhofft — genau wie die Armut darueber. Die Simulation
 * verlangt sie aus demselben Grund nicht mehr namentlich (siehe
 * simulation.test.ts).
 */
const HOCHZEIT_RS = makeRuleSet({ hochzeit: true, armut: false, pflichtsolo: false });

/**
 * Baut eine Runde, in der genau der Sitz mit beiden Kreuz-Damen Hochzeit
 * ansagt und alle anderen gesund sind. `null`, wenn der Keim keine Braut hat.
 */
function hochzeitAngesagt(seed: number): { state: RoundState; braut: number } | null {
  let state = createRound(HOCHZEIT_RS, SEATS, 0, seed);
  const braut = SEATS.find((s) => allowedVorbehalte(state, s).includes('hochzeit'));
  if (braut === undefined) return null;

  while (state.phase === 'vorbehalt') {
    const dran = vorbehaltOffen(state)[0]!;
    state = apply(state, {
      type: 'vorbehalt',
      seat: dran,
      kind: dran === braut ? 'hochzeit' : null,
    });
  }
  return state.phase === 'playing' ? { state, braut } : null;
}

/**
 * Spielt genau einen Stich zu Ende. `schwach` legt seine schlechteste erlaubte
 * Karte, alle anderen ihre beste — damit laesst sich steuern, WER den Stich
 * macht, und darauf beruht die ganze Klaerung der Hochzeit.
 */
function spieleStich(state: RoundState, schwach: number): RoundState {
  const vorher = state.tricks.length;
  while (state.phase === 'playing' && state.tricks.length === vorher) {
    const seat = currentActor(state)!;
    const sicht = viewFor(state, seat);
    const erste = sicht.currentTrick[0]?.card ?? null;
    const wert = (c: (typeof sicht.legal)[number]) =>
      strength(c, sicht.order, servingSuit(erste ?? c, sicht.order));
    const sortiert = [...sicht.legal].sort((a, b) => wert(a) - wert(b));
    const karte = seat === schwach ? sortiert[0]! : sortiert[sortiert.length - 1]!;
    state = apply(state, { type: 'playCard', seat, cardId: karte.id });
  }
  return state;
}

/** Sucht einen Keim mit angesagter Hochzeit, den `bedingung` durchlaesst. */
function sucheHochzeit(
  bedingung: (state: RoundState, braut: number) => boolean,
): { state: RoundState; braut: number } {
  for (let seed = 0; seed < 20000; seed++) {
    const treffer = hochzeitAngesagt(seed);
    if (treffer === null) continue;
    if (!bedingung(treffer.state, treffer.braut)) continue;
    return treffer;
  }
  throw new Error('Kein Keim mit angesagter Hochzeit gefunden');
}

test('Hochzeit: der Klaerungsstich macht seinen Gewinner zum Partner', () => {
  const { state: angesagt, braut } = sucheHochzeit(
    (s, b) => spieleStich(s, b).tricks[0]!.winnerSeat !== b,
  );

  assert.equal(angesagt.gameType.kind, 'hochzeit', 'Die Ansage wurde nicht zur Hochzeit');
  assert.equal(angesagt.hochzeitBride, braut);
  assert.equal(
    angesagt.hands[braut]!.filter(isClubQueen).length,
    2,
    'Die Braut haelt nicht beide Kreuz-Damen',
  );
  // Vor der Klaerung steht die Braut allein da — sie weiss selbst noch nicht,
  // mit wem sie spielt.
  assert.equal(angesagt.hochzeitResolved, false, 'Hochzeit schon vor dem ersten Stich geklaert');
  assert.deepEqual(angesagt.reSeats, [braut], 'Vor der Klaerung ist nur die Braut Re');

  const state = spieleStich(angesagt, braut);
  const partner = state.tricks[0]!.winnerSeat;

  assert.equal(state.hochzeitResolved, true, 'Der fremde Stich hat nicht geklaert');
  assert.deepEqual(
    [...state.reSeats].sort((a, b) => a - b),
    [braut, partner].sort((a, b) => a - b),
    'Re ist nicht Braut + Gewinner des Klaerungsstichs',
  );
});

test('Hochzeit: klaert sich bis zur Frist niemand, spielt die Braut allein', () => {
  // Gegenprobe zum Klaerungsstich: Gewinnt die Braut die ersten
  // `hochzeitClarifyTricks` Stiche selbst, wird die Hochzeit zum Solo. Sie
  // legt dafuer ihre beste Karte, alle anderen ihre schlechteste.
  const frist = HOCHZEIT_RS.hochzeitClarifyTricks;
  const { state: angesagt, braut } = sucheHochzeit((s, b) => {
    let probe = s;
    for (let i = 0; i < frist; i++) {
      probe = spieleStich(probe, gegenspieler(b));
      if (probe.tricks[i]!.winnerSeat !== b) return false;
    }
    return true;
  });

  let state = angesagt;
  for (let i = 0; i < frist; i++) state = spieleStich(state, gegenspieler(braut));

  assert.equal(state.hochzeitResolved, true, 'Nach Ablauf der Frist immer noch ungeklaert');
  assert.deepEqual(state.reSeats, [braut], 'Die ungeklaerte Hochzeit hat einen Partner bekommen');
});

/** Irgendein Sitz, der nicht die Braut ist — als "schwacher" Spieler. */
function gegenspieler(braut: number): number {
  return SEATS.find((s) => s !== braut)!;
}

test('Stille Hochzeit: kein Partner, gewertet wie ein Solo', () => {
  // Die Braut sagt NICHTS an. Dann bleibt die Spielart 'normal', aber die
  // Parteibildung ueber die Kreuz-Damen laesst sie allein zurueck — und die
  // Abrechnung muss sie trotzdem als Solo behandeln (dreifacher Wert gegen
  // drei Gegner). Genau das ist der Unterschied zwischen GESPIELTER und
  // GEWERTETER Spielart, und er faellt sonst niemandem auf.
  const gefunden = sucheStilleHochzeit();
  const { state, braut } = gefunden;

  assert.equal(state.stilleHochzeit, true, 'Die Runde gilt nicht als stille Hochzeit');
  assert.equal(state.gameType.kind, 'normal', 'Die stille Hochzeit ist keine angesagte Hochzeit');
  assert.deepEqual(state.reSeats, [braut], 'Die stille Braut hat einen Partner bekommen');

  const res = state.result!;
  assert.equal(res.soloSeat, braut, 'Die stille Hochzeit wurde nicht als Solo abgerechnet');
  for (const seat of SEATS) {
    if (seat === braut) continue;
    assert.equal(
      res.scores[braut],
      -3 * res.scores[seat]!,
      `Sitz ${seat} bekommt nicht ein Drittel des Brautwerts mit umgekehrtem Vorzeichen`,
    );
  }
});

/**
 * Sucht einen Keim, bei dem ein Sitz beide Kreuz-Damen haelt und niemand
 * etwas ansagt, und spielt die Runde zu Ende.
 *
 * Verlangt wird zusaetzlich ein entschiedener Ausgang: Bei Gleichstand ist der
 * Spielwert 0, alle bekommen 0, und die Drittel-Zusicherung waere leer.
 */
function sucheStilleHochzeit(): { state: RoundState; braut: number } {
  for (let seed = 0; seed < 20000; seed++) {
    let state = createRound(HOCHZEIT_RS, SEATS, 0, seed);
    const braut = SEATS.find((s) => allowedVorbehalte(state, s).includes('hochzeit'));
    if (braut === undefined) continue;

    while (state.phase === 'vorbehalt') {
      const dran = vorbehaltOffen(state)[0]!;
      state = apply(state, { type: 'vorbehalt', seat: dran, kind: null });
    }
    if (state.phase !== 'playing') continue;

    while (state.phase === 'playing') {
      const seat = currentActor(state)!;
      state = apply(state, {
        type: 'playCard',
        seat,
        cardId: viewFor(state, seat).legal[0]!.id,
      });
    }
    if (state.result === null || state.result.winner === null) continue;
    return { state, braut };
  }
  throw new Error('Kein Keim mit entschiedener stiller Hochzeit gefunden');
}
