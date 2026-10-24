/**
 * Das Werkstattbuch (Phase 3): Kauf mit Siegeln, jede Wirkung einmal, und
 * dass das Buch einen Umzug ueberlebt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type ManufakturStand,
  type Ziel,
  AktionAbgelehnt,
  BUCH,
  EINTRAEGE,
  MAX_PRESSEN,
  OFFLINE_MS,
  RAENGE,
  ausbauKostenFuer,
  ausbauVorschau,
  handle,
  neuePresse,
  neuerStand,
  platzVon,
  presseLeistung,
  rangChance,
  vorspulen,
} from '../src/index.js';

const T0 = Date.parse('2026-10-24T12:00:00Z');
const presse: Ziel = { art: 'presse', index: 0 };

function mitBuch(buch: Record<string, number>, siegel = 0): ManufakturStand {
  return { ...neuerStand(T0, 1, { werkstattbuch: buch, siegel, zufall: 9 }), taler: 1e12 };
}

test('kaufen kostet Siegel, nie mehr als die Stufen des Eintrags', () => {
  let stand = mitBuch({}, 100);
  stand = handle(stand, { typ: 'buch', eintrag: 'lager' }, T0).stand;
  assert.equal(stand.werkstattbuch.lager, 1);
  assert.equal(stand.siegel, 100 - BUCH.lager[0]!);
  assert.throws(
    () => handle(stand, { typ: 'buch', eintrag: 'lager' }, T0),
    (e: unknown) => e instanceof AktionAbgelehnt && e.code === 'manufakturHoechststufe',
  );
  assert.throws(
    () => handle(mitBuch({}, 1), { typ: 'buch', eintrag: 'ruf' }, T0),
    (e: unknown) => e instanceof AktionAbgelehnt && e.code === 'manufakturZuWenigSiegel',
  );
});

test('das ganze Buch kostet so viel, wie fuenf voll renovierte Orte einbringen', () => {
  const summe = EINTRAEGE.reduce((s, e) => s + BUCH[e].reduce((a, b) => a + b, 0), 0);
  assert.equal(summe, 154);
});

test('Laengere Nachtschicht: der Offline-Deckel waechst um je eine Stunde', () => {
  const lauf = (stufe: number) => {
    const s = mitBuch({ nachtschicht: stufe });
    s.versand = { ...s.versand, meister: true };
    s.paternoster = { ...s.paternoster, meister: true };
    s.pressen[0] = { ...s.pressen[0]!, meister: true };
    s.taler = 0;
    return vorspulen(s, T0 + 10 * OFFLINE_MS).taler;
  };
  const ohne = lauf(0);
  const drei = lauf(3);
  assert.ok(Math.abs(drei / ohne - 4) < 0.05, `vierfacher Deckel (${drei} / ${ohne})`);
});

test('Guter Ruf: +10 % Kartenwert je Stufe', () => {
  const ohne = presseLeistung(0, 10, 1);
  const stand = mitBuch({ ruf: 3 });
  const v = ausbauVorschau(stand, presse, 1);
  assert.ok(Math.abs(v.leistung.vorher / presseLeistung(0, 1, 1) - 1.3) < 1e-9);
  assert.ok(ohne > 0);
});

test('Erfahrene Meister und Kurze Pausen: Wirkung laenger, Pause kuerzer', () => {
  let stand = mitBuch({ erfahrene: 2, pausen: 3 });
  stand = handle(stand, { typ: 'einstellen', ziel: presse }, T0).stand;
  stand = handle(stand, { typ: 'faehigkeit', ziel: presse }, T0).stand;
  const p = stand.pressen[0]!;
  assert.equal(p.faehigkeitBis - T0, RAENGE.jung.wirkMs * 1.3);
  assert.ok(Math.abs(p.abklingenBis - p.faehigkeitBis - RAENGE.jung.abklingMs * 0.7) < 1e-6);
});

test('Feilschen: jeder Ausbau 5 % billiger je Stufe', () => {
  const stand = mitBuch({ feilschen: 2 });
  const v = ausbauVorschau(stand, presse, 10);
  assert.ok(Math.abs(v.kosten - ausbauKostenFuer(presse, 1, 10, 1) * 0.9) < 1e-6);
});

test('Gute Bewerber verschiebt die Chancen, Grosses Lager vergroessert den Pool', () => {
  assert.equal(rangChance(mitBuch({})).ober, 0.05);
  assert.ok(rangChance(mitBuch({ bewerber: 2 })).ober > 0.1);
  let stand = mitBuch({ lager: 1 });
  for (let i = 0; i < 7; i += 1) stand = handle(stand, { typ: 'einstellen', ziel: presse }, T0).stand;
  assert.equal(platzVon(stand, presse).pool.length, 7);
});

test('Umzug: +5 Siegel, das Buch bleibt', () => {
  let stand = mitBuch({ ruf: 2 }, 1);
  stand.pressen = Array.from({ length: MAX_PRESSEN }, neuePresse);
  stand = handle(stand, { typ: 'umziehen' }, T0).stand;
  assert.equal(stand.manufaktur, 2);
  assert.equal(stand.siegel, 6);
  assert.equal(stand.werkstattbuch.ruf, 2);
});
