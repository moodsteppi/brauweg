/**
 * Zurufe: Besitz, Kauf und die feste Liste.
 *
 * Die Verteilung selbst haengt am Gateway und ist dort nur mit zwei echten
 * Verbindungen zu pruefen; hier steht, was davor entscheidet, ob ein Zuruf
 * ueberhaupt durchgeht.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { EMOTES, besitztEmote, istEmote } from '../src/emotes.js';
import { kaufen } from '../src/shop.js';
import { WAREN } from '../src/tischware.js';
import { AppError } from '../src/errors.js';
import * as s from '../src/db/schema.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

test('nur Kennungen aus der Liste gelten als Zuruf', () => {
  assert.equal(istEmote('grinsen'), true);
  assert.equal(istEmote('guter-stich'), true);
  assert.equal(istEmote('<script>'), false);
  assert.equal(istEmote('beleidigung'), false);
});

test('jeder Zuruf steht auch im Warenkatalog', () => {
  // Sonst gaebe es einen, den niemand kaufen kann — oder einen Preis fuer
  // etwas, das der Server gar nicht verteilt.
  const imKatalog = new Set(WAREN.filter((w) => w.art === 'emote').map((w) => w.wert));
  for (const id of EMOTES) {
    assert.ok(imKatalog.has(id), `${id} fehlt im Katalog`);
  }
  assert.equal(imKatalog.size, EMOTES.length, 'keine Ware ohne Zuruf');
});

test('zwei Zurufe sind frei, der Rest muss gekauft werden', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  assert.equal(await besitztEmote(c.db, anna.accountId, 'grinsen'), true);
  assert.equal(await besitztEmote(c.db, anna.accountId, 'gut-gespielt'), true);
  assert.equal(await besitztEmote(c.db, anna.accountId, 'prusten'), false);
});

test('gekaufter Zuruf gehoert danach', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  await c.db.update(s.account).set({ coins: 500 }).where(eq(s.account.id, anna.accountId));

  const kauf = await kaufen(c.db, anna.accountId, 'emote-prusten');
  assert.equal(kauf.bezahlt, 150);
  assert.equal(await besitztEmote(c.db, anna.accountId, 'prusten'), true);

  await assert.rejects(
    () => kaufen(c.db, anna.accountId, 'emote-prusten'),
    (e: unknown) => e instanceof AppError && e.code === 'itemAlreadyOwned',
  );
});

test('Testkonten haben jeden Zuruf', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  await c.db.update(s.account).set({ isStaff: true }).where(eq(s.account.id, anna.accountId));

  for (const id of EMOTES) {
    assert.equal(await besitztEmote(c.db, anna.accountId, id), true, id);
  }
});

test('ein Wappen laesst sich kaufen und ist dann benutzbar', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  await c.db.update(s.account).set({ coins: 1000 }).where(eq(s.account.id, anna.accountId));

  // Die acht der ersten Stunde gehoeren allen, die neuen kosten.
  await assert.rejects(
    () => kaufen(c.db, anna.accountId, 'wappen-wappen-1'),
    (e: unknown) => e instanceof AppError && e.code === 'itemAlreadyOwned',
  );

  const kauf = await kaufen(c.db, anna.accountId, 'wappen-wappen-18');
  assert.equal(kauf.bezahlt, 800);
});
