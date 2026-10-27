/**
 * Blockieren und Melden (23.09.2026, Apple 1.2).
 *
 * Die Tabellen gab es seit dem Beta-Plan, nur keinen Weg hinein. Geprueft
 * wird, was ein Nutzer davon merkt: Das Profil sagt „blockiert", eine
 * Freundschaft verschwindet und kommt nicht wieder, und eine Meldung landet
 * bei der Aufsicht — in der Liste und per Mail.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';

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
  const bert = await createVerifiedAccount(ctx, 'Bert');
  const aufsicht = await createVerifiedAccount(ctx, 'Aufsicht');
  await ctx.db
    .update(schema.account)
    .set({ isStaff: true })
    .where(eq(schema.account.id, aufsicht.accountId));
  const kopf = async (id: string) => ({ authorization: `Bearer ${await createSession(ctx.auth, id)}` });
  return {
    ctx,
    app,
    anna: { ...anna, kopf: await kopf(anna.accountId) },
    bert: { ...bert, kopf: await kopf(bert.accountId) },
    aufsicht: { ...aufsicht, kopf: await kopf(aufsicht.accountId) },
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

test('blockieren: das Profil sagt es, die Freundschaft verschwindet und kommt nicht wieder', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  // Erst befreundet ...
  await s.app.inject({ method: 'POST', url: `/api/friends/${s.bert.accountId}/request`, headers: s.anna.kopf });
  await s.app.inject({ method: 'POST', url: `/api/friends/${s.anna.accountId}/accept`, headers: s.bert.kopf });

  const block = await s.app.inject({
    method: 'POST',
    url: `/api/players/${s.bert.accountId}/block`,
    headers: s.anna.kopf,
  });
  assert.equal(block.statusCode, 200);

  const profil = await s.app.inject({
    method: 'GET',
    url: `/api/players/${s.bert.accountId}`,
    headers: s.anna.kopf,
  });
  assert.equal(profil.json().blockiert, true);
  assert.equal(profil.json().relationship, 'none');

  // Auch der Blockierte kann keine neue Anfrage stellen.
  const anfrage = await s.app.inject({
    method: 'POST',
    url: `/api/friends/${s.anna.accountId}/request`,
    headers: s.bert.kopf,
  });
  assert.equal(anfrage.statusCode, 403);
  assert.equal(anfrage.json().code, 'blockiert');

  const zurueck = await s.app.inject({
    method: 'DELETE',
    url: `/api/players/${s.bert.accountId}/block`,
    headers: s.anna.kopf,
  });
  assert.equal(zurueck.statusCode, 200);
  const danach = await s.app.inject({
    method: 'GET',
    url: `/api/players/${s.bert.accountId}`,
    headers: s.anna.kopf,
  });
  assert.equal(danach.json().blockiert, false);
});

test('sich selbst blockieren oder melden geht nicht', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const block = await s.app.inject({
    method: 'POST',
    url: `/api/players/${s.anna.accountId}/block`,
    headers: s.anna.kopf,
  });
  const melden = await s.app.inject({
    method: 'POST',
    url: `/api/players/${s.anna.accountId}/report`,
    headers: s.anna.kopf,
    payload: { grund: 'spam' },
  });
  assert.equal(block.statusCode, 400);
  assert.equal(melden.statusCode, 400);
});

test('eine Meldung landet bei der Aufsicht — in der Liste und per Mail', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const unbekannt = await s.app.inject({
    method: 'POST',
    url: `/api/players/${s.bert.accountId}/report`,
    headers: s.anna.kopf,
    payload: { grund: 'weil' },
  });
  assert.equal(unbekannt.statusCode, 400, 'nur Gruende aus der Liste');

  const meldung = await s.app.inject({
    method: 'POST',
    url: `/api/players/${s.bert.accountId}/report`,
    headers: s.anna.kopf,
    payload: { grund: 'beleidigung', text: 'im Chat ausfallend' },
  });
  assert.equal(meldung.statusCode, 201);

  const mail = s.ctx.mailer.sent.find((m) => m.to === s.aufsicht.email && m.subject.includes('Meldung'));
  assert.ok(mail, 'keine Mail an die Aufsicht');
  assert.match(mail.subject, /Bert/);
  assert.match(mail.text, /beleidigung/);

  const liste = await s.app.inject({
    method: 'GET',
    url: '/api/aufsicht/meldungen',
    headers: s.aufsicht.kopf,
  });
  assert.equal(liste.statusCode, 200);
  const [erste] = liste.json();
  assert.equal(erste.melder, 'Anna');
  assert.equal(erste.ziel, 'Bert');
  assert.equal(erste.grund, 'beleidigung');
  assert.equal(erste.text, 'im Chat ausfallend');

  const fremd = await s.app.inject({
    method: 'GET',
    url: '/api/aufsicht/meldungen',
    headers: s.anna.kopf,
  });
  assert.equal(fremd.statusCode, 403);
});
