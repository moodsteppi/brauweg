import { test } from 'node:test';
import assert from 'node:assert/strict';

import { wizard } from '../src/adapter.js';
import { DEFAULT_RULESET } from '../src/ruleset.js';
import type { PartyState } from '../src/party.js';
import type { RoundAction } from '../src/round.js';

function neueParty(seats = 4, rounds = 4, patch: Record<string, unknown> = {}): PartyState {
  return wizard.createParty({
    config: { ...DEFAULT_RULESET, ...patch },
    seats,
    rounds,
    seed: 7,
    seedHex: 'c0ffee00c0ffee00c0ffee00c0ffee00',
  });
}

/** Spielt die Partie ueber die Modulschnittstelle zu Ende. */
function durchspielen(start: PartyState): PartyState {
  let party = start;
  let schutz = 0;
  while (!wizard.isFinished(party)) {
    const seat = wizard.currentActor(party);
    assert.notEqual(seat, null, 'Niemand am Zug, Partie laeuft aber noch');
    const actions = wizard.legalActions(party, seat!);
    assert.ok(actions.length > 0, `Sitz ${seat} hat keine Aktion`);
    const bot = wizard.botAction(wizard.viewFor(party, seat!));
    assert.ok(
      actions.some((a) => JSON.stringify(a) === JSON.stringify(bot)),
      `Bot-Aktion steht nicht in legalActions: ${JSON.stringify(bot)}`,
    );
    party = wizard.act(party, seat!, bot);
    if (++schutz > 20000) throw new Error('Partie laeuft nicht zu Ende');
  }
  return party;
}

test('Meta: vier Tischgroessen, Rotation 1, sinnvolle Rundenvorschlaege', () => {
  assert.equal(wizard.meta.id, 'wizard');
  assert.equal(wizard.meta.availability, 'playable');
  assert.deepEqual([...wizard.meta.seatCounts], [3, 4, 5, 6]);
  for (const seats of [3, 4, 5, 6]) {
    assert.equal(wizard.meta.rotationSize(seats), 1);
    const vorschlaege = wizard.meta.suggestedRounds(seats);
    assert.equal(vorschlaege[0], Math.floor(60 / seats));
    for (const runden of vorschlaege) {
      assert.ok(runden >= 1 && runden <= 60 / seats);
    }
  }
});

test('Regelsatz: Vorgabe ist gueltig, Unsinn wird abgewiesen', () => {
  assert.deepEqual(wizard.validateConfig(DEFAULT_RULESET, 4, 15), []);
  assert.ok(wizard.validateConfig(null, 4, 15).length > 0);
  assert.ok(wizard.validateConfig('kein Regelsatz', 4, 15).length > 0);
  assert.ok(wizard.validateConfig({}, 4, 15).length > 0);
  // Fehlendes Feld
  const { zeroBonus: _weg, ...luecke } = DEFAULT_RULESET;
  assert.ok(wizard.validateConfig(luecke, 4, 15).length > 0);
  // Falscher Typ
  assert.ok(wizard.validateConfig({ ...DEFAULT_RULESET, noTrump: 'ja' }, 4, 15).length > 0);
});

test('Regelsatz: zu viele Runden und unbekannte Sitzzahlen fallen auf', () => {
  assert.ok(wizard.validateConfig(DEFAULT_RULESET, 4, 16).length > 0);
  assert.ok(wizard.validateConfig(DEFAULT_RULESET, 7, 8).length > 0);
  assert.deepEqual(wizard.validateConfig(DEFAULT_RULESET, 6, 10), []);
});

test('Regelsatz: widerspruechliche Hausregeln werden abgewiesen', () => {
  const problems = wizard.validateConfig(
    { ...DEFAULT_RULESET, noTrump: true, jesterPicksTrump: true },
    4,
    10,
  );
  assert.ok(problems.some((p) => p.messageKey.includes('noTrumpVsJesterPicks')));
});

test('Eine Partie startet mit laufender erster Runde', () => {
  const party = neueParty();
  assert.ok(party.current);
  assert.equal(party.current!.roundNumber, 1);
  assert.notEqual(wizard.currentActor(party), null);
});

test('legalActions liefert genau die Aktionen der jeweiligen Phase', () => {
  let party = neueParty(4, 4);
  const seat = wizard.currentActor(party)!;
  const actions = wizard.legalActions(party, seat) as RoundAction[];

  if (party.current!.phase === 'trump') {
    assert.equal(actions.length, 4);
    assert.ok(actions.every((a) => a.type === 'chooseTrump'));
    party = wizard.act(party, seat, actions[0]!);
  }

  const ansager = wizard.currentActor(party)!;
  const ansagen = wizard.legalActions(party, ansager) as RoundAction[];
  assert.ok(ansagen.every((a) => a.type === 'bid'));
  // Runde 1: null oder ein Stich.
  assert.equal(ansagen.length, 2);
  // Wer nicht dran ist, hat nichts zu tun.
  const anderer = party.seats.find((s) => s !== ansager)!;
  assert.deepEqual(wizard.legalActions(party, anderer), []);
});

test('Fremde Sitze koennen nicht handeln', () => {
  const party = neueParty();
  const seat = wizard.currentActor(party)!;
  const action = (wizard.legalActions(party, seat) as RoundAction[])[0]!;
  const fremd = party.seats.find((s) => s !== seat)!;
  assert.throws(() => wizard.act(party, fremd, action));
});

test('Eine volle Partie laeuft ueber die Modulschnittstelle durch', () => {
  const fertig = durchspielen(neueParty(4, 8));
  assert.equal(wizard.isFinished(fertig), true);
  assert.equal(wizard.currentActor(fertig), null);
  assert.equal(wizard.completedSegments!(fertig).length, 8);

  const tabelle = wizard.standings(fertig);
  assert.equal(tabelle.length, 4);
  assert.equal(new Set(tabelle.map((s) => s.seat)).size, 4);
  assert.ok(tabelle.some((s) => s.place === 1));
});

test('Sicht: eigene Hand ja, fremde nein - Zuschauer gar keine', () => {
  const party = neueParty(4, 6);
  const view = wizard.viewFor(party, 1);
  assert.equal(view.spectator, false);
  assert.equal(view.round!.seat, 1);
  assert.equal(view.totalRounds, 6);

  const zuschauer = wizard.spectatorView(party);
  assert.equal(zuschauer.spectator, true);
  assert.deepEqual(zuschauer.round!.hand, []);
  assert.equal(zuschauer.round!.seat, null);
});

test('Der Bot laeuft nicht auf der Zuschauersicht', () => {
  const party = neueParty();
  assert.throws(() => wizard.botAction(wizard.spectatorView(party)));
});

test('Snapshot ueberlebt den Weg durch JSON', () => {
  let party = neueParty(4, 5);
  // Ein paar Zuege, damit der Zustand nicht der Anfangszustand ist.
  for (let i = 0; i < 6 && !wizard.isFinished(party); i++) {
    const seat = wizard.currentActor(party)!;
    party = wizard.act(party, seat, wizard.botAction(wizard.viewFor(party, seat)));
  }

  const wieder = wizard.deserialize(JSON.parse(JSON.stringify(wizard.serialize(party))));
  assert.deepEqual(wizard.viewFor(wieder, 0), wizard.viewFor(party, 0));
  assert.equal(wizard.currentActor(wieder), wizard.currentActor(party));

  // Und die Partie laeuft danach normal weiter.
  assert.equal(wizard.isFinished(durchspielen(wieder)), true);
});

test('Ein Snapshot aus einer anderen Fassung wird abgewiesen', () => {
  const snap = wizard.serialize(neueParty()) as Record<string, unknown>;
  assert.throws(() => wizard.deserialize({ ...snap, v: 99 }));
});

test('Ein Aussteiger steht in der Platzierung', () => {
  const fertig = durchspielen(neueParty(4, 3));
  const mitAusstieg = wizard.markLeft(fertig, 2);
  assert.equal(wizard.standings(mitAusstieg).find((s) => s.seat === 2)!.left, true);
});

test('Alle Tischgroessen laufen ueber die Schnittstelle durch', () => {
  for (const seats of [3, 4, 5, 6]) {
    const runden = Math.floor(60 / seats);
    const fertig = durchspielen(neueParty(seats, runden));
    assert.equal(wizard.standings(fertig).length, seats);
    assert.equal(wizard.completedSegments!(fertig).length, runden);
  }
});

test('Hausregeln laufen ueber die Schnittstelle: verdeckt ansagen und Null-Bonus', () => {
  const fertig = durchspielen(
    neueParty(4, 5, { hiddenBids: true, zeroBonus: true, blindFirstRound: true }),
  );
  assert.equal(wizard.isFinished(fertig), true);
});
