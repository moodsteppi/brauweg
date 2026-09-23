/**
 * Rueckweg fuer die App: Partykiste ohne Trinkmodus, ohne neuen Build.
 *
 * Robin hat entschieden, dass die Partykiste in der App MIT Trinkmodus
 * laeuft (23.09.2026). Lehnt Apple deshalb ab (1.4.3), soll ein Deploy mit
 * `APP_PARTYKISTE_TRINKMODUS=aus` genuegen. Geprueft wird: Vorgabe AUS
 * aendert nichts, eingeschaltet werden Tische aus der App gezaehmt, und an
 * einen auf der Webseite angelegten Trinktisch kommt aus der App niemand.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { GameId } from '@brauweg/game-api';

import { APP_ORIGIN, buildApp } from '../src/http/app.js';
import {
  APP_INHALT_WIE_WEB,
  type AppInhalt,
  appInhaltAusUmgebung,
  appRegeln,
  taugtFuerApp,
} from '../src/games/registry.js';
import { tableRules } from '../src/tables/service.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

const PARTY = 'partykiste' as GameId;
const ZAHM: AppInhalt = { trinkmodusAus: true, haerteMax: 2 };

test('die Umgebung schaltet nur mit ausdruecklichen Werten', () => {
  assert.deepEqual(appInhaltAusUmgebung({}), APP_INHALT_WIE_WEB);
  assert.deepEqual(appInhaltAusUmgebung({ APP_PARTYKISTE_TRINKMODUS: 'an' }), APP_INHALT_WIE_WEB);
  assert.deepEqual(appInhaltAusUmgebung({ APP_PARTYKISTE_HAERTE_MAX: '7' }), APP_INHALT_WIE_WEB);
  assert.deepEqual(
    appInhaltAusUmgebung({ APP_PARTYKISTE_TRINKMODUS: ' AUS ', APP_PARTYKISTE_HAERTE_MAX: '1' }),
    { trinkmodusAus: true, haerteMax: 1 },
  );
});

test('ohne Schalter bleibt jeder Regelsatz, wie er ist — auch ein fehlender', () => {
  const derb = { trinkmodus: true, inhaltsHaerte: 3 };
  assert.equal(appRegeln(PARTY, derb, APP_INHALT_WIE_WEB), derb);
  assert.equal(appRegeln(PARTY, undefined, APP_INHALT_WIE_WEB), undefined);
  assert.ok(taugtFuerApp(PARTY, derb, APP_INHALT_WIE_WEB));
});

test('eingeschaltet: Strafpunkte statt Schlucke, Textschaerfe gedeckelt, der Rest bleibt', () => {
  const r = appRegeln(PARTY, { trinkmodus: true, inhaltsHaerte: 3, schluckFaktor: 2 }, ZAHM);
  assert.deepEqual(r, { trinkmodus: false, inhaltsHaerte: 2, schluckFaktor: 2 });

  // Ohne Regelsatz gilt die Vorgabe des Moduls — die mit Trinkmodus.
  const vorgabe = appRegeln(PARTY, undefined, ZAHM) as Record<string, unknown>;
  assert.equal(vorgabe.trinkmodus, false);

  // Andere Spiele haben nichts zu zaehmen.
  const doko = { irgendwas: 1 };
  assert.equal(appRegeln('doppelkopf' as GameId, doko, ZAHM), doko);

  assert.ok(!taugtFuerApp(PARTY, { trinkmodus: true, inhaltsHaerte: 1 }, ZAHM));
  assert.ok(!taugtFuerApp(PARTY, { trinkmodus: false, inhaltsHaerte: 3 }, ZAHM));
  assert.ok(taugtFuerApp(PARTY, { trinkmodus: false, inhaltsHaerte: 2 }, ZAHM));
});

async function setup(appInhalt?: AppInhalt) {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    ...(appInhalt ? { appInhalt } : {}),
  });
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const ben = await createVerifiedAccount(ctx, 'Ben');
  const kopf = async (accountId: string, ausApp: boolean) => ({
    authorization: `Bearer ${await createSession(ctx.auth, accountId)}`,
    ...(ausApp ? { origin: APP_ORIGIN } : {}),
  });
  return {
    ctx,
    app,
    anna: (ausApp: boolean) => kopf(anna.accountId, ausApp),
    ben: (ausApp: boolean) => kopf(ben.accountId, ausApp),
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

async function partyTisch(
  s: Awaited<ReturnType<typeof setup>>,
  ausApp: boolean,
  wer: 'anna' | 'ben' = 'anna',
) {
  const res = await s.app.inject({
    method: 'POST',
    url: '/api/tables',
    headers: await s[wer](ausApp),
    payload: { gameId: 'partykiste', seats: 4, rounds: 3 },
  });
  assert.equal(res.statusCode, 201, res.body);
  return res.json() as { id: string; joinCode: string };
}

test('eingeschaltet: ein Tisch aus der App zaehlt Strafpunkte, einer von der Webseite nicht', async (t) => {
  const s = await setup(ZAHM);
  t.after(() => s.close());

  const ausApp = await partyTisch(s, true);
  const ausWeb = await partyTisch(s, false, 'ben');
  assert.equal((await tableRules(s.ctx.db, ausApp.id)).trinkmodus, false);
  assert.equal((await tableRules(s.ctx.db, ausWeb.id)).trinkmodus, true);
});

test('eingeschaltet: an den Trinktisch der Webseite kommt aus der App niemand', async (t) => {
  const s = await setup(ZAHM);
  t.after(() => s.close());
  const tisch = await partyTisch(s, false);

  const ausApp = await s.app.inject({
    method: 'POST',
    url: `/api/tables/code/${tisch.joinCode}/join`,
    headers: await s.ben(true),
  });
  assert.equal(ausApp.statusCode, 409);
  assert.equal(ausApp.json().code, 'tischNichtInDerApp');

  const ausWeb = await s.app.inject({
    method: 'POST',
    url: `/api/tables/${tisch.id}/join`,
    headers: await s.ben(false),
  });
  assert.equal(ausWeb.statusCode, 200);
});

test('Vorgabe AUS: App und Webseite spielen an denselben Trinktischen', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const ausApp = await partyTisch(s, true);
  assert.equal((await tableRules(s.ctx.db, ausApp.id)).trinkmodus, true);

  const tisch = await partyTisch(s, false);
  const beitritt = await s.app.inject({
    method: 'POST',
    url: `/api/tables/code/${tisch.joinCode}/join`,
    headers: await s.ben(true),
  });
  assert.equal(beitritt.statusCode, 200);
});
