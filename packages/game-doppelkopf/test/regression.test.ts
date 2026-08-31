/**
 * Regressionstests: je ein Fund aus der Partiesimulation, mit dem Aufbau, der
 * ihn ausloest. Jeder Test hier ist einmal rot gewesen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isClubQueen } from '../src/cards.js';
import { isTrump } from '../src/order.js';
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
