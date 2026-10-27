/**
 * Die Android-Huelle (apps/android) ist dieselbe App wie die iOS-Huelle,
 * nur unter einer anderen Herkunft: `https://appassets.androidplatform.net`
 * statt `brauweg://app` (Begruendung bei APP_ORIGIN_ANDROID in http/app.ts).
 * Alles, was an der Herkunft der App haengt, muss fuer beide gleich gelten:
 * Token statt Cookie, Herkunftsfreigabe, die App-Auswahl der Spiele.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_ORIGIN,
  APP_ORIGIN_ANDROID,
  APP_ORIGINS,
  buildApp,
  istAppHerkunft,
} from '../src/http/app.js';
import { freigabeAuf } from '../src/games/registry.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

async function setup() {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
  const anna = await createVerifiedAccount(ctx, 'Anna');
  return {
    app,
    anna,
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

test('beide Huellen sind App, jede andere Herkunft nicht', () => {
  assert.deepEqual([...APP_ORIGINS], [APP_ORIGIN, APP_ORIGIN_ANDROID]);
  assert.ok(istAppHerkunft('brauweg://app'));
  assert.ok(istAppHerkunft('https://appassets.androidplatform.net'));
  for (const fremd of [undefined, 'null', 'https://www.brauweg-spielen.de', 'http://appassets.androidplatform.net']) {
    assert.ok(!istAppHerkunft(fremd), String(fremd));
  }
});

test('die Android-Huelle bekommt beim Anmelden das Token und die Freigabe', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const login = await s.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: APP_ORIGIN_ANDROID },
    payload: { email: s.anna.email, password: 'geheim-genug-1234' },
  });
  assert.equal(login.statusCode, 200);
  assert.equal(typeof login.json().token, 'string');

  const spiele = await s.app.inject({
    method: 'GET',
    url: '/api/games',
    headers: { origin: APP_ORIGIN_ANDROID },
  });
  assert.equal(spiele.headers['access-control-allow-origin'], APP_ORIGIN_ANDROID);
  // Sie sieht die App-Auswahl, nicht die der Webseite.
  for (const spiel of spiele.json() as { id: string; availability: string }[]) {
    const f = freigabeAuf(spiel.id as never, 'app');
    assert.equal(spiel.availability, f === 'spielbar' ? 'playable' : 'preview', spiel.id);
  }
});
