/**
 * Baustellen vor Etage 5 und 8 (Phase 4): erst bauen, dann warten — auch
 * offline —, dann freischalten. Einmal je Ort; das Buch macht es kuerzer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type ManufakturStand,
  AktionAbgelehnt,
  BAUSTELLEN,
  MAX_PRESSEN,
  bauKosten,
  handle,
  hatBaustelle,
  laufenderBau,
  neuePresse,
  neuerStand,
  vorspulen,
} from '../src/index.js';

const T0 = Date.parse('2026-10-24T16:00:00Z');
const abgelehnt = (code: string) => (e: unknown) => e instanceof AktionAbgelehnt && e.code === code;

function vierEtagen(buch: Record<string, number> = {}): ManufakturStand {
  const stand = { ...neuerStand(T0, 1, { werkstattbuch: buch }), taler: 1e30 };
  stand.pressen = Array.from({ length: 4 }, neuePresse);
  return stand;
}

test('vor Etage 5 erst Bauarbeiten: Taler sofort, dann zehn Minuten warten', () => {
  let stand = vierEtagen();
  assert.throws(() => handle(stand, { typ: 'freischalten' }, T0), abgelehnt('manufakturBaustelle'));
  const vorher = stand.taler;
  stand = handle(stand, { typ: 'bauen' }, T0).stand;
  assert.ok(Math.abs(vorher - stand.taler - bauKosten(4, 1)) < 1e-6 * vorher);
  assert.equal(laufenderBau(stand)?.bis, T0 + BAUSTELLEN[4]!);
  assert.throws(() => handle(stand, { typ: 'bauen' }, T0), abgelehnt('manufakturKeineBaustelle'), 'nicht zweimal');
  assert.throws(() => handle(stand, { typ: 'freischalten' }, T0 + 5 * 60_000), abgelehnt('manufakturBaustelle'));
  const fertig = handle(stand, { typ: 'freischalten' }, T0 + 10 * 60_000).stand;
  assert.equal(fertig.pressen.length, 5);
  assert.equal(laufenderBau(fertig), null);
});

test('die Bauarbeiten laufen offline weiter', () => {
  let stand = vierEtagen();
  stand = handle(stand, { typ: 'bauen' }, T0).stand;
  // Drei Stunden weg: Offline rechnet nur eine Stunde Produktion, die Baustelle haengt aber an der Uhr.
  const zurueck = vorspulen(stand, T0 + 3 * 3600_000);
  assert.equal(hatBaustelle(zurueck, 4), false);
});

test('einmal je Ort: nach dem Renovieren liegt kein Schutt mehr', () => {
  let stand = vierEtagen();
  stand = handle(stand, { typ: 'bauen' }, T0).stand;
  stand = handle(stand, { typ: 'freischalten' }, T0 + BAUSTELLEN[4]!).stand;
  stand = handle(stand, { typ: 'freischalten' }, T0 + BAUSTELLEN[4]!).stand;
  stand = handle(stand, { typ: 'freischalten' }, T0 + BAUSTELLEN[4]!).stand;
  // Etage 8: dreissig Minuten.
  stand = handle(stand, { typ: 'bauen' }, T0 + BAUSTELLEN[4]!).stand;
  stand = handle(stand, { typ: 'freischalten' }, T0 + BAUSTELLEN[4]! + BAUSTELLEN[7]!).stand;
  assert.equal(stand.pressen.length, MAX_PRESSEN);
  const neu = handle({ ...stand, taler: 1e30 }, { typ: 'renovieren' }, T0 + 2 * 3600_000).stand;
  assert.equal(hatBaustelle(neu, 4), false);
  assert.equal(hatBaustelle(neu, 7), false);
});

test('Flinke Bautrupps: 25 % kuerzer je Stufe', () => {
  const stand = handle(vierEtagen({ bautrupps: 2 }), { typ: 'bauen' }, T0).stand;
  assert.equal(laufenderBau(stand)?.bis, T0 + BAUSTELLEN[4]! * 0.5);
});
