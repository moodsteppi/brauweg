/**
 * Meister mit Tiefe (Phase 1): feste erste Einstellungen, Zufall aus dem
 * Stand, Rabatt beim Max-Kauf, Tauschen mit eigenen Uhren, Verkaufen und die
 * Uebernahme alter Staende.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type ManufakturStand,
  type Ziel,
  AktionAbgelehnt,
  FASSUNG,
  RAENGE,
  ausbauKostenFuer,
  ausbauVorschau,
  einstellPreis,
  handle,
  maxKaufbar,
  migriere,
  neuerStand,
  platzVon,
  stufenFuer,
  ziehe,
} from '../src/index.js';

const T0 = Date.parse('2026-10-24T10:00:00Z');
const presse: Ziel = { art: 'presse', index: 0 };
const versand: Ziel = { art: 'versand' };

function reich(zufall = 12345): ManufakturStand {
  return { ...neuerStand(T0, 1, { zufall }), taler: 1e12 };
}

function stelleEin(stand: ManufakturStand, ziel: Ziel, mal: number, t = T0): ManufakturStand {
  for (let i = 0; i < mal; i += 1) stand = handle(stand, { typ: 'einstellen', ziel }, t).stand;
  return stand;
}

test('die ersten drei Einstellungen sind fest, die erste arbeitet sofort', () => {
  const stand = stelleEin(reich(), versand, 3);
  const platz = platzVon(stand, versand);
  assert.deepEqual(
    platz.pool.map((m) => [m.rang, m.art]),
    [
      ['jung', 'tempo'],
      ['jung', 'rabatt'],
      ['meister', 'ladung'],
    ],
  );
  assert.equal(platz.zugewiesen, platz.pool[0]!.id);
  assert.equal(stand.versand.meister, true);
  assert.equal(stand.versand.art, 'tempo');
  // Bei der Presse ist die dritte ein Meister mit Tempo — eine Ladung gibt es dort nicht.
  const p = stelleEin(reich(), presse, 3);
  assert.deepEqual(platzVon(p, presse).pool[2]!.art, 'tempo');
});

test('jede Einstellung kostet 1,6-mal so viel, Verkaufen zaehlt nicht zurueck', () => {
  let stand = reich();
  const erster = einstellPreis(stand, versand);
  stand = stelleEin(stand, versand, 2);
  assert.ok(Math.abs(einstellPreis(stand, versand) / erster - 1.6 ** 2) < 1e-9);
  const zweiter = platzVon(stand, versand).pool[1]!;
  const vorher = stand.taler;
  stand = handle(stand, { typ: 'verkaufen', ziel: versand, id: zweiter.id }, T0).stand;
  assert.ok(Math.abs(stand.taler - vorher - zweiter.preis / 2) < 1e-6, 'die Haelfte zurueck');
  assert.ok(Math.abs(einstellPreis(stand, versand) / erster - 1.6 ** 2) < 1e-9);
});

test('der Zufall haengt am Stand: gleicher Anfang, gleiche Meister — und die Verteilung stimmt', () => {
  const a = stelleEin(reich(777), versand, 5);
  const b = stelleEin(reich(777), versand, 5);
  assert.deepEqual(platzVon(a, versand).pool, platzVon(b, versand).pool);
  // 20 000 Ziehungen: 70 / 25 / 5 Prozent, auf einen Prozentpunkt genau.
  const zaehler = { jung: 0, meister: 0, ober: 0 };
  const probe = reich(99);
  probe.belegschaft['versand'] = { pool: [], zugewiesen: null, eingestellt: 3 };
  for (let i = 0; i < 20_000; i += 1) zaehler[ziehe(probe, versand).rang] += 1;
  assert.ok(Math.abs(zaehler.jung / 20_000 - 0.7) < 0.01);
  assert.ok(Math.abs(zaehler.meister / 20_000 - 0.25) < 0.01);
  assert.ok(Math.abs(zaehler.ober / 20_000 - 0.05) < 0.01);
});

test('der Pool ist begrenzt', () => {
  const stand = stelleEin(reich(), versand, 5);
  assert.throws(
    () => handle(stand, { typ: 'einstellen', ziel: versand }, T0),
    (e: unknown) => e instanceof AktionAbgelehnt && e.code === 'manufakturPoolVoll',
  );
});

test('Rabatt: wirkt nur, solange die Faehigkeit laeuft, und Max rechnet damit', () => {
  // Rabatt-Jungmeister an Presse 1: 40 % fuer eine Minute.
  let stand = stelleEin(reich(), presse, 2);
  const rabattMeister = platzVon(stand, presse).pool[1]!;
  stand = handle(stand, { typ: 'zuweisen', ziel: presse, id: rabattMeister.id }, T0).stand;
  stand.taler = 50_000;
  const ohne = stufenFuer(stand, presse, 'max');
  stand = handle(stand, { typ: 'faehigkeit', ziel: presse }, T0).stand;
  const mit = stufenFuer(stand, presse, 'max');
  assert.ok(mit > ohne, `mit Rabatt mehr Stufen (${mit} > ${ohne})`);
  assert.equal(mit, maxKaufbar(presse, stand.pressen[0]!.stufe, 50_000 / 0.6, 1));
  const v = ausbauVorschau(stand, presse, 10);
  assert.ok(Math.abs(v.kosten - v.kostenOhneRabatt * 0.6) < 1e-6);
  assert.equal(v.rabattBis, T0 + RAENGE.jung.wirkMs);
  // Max kaufen kostet den rabattierten Preis.
  const stufe = stand.pressen[0]!.stufe;
  const gekauft = handle(stand, { typ: 'ausbauen', ziel: presse, menge: 'max' }, T0).stand;
  const bezahlt = 50_000 - gekauft.taler;
  assert.ok(Math.abs(bezahlt - ausbauKostenFuer(presse, stufe, mit, 1) * 0.6) < 1e-6);
  // Nach der Minute ist der Rabatt weg.
  const spaeter = handle(stand, { typ: 'arbeiten', ziel: presse }, T0 + RAENGE.jung.wirkMs + 1000).stand;
  assert.equal(ausbauVorschau(spaeter, presse, 1).rabatt, 0);
});

test('Tauschen: die laufende Faehigkeit endet, jeder Meister behaelt seine eigene Pause', () => {
  let stand = stelleEin(reich(), versand, 2);
  const [tempo, rabatt] = platzVon(stand, versand).pool;
  stand = handle(stand, { typ: 'faehigkeit', ziel: versand }, T0).stand;
  assert.ok(stand.versand.faehigkeitBis > T0);
  // Rabatt-Meister rein: sofort bereit, obwohl der Tempo-Meister gerade wirkt.
  stand = handle(stand, { typ: 'zuweisen', ziel: versand, id: rabatt!.id }, T0 + 10_000).stand;
  assert.equal(stand.versand.art, 'rabatt');
  assert.equal(stand.versand.faehigkeitBis, 0);
  stand = handle(stand, { typ: 'faehigkeit', ziel: versand }, T0 + 10_000).stand;
  // Zurueck: Der Tempo-Meister wirkt nicht mehr, pausiert aber weiter.
  stand = handle(stand, { typ: 'zuweisen', ziel: versand, id: tempo!.id }, T0 + 20_000).stand;
  assert.ok(stand.versand.faehigkeitBis <= T0 + 20_000, 'Faehigkeit beim Tauschen beendet');
  assert.equal(stand.versand.abklingenBis, T0 + RAENGE.jung.wirkMs + RAENGE.jung.abklingMs);
});

test('Verkaufen des zugewiesenen Meisters laesst die Station schlafen', () => {
  let stand = stelleEin(reich(), versand, 1);
  const m = platzVon(stand, versand).pool[0]!;
  stand = handle(stand, { typ: 'verkaufen', ziel: versand, id: m.id }, T0).stand;
  assert.equal(stand.versand.meister, false);
  assert.equal(platzVon(stand, versand).pool.length, 0);
});

test('Meister bleiben ueber den Umzug und stehen an ihren Stationen', () => {
  let stand = stelleEin(reich(), versand, 2);
  stand = stelleEin(stand, presse, 1);
  for (let i = 1; i < 8; i += 1) stand = handle(stand, { typ: 'freischalten' }, T0).stand;
  stand = stelleEin(stand, { art: 'presse', index: 6 }, 1);
  const neu = handle(stand, { typ: 'umziehen' }, T0).stand;
  assert.equal(neu.manufaktur, 2);
  assert.equal(neu.versand.meister, true);
  assert.equal(neu.pressen[0]!.meister, true);
  assert.equal(platzVon(neu, versand).pool.length, 2);
  // Presse 7 gibt es in der neuen Halle noch nicht — ihr Meister wartet, bis sie steht.
  assert.equal(neu.pressen.length, 1);
  assert.equal(platzVon(neu, { art: 'presse', index: 6 }).pool.length, 1);
});

test('Uebernahme Fassung 3: jeder Meister wird ein Jungmeister mit Tempo', () => {
  const alt = { ...neuerStand(T0), fassung: 3 } as unknown as Record<string, unknown>;
  const pressen = (alt.pressen as Record<string, unknown>[]).map((p) => ({ ...p, meister: true }));
  delete alt.belegschaft;
  delete alt.zufall;
  delete alt.naechsteMeisterId;
  const neu = migriere({ ...alt, pressen, versand: { ...(alt.versand as object), meister: true } });
  assert.equal(neu.fassung, FASSUNG);
  assert.equal(neu.versand.rang, 'jung');
  assert.equal(neu.versand.art, 'tempo');
  assert.equal(neu.paternoster.meister, false);
  const platz = platzVon(neu, versand);
  assert.equal(platz.eingestellt, 1);
  assert.equal(platz.zugewiesen, platz.pool[0]!.id);
  // Als naechstes kommt der feste Rabatt-Jungmeister.
  const weiter = handle({ ...neu, taler: 1e9 }, { typ: 'einstellen', ziel: versand }, T0).stand;
  assert.equal(platzVon(weiter, versand).pool[1]!.art, 'rabatt');
  assert.ok(neu.zufall > 0);
});
