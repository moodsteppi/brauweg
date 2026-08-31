/**
 * Regressionen aus der Partiesimulation.
 *
 * Jeder Eintrag hier ist ein Fehler, den `simulation.test.ts` gefunden hat -
 * festgehalten als kleinster Fall mit festem Keim, damit er beim naechsten Mal
 * in einer Zeile auffaellt statt in dreihundert Partien.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { wizard } from '../src/adapter.js';
import { DEFAULT_RULESET, type RuleSet } from '../src/ruleset.js';

/**
 * Gefunden am 31.08.2026 durch die Aktionsprobe der Simulation.
 *
 * In der blinden ersten Runde bietet `legalActions` nur 'playBlind' an - die
 * Engine nahm aber auch 'playCard' entgegen. Zwei Folgen:
 *
 *   1. Die Engine akzeptierte eine Aktion, die das Modul selbst als unerlaubt
 *      meldet. Der Server verlaesst sich an genau dieser Stelle auf das Modul.
 *   2. Ein Client konnte Kartennummern durchprobieren: Alle fremden Nummern
 *      werden mit "liegt nicht auf der Hand" abgelehnt, die eigene nicht.
 *      Damit war die Karte an der Stirn lesbar - das Gegenteil der Hausregel.
 */
test('Regression: in der blinden Runde nimmt die Engine kein playCard an', () => {
  const rs: RuleSet = { ...DEFAULT_RULESET, tableSize: 4, rounds: 3, blindFirstRound: true };
  let party = wizard.createParty({ config: rs, seats: 4, rounds: 3, seed: 7 });

  while (party.current!.phase !== 'playing') {
    const seat = wizard.currentActor(party)!;
    party = wizard.act(party, seat, wizard.botAction(wizard.viewFor(party, seat)));
  }

  const seat = wizard.currentActor(party)!;
  assert.equal(party.current!.blind, true, 'Aufbau falsch: Runde ist nicht blind');
  assert.deepEqual(
    wizard.legalActions(party, seat),
    [{ type: 'playBlind', seat }],
    'Aufbau falsch: legalActions bietet mehr als playBlind an',
  );

  const eigene = party.current!.hands[seat]![0]!.id;
  assert.throws(
    () => wizard.act(party, seat, { type: 'playCard', seat, cardId: eigene }),
    /blind/,
    'die eigene Karte liess sich benennen',
  );
  // Die Gegenprobe: Eine fremde Nummer wird ebenfalls abgelehnt - und zwar mit
  // DERSELBEN Begruendung. Sonst bleibt die Sondierung moeglich.
  const fremde = (eigene + 1) % 60;
  assert.throws(
    () => wizard.act(party, seat, { type: 'playCard', seat, cardId: fremde }),
    /blind/,
    'fremde Nummer wird anders abgelehnt als die eigene - die Karte bleibt lesbar',
  );

  // Und der erlaubte Weg funktioniert weiter.
  const danach = wizard.act(party, seat, { type: 'playBlind', seat });
  assert.equal(danach.current!.currentTrick.length, 1);
});
