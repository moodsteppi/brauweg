/**
 * Kontoeinstellungen.
 *
 * Das Kartenblatt ist reine Darstellung, aber es kommt aus dem Netz und landet
 * in der Datenbank. Geprueft wird deshalb genau das: Vorgabe stimmt, gueltige
 * Werte kommen an, ungueltige nicht, und ohne Anmeldung geht gar nichts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { CARD_DECKS, DEFAULT_CARD_DECK } from '../src/decks.js';
import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
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
  const account = await createVerifiedAccount(ctx, 'Anna');
  const token = await createSession(ctx.auth, account.accountId);
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}`;

  return {
    ctx,
    app,
    account,
    cookie,
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

test('ein neues Konto beginnt mit dem Textblatt', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const res = await s.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: s.cookie } });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().cardDeck, DEFAULT_CARD_DECK);
});

test('jedes bekannte Blatt laesst sich waehlen und kommt zurueck', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  for (const deck of CARD_DECKS) {
    const patch = await s.app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { cookie: s.cookie },
      payload: { cardDeck: deck },
    });
    assert.equal(patch.statusCode, 200, `${deck} wurde abgelehnt`);

    const me = await s.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: s.cookie } });
    assert.equal(me.json().cardDeck, deck);
  }
});

test('ein unbekanntes Blatt wird abgewiesen und aendert nichts', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  await s.app.inject({
    method: 'PATCH',
    url: '/api/me',
    headers: { cookie: s.cookie },
    payload: { cardDeck: 'klassisch' },
  });

  const res = await s.app.inject({
    method: 'PATCH',
    url: '/api/me',
    headers: { cookie: s.cookie },
    payload: { cardDeck: '../../etc/passwd' },
  });

  assert.equal(res.statusCode, 400);

  const [row] = await s.ctx.db
    .select({ cardDeck: schema.account.cardDeck })
    .from(schema.account)
    .where(eq(schema.account.id, s.account.accountId));
  assert.equal(row!.cardDeck, 'klassisch');
});

test('ohne Anmeldung laesst sich kein Blatt setzen', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const res = await s.app.inject({
    method: 'PATCH',
    url: '/api/me',
    payload: { cardDeck: 'klassisch' },
  });

  assert.equal(res.statusCode, 401);
});

/**
 * Kontoloeschung ueber die Schnittstelle.
 *
 * Der Weg dorthin ist neu (Profil-Tab), und ohne ihn lehnt Apple die App ab.
 * Geprueft wird die Passwortabfrage: Sie ist der einzige Schutz davor, dass
 * ein kurz aus der Hand gelegtes Handy genuegt, um ein Konto endgueltig zu
 * loeschen - die Sitzung selbst haelt dreissig Tage.
 */
const PASSWORD = 'geheim-genug-1234';

test('mit richtigem Passwort loescht sich das Konto und wird anonymisiert', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const res = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: { cookie: s.cookie },
    payload: { password: PASSWORD },
  });

  assert.equal(res.statusCode, 200);

  const [row] = await s.ctx.db
    .select()
    .from(schema.account)
    .where(eq(schema.account.id, s.account.accountId));

  assert.ok(row, 'die Zeile muss erhalten bleiben');
  assert.equal(row!.email, null);
  assert.equal(row!.passwordHash, null);
  assert.ok(row!.anonymizedAt);
  assert.ok(row!.displayName.startsWith('geloescht-'));
});

test('mit falschem Passwort bleibt das Konto bestehen', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const res = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: { cookie: s.cookie },
    payload: { password: 'das-ist-es-nicht' },
  });

  assert.equal(res.statusCode, 401);

  const [row] = await s.ctx.db
    .select({ email: schema.account.email, anonymizedAt: schema.account.anonymizedAt })
    .from(schema.account)
    .where(eq(schema.account.id, s.account.accountId));
  assert.equal(row!.anonymizedAt, null);
  assert.ok(row!.email, 'die Adresse muss stehenbleiben');
});

test('ohne Passwort im Rumpf wird die Loeschung abgewiesen', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const res = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: { cookie: s.cookie },
    payload: {},
  });

  assert.equal(res.statusCode, 400);

  const [row] = await s.ctx.db
    .select({ anonymizedAt: schema.account.anonymizedAt })
    .from(schema.account)
    .where(eq(schema.account.id, s.account.accountId));
  assert.equal(row!.anonymizedAt, null);
});

test('ohne Anmeldung laesst sich kein Konto loeschen', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const res = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    payload: { password: PASSWORD },
  });

  assert.equal(res.statusCode, 401);
});
