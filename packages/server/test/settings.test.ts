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

test('ein neues Konto beginnt bei jedem Spiel mit dem Textblatt', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const res = await s.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: s.cookie } });

  assert.equal(res.statusCode, 200);
  // Alle bekannten Spiele stehen drin, auch die noch nicht spielbaren:
  // Sonst muesste der Client die Vorgaben ein zweites Mal pflegen.
  const themes = res.json().themes;
  assert.ok(themes.doppelkopf, 'Doppelkopf fehlt');
  assert.ok(themes.skat, 'Skat fehlt, obwohl es die Kennung gibt');
  assert.equal(themes.doppelkopf.cardDeck, DEFAULT_CARD_DECK);
});

test('jedes bekannte Blatt laesst sich waehlen und kommt zurueck', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  for (const deck of CARD_DECKS) {
    const patch = await s.app.inject({
      method: 'PATCH',
      url: '/api/me/themes/doppelkopf',
      headers: { cookie: s.cookie },
      payload: { cardDeck: deck },
    });
    assert.equal(patch.statusCode, 200, `${deck} wurde abgelehnt`);

    const me = await s.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: s.cookie } });
    assert.equal(me.json().themes.doppelkopf.cardDeck, deck);
  }
});

test('die Spiele halten ihr Blatt auseinander', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  await s.app.inject({
    method: 'PATCH',
    url: '/api/me/themes/doppelkopf',
    headers: { cookie: s.cookie },
    payload: { cardDeck: 'klassisch' },
  });
  // Auch ein noch nicht spielbares Spiel darf eingestellt werden - es kostet
  // nichts und geht nicht verloren.
  await s.app.inject({
    method: 'PATCH',
    url: '/api/me/themes/skat',
    headers: { cookie: s.cookie },
    payload: { cardDeck: 'minimal4' },
  });

  const themes = (
    await s.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: s.cookie } })
  ).json().themes;
  assert.equal(themes.doppelkopf.cardDeck, 'klassisch');
  assert.equal(themes.skat.cardDeck, 'minimal4');
  // Unberuehrte Spiele bleiben auf der Vorgabe.
  assert.equal(themes.maumau.cardDeck, DEFAULT_CARD_DECK);
});

test('ein unbekanntes Blatt wird abgewiesen und aendert nichts', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  await s.app.inject({
    method: 'PATCH',
    url: '/api/me/themes/doppelkopf',
    headers: { cookie: s.cookie },
    payload: { cardDeck: 'klassisch' },
  });

  const res = await s.app.inject({
    method: 'PATCH',
    url: '/api/me/themes/doppelkopf',
    headers: { cookie: s.cookie },
    payload: { cardDeck: '../../etc/passwd' },
  });

  assert.equal(res.statusCode, 400);

  const [row] = await s.ctx.db
    .select({ cardDeck: schema.accountGameTheme.cardDeck })
    .from(schema.accountGameTheme)
    .where(eq(schema.accountGameTheme.accountId, s.account.accountId));
  assert.equal(row!.cardDeck, 'klassisch');
});

test('ein unbekanntes Spiel wird abgewiesen', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const res = await s.app.inject({
    method: 'PATCH',
    url: '/api/me/themes/schachnochwas',
    headers: { cookie: s.cookie },
    payload: { cardDeck: 'klassisch' },
  });

  assert.equal(res.statusCode, 404);
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
