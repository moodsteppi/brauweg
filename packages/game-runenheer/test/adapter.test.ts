import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runenheer } from '../src/adapter.js';
import { DEFAULT_REGELN, SEAT_COUNTS } from '../src/regeln.js';
import { type RunenheerPartie, vollerVorrat } from '../src/partie.js';
import { kartenZahl } from '../src/katalog.js';

/** Wie viele Karten es insgesamt gibt. Diese Zahl darf sich nie aendern. */
const KARTEN_INSGESAMT = Object.values(vollerVorrat()).reduce((a, b) => a + b, 0);

/** Vorrat plus alles, was gerade in Laeden, Baenken und auf Brettern liegt. */
function alleKarten(partie: RunenheerPartie): number {
  let zahl = Object.values(partie.vorrat).reduce((a, b) => a + b, 0);
  for (const heer of Object.values(partie.heere)) {
    zahl += heer.laden.filter((k) => k !== null).length;
    for (const k of [...heer.bank, ...heer.brett]) if (k) zahl += kartenZahl(k.stufe);
  }
  return zahl;
}

function partie(seats = 2): RunenheerPartie {
  return runenheer.createParty({
    config: DEFAULT_REGELN,
    seats,
    rounds: 1,
    seed: 42,
    seedHex: 'deadbeefcafebabe0123456789abcdef',
  });
}

describe('Adapter', () => {
  it('meldet sich als Vorschau fuer zwei bis acht Sitze', () => {
    assert.equal(runenheer.meta.id, 'runenheer');
    // Vorschau, solange es keinen Bildschirm und keine Kampfsimulation gibt.
    assert.equal(runenheer.meta.availability, 'preview');
    assert.deepEqual(runenheer.meta.seatCounts, SEAT_COUNTS);
    assert.equal(runenheer.meta.xpBasisZaehltKarten, false);
  });

  it('nimmt den Vorgabe-Regelsatz an', () => {
    assert.deepEqual(runenheer.validateConfig(DEFAULT_REGELN, 4, 1), []);
  });

  it('weist Unsinn im Regelsatz ab', () => {
    assert.ok(runenheer.validateConfig(null, 2, 1).length > 0);
    assert.ok(runenheer.validateConfig({ startLeben: 100 }, 2, 1).length > 0);
    assert.ok(
      runenheer.validateConfig({ ...DEFAULT_REGELN, startLeben: 9999 }, 2, 1).length > 0,
    );
    assert.ok(
      runenheer.validateConfig({ ...DEFAULT_REGELN, ladenPlaetze: 1.5 }, 2, 1).length > 0,
    );
    // Neun Sitze passen an keinen Tisch dieser Plattform.
    assert.ok(runenheer.validateConfig(DEFAULT_REGELN, 9, 1).length > 0);
  });

  it('weist eine Bank ab, die kleiner als das Brett des hoechsten Levels ist', () => {
    // Sonst liesse sich ein volles Brett nicht einmal mehr umbauen.
    assert.ok(
      runenheer.validateConfig({ ...DEFAULT_REGELN, bankPlaetze: 3 }, 2, 1).length > 0,
    );
  });

  it('kennt einen Sitz am Zug und seine Zuege', () => {
    const p = partie();
    assert.equal(runenheer.currentActor(p), 0);
    assert.ok(runenheer.legalActions(p, 0).length > 0);
    // Anders als bei einem Kartenspiel darf hier JEDER handeln.
    assert.ok(runenheer.legalActions(p, 1).length > 0);
    assert.equal(runenheer.isFinished(p), false);
  });

  it('haelt in der Kampfphase eine Schaupause und geht danach weiter', () => {
    let p = partie();
    p = runenheer.act(p, 0, { typ: 'bereit' });
    assert.equal(runenheer.interludeMs!(p), null, 'Noch ist nicht alles bereit');
    p = runenheer.act(p, 1, { typ: 'bereit' });
    assert.ok(runenheer.interludeMs!(p)! > 0);
    assert.equal(runenheer.currentActor(p), null);

    const weiter = runenheer.advanceInterlude!(p);
    assert.equal(weiter.runde, 2);
    assert.equal(runenheer.interludeMs!(weiter), null);
  });

  it('ueberlebt Speichern und Laden', () => {
    const p = runenheer.act(partie(), 0, { typ: 'kaufen', platz: 0 });
    const roh = JSON.parse(JSON.stringify(runenheer.serialize(p)));
    assert.deepEqual(runenheer.deserialize(roh), p);
  });

  it('weist einen Snapshot aus einer unbekannten Fassung ab', () => {
    // Lieber ein Fehler als eine falsch gedeutete Partie.
    assert.throws(() => runenheer.deserialize({ v: 99 }), /Snapshot-Version/);
  });

  it('liefert Platzierungen und Erfahrungsgrundlage fuer jeden Sitz', () => {
    const p = partie(4);
    assert.equal(runenheer.standings(p).length, 4);
    assert.deepEqual(Object.keys(runenheer.xpBasis!(p)), ['0', '1', '2', '3']);
  });

  it('laesst den Bot nicht auf der Zuschauersicht laufen', () => {
    assert.throws(
      () => runenheer.botAction(runenheer.spectatorView(partie())),
      /Zuschauersicht/,
    );
  });
});

describe('Bot', () => {
  it('spielt eine ganze Partie zu acht zu Ende, ohne zu werfen', () => {
    // Der schaerfste Dauertest, den dieser Kern hat: Jede Aktion, die der Bot
    // waehlt, muss `act` auch annehmen — und der Vorrat muss ueber dreissig
    // Runden mit acht Laeden durchhalten.
    let p = partie(8);
    let schritte = 0;

    while (!runenheer.isFinished(p) && schritte < 20000) {
      schritte++;
      if (runenheer.interludeMs!(p) !== null) {
        p = runenheer.advanceInterlude!(p);
        continue;
      }
      const sitz = runenheer.currentActor(p);
      assert.notEqual(sitz, null, 'Niemand am Zug und keine Schaupause: Der Tisch haengt');
      p = runenheer.act(p, sitz!, runenheer.botAction(runenheer.viewFor(p, sitz!)));
    }

    assert.ok(runenheer.isFinished(p), `nach ${schritte} Schritten nicht fertig`);
    assert.equal(runenheer.standings(p).length, 8);
    // Kein Vorrat darf dabei ins Minus gelaufen sein.
    for (const [id, zahl] of Object.entries(p.vorrat)) {
      assert.ok(zahl >= 0, `${id} steht bei ${zahl}`);
    }
    /*
     * Und keine Karte darf verschwunden oder dazugekommen sein. Das ist die
     * schaerfste Aussage ueber den Vorrat, die sich treffen laesst: Sie faellt
     * bei jedem vergessenen Rueckweg um — Neu-Wuerfeln, Verkaufen,
     * Rundenanfang, Ausscheiden.
     */
    assert.equal(alleKarten(p), KARTEN_INSGESAMT);
  });

  it('stellt gekaufte Einheiten auch auf das Brett', () => {
    // Ein Bot, der nur hamstert, sieht beim Zusehen aus wie ein Fehler.
    let p = partie(2);
    for (let i = 0; i < 200; i++) {
      if (runenheer.interludeMs!(p) !== null) {
        p = runenheer.advanceInterlude!(p);
        continue;
      }
      const sitz = runenheer.currentActor(p);
      if (sitz === null) break;
      p = runenheer.act(p, sitz, runenheer.botAction(runenheer.viewFor(p, sitz)));
      if (p.heere[0]!.brett.some((k) => k !== null)) return;
    }
    assert.fail('Der Bot hat in 200 Schritten keine Einheit aufgestellt');
  });
});
