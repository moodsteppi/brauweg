/**
 * Ware fuer den Tisch: Szenerien kaufen und benutzen.
 *
 * Der springende Punkt ist die zweite Pruefung beim Einstellen: Eine Kennung,
 * die es gibt, ist noch keine, die mir gehoert.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { kaufen } from '../src/shop.js';
import { WAREN, besitzVon, darfBenutzen, istFrei } from '../src/tischware.js';
import { MUENZEN_JE_EDELSTEIN, inEdelsteine } from '../src/waehrung.js';
import { AppError } from '../src/errors.js';
import * as s from '../src/db/schema.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

/** Muenzen aufs Konto, damit ein Kauf ueberhaupt gehen kann. */
async function gibMuenzen(
  c: Awaited<ReturnType<typeof ctx>>,
  accountId: string,
  betrag: number,
): Promise<void> {
  await c.db.update(s.account).set({ coins: betrag }).where(eq(s.account.id, accountId));
}

test('die zehn der ersten Stunde gehoeren allen, ohne Kauf', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const eigen = await besitzVon(c.db, anna.accountId, false);
  assert.ok(eigen.has('szene-stube'));
  assert.ok(eigen.has('szene-nacht'));
  assert.ok(!eigen.has('szene-basar'), 'die neuen kosten');

  assert.equal(await darfBenutzen(c.db, anna.accountId, 'szene', 'stube', false), true);
  assert.equal(await darfBenutzen(c.db, anna.accountId, 'szene', 'basar', false), false);
});

test('kaufen bucht ab und schaltet frei', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  await gibMuenzen(c, anna.accountId, 1000);

  const kauf = await kaufen(c.db, anna.accountId, 'szene-wirtshaus');
  assert.equal(kauf.bezahlt, 250);
  assert.equal(kauf.waehrung, 'coins');
  assert.equal(kauf.stand, 750, 'der Rest steht auf dem Konto');

  assert.equal(await darfBenutzen(c.db, anna.accountId, 'szene', 'wirtshaus', false), true);

  // Zweimal kaufen geht nicht.
  await assert.rejects(
    () => kaufen(c.db, anna.accountId, 'szene-wirtshaus'),
    (e: unknown) => e instanceof AppError && e.code === 'itemAlreadyOwned',
  );
});

test('ohne Muenzen kein Kauf', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  await gibMuenzen(c, anna.accountId, 10);

  await assert.rejects(
    () => kaufen(c.db, anna.accountId, 'szene-basar'),
    (e: unknown) => e instanceof AppError && e.code === 'coinsInsufficient',
  );
  assert.equal(await darfBenutzen(c.db, anna.accountId, 'szene', 'basar', false), false);
});

test('was allen gehoert, laesst sich nicht kaufen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  await gibMuenzen(c, anna.accountId, 1000);

  await assert.rejects(
    () => kaufen(c.db, anna.accountId, 'szene-stube'),
    (e: unknown) => e instanceof AppError && e.code === 'itemAlreadyOwned',
  );
});

test('Testkonten haben alles, ohne Besitzzeile', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  await c.db.update(s.account).set({ isStaff: true }).where(eq(s.account.id, anna.accountId));

  const eigen = await besitzVon(c.db, anna.accountId, true);
  assert.equal(eigen.size, WAREN.length);
  assert.equal(await darfBenutzen(c.db, anna.accountId, 'szene', 'basar', true), true);
});

test('eine Kennung ausserhalb des Katalogs wird nicht gesperrt', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  // Blaetter stehen noch in keinem Katalog — sie duerfen deshalb nicht
  // versehentlich unbenutzbar werden.
  assert.equal(await darfBenutzen(c.db, anna.accountId, 'blatt', 'klassisch', false), true);
});

// ---------------------------------------------------------------------------
// Doppelpreis
// ---------------------------------------------------------------------------

test('jede Ware traegt beide Preise, aufgerundet nach Kurs', () => {
  // Sonst gaelte "mit Edelsteinen ist alles zu haben" fuer die halbe Auslage
  // nicht — und genau das war der Auftrag.
  for (const ware of WAREN) {
    if (istFrei(ware)) {
      assert.equal(ware.preis.coins, 0, `${ware.id} muenzfrei`);
      assert.equal(ware.preis.gems, 0, `${ware.id} edelsteinfrei`);
      continue;
    }
    assert.ok(ware.preis.coins > 0, `${ware.id} hat keinen Muenzpreis`);
    assert.ok(ware.preis.gems > 0, `${ware.id} hat keinen Edelsteinpreis`);
    assert.equal(
      ware.preis.gems,
      inEdelsteine(ware.preis.coins),
      `${ware.id} folgt nicht dem Kurs`,
    );
  }
});

test('der Edelsteinpreis ist nie billiger als der Umweg ueber den Umtausch', () => {
  // Abgerundet waere der direkte Kauf ein Rabatt, den niemand entschieden hat.
  for (const ware of WAREN) {
    if (istFrei(ware)) continue;
    assert.ok(
      ware.preis.gems * MUENZEN_JE_EDELSTEIN >= ware.preis.coins,
      `${ware.id}: ${ware.preis.gems} Edelsteine sind weniger wert als ${ware.preis.coins} Muenzen`,
    );
  }
});

test('eine Szenerie laesst sich auch mit Edelsteinen kaufen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  await c.db.update(s.account).set({ gems: 100 }).where(eq(s.account.id, anna.accountId));

  const kauf = await kaufen(c.db, anna.accountId, 'szene-wirtshaus', 'gems');
  assert.equal(kauf.waehrung, 'gems');
  assert.equal(kauf.bezahlt, inEdelsteine(250));
  assert.equal(await darfBenutzen(c.db, anna.accountId, 'szene', 'wirtshaus', false), true);
});
