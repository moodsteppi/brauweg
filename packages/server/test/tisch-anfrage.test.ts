/**
 * Beitritt mit Zusage (tables/anfragen.ts, Emile 13.10.2026).
 *
 * An einem nicht-oeffentlichen Tisch der Kartenlobby setzt sich niemand von
 * selbst hin: Der Beitritt wird zur Anfrage, der Gastgeber sagt zu oder ab.
 * Geprueft werden beide Wege hinein (Code und Tisch-Kennung), dass nur der
 * Gastgeber entscheidet, und die Ausnahmen — oeffentliche Tische und die
 * Partykiste bleiben, wie sie waren.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
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
  const kopf = async (name: string) => {
    const konto = await createVerifiedAccount(ctx, name);
    const token = await createSession(ctx.auth, konto.accountId);
    return { id: konto.accountId, kopf: { authorization: `Bearer ${token}` } };
  };
  return {
    app,
    anna: await kopf('Anna'),
    ben: await kopf('Ben'),
    carla: await kopf('Carla'),
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;
type Person = Setup['anna'];

async function tisch(s: Setup, gameId: string, visibility: string, seats = 4) {
  // Rundenzahl aus den Vorgaben des Moduls: Was aufgeht, weiss nur das Spiel.
  const vorgabe = await s.app.inject({ method: 'GET', url: `/api/games/${gameId}/defaults`, headers: s.anna.kopf });
  const rounds = (vorgabe.json() as { rounds: Record<string, number[]> }).rounds[String(seats)]![0]!;
  const res = await s.app.inject({
    method: 'POST',
    url: '/api/tables',
    headers: s.anna.kopf,
    payload: { gameId, seats, rounds, visibility },
  });
  assert.equal(res.statusCode, 201, res.body);
  return res.json() as { id: string; joinCode: string };
}

const perCode = (s: Setup, wer: Person, code: string) =>
  s.app.inject({ method: 'POST', url: `/api/tables/code/${code}/join`, headers: wer.kopf });

async function sitzt(s: Setup, tableId: string, wer: Person): Promise<boolean> {
  const res = await s.app.inject({ method: 'GET', url: `/api/tables/${tableId}`, headers: s.anna.kopf });
  return (res.json() as { seats: { accountId: string | null }[] }).seats.some((x) => x.accountId === wer.id);
}

const stand = async (s: Setup, tableId: string, wer: Person) =>
  (await s.app.inject({ method: 'GET', url: `/api/tables/${tableId}/anfrage`, headers: wer.kopf })).json().stand;

test('per Code an einen privaten Tisch: erst Anfrage, nach der Zusage sitzt man', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const { id, joinCode } = await tisch(s, 'doppelkopf', 'on_request');

  const res = await perCode(s, s.ben, joinCode);
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().angefragt, true);
  assert.equal(await sitzt(s, id, s.ben), false, 'ohne Zusage kein Platz');
  assert.equal(await stand(s, id, s.ben), 'offen');

  const liste = await s.app.inject({ method: 'GET', url: `/api/tables/${id}/anfragen`, headers: s.anna.kopf });
  assert.deepEqual(liste.json().anfragen.map((a: { displayName: string }) => a.displayName), ['Ben']);

  const zu = await s.app.inject({
    method: 'POST',
    url: `/api/tables/${id}/anfragen/${s.ben.id}`,
    headers: s.anna.kopf,
    payload: { annehmen: true },
  });
  assert.equal(zu.statusCode, 200, zu.body);
  assert.equal(await sitzt(s, id, s.ben), true);
  assert.equal(await stand(s, id, s.ben), 'angenommen');
});

test('abgelehnt heisst: kein Platz, und die Anfrage ist weg', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const { id } = await tisch(s, 'doppelkopf', 'on_request');

  const res = await s.app.inject({ method: 'POST', url: `/api/tables/${id}/join`, headers: s.carla.kopf });
  assert.equal(res.json().angefragt, true);

  await s.app.inject({
    method: 'POST',
    url: `/api/tables/${id}/anfragen/${s.carla.id}`,
    headers: s.anna.kopf,
    payload: { annehmen: false },
  });
  assert.equal(await sitzt(s, id, s.carla), false);
  assert.equal(await stand(s, id, s.carla), 'abgelehnt');
});

test('nur der Gastgeber sieht und entscheidet Anfragen', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const { id, joinCode } = await tisch(s, 'doppelkopf', 'on_request');
  await perCode(s, s.carla, joinCode);

  const sehen = await s.app.inject({ method: 'GET', url: `/api/tables/${id}/anfragen`, headers: s.ben.kopf });
  assert.equal(sehen.statusCode, 403);
  const entscheiden = await s.app.inject({
    method: 'POST',
    url: `/api/tables/${id}/anfragen/${s.carla.id}`,
    headers: s.ben.kopf,
    payload: { annehmen: true },
  });
  assert.equal(entscheiden.statusCode, 403);
  assert.equal(await sitzt(s, id, s.carla), false);
});

test('zurueckgezogene Anfrage steht beim Gastgeber nicht mehr', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const { id, joinCode } = await tisch(s, 'skat', 'on_request', 3);
  await perCode(s, s.ben, joinCode);
  await s.app.inject({ method: 'DELETE', url: `/api/tables/${id}/anfrage`, headers: s.ben.kopf });
  const liste = await s.app.inject({ method: 'GET', url: `/api/tables/${id}/anfragen`, headers: s.anna.kopf });
  assert.deepEqual(liste.json().anfragen, []);
});

test('oeffentliche Tische und die Partykiste lassen direkt herein', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const offen = await tisch(s, 'doppelkopf', 'public');
  const res = await s.app.inject({ method: 'POST', url: `/api/tables/${offen.id}/join`, headers: s.ben.kopf });
  assert.equal(res.json().angefragt, undefined);
  assert.equal(await sitzt(s, offen.id, s.ben), true);

  const { id, joinCode } = await tisch(s, 'partykiste', 'on_request');
  const rein = await perCode(s, s.carla, joinCode);
  assert.equal(rein.json().angefragt, undefined, rein.body);
  assert.equal(await sitzt(s, id, s.carla), true);
});
