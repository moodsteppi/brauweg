import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filler } from '../src/adapter.js';
import { DEFAULT_REGELN } from '../src/regeln.js';

function partie() {
  return filler.createParty({
    config: DEFAULT_REGELN,
    seats: 2,
    rounds: 1,
    seed: 42,
    seedHex: 'deadbeefcafebabe0123456789abcdef',
  });
}

describe('Adapter', () => {
  it('meldet sich als spielbares Zweierspiel', () => {
    assert.equal(filler.meta.id, 'filler');
    assert.equal(filler.meta.availability, 'playable');
    assert.deepEqual(filler.meta.seatCounts, [2]);
    assert.equal(filler.meta.xpBasisZaehltKarten, false);
  });

  it('nimmt den Vorgabe-Regelsatz an', () => {
    assert.deepEqual(filler.validateConfig(DEFAULT_REGELN, 2, 1), []);
  });

  it('weist Unsinn im Regelsatz ab', () => {
    assert.ok(filler.validateConfig(null, 2, 1).length > 0);
    assert.ok(filler.validateConfig({ spalten: 8 }, 2, 1).length > 0);
    assert.ok(filler.validateConfig({ ...DEFAULT_REGELN, farben: 99 }, 2, 1).length > 0);
    // Drei Sitze: nicht vorgesehen, und mit sechs Farben blieben nur drei.
    assert.ok(filler.validateConfig(DEFAULT_REGELN, 3, 1).length > 0);
  });

  it('kennt den Sitz am Zug und seine Zuege', () => {
    const p = partie();
    assert.equal(filler.currentActor(p), 0);
    assert.equal(filler.legalActions(p, 0).length, DEFAULT_REGELN.farben - 2);
    assert.equal(filler.legalActions(p, 1).length, 0);
    assert.equal(filler.isFinished(p), false);
  });

  it('ueberlebt Speichern und Laden', () => {
    const p = filler.act(partie(), 0, filler.legalActions(partie(), 0)[0]!);
    const roh = JSON.parse(JSON.stringify(filler.serialize(p)));
    assert.deepEqual(filler.deserialize(roh), p);
  });

  it('weist einen Snapshot aus einer anderen Fassung ab', () => {
    assert.throws(() => filler.deserialize({ v: 99 }));
  });

  it('liefert Platzierungen und markiert Aussteiger', () => {
    const p = filler.markLeft(partie(), 1);
    const stand = filler.standings(p);
    assert.equal(stand.length, 2);
    assert.equal(stand.find((s) => s.seat === 1)?.left, true);
  });

  it('laesst den Bot nicht auf die Zuschauersicht', () => {
    assert.throws(() => filler.botAction(filler.spectatorView(partie())));
  });

  it('spielt gegen sich selbst bis zum Schluss', () => {
    let p = partie();
    let schritte = 0;
    while (!filler.isFinished(p) && schritte < 500) {
      const sitz = filler.currentActor(p)!;
      p = filler.act(p, sitz, filler.botAction(filler.viewFor(p, sitz)));
      schritte++;
    }
    assert.equal(filler.isFinished(p), true);
    const xp = filler.xpBasis!(p);
    assert.equal(
      (xp[0] ?? 0) + (xp[1] ?? 0),
      DEFAULT_REGELN.spalten * DEFAULT_REGELN.zeilen,
    );
  });
});
