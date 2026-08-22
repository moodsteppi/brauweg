import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mememory } from '../src/adapter.js';
import { DEFAULT_REGELN } from '../src/regeln.js';
import type { MememoryPartie } from '../src/partie.js';

function partie(saat: number | string = 4711): MememoryPartie {
  return mememory.createParty({
    config: DEFAULT_REGELN,
    seats: 2,
    rounds: 1,
    seed: 4711,
    seedHex: typeof saat === 'string' ? saat : undefined,
  }) as MememoryPartie;
}

/** Zwei Plaetze mit demselben Motiv. */
function paar(p: MememoryPartie): [number, number] {
  for (let a = 0; a < p.feld.length; a++) {
    for (let b = a + 1; b < p.feld.length; b++) {
      if (p.feld[a] === p.feld[b]) return [a, b];
    }
  }
  throw new Error('kein Paar');
}

function ungleich(p: MememoryPartie): [number, number] {
  for (let a = 0; a < p.feld.length; a++) {
    for (let b = a + 1; b < p.feld.length; b++) {
      if (p.feld[a] !== p.feld[b]) return [a, b];
    }
  }
  throw new Error('kein Fehlgriff');
}

test('das Modul meldet sich als spielbar, nur zu zweit', () => {
  assert.equal(mememory.meta.id, 'mememory');
  assert.equal(mememory.meta.availability, 'playable');
  assert.deepEqual([...mememory.meta.seatCounts], [2]);
  assert.equal(mememory.meta.xpBasisZaehltKarten, false);
});

test('die Sicht verraet KEIN verdecktes Motiv', () => {
  const p = partie();
  const sicht = mememory.viewFor(p, 0);
  assert.equal(sicht.feld.length, 24);
  assert.ok(
    sicht.feld.every((eintrag) => eintrag === null),
    'am Anfang liegt alles verdeckt',
  );
  // Die Motivliste geht mit - sie ist die Grundlage des Vorladens und
  // sortiert, verraet also nichts ueber die Lage.
  assert.equal(sicht.motive.length, 12);
  assert.deepEqual([...sicht.motive], [...sicht.motive].sort());
  // Und nirgends steckt die interne Feldbelegung mit drin.
  const roh = JSON.stringify(sicht);
  assert.ok(!roh.includes('"feld":[0'), 'die Motivnummern duerfen nicht mitgehen');
});

test('beide Sitze sehen dieselbe Anordnung', () => {
  const p = partie();
  assert.deepEqual(mememory.viewFor(p, 0), mememory.viewFor(p, 1));
});

test('eine aufgedeckte Karte steht in der Sicht, die uebrigen nicht', () => {
  const p = partie();
  const wer = p.dran;
  const danach = mememory.act(p, wer, { typ: 'aufdecken', platz: 5 });
  const sicht = mememory.viewFor(danach, wer);
  assert.equal(typeof sicht.feld[5], 'string');
  assert.equal(sicht.feld.filter((x) => x !== null).length, 1);
  // Auch der Gegner sieht sie - sonst koennte er sich nichts merken.
  assert.equal(mememory.viewFor(danach, wer === 0 ? 1 : 0).feld[5], sicht.feld[5]);
});

test('die Schaupause meldet eine Dauer und raeumt danach ab', () => {
  const p = partie();
  const wer = p.dran;
  const [a, b] = ungleich(p);
  let lauf = mememory.act(p, wer, { typ: 'aufdecken', platz: a });
  lauf = mememory.act(lauf, wer, { typ: 'aufdecken', platz: b });

  assert.equal(mememory.currentActor(lauf), null, 'in der Pause ist niemand am Zug');
  assert.equal(mememory.interludeMs?.(lauf), DEFAULT_REGELN.merkzeitMs);
  // Botsitze duerfen in der Pause nichts finden, sonst zieht die Plattform
  // sofort einen Bot-Zug vor (siehe scheduleInterlude).
  assert.deepEqual(mememory.legalActions(lauf, 0), []);
  assert.deepEqual(mememory.legalActions(lauf, 1), []);

  const weiter = mememory.advanceInterlude?.(lauf) as MememoryPartie;
  assert.equal(mememory.interludeMs?.(weiter), null);
  assert.notEqual(weiter.dran, wer);
  assert.ok(mememory.viewFor(weiter, 0).feld.every((x) => x === null));
});

test('ein Treffer bleibt in der Sicht sichtbar und traegt seinen Besitzer', () => {
  const p = partie();
  const wer = p.dran;
  const [a, b] = paar(p);
  let lauf = mememory.act(p, wer, { typ: 'aufdecken', platz: a });
  lauf = mememory.act(lauf, wer, { typ: 'aufdecken', platz: b });
  lauf = mememory.advanceInterlude?.(lauf) as MememoryPartie;

  const sicht = mememory.viewFor(lauf, 0);
  assert.equal(sicht.besitzer[a], wer);
  assert.equal(sicht.feld[a], sicht.feld[b]);
  assert.equal(sicht.punkte[wer], 1);
  assert.equal(lauf.dran, wer);
});

test('legalActions liefert genau die verdeckten Plaetze des Spielers am Zug', () => {
  const p = partie();
  const wer = p.dran;
  assert.equal(mememory.legalActions(p, wer).length, 24);
  assert.equal(mememory.legalActions(p, wer === 0 ? 1 : 0).length, 0);
});

test('der Bot deckt nur auf, was auch offen sein darf', () => {
  const p = partie();
  const wer = p.dran;
  const zug = mememory.botAction(mememory.viewFor(p, wer));
  assert.equal(zug.typ, 'aufdecken');
  const danach = mememory.act(p, wer, zug);
  assert.equal(danach.offen.length, 1);
});

test('der Bot laeuft nicht auf einer Zuschauersicht', () => {
  const p = partie();
  assert.throws(() => mememory.botAction(mememory.spectatorView(p)));
});

test('serialize und deserialize sind verlustfrei', () => {
  const p = partie();
  const roh = JSON.parse(JSON.stringify(mememory.serialize(p)));
  const zurueck = mememory.deserialize(roh);
  assert.deepEqual(zurueck, p);
});

test('ein Snapshot mit falscher Version wird abgewiesen, nicht falsch gedeutet', () => {
  const roh = { ...(mememory.serialize(partie()) as Record<string, unknown>), v: 99 };
  assert.throws(() => mememory.deserialize(roh));
});

test('validateConfig winkt keinen Unsinn durch', () => {
  assert.deepEqual(mememory.validateConfig(DEFAULT_REGELN, 2, 1), []);
  assert.ok(mememory.validateConfig(DEFAULT_REGELN, 3, 1).length > 0);
  assert.ok(mememory.validateConfig({}, 2, 1).length > 0);
  // 10x10 = 50 Paare, der Katalog hat 43.
  assert.ok(
    mememory.validateConfig({ spalten: 10, zeilen: 10, merkzeitMs: 1100 }, 2, 1).length > 0,
  );
});

test('xpBasis zaehlt die aufgedeckten Karten je Sitz', () => {
  const p = partie();
  const wer = p.dran;
  const danach = mememory.act(p, wer, { typ: 'aufdecken', platz: 0 });
  const basis = mememory.xpBasis?.(danach) ?? {};
  assert.equal(basis[wer], 1);
  assert.equal(basis[wer === 0 ? 1 : 0], 0);
});

test('markLeft merkt sich den Aussteiger, ohne die Partie zu kippen', () => {
  const p = partie();
  const danach = mememory.markLeft(p, 1);
  assert.deepEqual([...danach.leftSeats], [1]);
  assert.equal(mememory.isFinished(danach), false);
  assert.equal(mememory.standings(danach).find((s) => s.seat === 1)?.left, true);
});
