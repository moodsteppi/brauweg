/**
 * Kontoloeschung fuer jedes Konto, auch ohne Passwort (Apple 5.1.1(v)).
 *
 * Bis zum 23.09.2026 verlangte die Loeschung das Passwort. Gaeste und Konten,
 * die nur ueber Google oder Apple hereinkamen, haben keins — sie konnten sich
 * gar nicht loeschen. Jetzt: Passwort, wo es eins gibt; sonst ein Code per
 * Mail; ohne Mail (Gast) das Wort LÖSCHEN.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { loeschWeg, wortBestaetigt } from '../src/auth/loeschen.js';
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
  const kopf = async (accountId: string) => ({
    authorization: `Bearer ${await createSession(ctx.auth, accountId)}`,
  });
  return {
    ctx,
    app,
    kopf,
    /** Ein Konto wie nach „Mit Google anmelden": Mail ja, Passwort nein. */
    async anbieterKonto(email = 'gina@example.org', displayName = 'Gina'): Promise<string> {
      const [zeile] = await ctx.db
        .insert(schema.account)
        .values({ email, emailVerifiedAt: new Date(), displayName, passwordHash: null })
        .returning({ id: schema.account.id });
      return zeile!.id;
    },
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

async function anonymisiert(s: Awaited<ReturnType<typeof setup>>, id: string): Promise<boolean> {
  const [zeile] = await s.ctx.db
    .select({ am: schema.account.anonymizedAt })
    .from(schema.account)
    .where(eq(schema.account.id, id));
  return zeile?.am != null;
}

test('der Weg richtet sich nach dem, was das Konto hat', () => {
  assert.equal(loeschWeg({ passwordHash: 'x', email: 'a@b.de' }), 'passwort');
  assert.equal(loeschWeg({ passwordHash: 'x', email: null }), 'passwort');
  assert.equal(loeschWeg({ passwordHash: null, email: 'a@b.de' }), 'code');
  assert.equal(loeschWeg({ passwordHash: null, email: null }), 'bestaetigung');
  for (const ja of ['LÖSCHEN', ' löschen ', 'LOESCHEN', 'loeschen']) assert.ok(wortBestaetigt(ja), ja);
  for (const nein of [undefined, '', 'ja', 'LOSCHEN']) assert.ok(!wortBestaetigt(nein), String(nein));
});

test('mit Passwort bleibt es beim Passwort', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await createVerifiedAccount(s.ctx, 'Anna');
  const kopf = await s.kopf(anna.accountId);

  const me = await s.app.inject({ method: 'GET', url: '/api/me', headers: kopf });
  assert.equal(me.json().loeschenPer, 'passwort');
  assert.equal(me.json().loeschPasswort, undefined, 'Hilfsfelder gehen nicht hinaus');

  const ohne = await s.app.inject({ method: 'DELETE', url: '/api/me', headers: kopf, payload: {} });
  assert.equal(ohne.statusCode, 400, 'ohne Passwort bleibt es eine kaputte Anfrage');
  const wort = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: kopf,
    payload: { bestaetigung: 'LÖSCHEN' },
  });
  assert.equal(wort.statusCode, 400, 'das Wort ersetzt kein Passwort');
  const mit = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: kopf,
    payload: { password: 'geheim-genug-1234' },
  });
  assert.equal(mit.statusCode, 200);
  assert.ok(await anonymisiert(s, anna.accountId));
});

test('ein Gast loescht sich mit dem Wort LÖSCHEN', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const gast = await s.app.inject({ method: 'POST', url: '/api/auth/gast', payload: { name: 'Gustav' } });
  assert.equal(gast.statusCode, 200, gast.body);
  const kopf = await s.kopf(gast.json().accountId);

  const me = await s.app.inject({ method: 'GET', url: '/api/me', headers: kopf });
  assert.equal(me.json().loeschenPer, 'bestaetigung');

  const falsch = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: kopf,
    payload: { bestaetigung: 'ja' },
  });
  assert.equal(falsch.statusCode, 400);
  assert.equal(falsch.json().code, 'loeschBestaetigungFehlt');

  const richtig = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: kopf,
    payload: { bestaetigung: 'löschen' },
  });
  assert.equal(richtig.statusCode, 200);
  assert.ok(await anonymisiert(s, gast.json().accountId));
});

test('ein Anbieter-Konto loescht sich mit dem Code aus der Mail — nur mit seinem eigenen', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const gina = await s.anbieterKonto();
  const kopf = await s.kopf(gina);

  const me = await s.app.inject({ method: 'GET', url: '/api/me', headers: kopf });
  assert.equal(me.json().loeschenPer, 'code');

  const anfordern = await s.app.inject({ method: 'POST', url: '/api/me/loeschcode', headers: kopf });
  assert.equal(anfordern.statusCode, 200);
  assert.equal(anfordern.json().versandt, true);
  const mail = s.ctx.mailer.sent.at(-1)!;
  assert.equal(mail.to, 'gina@example.org');
  const code = /([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(mail.text)?.[1];
  assert.ok(code, 'kein Code in der Mail');

  // Gleich danach kein zweiter: Der erste gilt weiter.
  const nochmal = await s.app.inject({ method: 'POST', url: '/api/me/loeschcode', headers: kopf });
  assert.equal(nochmal.json().versandt, false);

  // Ein anderes Konto kann mit Ginas Code nichts anfangen.
  const fremd = await s.anbieterKonto('fred@example.org', 'Fred');
  const fremdLoescht = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: await s.kopf(fremd),
    payload: { code },
  });
  assert.equal(fremdLoescht.statusCode, 401);
  assert.equal(fremdLoescht.json().code, 'loeschcodeFalsch');

  const falsch = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: kopf,
    payload: { code: 'AAAA-AAAA' },
  });
  assert.equal(falsch.statusCode, 401);

  const richtig = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: kopf,
    // Kleinschreibung und ohne Strich zaehlen wie abgetippt.
    payload: { code: code!.replace('-', '').toLowerCase() },
  });
  assert.equal(richtig.statusCode, 200, richtig.body);
  assert.ok(await anonymisiert(s, gina));
});

test('wer ein Passwort hat, bekommt keinen Loeschcode', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await createVerifiedAccount(s.ctx, 'Anna');
  const res = await s.app.inject({
    method: 'POST',
    url: '/api/me/loeschcode',
    headers: await s.kopf(anna.accountId),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 'loeschcodeUnnoetig');
});
