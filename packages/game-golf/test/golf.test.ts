import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type GolfAktion, RegelverstossError, STILLSTAND_MS, golf } from '../src/index.js';

const start = (
  opts: { saat?: number; sitze?: number; loecher?: number; botSitze?: number[] } = {},
) =>
  golf.createParty({
    config: {},
    seats: opts.sitze ?? 2,
    rounds: opts.loecher ?? 9,
    seed: opts.saat ?? 4711,
    botSeats: opts.botSitze,
  });

const zug = (takt: number, nr = 0, rx = 1, ry = 0, kraft = 0.5): GolfAktion => ({
  art: 'zug',
  zug: { takt, nr, rx, ry, kraft },
});

const ergebnis = (schlaege: number[], pruef: string): GolfAktion => ({
  art: 'ergebnis',
  schlaege,
  pruef,
});

// ---------------------------------------------------------------------------
// Regelsatz
// ---------------------------------------------------------------------------

test('Regelsatz: Sitzzahl 1..8 (allein spielen erlaubt), Loecher 2..15, Regelsatz muss ein Objekt sein', () => {
  assert.equal(golf.validateConfig({}, 4, 9).length, 0);
  assert.equal(golf.validateConfig({}, 1, 9).length, 0);
  assert.equal(golf.validateConfig({}, 8, 15).length, 0);
  assert.equal(golf.validateConfig({}, 0, 9).length, 1);
  assert.equal(golf.validateConfig({}, 9, 9).length, 1);
  assert.equal(golf.validateConfig({}, 4, 1).length, 1);
  assert.equal(golf.validateConfig({}, 4, 16).length, 1);
  assert.equal(golf.validateConfig(null, 4, 9).length, 1);
  assert.equal(golf.validateConfig('kaputt', 4, 9).length, 1);
  assert.equal(golf.validateConfig([], 4, 9).length, 1);
});

// ---------------------------------------------------------------------------
// Formpruefung der Schlaege
// ---------------------------------------------------------------------------

test('Formpruefung weist unsinnige Schlaege ab', () => {
  const p = start();
  assert.throws(() => golf.act(p, 0, zug(-1)), RegelverstossError, 'negativer Takt');
  assert.throws(
    () => golf.act(p, 0, { art: 'zug', zug: { takt: 1.5, nr: 0, rx: 1, ry: 0, kraft: 0.5 } }),
    RegelverstossError,
    'nicht-ganzzahliger Takt',
  );
  assert.throws(
    () => golf.act(p, 0, { art: 'zug', zug: { takt: 1, nr: -1, rx: 1, ry: 0, kraft: 0.5 } }),
    RegelverstossError,
    'negative Laufnummer',
  );
  assert.throws(
    () => golf.act(p, 0, { art: 'zug', zug: { takt: 1, nr: 0, rx: 0.5, ry: 0, kraft: 0.5 } }),
    RegelverstossError,
    'Richtung ist kein Einheitsvektor',
  );
  assert.throws(
    () => golf.act(p, 0, { art: 'zug', zug: { takt: 1, nr: 0, rx: 1, ry: 0, kraft: 0 } }),
    RegelverstossError,
    'Kraft 0 ist kein Schlag',
  );
  assert.throws(
    () => golf.act(p, 0, { art: 'zug', zug: { takt: 1, nr: 0, rx: 1, ry: 0, kraft: 1.5 } }),
    RegelverstossError,
    'Kraft ueber 1',
  );
  assert.throws(
    () => golf.act(p, 0, { art: 'zug', zug: { takt: 1, nr: 0, rx: Number.NaN, ry: 0, kraft: 0.5 } }),
    RegelverstossError,
    'keine endliche Zahl',
  );
  assert.doesNotThrow(() => golf.act(p, 0, zug(1)));
});

test('Takt muss je Sitz streng steigen; andere Sitze bleiben unberuehrt', () => {
  let p = start();
  p = golf.act(p, 0, zug(10));
  p = golf.act(p, 1, zug(5));
  assert.throws(() => golf.act(p, 0, zug(10)), RegelverstossError, 'gleicher Takt erneut');
  assert.throws(() => golf.act(p, 0, zug(5)), RegelverstossError, 'Takt in der Vergangenheit');
  assert.doesNotThrow(() => golf.act(p, 0, zug(11)));
  assert.doesNotThrow(() => golf.act(p, 1, zug(6)), 'Sitz 1 ist von Sitz 0 unabhaengig');
});

// ---------------------------------------------------------------------------
// Sicht: Ausschnitt, abIndex, viewCursor
// ---------------------------------------------------------------------------

test('Die Sicht liefert ab der Marke, die der Empfaenger schon hat', () => {
  let p = start();
  for (let i = 0; i < 5; i += 1) p = golf.act(p, i % 2, zug(10 + i * 10, i));

  const voll = golf.viewFor(p, 0, 0);
  assert.equal(voll.abIndex, 0);
  assert.equal(voll.zuege.length, 5, 'ohne Marke kommt alles');
  assert.equal(golf.viewCursor?.(p), 5, 'die Marke ist die Laenge der Zugliste');

  const teil = golf.viewFor(p, 0, 3);
  assert.equal(teil.abIndex, 3);
  assert.deepEqual(
    teil.zuege.map((z) => z.takt),
    [40, 50],
    'nur der Zuwachs seit der Marke',
  );

  // Alles ausser der Zugliste bleibt in jedem Ausschnitt vollstaendig.
  assert.equal(teil.saat, voll.saat);
  assert.equal(teil.ausgang, voll.ausgang);
  assert.deepEqual(teil.botSitze, voll.botSitze);

  // Eine Marke jenseits des Endes faellt auf die volle Sicht zurueck.
  const frisch = start();
  const nachStart = golf.viewFor(frisch, 0, 99);
  assert.equal(nachStart.abIndex, 0);
  assert.equal(nachStart.zuege.length, 0);
});

test('Jede Sicht traegt Taktlaenge, Vorlauf und Bot-Stufe', () => {
  const p = golf.createParty({
    config: {},
    seats: 2,
    rounds: 9,
    seed: 1,
    botLevel: 'experte',
  });
  const sicht = golf.viewFor(p, 0);
  assert.equal(sicht.taktMs, 50);
  assert.equal(sicht.vorlauf, 2);
  assert.equal(sicht.botStufe, 'experte');
});

// ---------------------------------------------------------------------------
// Ergebnis-Mehrheitsregel
// ---------------------------------------------------------------------------

test('Einstimmige Meldungen ergeben ein eindeutiges Ergebnis', () => {
  let p = start({ sitze: 2 });
  p = golf.act(p, 0, ergebnis([10, 12], 'abc'));
  assert.equal(golf.isFinished(p), false, 'eine Meldung genuegt nicht');
  p = golf.act(p, 1, ergebnis([10, 12], 'abc'));
  assert.equal(golf.isFinished(p), true);
  assert.deepEqual(p.ausgang, { schlaege: [10, 12], strittig: false });
});

test('Mehrheitsregel: die groessere Gruppe gleicher Pruefsumme entscheidet', () => {
  let p = start({ sitze: 4 });
  p = golf.act(p, 0, ergebnis([10, 12, 9, 11], 'x'));
  p = golf.act(p, 1, ergebnis([10, 12, 9, 11], 'x'));
  p = golf.act(p, 2, ergebnis([10, 12, 9, 11], 'x'));
  p = golf.act(p, 3, ergebnis([1, 2, 3, 4], 'y'));
  assert.equal(golf.isFinished(p), true);
  assert.deepEqual(p.ausgang, { schlaege: [10, 12, 9, 11], strittig: false });
});

test('Ohne Mehrheit (Patt) gilt die Partie als strittig', () => {
  let p = start({ sitze: 4 });
  p = golf.act(p, 0, ergebnis([1, 1, 1, 1], 'a'));
  p = golf.act(p, 1, ergebnis([2, 2, 2, 2], 'b'));
  p = golf.act(p, 2, ergebnis([1, 1, 1, 1], 'a'));
  p = golf.act(p, 3, ergebnis([2, 2, 2, 2], 'b'));
  assert.equal(golf.isFinished(p), true);
  assert.equal(p.ausgang?.strittig, true);
  assert.deepEqual(p.ausgang?.schlaege, [0, 0, 0, 0]);
});

test('Erste Meldung je Sitz zaehlt, jede weitere ist folgenlos', () => {
  let p = start({ sitze: 2 });
  p = golf.act(p, 0, ergebnis([5, 5], 'erste'));
  const nachErster = p;
  p = golf.act(p, 0, ergebnis([99, 99], 'zweite'));
  assert.deepEqual(p, nachErster, 'die zweite Meldung desselben Sitzes aendert nichts');
});

test('Bots melden nicht und werden bei der Mehrheitsregel nicht abgewartet', () => {
  let p = start({ sitze: 3, botSitze: [2] });
  assert.throws(
    () => golf.act(p, 2, ergebnis([1, 1, 1], 'x')),
    RegelverstossError,
    'ein Bot-Sitz darf nicht melden',
  );
  p = golf.act(p, 0, ergebnis([1, 2, 3], 'gleich'));
  assert.equal(golf.isFinished(p), false);
  p = golf.act(p, 1, ergebnis([1, 2, 3], 'gleich'));
  assert.equal(golf.isFinished(p), true, 'der Bot-Sitz 2 wird nicht abgewartet');
});

test('markLeft schliesst ab, sobald danach alle Restlichen gemeldet haben', () => {
  let p = start({ sitze: 2 });
  p = golf.act(p, 0, ergebnis([5, 7], 'nur0'));
  assert.equal(golf.isFinished(p), false);
  p = golf.markLeft(p, 1);
  assert.equal(golf.isFinished(p), true, 'Sitz 1 war der letzte Erforderliche');
  assert.equal(golf.standings(p).find((s) => s.seat === 1)?.left, true);
});

test('advanceInterlude ohne jede Meldung schliesst strittig ab', () => {
  const p = start({ sitze: 3 });
  assert.equal(golf.interludeMs?.(p), STILLSTAND_MS);
  assert.ok(golf.advanceInterlude, 'interludeMs ohne advanceInterlude waere ein haengender Tisch');
  const nach = golf.advanceInterlude!(p);
  assert.equal(golf.isFinished(nach), true);
  assert.equal(nach.ausgang?.strittig, true);
  assert.deepEqual(nach.ausgang?.schlaege, [0, 0, 0]);
});

test('interludeMs ist null, sobald die Partie beendet ist', () => {
  let p = start({ sitze: 1 });
  assert.equal(golf.interludeMs?.(p), STILLSTAND_MS);
  p = golf.act(p, 0, ergebnis([20], 'solo'));
  assert.equal(golf.isFinished(p), true);
  assert.equal(golf.interludeMs?.(p), null);
});

// ---------------------------------------------------------------------------
// Ausstieg / Aufgabe
// ---------------------------------------------------------------------------

test('Aufgabe meldet den Sitz als ausgestiegen, idempotent', () => {
  let p = start({ sitze: 3 });
  p = golf.act(p, 0, { art: 'aufgabe' });
  assert.equal(golf.standings(p).find((s) => s.seat === 0)?.left, true);
  const nochmal = golf.act(p, 0, { art: 'aufgabe' });
  assert.deepEqual(nochmal.ausstiege, p.ausstiege, 'ein zweiter Ausstieg aendert nichts');
});

test('nach dem Ausgang wird nichts mehr angenommen, ausser "nichts"', () => {
  let p = start({ sitze: 1 });
  p = golf.act(p, 0, ergebnis([5], 'x'));
  assert.throws(() => golf.act(p, 0, zug(1)), RegelverstossError);
  assert.throws(() => golf.act(p, 0, { art: 'aufgabe' }), RegelverstossError);
  assert.doesNotThrow(() => golf.act(p, 0, { art: 'nichts' }));
});

test('"nichts" ist immer folgenlos, auch nach dem Ende', () => {
  const p = start();
  const nachNichts = golf.act(p, 0, { art: 'nichts' });
  assert.equal(nachNichts, p, 'gleiche Referenz zurueck');

  const beendet = golf.act(start({ sitze: 1 }), 0, ergebnis([1], 'x'));
  const nochNichts = golf.act(beendet, 0, { art: 'nichts' });
  assert.equal(nochNichts, beendet);
});

// ---------------------------------------------------------------------------
// Platzierungen / standings
// ---------------------------------------------------------------------------

test('standings: Gleichstand teilt sich denselben Platz, Punkte aus Lochzahl und Schlaegen', () => {
  let p = start({ sitze: 3, loecher: 9 });
  p = golf.act(p, 0, ergebnis([5, 5, 9], 'x'));
  p = golf.act(p, 1, ergebnis([5, 5, 9], 'x'));
  p = golf.act(p, 2, ergebnis([5, 5, 9], 'x'));
  const stand = golf.standings(p);
  assert.deepEqual(
    stand.map((s) => s.place),
    [1, 1, 3],
  );
  assert.equal(stand[0]?.points, 9 * 12 - 5);
  assert.equal(stand[2]?.points, 9 * 12 - 9);
});

test('standings bei strittigem Ausgang: alle Platz 1, 0 Punkte', () => {
  let p = start({ sitze: 2 });
  p = golf.act(p, 0, ergebnis([1, 1], 'a'));
  p = golf.act(p, 1, ergebnis([2, 2], 'b'));
  assert.equal(p.ausgang?.strittig, true);
  const stand = golf.standings(p);
  assert.deepEqual(
    stand.map((s) => s.place),
    [1, 1],
  );
  assert.deepEqual(
    stand.map((s) => s.points),
    [0, 0],
  );
});

// ---------------------------------------------------------------------------
// Erfahrung
// ---------------------------------------------------------------------------

test('xpBasis: 15 Punkte je Loch fuer jeden Sitz, auch strittig, nichts vor dem Ende', () => {
  const offen = start({ sitze: 2, loecher: 9 });
  assert.deepEqual(golf.xpBasis?.(offen), {});

  let p = start({ sitze: 2, loecher: 9 });
  p = golf.act(p, 0, ergebnis([1, 1], 'a'));
  p = golf.act(p, 1, ergebnis([2, 2], 'b'));
  assert.equal(p.ausgang?.strittig, true);
  assert.deepEqual(golf.xpBasis?.(p), { 0: 135, 1: 135 });
});

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

test('Snapshot ueberlebt Speichern und Laden', () => {
  let p = start({ saat: 99 });
  p = golf.act(p, 0, zug(10));
  p = golf.act(p, 1, ergebnis([1, 2], 'q'));
  const wieder = golf.deserialize(JSON.parse(JSON.stringify(golf.serialize(p))));
  assert.deepEqual(wieder, p);
  assert.throws(() => golf.deserialize({ v: 99 }));
});
