/**
 * Zielkette (Phase 5): Ziele folgen aus Stand und Zaehlern, Abholen zahlt
 * Taler und rueckt weiter, ein offenes Ziel laesst sich nicht abholen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type Ziel,
  AktionAbgelehnt,
  ZIELKETTE,
  aktuellesZiel,
  handle,
  neuerStand,
  platzVon,
  zielBelohnung,
  zielErreicht,
} from '../src/index.js';

const T0 = Date.parse('2026-10-24T18:00:00Z');
const versand: Ziel = { art: 'versand' };
const presse: Ziel = { art: 'presse', index: 0 };

test('die Kette fuehrt durch Meister, Rabatt, Renovieren und Buch', () => {
  const kennungen = ZIELKETTE.map((z) => z.kennung);
  for (const k of ['meister-2', 'rabatt-1', 'tauschen', 'renovieren-1', 'buch-1', 'faehigkeit-3', 'rabatt-10']) {
    assert.ok(kennungen.includes(k), k);
  }
});

test('abholen erst, wenn erreicht — dann Taler und das naechste Ziel', () => {
  let stand = { ...neuerStand(T0, 1, { zufall: 5 }), taler: 1e9 };
  assert.equal(aktuellesZiel(stand)?.kennung, 'meister-2');
  assert.throws(() => handle(stand, { typ: 'ziel' }, T0), (e: unknown) => e instanceof AktionAbgelehnt && e.code === 'manufakturZielOffen');
  stand = handle(stand, { typ: 'einstellen', ziel: versand }, T0).stand;
  stand = handle(stand, { typ: 'einstellen', ziel: versand }, T0).stand;
  assert.equal(zielErreicht(stand), true);
  const vorher = stand.taler;
  const belohnung = zielBelohnung(stand);
  stand = handle(stand, { typ: 'ziel' }, T0).stand;
  assert.ok(Math.abs(stand.taler - vorher - belohnung) < 1e-6);
  assert.equal(aktuellesZiel(stand)?.kennung, 'faehigkeit-1');
});

test('Zaehler: Faehigkeiten, Tausche und Stufen mit Rabatt', () => {
  let stand = { ...neuerStand(T0, 1, { zufall: 5 }), taler: 1e9 };
  stand = handle(stand, { typ: 'einstellen', ziel: presse }, T0).stand;
  stand = handle(stand, { typ: 'einstellen', ziel: presse }, T0).stand;
  stand = handle(stand, { typ: 'faehigkeit', ziel: presse }, T0).stand;
  const rabatt = platzVon(stand, presse).pool[1]!;
  stand = handle(stand, { typ: 'zuweisen', ziel: presse, id: rabatt.id }, T0).stand;
  stand = handle(stand, { typ: 'faehigkeit', ziel: presse }, T0).stand;
  stand = handle(stand, { typ: 'ausbauen', ziel: presse, menge: 10 }, T0).stand;
  assert.deepEqual(stand.zaehler, { faehigkeiten: 2, getauscht: 1, rabattStufen: 10 });
  // Nach dem Renovieren bleiben Zaehler und Ziel.
  stand.orte['1'] = { renovierung: 0, geraeumt: [4, 7] };
  while (stand.pressen.length < 8) stand = handle(stand, { typ: 'freischalten' }, T0).stand;
  stand.ziel = 3;
  const neu = handle({ ...stand, taler: 1e40 }, { typ: 'renovieren' }, T0).stand;
  assert.equal(neu.ziel, 3);
  assert.equal(neu.zaehler.rabattStufen, 10);
});
