/**
 * Renovieren und Umzug (Phase 2): was zurueckgesetzt wird und was bleibt,
 * der Multiplikator, das Jubilaeum im Palast und die Uebernahme alter Staende.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type ManufakturStand,
  AktionAbgelehnt,
  FASSUNG,
  MAX_PRESSEN,
  SIEGEL_RENOVIERUNG,
  durchsatz,
  handle,
  kannUmziehen,
  migriere,
  neuerStand,
  platzVon,
  renovierFaktor,
  renovierKosten,
  renovierVorschau,
  renovierung,
} from '../src/index.js';

const T0 = Date.parse('2026-10-24T14:00:00Z');
const abgelehnt = (code: string) => (e: unknown) => e instanceof AktionAbgelehnt && e.code === code;

function vollerOrt(manufaktur = 1): ManufakturStand {
  let stand: ManufakturStand = { ...neuerStand(T0, manufaktur, { zufall: 3 }), taler: 1e40 };
  stand = handle(stand, { typ: 'einstellen', ziel: { art: 'versand' } }, T0).stand;
  while (stand.pressen.length < MAX_PRESSEN) stand = handle(stand, { typ: 'freischalten' }, T0).stand;
  stand.pressen[0]!.stufe = 77;
  stand.werkstattbuch = { ruf: 1 };
  return stand;
}

test('renovieren erst mit acht Pressen; danach Halle neu, Meister, Buch und Stufe bleiben', () => {
  assert.throws(() => handle({ ...neuerStand(T0), taler: 1e40 }, { typ: 'renovieren' }, T0), abgelehnt('manufakturRenovierenZuFrueh'));
  const vorher = vollerOrt();
  const { stand, meilensteine } = handle(vorher, { typ: 'renovieren' }, T0);
  assert.equal(renovierung(stand), 1);
  assert.equal(stand.pressen.length, 1, 'Etagen zurueckgesetzt');
  assert.equal(stand.pressen[0]!.stufe, 1, 'Stufen zurueckgesetzt');
  assert.equal(stand.taler, 0);
  assert.equal(stand.siegel, SIEGEL_RENOVIERUNG[0]);
  assert.equal(stand.werkstattbuch.ruf, 1, 'das Buch bleibt');
  assert.equal(platzVon(stand, { art: 'versand' }).pool.length, 1, 'der Pool bleibt');
  assert.equal(stand.versand.meister, true, 'und steht gleich wieder da');
  assert.deepEqual(meilensteine, [{ kennung: 'renovierung-1-1', muenzen: 0 }], 'Siegel, keine Hub-Muenzen');
});

test('der Multiplikator gilt fuer die ganze Kette, Stufe fuer Stufe als Gesamtwert', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(renovierFaktor), [1, 4, 10, 25, 60]);
  const ohne = durchsatz(neuerStand(T0));
  const mit = durchsatz(neuerStand(T0, 1, { orte: { '1': { renovierung: 2, geraeumt: [] } } }));
  assert.ok(Math.abs(mit.pressen / ohne.pressen - 10) < 1e-9);
  assert.ok(Math.abs(mit.paternoster / ohne.paternoster - 10) < 1e-9);
  assert.ok(Math.abs(mit.versand / ohne.versand - 10) < 1e-9);
});

test('Umzug erst nach der ersten Renovierung; die Stufe des alten Orts bleibt gespeichert', () => {
  const voll = vollerOrt();
  assert.equal(kannUmziehen(voll), false);
  let stand = handle(voll, { typ: 'renovieren' }, T0).stand;
  stand.taler = 1e40;
  while (stand.pressen.length < MAX_PRESSEN) stand = handle(stand, { typ: 'freischalten' }, T0).stand;
  assert.equal(kannUmziehen(stand), true);
  const neu = handle(stand, { typ: 'umziehen' }, T0).stand;
  assert.equal(neu.manufaktur, 2);
  assert.equal(renovierung(neu), 0, 'der neue Ort beginnt unrenoviert');
  assert.equal(renovierung(neu, 1), 1, 'der alte behaelt seine Stufe');
});

test('vier Stufen je Ort; im Palast geht es als Jubilaeum weiter, mit Muenzen fuer die ersten zehn', () => {
  const ort = vollerOrt();
  ort.orte['1'] = { renovierung: 4, geraeumt: [] };
  assert.throws(() => handle(ort, { typ: 'renovieren' }, T0), abgelehnt('manufakturRenovierenZuFrueh'));
  let palast = vollerOrt(5);
  palast.orte['5'] = { renovierung: 4, geraeumt: [] };
  const v = renovierVorschau(palast);
  assert.equal(v.istJubilaeum, true);
  assert.equal(v.siegel, 0);
  assert.ok(Math.abs(v.faktorNachher / v.faktorVorher - 1.5) < 1e-9, 'flacher Zuwachs');
  const fest = handle(palast, { typ: 'renovieren' }, T0);
  assert.deepEqual(fest.meilensteine, [{ kennung: 'jubilaeum-1', muenzen: 100 }]);
  palast = vollerOrt(5);
  palast.orte['5'] = { renovierung: 14, geraeumt: [] };
  assert.deepEqual(handle(palast, { typ: 'renovieren' }, T0).meilensteine, [{ kennung: 'jubilaeum-11', muenzen: 0 }]);
  assert.ok(renovierKosten(5, 5) > renovierKosten(5, 4));
});

test('Fassung 5: jedes Jubilaeum wird eine Renovierungsstufe des Palasts', () => {
  const alt = { ...neuerStand(T0, 5), fassung: 5, jubilaeen: 2 } as unknown as Record<string, unknown>;
  delete alt.orte;
  const neu = migriere(alt);
  assert.equal(neu.fassung, FASSUNG);
  assert.equal(renovierung(neu), 2);
  assert.equal('jubilaeen' in neu, false);
  // Und eine Fassung 2 kommt ueber alle Stufen bis hierher.
  const v2 = { ...neuerStand(T0, 3), taler: 77, fassung: 2 } as unknown as Record<string, unknown>;
  for (const k of ['orte', 'belegschaft', 'zufall', 'naechsteMeisterId', 'siegel', 'werkstattbuch']) delete v2[k];
  const weit = migriere(v2);
  assert.equal(weit.fassung, FASSUNG);
  assert.equal(weit.taler, 77);
  assert.deepEqual(weit.orte, {});
  assert.equal(weit.siegel, 0);
});

test('wechseln: zurueck an einen schon bezogenen Ort, Halle neu, seine Renovierung gilt', () => {
  let stand = vollerOrt();
  stand = handle(stand, { typ: 'renovieren' }, T0).stand;
  stand.taler = 1e40;
  while (stand.pressen.length < MAX_PRESSEN) stand = handle(stand, { typ: 'freischalten' }, T0).stand;
  stand = handle(stand, { typ: 'umziehen' }, T0).stand;
  assert.throws(() => handle(stand, { typ: 'wechseln', nach: 3 }, T0), abgelehnt('manufakturUnbekannt'));
  const siegel = stand.siegel;
  const zurueck = handle({ ...stand, taler: 5 }, { typ: 'wechseln', nach: 1 }, T0);
  assert.equal(zurueck.stand.manufaktur, 1);
  assert.equal(renovierung(zurueck.stand), 1);
  assert.equal(zurueck.stand.taler, 0);
  assert.equal(zurueck.stand.siegel, siegel, 'keine Siegel fuers Wechseln');
  assert.deepEqual(zurueck.meilensteine, [], 'keine Muenzen');
  // Wieder vor nach 2 ist ein Wechsel, kein Umzug.
  let wieder = zurueck.stand;
  wieder.taler = 1e40;
  while (wieder.pressen.length < MAX_PRESSEN) wieder = handle(wieder, { typ: 'freischalten' }, T0).stand;
  assert.equal(kannUmziehen(wieder), false);
  assert.equal(handle(wieder, { typ: 'wechseln', nach: 2 }, T0).stand.manufaktur, 2);
});
