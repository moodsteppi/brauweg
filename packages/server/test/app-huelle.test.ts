/**
 * Anmeldung der iOS-Huelle.
 *
 * Die App laedt den Client aus dem eigenen Paket und ist damit eine fremde
 * Herkunft. Ein Cookie bekommt sie nicht - WebKit verwirft Cookies ueber die
 * Herkunftsgrenze, und ein WebSocket kaeme ohnehin ohne aus. Sie traegt ihr
 * Sitzungstoken deshalb selbst: im `Authorization`-Kopf, am WebSocket als
 * Unterprotokoll.
 *
 * Geprueft wird genau die Naht: Das Token oeffnet dieselben Tueren wie das
 * Cookie, ein erfundenes oeffnet keine, und herausgegeben wird es nur an die
 * App - der Browser behaelt sein HttpOnly-Cookie, das kein Skript sieht.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WebSocket } from 'ws';

import { APP_ORIGIN, SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { Gateway, TOKEN_PROTOKOLL } from '../src/realtime/gateway.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

const PASSWORT = 'geheim-genug-1234';
const PUBLIC_URL = 'https://www.brauweg-spielen.de';

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

  await app.listen({ port: 0, host: '127.0.0.1' });
  const gateway = new Gateway(app.server, ctx.db, runtime, {
    allowedOrigins: [PUBLIC_URL, APP_ORIGIN],
  });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    ctx,
    app,
    anna,
    wsUrl: `ws://127.0.0.1:${port}/ws`,
    token: () => createSession(ctx.auth, anna.accountId),
    async close() {
      runtime.shutdown();
      await gateway.close();
      await app.close();
      await ctx.close();
    },
  };
}

/**
 * Verbindet und wartet die erste Antwort ab.
 *
 * Der Gateway meldet sich bei einer abgelehnten Sitzung mit `unauthorized`
 * und schliesst; bei einer gueltigen schweigt er, bis ein `join` kommt.
 * Beides ist eindeutig, sobald man kurz wartet.
 */
async function verbinde(
  url: string,
  options: { protocols?: string[]; origin?: string } = {},
): Promise<{ angenommen: boolean; protokoll: string; fehler: string | null }> {
  const socket = new WebSocket(url, options.protocols ?? [], {
    headers: options.origin ? { origin: options.origin } : {},
  });

  const fehler = await new Promise<string | null>((resolve) => {
    const fertig = setTimeout(() => resolve(null), 300);
    socket.on('message', (raw) => {
      clearTimeout(fertig);
      const nachricht = JSON.parse(raw.toString()) as { type: string; code?: string };
      resolve(nachricht.type === 'error' ? (nachricht.code ?? 'error') : null);
    });
    socket.on('close', () => {
      clearTimeout(fertig);
      resolve('closed');
    });
    socket.on('error', () => {
      clearTimeout(fertig);
      resolve('closed');
    });
  });

  const protokoll = socket.protocol;
  socket.close();
  return { angenommen: fehler === null, protokoll, fehler };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

test('das Sitzungstoken im Authorization-Kopf oeffnet dieselbe Tuer wie das Cookie', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const token = await s.token();

  const mitCookie = await s.app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` },
  });
  const mitKopf = await s.app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(mitCookie.statusCode, 200);
  assert.equal(mitKopf.statusCode, 200);
  assert.equal(mitKopf.json().id, mitCookie.json().id);
});

test('ein erfundenes Token oeffnet nichts', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  for (const kopf of ['Bearer erfunden', 'erfunden', 'Basic ' + Buffer.from('a:b').toString('base64')]) {
    const res = await s.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: kopf },
    });
    assert.equal(res.statusCode, 401, `"${kopf}" wurde durchgelassen`);
  }
});

test('das Login gibt das Token nur an die App heraus', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const imBrowser = await s.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: s.anna.email, password: PASSWORT },
  });
  const inDerApp = await s.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: APP_ORIGIN },
    payload: { email: s.anna.email, password: PASSWORT },
  });

  assert.equal(imBrowser.statusCode, 200);
  // Der Browser haelt seine Sitzung im HttpOnly-Cookie. Stuende das Token
  // zusaetzlich im Rumpf, koennte ein XSS es abgreifen und dauerhaft
  // weiterverwenden - genau das verhindert HttpOnly.
  assert.equal(imBrowser.json().token, undefined);
  assert.ok(imBrowser.headers['set-cookie'], 'das Cookie fehlt');

  assert.equal(inDerApp.statusCode, 200);
  assert.equal(typeof inDerApp.json().token, 'string');
});

test('eine fremde Herkunft bekommt keine Freigabe', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const fremd = await s.app.inject({
    method: 'GET',
    url: '/api/games',
    headers: { origin: 'https://boese.example' },
  });
  const app = await s.app.inject({
    method: 'GET',
    url: '/api/games',
    headers: { origin: APP_ORIGIN },
  });

  assert.equal(fremd.headers['access-control-allow-origin'], undefined);
  assert.equal(app.headers['access-control-allow-origin'], APP_ORIGIN);
  // Ohne Cookies ueber die Grenze gibt es keinen CSRF-Weg in die App-Freigabe.
  assert.equal(app.headers['access-control-allow-credentials'], undefined);
});

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

test('der WebSocket nimmt das Token als Unterprotokoll an', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const ergebnis = await verbinde(s.wsUrl, {
    protocols: [TOKEN_PROTOKOLL, await s.token()],
    origin: APP_ORIGIN,
  });

  assert.ok(ergebnis.angenommen, `abgewiesen mit ${ergebnis.fehler}`);
  // Bestaetigt wird die Marke, nie das Token: Es hat im Antwortkopf nichts
  // verloren. Ohne Bestaetigung bricht der Browser die Verbindung ab.
  assert.equal(ergebnis.protokoll, TOKEN_PROTOKOLL);
});

test('ein erfundenes Token am WebSocket wird abgewiesen', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const ergebnis = await verbinde(s.wsUrl, {
    protocols: [TOKEN_PROTOKOLL, 'erfunden'],
    origin: APP_ORIGIN,
  });

  assert.equal(ergebnis.fehler, 'unauthorized');
});

test('das Cookie bleibt der Weg des Browsers', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const token = await s.token();
  const socket = new WebSocket(s.wsUrl, {
    headers: {
      origin: PUBLIC_URL,
      cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    },
  });
  const fehler = await new Promise<string | null>((resolve) => {
    const fertig = setTimeout(() => resolve(null), 300);
    socket.on('message', (raw) => {
      clearTimeout(fertig);
      resolve(String((JSON.parse(raw.toString()) as { code?: string }).code ?? 'error'));
    });
    socket.on('error', () => {
      clearTimeout(fertig);
      resolve('closed');
    });
  });
  socket.close();

  assert.equal(fehler, null);
});

test('eine fremde Herkunft kommt an den WebSocket nicht heran', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const ergebnis = await verbinde(s.wsUrl, {
    protocols: [TOKEN_PROTOKOLL, await s.token()],
    origin: 'https://boese.example',
  });

  assert.equal(ergebnis.angenommen, false);
});
