/**
 * Werbelinks `?q=<kennung>` (src/herkunft.ts).
 *
 * Festgehalten, weil jede dieser Zusagen lautlos bricht:
 *
 *   1. Besuch, Gastkonto und Runde zaehlen fuer die Kennung — und eine Runde
 *      zaehlt, ohne dass irgendwer an der Laufzeit etwas Werbliches weiss.
 *   2. Ein kaputter Werbelink sperrt niemanden aus: Das Gastkonto entsteht
 *      trotzdem, nur ohne Herkunft.
 *   3. Lesen geht NUR mit dem Schluessel. Ohne gesetzten Schluessel ist die
 *      Auswertung zu, nicht offen.
 *   4. Die Summen ueberleben das Konto: Wer sich loescht, nimmt die Kennung
 *      mit, aber keine schon gezaehlte Runde.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { wizard } from '@brauweg/game-wizard';

import { buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { anonymizeAccount, gastKonto } from '../src/auth/service.js';
import { createTable } from '../src/tables/service.js';
import {
  KENNUNGEN_JE_TAG,
  auswertung,
  besuchZaehlen,
  gastkontoZaehlen,
  normalisiereKennung,
} from '../src/herkunft.js';
import { createTestContext, schema as s, seedInvite } from './helpers.js';
import { startHarness } from './harness.js';
import { TestClient } from './client.js';

const SCHLUESSEL = 'herkunft-schluessel-lang-genug';

async function aufbau(t: { after(fn: () => unknown): void }, schluessel: string | null = SCHLUESSEL) {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const app = await buildApp({
    db: ctx.db,
    runtime: new PartyRuntime(ctx.db),
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    herkunftSchluessel: schluessel,
  });
  t.after(() => app.close());
  return { ctx, app };
}

test('Kennungen: klein geschrieben, eng gefasst', () => {
  assert.equal(normalisiereKennung(' TikTok-1 '), 'tiktok-1');
  assert.equal(normalisiereKennung('meta_a'), 'meta_a');
  assert.equal(normalisiereKennung(''), null);
  assert.equal(normalisiereKennung('-vorn'), null);
  assert.equal(normalisiereKennung('mit leerzeichen'), null);
  assert.equal(normalisiereKennung('a'.repeat(41)), null);
  assert.equal(normalisiereKennung(42), null);
});

test('Besuch und Gastkonto zaehlen fuer die Kennung, das Konto traegt sie', async (t) => {
  const { ctx, app } = await aufbau(t);

  for (let i = 0; i < 3; i++) {
    const besuch = await app.inject({
      method: 'POST',
      url: '/api/herkunft/besuch',
      payload: { kennung: 'TikTok-1' },
    });
    assert.equal(besuch.statusCode, 200);
  }
  // Unsinn bekommt dieselbe Antwort, zaehlt aber nicht.
  const unsinn = await app.inject({
    method: 'POST',
    url: '/api/herkunft/besuch',
    payload: { kennung: '<script>' },
  });
  assert.equal(unsinn.statusCode, 200);

  const gast = await app.inject({
    method: 'POST',
    url: '/api/auth/gast',
    payload: { name: 'Laufkunde', herkunft: 'tiktok-1' },
  });
  assert.equal(gast.statusCode, 200);
  const { accountId } = gast.json() as { accountId: string };
  const [konto] = await ctx.db.select().from(s.account).where(eq(s.account.id, accountId));
  assert.equal(konto?.herkunft, 'tiktok-1');

  const [summe, ...rest] = await auswertung(ctx.db);
  assert.equal(rest.length, 0, 'nur die eine gueltige Kennung');
  assert.equal(summe?.kennung, 'tiktok-1');
  assert.equal(summe?.besuche, 3);
  assert.equal(summe?.gastkonten, 1);
});

test('ein kaputter Werbelink sperrt niemanden aus', async (t) => {
  const { ctx, app } = await aufbau(t);
  const gast = await app.inject({
    method: 'POST',
    url: '/api/auth/gast',
    payload: { name: 'Laufkunde', herkunft: 'nicht gültig!' },
  });
  assert.equal(gast.statusCode, 200);
  const { accountId } = gast.json() as { accountId: string };
  const [konto] = await ctx.db.select().from(s.account).where(eq(s.account.id, accountId));
  assert.equal(konto?.herkunft, null);
  assert.deepEqual(await auswertung(ctx.db), []);

  // Ohne Feld wie bisher.
  const ohne = await app.inject({ method: 'POST', url: '/api/auth/gast', payload: { name: 'Zweiter' } });
  assert.equal(ohne.statusCode, 200);
});

test('mehr als die Tagesgrenze an neuen Kennungen wird verworfen, bekannte zaehlen weiter', async (t) => {
  const { ctx } = await aufbau(t);
  const jetzt = new Date('2026-10-20T12:00:00Z');
  for (let i = 0; i < KENNUNGEN_JE_TAG; i++) {
    assert.equal(await besuchZaehlen(ctx.db, `k${i}`, jetzt), true);
  }
  assert.equal(await besuchZaehlen(ctx.db, 'eine-zu-viel', jetzt), false);
  assert.equal(await besuchZaehlen(ctx.db, 'k0', jetzt), true, 'eine bekannte Kennung zaehlt weiter');
  assert.equal(
    await besuchZaehlen(ctx.db, 'eine-zu-viel', new Date('2026-10-21T12:00:00Z')),
    true,
    'am naechsten Tag ist wieder Platz',
  );
});

test('die Auswertung geht nur mit dem richtigen Schluessel', async (t) => {
  const { ctx, app } = await aufbau(t);
  await besuchZaehlen(ctx.db, 'meta-1', new Date('2026-10-19T10:00:00Z'));
  await besuchZaehlen(ctx.db, 'meta-1', new Date('2026-10-20T10:00:00Z'));
  await besuchZaehlen(ctx.db, 'tiktok-1', new Date('2026-10-20T10:00:00Z'));

  const ohne = await app.inject({ method: 'GET', url: '/api/herkunft/auswertung' });
  assert.equal(ohne.statusCode, 403);
  const falsch = await app.inject({
    method: 'GET',
    url: '/api/herkunft/auswertung',
    headers: { 'x-herkunft-schluessel': 'x'.repeat(SCHLUESSEL.length) },
  });
  assert.equal(falsch.statusCode, 403);

  const alles = await app.inject({
    method: 'GET',
    url: '/api/herkunft/auswertung',
    headers: { 'x-herkunft-schluessel': SCHLUESSEL },
  });
  assert.equal(alles.statusCode, 200);
  const { kennungen } = alles.json() as {
    kennungen: { kennung: string; besuche: number; tage: { tag: string }[] }[];
  };
  assert.deepEqual(
    kennungen.map((k) => [k.kennung, k.besuche, k.tage.map((tag) => tag.tag)]),
    [
      ['meta-1', 2, ['2026-10-19', '2026-10-20']],
      ['tiktok-1', 1, ['2026-10-20']],
    ],
  );

  const ab = await app.inject({
    method: 'GET',
    url: '/api/herkunft/auswertung?von=2026-10-20&kennung=META-1',
    headers: { 'x-herkunft-schluessel': SCHLUESSEL },
  });
  const gefiltert = (ab.json() as { kennungen: { kennung: string; besuche: number }[] }).kennungen;
  assert.deepEqual(gefiltert.map((k) => [k.kennung, k.besuche]), [['meta-1', 1]]);
});

test('ohne gesetzten Schluessel ist die Auswertung zu', async (t) => {
  const { app } = await aufbau(t, null);
  const antwort = await app.inject({
    method: 'GET',
    url: '/api/herkunft/auswertung',
    headers: { 'x-herkunft-schluessel': '' },
  });
  assert.equal(antwort.statusCode, 403);
});

test('ein Geworbener spielt eine Partie: Runden und Partie zaehlen, Bots nicht', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const gast = await gastKonto(h.ctx.auth, 'Geworben');
  await gastkontoZaehlen(h.ctx.db, gast.accountId, 'tiktok-1');

  const tisch = await createTable(h.ctx.db, {
    accountId: gast.accountId,
    gameId: 'wizard',
    config: wizard.defaultConfig(),
    seats: 3,
    rounds: 2,
    fillWithBots: true,
  });

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(gast.accountId), 'Geworben');
  a.join(tisch.id, 1, 'wizard');
  await a.waitFor(() => a.lastView?.finished === true, 'Partie-Ende', 60_000);
  assert.deepEqual(a.errors, []);

  const [party] = await h.ctx.db.select().from(s.party).where(eq(s.party.tableId, tisch.id));
  const abgelegt = await h.ctx.db
    .select()
    .from(s.roundSummary)
    .where(eq(s.roundSummary.partyId, party!.id));
  assert.ok(abgelegt.length > 0, 'die Partie hat Runden abgelegt');

  const [summe] = await auswertung(h.ctx.db, { kennung: 'tiktok-1' });
  assert.equal(summe?.runden, abgelegt.length, 'je abgelegte Runde eine — die Bots zaehlen nicht');
  assert.equal(summe?.partien, 1);
  assert.equal(summe?.gastkonten, 1);

  // Loeschen nimmt die Kennung vom Konto, nicht die Runden aus der Summe.
  await anonymizeAccount(h.ctx.db, gast.accountId);
  const [konto] = await h.ctx.db.select().from(s.account).where(eq(s.account.id, gast.accountId));
  assert.equal(konto?.herkunft, null);
  const [danach] = await auswertung(h.ctx.db, { kennung: 'tiktok-1' });
  assert.equal(danach?.runden, abgelegt.length);
});
