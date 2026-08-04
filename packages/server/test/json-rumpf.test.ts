/**
 * Fehlerhaftes JSON am Eingang.
 *
 * Der eigene Content-Type-Parser liest einen leeren Rumpf als "keine Daten"
 * (siehe `app.ts`). Bricht das Parsen dagegen ab, ist das ein Fehler des
 * Aufrufers und keiner des Servers. Der rohe `SyntaxError` trug bis hierher
 * keinen Statuscode: Er fiel in der Fehlerbehandlung an allen 4xx-Zweigen
 * vorbei in den 500er - mit `console.error`, sodass ein abgebrochener
 * Client-Aufruf das Fehlerlog flutete.
 *
 * Geprueft wird beides: dass eine 400 mit `invalidRequest` zurueckgeht, und
 * dass die Nachsicht gegenueber dem leeren Rumpf dabei erhalten bleibt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createTestContext, type TestContext } from './helpers.js';

const JSON_KOPF = { 'content-type': 'application/json' };

async function aufbau(): Promise<{ ctx: TestContext; app: FastifyInstance }> {
  const ctx = await createTestContext();
  const app = await buildApp({
    db: ctx.db,
    runtime: new PartyRuntime(ctx.db),
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
  return { ctx, app };
}

test('Ein abgeschnittener JSON-Rumpf bekommt eine 400, keine 500', async (t) => {
  const { ctx, app } = await aufbau();
  t.after(() => ctx.close());
  t.after(() => app.close());

  // Genau der Rumpf aus der Fehlermeldung: Anfuehrungszeichen und geschweifte
  // Klammer fehlen, weil der Aufruf mitten im Schreiben abbrach.
  const antwort = await app.inject({
    method: 'POST',
    url: '/api/auth/verify',
    headers: JSON_KOPF,
    payload: '{"token":"abc',
  });

  assert.equal(antwort.statusCode, 400);
  assert.equal(antwort.json().code, 'invalidRequest');
  assert.equal(antwort.json().messageKey, 'error.invalidRequest');
});

test('Der Statuscode haengt am Parser, nicht an der einzelnen Route', async (t) => {
  const { ctx, app } = await aufbau();
  t.after(() => ctx.close());
  t.after(() => app.close());

  // Kein Schema kommt hier je zum Zug - der Rumpf scheitert davor. Deshalb
  // muss es an jedem Endpunkt gleich aussehen, auch an denen mit Anmeldepflicht.
  const wege: readonly [string, string][] = [
    ['POST', '/api/auth/verify'],
    ['POST', '/api/auth/login'],
    ['POST', '/api/tables'],
    ['PATCH', '/api/me'],
  ];

  for (const [method, url] of wege) {
    const antwort = await app.inject({
      method: method as 'POST',
      url,
      headers: JSON_KOPF,
      payload: 'kein json',
    });
    assert.equal(antwort.statusCode, 400, `${method} ${url}`);
    assert.equal(antwort.json().code, 'invalidRequest', `${method} ${url}`);
  }
});

test('Fehlerhaftes JSON landet nicht im Fehlerlog', async (t) => {
  const { ctx, app } = await aufbau();
  t.after(() => ctx.close());
  t.after(() => app.close());

  // Der 500er-Zweig schreibt mit console.error. Lief ein Client-Fehler dort
  // hinein, ging das Log in Meldungen unter, die niemanden etwas angehen.
  const gemeldet: unknown[][] = [];
  const original = console.error;
  // eslint-disable-next-line no-console
  console.error = (...args: unknown[]) => {
    gemeldet.push(args);
  };
  t.after(() => {
    // eslint-disable-next-line no-console
    console.error = original;
  });

  await app.inject({
    method: 'POST',
    url: '/api/auth/verify',
    headers: JSON_KOPF,
    payload: '{"token":"abc',
  });

  assert.deepEqual(gemeldet, [], 'ein Client-Fehler gehoert nicht ins Fehlerlog');
});

test('Der leere Rumpf bleibt nachsichtig behandelt', async (t) => {
  const { ctx, app } = await aufbau();
  t.after(() => ctx.close());
  t.after(() => app.close());

  // Die Nachsicht gegenueber dem leeren Rumpf ist der Grund, aus dem es den
  // eigenen Parser ueberhaupt gibt. Sie darf durch den Statuscode nicht
  // verlorengehen: 401 heisst, der Rumpf war in Ordnung und die Anmeldung
  // fehlte - 400 hiesse, der Parser haette abgelehnt.
  const leer = await app.inject({
    method: 'POST',
    url: '/api/tables',
    headers: JSON_KOPF,
    payload: '',
  });
  assert.equal(leer.statusCode, 401);

  // Gueltiges JSON kommt weiterhin bis zum Schema durch: Der Endpunkt verlangt
  // keine Anmeldung, das Feld `token` fehlt aber.
  const gueltig = await app.inject({
    method: 'POST',
    url: '/api/auth/verify',
    headers: JSON_KOPF,
    payload: '{}',
  });
  assert.equal(gueltig.statusCode, 400);
  assert.equal(gueltig.json().code, 'invalidInput');
});
