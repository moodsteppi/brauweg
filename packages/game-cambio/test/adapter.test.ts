import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cambio } from '../src/adapter.js';
import { DEFAULT_RULESET, makeRuleSet } from '../src/ruleset.js';

function partie(seats = 4, rounds = 4) {
  return cambio.createParty({
    config: makeRuleSet({ tableSize: seats, rounds }),
    seats,
    rounds,
    seed: 4711,
  });
}

test('das Modul meldet sich als spielbar mit zwei bis sechs Sitzen', () => {
  assert.equal(cambio.meta.id, 'cambio');
  assert.equal(cambio.meta.availability, 'playable');
  assert.deepEqual([...cambio.meta.seatCounts], [2, 3, 4, 5, 6]);
});

test('die Geberrotation ist die Sitzzahl, damit jeder gleich oft gibt', () => {
  assert.equal(cambio.meta.rotationSize(4), 4);
  assert.equal(cambio.meta.rotationSize(3), 3);
  // Alle Vorschlaege gehen glatt auf.
  for (const seats of [2, 3, 4, 5, 6]) {
    for (const r of cambio.meta.suggestedRounds(seats)) {
      assert.equal(r % seats, 0, `${r} Runden bei ${seats} Sitzen geht nicht auf`);
    }
  }
});

test('ein unvollstaendiger Regelsatz wird abgelehnt', () => {
  const probleme = cambio.validateConfig({ name: 'kaputt' }, 4, 4);
  assert.ok(probleme.some((p) => p.messageKey === 'ruleset.fieldMissing'));
});

test('kein Objekt ist auch kein Regelsatz', () => {
  assert.ok(cambio.validateConfig(null, 4, 4).some((p) => p.severity === 'error'));
  assert.ok(cambio.validateConfig('nein', 4, 4).some((p) => p.severity === 'error'));
});

test('eine Rundenzahl, die nicht aufgeht, ist ein Fehler', () => {
  const probleme = cambio.validateConfig(DEFAULT_RULESET, 4, 5);
  assert.ok(probleme.some((p) => p.path === 'roundsNotMultipleOfRotation'));
});

test('eine unbekannte Sitzzahl ist ein Fehler', () => {
  const probleme = cambio.validateConfig(DEFAULT_RULESET, 7, 7);
  assert.ok(probleme.some((p) => p.severity === 'error'));
});

test('der Standardregelsatz geht durch', () => {
  const probleme = cambio.validateConfig(DEFAULT_RULESET, 4, 4);
  assert.deepEqual(probleme.filter((p) => p.severity === 'error'), []);
});

test('eine frische Partie hat eine laufende Runde und einen Sitz am Zug', () => {
  const p = partie();
  assert.equal(cambio.isFinished(p), false);
  assert.notEqual(cambio.currentActor(p), null);
  assert.ok(cambio.legalActions(p, cambio.currentActor(p)!).length > 0);
});

test('wer nicht am Zug ist, hat keine erlaubten Aktionen', () => {
  const p = partie();
  const dran = cambio.currentActor(p)!;
  const anderer = [0, 1, 2, 3].find((s) => s !== dran)!;
  assert.deepEqual(cambio.legalActions(p, anderer), []);
});

test('eine Aktion fuer einen fremden Sitz wird abgewiesen', () => {
  const p = partie();
  const dran = cambio.currentActor(p)!;
  const anderer = [0, 1, 2, 3].find((s) => s !== dran)!;
  assert.throws(
    () => cambio.act(p, anderer, { type: 'drawStock', seat: dran }),
    /anderen Sitz/,
  );
});

test('die Zuschauersicht enthaelt keine einzige Karte', () => {
  const v = cambio.spectatorView(partie());
  assert.equal(v.spectator, true);
  assert.notEqual(v.round, null);
  for (const seat of [0, 1, 2, 3]) {
    for (const slot of v.round!.hands[seat]!) assert.equal(slot.card, null);
  }
});

test('der Bot laeuft nicht auf der Zuschauersicht', () => {
  assert.throws(() => cambio.botAction(cambio.spectatorView(partie())), /Zuschauersicht/);
});

test('eine Partie laeuft ueber das Modul komplett durch', () => {
  // Genau so, wie die Plattform es tut: Wer am Zug ist, handelt; laeuft eine
  // Schaupause, wird sie nach Ablauf der Zeit beendet.
  let p = partie();
  let schritte = 0;
  while (!cambio.isFinished(p)) {
    if (cambio.interludeMs!(p) !== null) {
      assert.equal(cambio.currentActor(p), null, 'in der Pause ist niemand am Zug');
      p = cambio.advanceInterlude!(p);
      continue;
    }
    const seat = cambio.currentActor(p);
    assert.notEqual(seat, null, 'es ist immer jemand am Zug, solange es laeuft');
    const action = cambio.botAction(cambio.viewFor(p, seat!));
    p = cambio.act(p, seat!, action);
    if (++schritte > 20000) throw new Error('Partie laeuft nicht zu Ende');
  }

  const tabelle = cambio.standings(p);
  assert.equal(tabelle.length, 4);
  // Wenig ist gut: Platz 1 hat die kleinste Punktzahl.
  const erster = tabelle.find((s) => s.place === 1)!;
  for (const s of tabelle) assert.ok(erster.points <= s.points);
});

test('nach einer Runde laeuft eine Schaupause mit offenen Haenden', () => {
  // Ohne sie waere die neue Runde da, bevor jemand das Ergebnis gesehen hat -
  // und das Aufdecken ist bei diesem Spiel der ganze Zahltag.
  let p = partie(4, 8);
  let schritte = 0;
  while (cambio.interludeMs!(p) === null) {
    const seat = cambio.currentActor(p)!;
    p = cambio.act(p, seat, cambio.botAction(cambio.viewFor(p, seat)));
    if (++schritte > 5000) throw new Error('Keine Runde endete');
  }

  assert.equal(cambio.currentActor(p), null, 'in der Pause ist niemand am Zug');
  assert.equal(cambio.isFinished(p), false, 'die Partie laeuft weiter');
  assert.deepEqual(cambio.legalActions(p, 0), [], 'und niemand kann handeln');

  const v = cambio.viewFor(p, 0);
  assert.equal(v.round?.phase, 'finished');
  assert.notEqual(v.round?.result, null, 'die Abrechnung steht in der Sicht');
  // Jetzt liegen ALLE Haende offen - vorher war das die Ausnahme.
  for (const seat of [0, 1, 2, 3]) {
    for (const slot of v.round!.hands[seat]!) {
      assert.notEqual(slot.card, null, `Sitz ${seat} sollte offen liegen`);
    }
  }
  assert.equal(v.history.length, 1, 'die Runde steht schon in der Punktetafel');

  const weiter = cambio.advanceInterlude!(p);
  assert.equal(cambio.interludeMs!(weiter), null, 'die Pause ist vorbei');
  assert.notEqual(cambio.currentActor(weiter), null, 'die naechste Runde laeuft');
});

test('die Pause der letzten Runde beendet die Partie erst danach', () => {
  // Sonst waere die Partie vorbei, bevor das letzte Ergebnis zu sehen war.
  let p = partie(4, 4);
  let schritte = 0;
  while (!cambio.isFinished(p)) {
    if (cambio.interludeMs!(p) !== null) {
      const vorher = cambio.viewFor(p, 0).history.length;
      p = cambio.advanceInterlude!(p);
      assert.equal(cambio.viewFor(p, 0).history.length, vorher, 'die Pause zaehlt nichts dazu');
      continue;
    }
    const seat = cambio.currentActor(p)!;
    p = cambio.act(p, seat, cambio.botAction(cambio.viewFor(p, seat)));
    if (++schritte > 20000) throw new Error('Partie laeuft nicht zu Ende');
  }
  assert.equal(cambio.viewFor(p, 0).history.length, 4);
});

test('Snapshot laesst sich schreiben und wieder lesen', () => {
  const p = partie();
  const roh = JSON.parse(JSON.stringify(cambio.serialize(p)));
  const zurueck = cambio.deserialize(roh);

  assert.equal(cambio.currentActor(zurueck), cambio.currentActor(p));
  assert.deepEqual(cambio.viewFor(zurueck, 1), cambio.viewFor(p, 1));
});

test('ein Snapshot aus einer fremden Fassung faellt auf', () => {
  const roh = { ...(cambio.serialize(partie()) as Record<string, unknown>), v: 99 };
  assert.throws(() => cambio.deserialize(roh), /Snapshot-Version/);
});

test('derselbe Seed ergibt dieselbe Partie', () => {
  const a = cambio.viewFor(partie(), 0);
  const b = cambio.viewFor(partie(), 0);
  assert.deepEqual(a, b);
});

test('ein Aussteiger wird vermerkt, die Partie laeuft weiter', () => {
  const p = cambio.markLeft(partie(), 2);
  assert.ok(cambio.standings(p).find((s) => s.seat === 2)!.left);
  assert.equal(cambio.isFinished(p), false);
});
