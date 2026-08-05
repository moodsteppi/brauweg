/**
 * Testkonten.
 *
 * Sie haengen am Konto, nicht an der Umgebung: auf staging fuer alle, die dort
 * ausprobieren, in der Produktion hoechstens fuer das Demokonto der
 * App-Store-Pruefung. Gesetzt wird ausschliesslich ueber STAFF_EMAILS beim
 * Start - es gibt bewusst keinen Endpunkt dafuer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { STAFF_COINS, coinsFor, entitlementsFor } from '../src/entitlements.js';
import { applyStaffEmails, parseStaffEmails } from '../src/staff.js';
import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession, register, verifyEmail } from '../src/auth/service.js';
import {
  INVITE,
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
} from './helpers.js';

// --- Rechte -----------------------------------------------------------------

test('Ein gewoehnliches Konto ohne Premium darf nichts Besonderes', () => {
  const rechte = entitlementsFor({ premiumUntil: null, isStaff: false });
  assert.deepEqual(rechte, {
    premium: false,
    unlimitedCoins: false,
    ownsEverything: false,
    staff: false,
  });
});

test('Premium gilt bis zum Ablauf, danach nicht mehr', () => {
  const jetzt = new Date('2026-08-04T12:00:00Z');
  const morgen = new Date('2026-08-05T12:00:00Z');
  const gestern = new Date('2026-08-03T12:00:00Z');

  assert.equal(entitlementsFor({ premiumUntil: morgen, isStaff: false }, jetzt).premium, true);
  assert.equal(entitlementsFor({ premiumUntil: gestern, isStaff: false }, jetzt).premium, false);
  // Auch als Zeichenkette, so kommt es aus der Datenbank durch JSON zurueck.
  assert.equal(
    entitlementsFor({ premiumUntil: morgen.toISOString(), isStaff: false }, jetzt).premium,
    true,
  );
});

test('Ein Testkonto hat alles, auch ohne Premium-Datum', () => {
  const rechte = entitlementsFor({ premiumUntil: null, isStaff: true });
  assert.deepEqual(rechte, {
    premium: true,
    unlimitedCoins: true,
    ownsEverything: true,
    staff: true,
  });
});

test('Ein Testkonto zeigt einen vollen Muenzstand', () => {
  assert.equal(coinsFor({ premiumUntil: null, isStaff: true, coins: 0 }), STAFF_COINS);
  assert.equal(coinsFor({ premiumUntil: null, isStaff: false, coins: 7 }), 7);
});

// --- Liste aus der Umgebung -------------------------------------------------

test('Die Liste wird geglaettet: Leerzeichen, Grossschreibung, Doppelte', () => {
  assert.deepEqual(parseStaffEmails(' Anna@Example.org , bert@example.org,anna@example.org '), [
    'anna@example.org',
    'bert@example.org',
  ]);
  assert.deepEqual(parseStaffEmails(''), []);
  assert.deepEqual(parseStaffEmails(undefined), []);
  assert.deepEqual(parseStaffEmails(',,'), []);
});

test('STAFF_EMAILS setzt das Merkmal, und zwar unabhaengig von Gross- und Kleinschreibung', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  await createVerifiedAccount(ctx, 'Bert');

  const ergebnis = await applyStaffEmails(ctx.db, parseStaffEmails('ANNA@example.org'));
  assert.deepEqual(ergebnis.gesetzt, ['anna@example.org']);
  assert.deepEqual(ergebnis.unbekannt, []);

  const [konto] = await ctx.db
    .select({ isStaff: schema.account.isStaff })
    .from(schema.account)
    .where(eq(schema.account.id, anna.accountId));
  assert.equal(konto!.isStaff, true);

  const alle = await ctx.db.select({ isStaff: schema.account.isStaff }).from(schema.account);
  assert.equal(alle.filter((z) => z.isStaff).length, 1, 'nur das gelistete Konto');
});

test('Wer von der Liste genommen wird, verliert das Merkmal beim naechsten Start', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  await createVerifiedAccount(ctx, 'Anna');
  await createVerifiedAccount(ctx, 'Bert');

  await applyStaffEmails(ctx.db, ['anna@example.org', 'bert@example.org']);
  const danach = await applyStaffEmails(ctx.db, ['anna@example.org']);

  assert.deepEqual(danach.entzogen, ['bert@example.org']);
  const alle = await ctx.db
    .select({ email: schema.account.email, isStaff: schema.account.isStaff })
    .from(schema.account);
  assert.deepEqual(
    alle.filter((z) => z.isStaff).map((z) => z.email),
    ['anna@example.org'],
  );
});

test('Eine leere Liste nimmt allen das Merkmal', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  await createVerifiedAccount(ctx, 'Anna');

  await applyStaffEmails(ctx.db, ['anna@example.org']);
  await applyStaffEmails(ctx.db, []);

  const alle = await ctx.db.select({ isStaff: schema.account.isStaff }).from(schema.account);
  assert.equal(alle.filter((z) => z.isStaff).length, 0);
});

test('Zweimal angewandt aendert sich beim zweiten Mal nichts', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  await createVerifiedAccount(ctx, 'Anna');

  await applyStaffEmails(ctx.db, ['anna@example.org']);
  const zweitesMal = await applyStaffEmails(ctx.db, ['anna@example.org']);
  assert.deepEqual(zweitesMal.entzogen, []);
  assert.deepEqual(zweitesMal.gesetzt, ['anna@example.org']);
});

test('Eine Adresse ohne Konto wird gemeldet, nicht angelegt', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);

  const ergebnis = await applyStaffEmails(ctx.db, ['niemand@example.org']);
  assert.deepEqual(ergebnis.unbekannt, ['niemand@example.org']);
  assert.deepEqual(ergebnis.unbestaetigt, []);
  const alle = await ctx.db.select({ id: schema.account.id }).from(schema.account);
  assert.equal(alle.length, 0);
});

test('Ein Konto mit unbestaetigter Adresse bekommt das Merkmal NICHT', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);

  // Registriert, aber den Bestaetigungslink nie angetippt. Genau so saehe der
  // Versuch aus, sich mit einer Adresse aus der Liste Rechte zu erschleichen.
  await register(ctx.auth, {
    email: 'fremd@example.org',
    password: 'geheim-genug-1234',
    displayName: 'Fremd',
    inviteCode: INVITE,
    birthday: '1990-06-15',
  });

  const ergebnis = await applyStaffEmails(ctx.db, ['fremd@example.org']);
  assert.deepEqual(ergebnis.gesetzt, []);
  assert.deepEqual(ergebnis.unbestaetigt, ['fremd@example.org']);
  assert.deepEqual(ergebnis.unbekannt, [], 'ein Konto gibt es ja - nur unbestaetigt');

  const alle = await ctx.db.select({ isStaff: schema.account.isStaff }).from(schema.account);
  assert.equal(alle.filter((z) => z.isStaff).length, 0);
});

test('Nach der Bestaetigung greift die Liste beim naechsten Start', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);

  await register(ctx.auth, {
    email: 'spaet@example.org',
    password: 'geheim-genug-1234',
    displayName: 'Spaet',
    inviteCode: INVITE,
    birthday: '1990-06-15',
  });
  assert.deepEqual((await applyStaffEmails(ctx.db, ['spaet@example.org'])).gesetzt, []);

  await verifyEmail(ctx.db, ctx.mailer.tokenFrom('spaet@example.org'));

  assert.deepEqual((await applyStaffEmails(ctx.db, ['spaet@example.org'])).gesetzt, [
    'spaet@example.org',
  ]);
});

// --- Was der Client sieht ---------------------------------------------------

async function meFuer(ctx: Awaited<ReturnType<typeof createTestContext>>, accountId: string, stage?: 'staging') {
  const app = await buildApp({
    db: ctx.db,
    runtime: new PartyRuntime(ctx.db),
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    stage,
  });
  const token = await createSession(ctx.auth, accountId);
  const antwort = await app.inject({
    method: 'GET',
    url: '/api/me',
    cookies: { [SESSION_COOKIE]: token },
  });
  await app.close();
  return antwort.json();
}

test('/api/me nennt Rechte und Ausgabe', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');

  const gewoehnlich = await meFuer(ctx, anna.accountId);
  assert.equal(gewoehnlich.entitlements.staff, false);
  assert.equal(gewoehnlich.entitlements.premium, false);
  assert.equal(gewoehnlich.coins, 0);
  assert.equal(gewoehnlich.stage, 'production', 'ohne Angabe gilt die Produktion');

  await applyStaffEmails(ctx.db, ['anna@example.org']);

  const testkonto = await meFuer(ctx, anna.accountId, 'staging');
  assert.equal(testkonto.entitlements.staff, true);
  assert.equal(testkonto.entitlements.premium, true);
  assert.equal(testkonto.entitlements.ownsEverything, true);
  assert.equal(testkonto.coins, STAFF_COINS);
  assert.equal(testkonto.stage, 'staging');
  // Das Merkmal selbst geht nicht mit raus - der Client soll die Rechte lesen,
  // nicht die Herkunft.
  assert.equal(testkonto.isStaff, undefined);
});
