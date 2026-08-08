/**
 * Eigenschaften, die ueber viele Gaben hinweg gelten muessen.
 *
 * Einzelne Beispiele fangen die Faelle, an die man denkt. Diese Tests fangen
 * die, an die man nicht denkt - sie laufen ueber hunderte Seeds und pruefen
 * Invarianten, die nie brechen duerfen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { botAction } from '../src/bot.js';
import { DECK_SIZE } from '../src/cards.js';
import { createParty, standings } from '../src/party.js';
import { HAND_SIZE, makeRuleSet } from '../src/ruleset.js';
import { apply, createRound, legalActions } from '../src/round.js';
import { viewFor } from '../src/view.js';
import { playOut } from './helpers.js';

const SEATS = [0, 1, 2, 3];

test('keine Karte geht verloren und keine kommt dazu', () => {
  for (let seed = 1; seed <= 200; seed++) {
    let st = createRound(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, 0, seed);

    for (let i = 0; i < 60 && st.phase !== 'finished'; i++) {
      const seat = st.turn;
      const action = botAction(viewFor(st, seat));
      if (!action) break;
      st = apply(st, action);

      const inHaenden = SEATS.reduce((n, s) => n + (st.hands[s] ?? []).length, 0);
      const gezogen = st.drawn ? 1 : 0;
      const gesamt = inHaenden + st.stock.length + st.discard.length + gezogen;

      assert.equal(gesamt, DECK_SIZE, `Seed ${seed}: ${gesamt} statt ${DECK_SIZE} Karten`);

      const ids = [
        ...SEATS.flatMap((s) => (st.hands[s] ?? []).map((k) => k.id)),
        ...st.stock.map((k) => k.id),
        ...st.discard.map((k) => k.id),
        ...(st.drawn ? [st.drawn.id] : []),
      ];
      assert.equal(new Set(ids).size, ids.length, `Seed ${seed}: doppelte Karte`);
    }
  }
});

test('jede Hand hat immer genau vier Plaetze', () => {
  for (let seed = 1; seed <= 100; seed++) {
    let st = createRound(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, 0, seed);
    for (let i = 0; i < 40 && st.phase !== 'finished'; i++) {
      for (const seat of SEATS) {
        assert.equal((st.hands[seat] ?? []).length, HAND_SIZE);
      }
      const action = botAction(viewFor(st, st.turn));
      if (!action) break;
      st = apply(st, action);
    }
  }
});

test('solange die Runde laeuft, hat der Sitz am Zug immer etwas zu tun', () => {
  // Sonst stuende der Tisch still und auch der Bot kaeme nicht weiter.
  for (let seed = 1; seed <= 150; seed++) {
    let st = createRound(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, 0, seed);
    for (let i = 0; i < 60 && st.phase !== 'finished'; i++) {
      assert.ok(
        legalActions(st, st.turn).length > 0,
        `Seed ${seed}: Sitz ${st.turn} steckt in Phase ${st.phase} fest`,
      );
      st = apply(st, botAction(viewFor(st, st.turn))!);
    }
  }
});

test('Partien laufen ueber viele Seeds zu Ende', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const party = playOut(createParty(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, seed));
    assert.equal(party.finished, true, `Seed ${seed} lief nicht zu Ende`);
    assert.equal(party.history.length, 4);
  }
});

test('Punkte sind nie negativ und die Tabelle ist widerspruchsfrei', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const party = playOut(createParty(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, seed));
    const tabelle = standings(party);

    for (const s of tabelle) {
      assert.ok(s.points >= 0, `Seed ${seed}: negative Punktzahl`);
      assert.ok(s.place >= 1 && s.place <= 4);
    }
    // Wer weniger Punkte hat, steht nie schlechter.
    for (const a of tabelle) {
      for (const b of tabelle) {
        if (a.points < b.points) assert.ok(a.place < b.place, `Seed ${seed}: Rangfolge falsch`);
      }
    }
  }
});

test('ein gelungener Ruf bringt dem Rufer immer null', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const party = playOut(createParty(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, seed));
    for (const runde of party.history) {
      if (runde.caller === null) continue;
      if (runde.callSucceeded) {
        assert.equal(runde.scores[runde.caller], 0);
      } else {
        assert.equal(
          runde.scores[runde.caller],
          (runde.raw[runde.caller] ?? 0) + party.rs.failPenalty,
        );
      }
    }
  }
});

test('derselbe Seed ergibt immer dieselbe Partie', () => {
  for (const seed of [3, 17, 99]) {
    const a = playOut(createParty(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, seed));
    const b = playOut(createParty(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, seed));
    assert.deepEqual(a.scores, b.scores);
    assert.deepEqual(a.history, b.history);
  }
});

test('kein Sitz sieht je eine Karte, die er nicht kennen darf', () => {
  // Die wichtigste Eigenschaft ueberhaupt: Wer fremde Karten sehen kann, hat
  // kein Spiel mehr, sondern eine Anzeige.
  for (let seed = 1; seed <= 100; seed++) {
    let st = createRound(makeRuleSet({ tableSize: 4, rounds: 4 }), SEATS, 0, seed);

    for (let i = 0; i < 40 && st.phase !== 'finished'; i++) {
      for (const betrachter of SEATS) {
        const v = viewFor(st, betrachter);
        for (const besitzer of SEATS) {
          v.hands[besitzer]!.forEach((slot) => {
            if (slot.card === null) return;
            const bekannt = (st.known[betrachter] ?? []).includes(`${besitzer}:${slot.index}`);
            assert.ok(
              bekannt,
              `Seed ${seed}: Sitz ${betrachter} sieht ${besitzer}:${slot.index} ohne es zu kennen`,
            );
          });
        }
      }
      st = apply(st, botAction(viewFor(st, st.turn))!);
    }
  }
});
