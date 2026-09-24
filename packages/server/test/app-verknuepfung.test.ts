/**
 * Universal Links (iOS) und App Links (Android) fuer den Einladungslink.
 *
 * Beide Systeme holen ihre Datei selbst vom Server. Fehlt die Angabe aus dem
 * Konto (Team-ID, Fingerabdruck), darf es die Datei nicht geben — keine
 * Platzhalter, und vor allem nicht die index.html, die der Server sonst fuer
 * jeden Pfad ohne Endung schickt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/http/app.js';
import { appVerknuepfungAusUmgebung } from '../src/http/app-verknuepfung.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createTestContext } from './helpers.js';

const FINGER = Array.from({ length: 32 }, (_, i) => (i + 16).toString(16).toUpperCase()).join(':');

async function setup(env: NodeJS.ProcessEnv) {
  const ctx = await createTestContext();
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    appVerknuepfung: appVerknuepfungAusUmgebung(env),
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

test('ohne Angaben aus den Konten gibt es beide Dateien nicht', async (t) => {
  const s = await setup({ APPLE_TEAM_ID: 'PLATZHALTER', ANDROID_SHA256: 'AB:CD' });
  t.after(() => s.close());
  for (const url of ['/.well-known/apple-app-site-association', '/.well-known/assetlinks.json']) {
    const res = await s.app.inject({ method: 'GET', url });
    assert.equal(res.statusCode, 404, url);
  }
});

test('mit Team-ID und Fingerabdruck: genau der Einladungspfad, fuer genau dieses Paket', async (t) => {
  const s = await setup({ APPLE_TEAM_ID: 'abcde12345', ANDROID_SHA256: ` ${FINGER.toLowerCase()} ,unsinn` });
  t.after(() => s.close());

  const apple = await s.app.inject({ method: 'GET', url: '/.well-known/apple-app-site-association' });
  assert.equal(apple.statusCode, 200);
  assert.match(String(apple.headers['content-type']), /^application\/json/);
  assert.deepEqual(apple.json(), {
    applinks: {
      details: [{ appIDs: ['ABCDE12345.de.broweg.brauweg-spielen'], components: [{ '/': '/beitritt/*' }] }],
    },
  });

  const android = await s.app.inject({ method: 'GET', url: '/.well-known/assetlinks.json' });
  assert.equal(android.statusCode, 200);
  assert.deepEqual(android.json(), [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'de.brauweg.app', sha256_cert_fingerprints: [FINGER] },
    },
  ]);
});
