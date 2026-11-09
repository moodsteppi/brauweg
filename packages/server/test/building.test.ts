import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import Fastify from 'fastify';
import { buildingStart, buildingErgebnis, buildingVerlauf } from '../src/building.js';
import { buildingRouten } from '../src/http/building-routen.js';
import { unauthorized } from '../src/errors.js';
import * as s from '../src/db/schema.js';
import { standVon } from '../src/waehrung.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';
import type { BauErgebnis } from '@brauweg/building-kern';
const t0 = new Date('2026-11-09T12:00:00Z');
const ende = (plus = 0) => new Date(t0.getTime() + 40000 + plus);
const ergebnis: BauErgebnis = { modus: 'rennen', hoehe: 17, gebaut: 13, verloren: 0, leben: 3, platz: 1, gewonnen: true, aufgegeben: false, dauer: 35, spielerzahl: 2 };

test('Building: Migration, Kontogrenze, doppelte/parallele Meldung, Tageslimit und Berliner Tageswechsel', async t => {
  const c = await createTestContext(); t.after(() => c.close()); await seedInvite(c.db);
  const { accountId: a } = await createVerifiedAccount(c, 'BauAnna');
  const { accountId: b } = await createVerifiedAccount(c, 'BauBert');
  const vorher = (await standVon(c.db, a)).coins;
  await buildingStart(c.db, a, { partie: 'runde-0001', modus: 'rennen' }, t0);
  await assert.rejects(buildingErgebnis(c.db, b, 'runde-0001', ergebnis, ende()), /buildingKeinStart/);
  await assert.rejects(buildingErgebnis(c.db, a, 'runde-0001', ergebnis, t0), /invalidInput/);
  const antwort = await Promise.all([buildingErgebnis(c.db, a, 'runde-0001', ergebnis, ende()), buildingErgebnis(c.db, a, 'runde-0001', ergebnis, ende())]);
  assert.deepEqual(antwort.map(r => r.wiederholt).sort(), [false, true]);
  assert.equal((await standVon(c.db, a)).coins - vorher, 15);
  for (let i = 2; i <= 6; i++) { const partie = `runde-000${i}`; await buildingStart(c.db, a, { partie, modus: 'rennen' }, t0); await buildingErgebnis(c.db, a, partie, ergebnis, ende(i)); }
  assert.equal((await standVon(c.db, a)).coins - vorher, 60);
  assert.equal((await buildingVerlauf(c.db, a, ende())).runden.length, 6);
  assert.equal((await buildingVerlauf(c.db, a, ende())).restMuenzen, 0);
  // 23:00 UTC ist im November 00:00 Uhr in Berlin.
  const morgen = new Date('2026-11-09T23:00:01Z');
  await buildingStart(c.db, a, { partie: 'runde-morgen', modus: 'rennen' }, new Date(morgen.getTime() - 40000));
  assert.equal((await buildingErgebnis(c.db, a, 'runde-morgen', ergebnis, morgen)).muenzen, 15);
  assert.equal((await buildingVerlauf(c.db, b, morgen)).runden.length, 0);
});

test('Building: kein Geschenk für Gäste, Abbruch, falsche Wertung oder zu kurze Runde; Start bleibt idempotent', async t => {
  const c = await createTestContext(); t.after(() => c.close()); await seedInvite(c.db);
  const { accountId: a } = await createVerifiedAccount(c, 'BauEmil');
  await c.db.update(s.account).set({ gastSeit: t0 }).where(eq(s.account.id, a));
  await assert.rejects(buildingStart(c.db, a, { partie: 'runde-gast', modus: 'rennen' }, t0), /forbidden/);
  await c.db.update(s.account).set({ gastSeit: null }).where(eq(s.account.id, a));
  await buildingStart(c.db, a, { partie: 'runde-kurz', modus: 'rennen' }, t0);
  await buildingStart(c.db, a, { partie: 'runde-kurz', modus: 'rennen' }, ende());
  const kurz = await buildingErgebnis(c.db, a, 'runde-kurz', { ...ergebnis, gewonnen: false, dauer: 4, gebaut: 1 }, ende());
  assert.equal(kurz.muenzen, 0);
  await buildingStart(c.db, a, { partie: 'runde-abbruch', modus: 'rennen' }, t0);
  await assert.rejects(buildingErgebnis(c.db, a, 'runde-abbruch', { ...ergebnis, aufgegeben: true }, ende()), /invalidInput/);
  assert.equal((await buildingErgebnis(c.db, a, 'runde-abbruch', { ...ergebnis, aufgegeben: true, gewonnen: false }, ende())).muenzen, 0);
  await buildingStart(c.db, a, { partie: 'runde-alt', modus: 'standfest' }, t0);
  await buildingStart(c.db, a, { partie: 'runde-neu', modus: 'rennen' }, t0);
  // Der neue Start löscht keinen noch ausstehenden Offline-Abschluss.
  assert.equal((await buildingErgebnis(c.db, a, 'runde-alt', { ...ergebnis, modus: 'standfest', gewonnen: false }, ende())).muenzen, 5);
});

test('Building-Endpunkte verlangen eine Sitzung auch ohne Request-Daten', async t => {
  const app = Fastify(); t.after(() => app.close());
  buildingRouten(app, { db: {} as never, requireAccount: async () => { throw unauthorized(); }, limitSchreiben: { max: 10, timeWindow: '1 minute' }, limitAllgemein: { max: 10, timeWindow: '1 minute' } });
  app.setErrorHandler((e: { status?: number }, _r, reply) => reply.status(e.status ?? 500).send({ ok: false }));
  for (const [method, url] of [['GET', '/api/building'], ['POST', '/api/building/start'], ['POST', '/api/building/ergebnis']] as const) assert.equal((await app.inject({ method, url })).statusCode, 401);
});
