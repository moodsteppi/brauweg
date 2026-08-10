import { test } from 'node:test';
import assert from 'node:assert/strict';

import { skat } from '../src/adapter.js';
import { makeRuleSet } from '../src/ruleset.js';
import type { PartyState } from '../src/party.js';

/**
 * Spielt eine ganze Partie mit drei Bots bis zum Ende durch — ueber die
 * Modul-Schnittstelle, also genau ueber die Aufrufe, die auch der Server
 * macht (currentActor / viewFor / botAction / act, Pause per advanceInterlude).
 * Das ist der Ende-zu-Ende-Nachweis, dass Reizen, Skat, Druecken, Ansage,
 * Stich und Abrechnung zusammenspielen.
 */
function spieleDurch(rounds: number, seed: number, ramsch: boolean): PartyState {
  const config = makeRuleSet({ ramsch, rounds });
  let party = skat.createParty({ config, seats: 3, rounds, seed }) as PartyState;

  let guard = 0;
  while (!skat.isFinished(party)) {
    if (++guard > 100_000) throw new Error('Partie kommt nicht zum Ende');
    const actor = skat.currentActor(party);
    if (actor === null) {
      // Niemand am Zug: entweder Zwischenpause (dann weiter), sonst Fehler.
      assert.notEqual(skat.interludeMs!(party), null, 'kein Akteur ohne Pause');
      party = skat.advanceInterlude!(party) as PartyState;
      continue;
    }
    const view = skat.viewFor(party, actor);
    const action = skat.botAction(view);
    party = skat.act(party, actor, action) as PartyState;
  }
  return party;
}

test('Volle Bot-Partie mit Ramsch laeuft bis zum Endstand', () => {
  const party = spieleDurch(3, 4242, true);
  assert.equal(party.finished, true);
  assert.equal(party.roundIndex, 3, 'genau drei abgerechnete Gaben');
  assert.equal(party.history.length, 3);

  const standings = skat.standings(party);
  assert.equal(standings.length, 3);
  // Plaetze sind 1..3 und lueckenlos vergeben (Gleichstand teilt sich einen).
  for (const s of standings) assert.ok(s.place >= 1 && s.place <= 3);
  assert.ok(standings.some((s) => s.place === 1));

  // xpBasis: zehn Karten je Sitz und abgerechneter Gabe.
  const xp = skat.xpBasis!(party);
  for (const seat of [0, 1, 2]) assert.equal(xp[seat], 3 * 10);
});

test('Volle Bot-Partie ohne Ramsch friert nicht ein (Vorhand nimmt an)', () => {
  const party = spieleDurch(6, 99, false);
  assert.equal(party.finished, true);
  assert.equal(party.roundIndex, 6);
  // Ohne Ramsch darf keine Gabe „Ramsch" gewesen sein.
  for (const h of party.history) {
    assert.notEqual(h.gameType?.kind, 'ramsch');
  }
});

test('Serialisierung ueberlebt eine Rundmitte', () => {
  const config = makeRuleSet({ rounds: 3 });
  let party = skat.createParty({ config, seats: 3, rounds: 3, seed: 7 }) as PartyState;
  // Ein paar Aktionen, dann durch Serialisierung schicken.
  for (let i = 0; i < 3 && !skat.isFinished(party); i++) {
    const actor = skat.currentActor(party);
    if (actor === null) break;
    const action = skat.botAction(skat.viewFor(party, actor));
    party = skat.act(party, actor, action) as PartyState;
  }
  const roh = JSON.parse(JSON.stringify(skat.serialize(party)));
  const zurueck = skat.deserialize(roh) as PartyState;
  assert.equal(zurueck.roundIndex, party.roundIndex);
  assert.equal(zurueck.current?.phase, party.current?.phase);
});
