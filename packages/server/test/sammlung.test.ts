/**
 * Mememory: Sammlung und Emote-Gurt.
 *
 * Zwei Dinge muessen hier stimmen:
 *
 *   1. **Gesammelt wird ohne Doppel.** Dasselbe Motiv taucht in vielen
 *      Partien auf; jede Meldung schickt das ganze Brett. Zaehlte das
 *      mehrfach, waere die Sammlung nach drei Runden eine Strichliste.
 *   2. **In den Gurt kommt nur, was gesammelt ist.** Das ist die einzige
 *      Stelle, an der die Sammlung ueberhaupt etwas bedeutet — deshalb
 *      prueft sie der Server und nicht der Client.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import {
  createTestContext,
  createVerifiedAccount,
  seedInvite,
  type TestContext,
} from './helpers.js';

async function aufbau(t: { after(fn: () => unknown): void }) {
  const ctx: TestContext = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const app = await buildApp({
    db: ctx.db,
    runtime: new PartyRuntime(ctx.db),
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
  t.after(() => app.close());
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const token = await createSession(ctx.auth, anna.accountId);
  const bert = await createVerifiedAccount(ctx, 'Bert');
  const bertToken = await createSession(ctx.auth, bert.accountId);
  return { ctx, app, token, bertToken };
}

const melden = (
  app: Awaited<ReturnType<typeof buildApp>>,
  token: string,
  kennungen: string[],
) =>
  app.inject({
    method: 'POST',
    url: '/api/mememory/sammlung',
    cookies: { [SESSION_COOKIE]: token },
    payload: { kennungen },
  });

const gurtSetzen = (
  app: Awaited<ReturnType<typeof buildApp>>,
  token: string,
  kennungen: string[],
  gesperrt?: boolean[],
) =>
  app.inject({
    method: 'PUT',
    url: '/api/mememory/sammlung/gurt',
    cookies: { [SESSION_COOKIE]: token },
    payload: { kennungen, gesperrt },
  });

const lesen = (app: Awaited<ReturnType<typeof buildApp>>, token: string) =>
  app.inject({
    method: 'GET',
    url: '/api/mememory/sammlung',
    cookies: { [SESSION_COOKIE]: token },
  });

test('Sammeln braucht eine Anmeldung', async (t) => {
  const { app } = await aufbau(t);
  const antwort = await app.inject({
    method: 'POST',
    url: '/api/mememory/sammlung',
    payload: { kennungen: ['apfel'] },
  });
  assert.equal(antwort.statusCode, 401);
});

test('Dasselbe Motiv zaehlt nur einmal', async (t) => {
  const { app, token } = await aufbau(t);

  const erste = await melden(app, token, ['apfel', 'birne', 'apfel']);
  assert.equal(erste.json().neu, 2, 'ein Doppel in derselben Meldung');
  assert.equal(erste.json().gesamt, 2);

  // Die naechste Partie schickt das ganze Brett noch einmal mit.
  const zweite = await melden(app, token, ['apfel', 'birne', 'hoch-aabbccddee']);
  assert.equal(zweite.json().neu, 1);
  assert.equal(zweite.json().gesamt, 3);

  const stand = await lesen(app, token);
  assert.equal(stand.json().gesammelt.length, 3);
  assert.deepEqual(stand.json().gurt, []);
});

test('Unsinnige Kennungen fallen still durch', async (t) => {
  const { app, token } = await aufbau(t);
  // Grossbuchstaben, Leerzeichen, Pfad: nichts davon ist eine Motivkennung.
  const antwort = await melden(app, token, ['GROSS', 'mit leerzeichen', '../../etc', 'gut']);
  assert.equal(antwort.statusCode, 200);
  assert.equal(antwort.json().neu, 1);
  assert.deepEqual(
    (await lesen(app, token)).json().gesammelt.map((z: { kennung: string }) => z.kennung),
    ['gut'],
  );
});

test('Die Sammlung gehoert dem Konto, nicht dem Spiel', async (t) => {
  const { app, token, bertToken } = await aufbau(t);
  await melden(app, token, ['apfel', 'birne']);
  assert.equal((await lesen(app, bertToken)).json().gesammelt.length, 0);
});

test('In den Gurt kommt nur, was gesammelt ist', async (t) => {
  const { app, token } = await aufbau(t);
  await melden(app, token, ['apfel', 'birne', 'kiwi', 'melone']);

  const fremd = await gurtSetzen(app, token, ['apfel', 'nie-gesehen']);
  assert.equal(fremd.statusCode, 400);
  assert.equal(fremd.json().code, 'nichtGesammelt');
  assert.deepEqual((await lesen(app, token)).json().gurt, [], 'nichts halb gesetzt');

  const gut = await gurtSetzen(app, token, ['birne', 'apfel']);
  assert.equal(gut.statusCode, 200);
  // Die Reihenfolge ist die der Wahl: Was zuerst gewaehlt wurde, sitzt links.
  assert.deepEqual(gut.json().gurt, ['birne', 'apfel']);
  assert.deepEqual((await lesen(app, token)).json().gurt, ['birne', 'apfel']);
});

test('Mehr als drei gehen nicht in den Gurt', async (t) => {
  const { app, token } = await aufbau(t);
  await melden(app, token, ['a', 'b', 'c', 'd']);
  const zuViel = await gurtSetzen(app, token, ['a', 'b', 'c', 'd']);
  assert.equal(zuViel.statusCode, 400);
});

test('Ein Platztausch laeuft nicht in den Index', async (t) => {
  const { app, token } = await aufbau(t);
  await melden(app, token, ['a', 'b', 'c']);
  await gurtSetzen(app, token, ['a', 'b', 'c']);

  // Genau der Fall, an dem eine naive Umsetzung scheitert: Dieselben drei
  // Motive, andere Reihenfolge. Wer die Plaetze einzeln umschreibt, ohne
  // vorher zu raeumen, stolpert ueber den eindeutigen Teilindex.
  const getauscht = await gurtSetzen(app, token, ['c', 'a', 'b']);
  assert.equal(getauscht.statusCode, 200);
  assert.deepEqual(getauscht.json().gurt, ['c', 'a', 'b']);
});

test('Eine leere Liste raeumt den Gurt', async (t) => {
  const { app, token } = await aufbau(t);
  await melden(app, token, ['a', 'b']);
  await gurtSetzen(app, token, ['a', 'b']);
  const geraeumt = await gurtSetzen(app, token, []);
  assert.equal(geraeumt.statusCode, 200);
  assert.deepEqual(geraeumt.json().gurt, []);
  // Gesammelt bleibt gesammelt — nur der Gurt ist leer.
  assert.equal((await lesen(app, token)).json().gesammelt.length, 2);
});

// ---------------------------------------------------------------------------
// Zufallsgurt und Schloesser (27. August 2026)
// ---------------------------------------------------------------------------

const zufallSetzen = (
  app: Awaited<ReturnType<typeof buildApp>>,
  token: string,
  an: boolean,
) =>
  app.inject({
    method: 'PUT',
    url: '/api/mememory/sammlung/zufall',
    cookies: { [SESSION_COOKIE]: token },
    payload: { an },
  });

test('Der Zufallsgurt ist aus, bis ihn jemand einschaltet', async (t) => {
  const { app, token } = await aufbau(t);
  assert.equal((await lesen(app, token)).json().zufall, false);

  const an = await zufallSetzen(app, token, true);
  assert.equal(an.statusCode, 200);
  assert.equal(an.json().zufall, true);
  assert.equal((await lesen(app, token)).json().zufall, true);

  await zufallSetzen(app, token, false);
  assert.equal((await lesen(app, token)).json().zufall, false);
});

test('Der Schalter gehoert dem Konto, nicht dem Geraet', async (t) => {
  const { app, token, bertToken } = await aufbau(t);
  await zufallSetzen(app, token, true);
  assert.equal(
    (await lesen(app, bertToken)).json().zufall,
    false,
    'Bert hat seinen eigenen Schalter',
  );
});

test('Schloesser stehen Stellung fuer Stellung zum Gurt', async (t) => {
  const { app, token } = await aufbau(t);
  await melden(app, token, ['a', 'b', 'c']);

  await gurtSetzen(app, token, ['a', 'b', 'c'], [false, true, false]);
  const stand = (await lesen(app, token)).json();
  assert.deepEqual(stand.gurt, ['a', 'b', 'c']);
  assert.deepEqual(stand.gesperrt, [false, true, false], 'nur das mittlere Fach haelt');
});

test('Ein Fach, das neu belegt wird, verliert sein Schloss', async (t) => {
  const { app, token } = await aufbau(t);
  await melden(app, token, ['a', 'b', 'c']);
  await gurtSetzen(app, token, ['a', 'b'], [true, true]);
  assert.deepEqual((await lesen(app, token)).json().gesperrt, [true, true]);

  // Dasselbe Fach, anderes Motiv, kein Schloss mehr mitgeschickt: Das
  // Schloss haengt am FACH, und das wird gerade neu vergeben.
  await gurtSetzen(app, token, ['c', 'b']);
  const nachher = (await lesen(app, token)).json();
  assert.deepEqual(nachher.gurt, ['c', 'b']);
  assert.deepEqual(nachher.gesperrt, [false, false]);
});

test('Ein Client ohne Zufallsmodus setzt seinen Gurt weiterhin', async (t) => {
  const { app, token } = await aufbau(t);
  await melden(app, token, ['a', 'b']);

  // Genau der alte Aufruf: nur `kennungen`, kein `gesperrt`. Er muss
  // durchgehen, sonst braeche der Deploy jeden Client, der noch laeuft.
  const alt = await app.inject({
    method: 'PUT',
    url: '/api/mememory/sammlung/gurt',
    cookies: { [SESSION_COOKIE]: token },
    payload: { kennungen: ['a', 'b'] },
  });
  assert.equal(alt.statusCode, 200);
  assert.deepEqual((await lesen(app, token)).json().gesperrt, [false, false]);
});

test('Zu viele Schloesser kommen nicht durch', async (t) => {
  const { app, token } = await aufbau(t);
  await melden(app, token, ['a']);
  const zuViel = await gurtSetzen(app, token, ['a'], [true, true, true, true]);
  assert.equal(zuViel.statusCode, 400);
});
