import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { eiland } from '../src/adapter.js';
import { DEFAULT_REGELN } from '../src/regeln.js';
import { waehlbare } from '../src/partie.js';

function partie() {
  return eiland.createParty({
    config: DEFAULT_REGELN,
    seats: 2,
    rounds: 1,
    seed: 42,
    seedHex: 'deadbeefcafebabe0123456789abcdef',
  });
}

describe('Adapter', () => {
  it('meldet sich als spielbares Zweierspiel', () => {
    assert.equal(eiland.meta.id, 'eiland');
    assert.equal(eiland.meta.availability, 'playable');
    assert.deepEqual(eiland.meta.seatCounts, [2]);
    assert.equal(eiland.meta.xpBasisZaehltKarten, false);
  });

  it('nimmt den Vorgabe-Regelsatz an', () => {
    assert.deepEqual(eiland.validateConfig(DEFAULT_REGELN, 2, 1), []);
  });

  it('weist Unsinn im Regelsatz ab', () => {
    assert.ok(eiland.validateConfig(null, 2, 1).length > 0);
    assert.ok(eiland.validateConfig({ spalten: 10 }, 2, 1).length > 0);
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, spalten: 99 }, 2, 1).length > 0);
    // Ungerade Feldzahl: Die Punktsymmetrie haette ein Feld, das sein eigener
    // Spiegel ist (siehe pruefeRegeln).
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, spalten: 7, zeilen: 7 }, 2, 1).length > 0);
    // Sichtweite ueber die halbe Karte hinaus waere ein offenes Brett.
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, sichtweite: 40 }, 2, 1).length > 0);
    // Mehr Hindernisse als Land.
    assert.ok(eiland.validateConfig({ ...DEFAULT_REGELN, seen: 6, berge: 12 }, 2, 1).length > 0);
    // Drei Sitze: nicht vorgesehen, die Karte kennt zwei Ecken.
    assert.ok(eiland.validateConfig(DEFAULT_REGELN, 3, 1).length > 0);
  });

  it('nennt einen Sitz am Zug und ueberlaesst dem Bildschirm die Aktion', () => {
    const p = partie();
    assert.equal(eiland.currentActor(p), 0);
    /*
     * Leer, und das ist die Aussage: Eine Aktion ist hier eine MENGE von
     * Feldern, die sich nicht aufzaehlen laesst. Was anwaehlbar ist, steht
     * stattdessen in der Sicht — derselbe Weg wie bei Skat und Doppelkopf.
     */
    assert.deepEqual(eiland.legalActions(p, 0), []);
    assert.ok(eiland.viewFor(p, 0).waehlbar.length > 0);
    assert.deepEqual(eiland.viewFor(p, 0).waehlbar, waehlbare(p, 0));
  });

  it('haelt einen Snapshot ueber Serialisieren hinweg', () => {
    const p = partie();
    const roh = JSON.parse(JSON.stringify(eiland.serialize(p)));
    assert.deepEqual(eiland.deserialize(roh), p);
  });

  it('weist einen Snapshot aus einer fremden Fassung ab', () => {
    const roh = eiland.serialize(partie()) as Record<string, unknown>;
    assert.throws(() => eiland.deserialize({ ...roh, v: 99 }), /Snapshot-Version/);
  });

  it('laesst den Bot nicht auf die Zuschauersicht', () => {
    // Sonst haette er kein Gebiet und wuesste nicht, wofuer er spielt.
    const p = partie();
    assert.throws(() => eiland.botAction(eiland.spectatorView(p)), /Zuschauersicht/);
  });

  it('spielt eine Partie ueber die Modulschnittstelle zu Ende', () => {
    let p = partie();
    let runden = 0;
    while (!eiland.isFinished(p) && runden < 1000) {
      // Genau die Schleife der Plattform: Wer am Zug ist, wird gefragt — hier
      // gibt der Bot je Aufruf einen ganzen Zettel ab (siehe bot.ts).
      const sitz = eiland.currentActor(p);
      assert.notEqual(sitz, null, 'niemand am Zug, obwohl die Partie laeuft');
      p = eiland.act(p, sitz!, eiland.botAction(eiland.viewFor(p, sitz!)));
      runden++;
    }
    assert.ok(eiland.isFinished(p));
    const tafel = eiland.standings(p);
    assert.equal(tafel.length, 2);
    assert.equal(tafel[0]!.place, 1);
    const xp = eiland.xpBasis!(p);
    assert.equal(xp[0], tafel.find((t) => t.seat === 0)!.points);
  });

  it('merkt sich einen ausgestiegenen Sitz', () => {
    const p = eiland.markLeft(partie(), 1);
    assert.ok(eiland.standings(p).find((s) => s.seat === 1)!.left);
  });
});
