/**
 * Zugangsschutz fuer staging (http/zugangsschutz.ts).
 *
 * Die Zusagen: Mit STAGING_ZUGANG fragt die Webseite — Seiten, Dateien und
 * API aus dem Browser — nach Name und Passwort. Frei bleiben, was sonst
 * bricht: Railways Gesundheitspruefung, Apples und Googles
 * Verknuepfungsdateien, die App (TestFlight-Fassung gegen staging) und
 * Aufrufe mit eigenem Bearer-Schluessel. Ohne Variable aendert sich nichts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { APP_ORIGIN, buildApp } from '../src/http/app.js';
import { leseZugang } from '../src/http/zugangsschutz.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createTestContext } from './helpers.js';

const OEFFENTLICH = fileURLToPath(new URL('../../../client/public/', import.meta.url));
const ZUGANG = 'team:geheim-genug';
const basic = (wert: string) => `Basic ${Buffer.from(wert).toString('base64')}`;

async function setup(stagingZugang: string | null) {
  const ctx = await createTestContext();
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    clientDir: OEFFENTLICH,
    stagingZugang,
  });
  return {
    app,
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

test('ohne STAGING_ZUGANG bleibt alles offen', async (t) => {
  const s = await setup(null);
  t.after(() => s.close());
  const res = await s.app.inject({ url: '/api/games' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['www-authenticate'], undefined);
});

test('mit STAGING_ZUGANG: Webseite und API nur mit Passwort', async (t) => {
  const s = await setup(ZUGANG);
  t.after(() => s.close());

  for (const url of ['/', '/api/games', '/rechtliches/impressum.html', '/beitritt/ABCD12']) {
    const ohne = await s.app.inject({ url });
    assert.equal(ohne.statusCode, 401, url);
    assert.match(String(ohne.headers['www-authenticate']), /^Basic realm="Brauweg staging"/, url);
  }
  const falsch = await s.app.inject({ url: '/api/games', headers: { authorization: basic('team:falsch-falsch') } });
  assert.equal(falsch.statusCode, 401);

  const richtig = await s.app.inject({ url: '/api/games', headers: { authorization: basic(ZUGANG) } });
  assert.equal(richtig.statusCode, 200);
});

test('mit STAGING_ZUGANG frei: Gesundheit, Verknuepfungsdateien, App, Bearer', async (t) => {
  const s = await setup(ZUGANG);
  t.after(() => s.close());

  const gesund = await s.app.inject({ url: '/api/health' });
  assert.equal(gesund.statusCode, 200);

  const aasa = await s.app.inject({ url: '/.well-known/apple-app-site-association' });
  assert.notEqual(aasa.statusCode, 401, 'Apple holt die Datei ohne Anmeldung');

  const app = await s.app.inject({ url: '/api/games', headers: { origin: APP_ORIGIN } });
  assert.equal(app.statusCode, 200, 'die TestFlight-Fassung kann keine Passwortabfrage beantworten');

  // bro-server mit Dienstschluessel: am Schutz vorbei, die Route sagt dann selbst nein.
  const dienst = await s.app.inject({ url: '/api/herkunft/auswertung', headers: { 'x-herkunft-schluessel': 'falsch' } });
  assert.notEqual(dienst.statusCode, 401);
  assert.equal(dienst.headers['www-authenticate'], undefined);

  // Ein Bearer kommt am Schutz vorbei — die Route prueft ihn dann selbst.
  const bearer = await s.app.inject({ url: '/api/me', headers: { authorization: 'Bearer kein-echtes-token' } });
  assert.equal(bearer.statusCode, 401);
  assert.equal(bearer.headers['www-authenticate'], undefined, 'die Absage kommt von der Route, nicht vom Schutz');
});

test('leseZugang: leer heisst aus, Unbrauchbares bricht laut ab', () => {
  assert.equal(leseZugang(undefined), null);
  assert.equal(leseZugang('  '), null);
  assert.equal(leseZugang(' team:geheim-genug '), 'team:geheim-genug');
  assert.throws(() => leseZugang('nurpasswort'));
  assert.throws(() => leseZugang(':geheim-genug'));
  assert.throws(() => leseZugang('team:kurz'));
});
