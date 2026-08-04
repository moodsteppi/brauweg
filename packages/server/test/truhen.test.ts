/**
 * Truhen.
 *
 * Die drei Dinge, die hier schiefgehen koennen und deshalb gepruefte Zeilen
 * haben: zweimal oeffnen, eine Stufentruhe oeffnen, die man nicht erreicht
 * hat, und eine Tagestruhe von gestern nachholen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import {
  SPANNE,
  STUFENTRUHEN,
  heute,
  stufenTruheId,
  tagesTruheId,
  truheOeffnen,
  truhenFuer,
  wuerfeln,
} from '../src/truhen.js';
import { punkteFuerStufe } from '../src/level.js';
import { standVon } from '../src/waehrung.js';
import { AppError } from '../src/errors.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
  type TestContext,
} from './helpers.js';

async function konto(xp = 0): Promise<{ ctx: TestContext; accountId: string }> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const { accountId } = await createVerifiedAccount(ctx, 'Anna');
  if (xp > 0) {
    await ctx.db.update(schema.account).set({ xp }).where(eq(schema.account.id, accountId));
  }
  return { ctx, accountId };
}

// --- Wurf -------------------------------------------------------------------

test('Der Wurf bleibt in der Spanne, an beiden Enden einschliesslich', () => {
  for (const grad of ['holz', 'bronze', 'silber', 'gold', 'diamant'] as const) {
    const { von, bis } = SPANNE[grad];
    // Die Extreme des Zufalls: 0 trifft die Untergrenze, knapp unter 1 die
    // Obergrenze. Beide muessen erreichbar sein - eine Spanne, deren oberes
    // Ende nie faellt, ist in Wahrheit eine kuerzere Spanne.
    assert.equal(wuerfeln(grad, () => 0), von);
    assert.equal(wuerfeln(grad, () => 0.999_999), bis);

    for (let i = 0; i < 200; i++) {
      const wert = wuerfeln(grad);
      assert.ok(wert >= von && wert <= bis, `${grad}: ${wert} liegt ausserhalb ${von}..${bis}`);
      assert.equal(Number.isInteger(wert), true);
    }
  }
});

test('Die Tagestruhe gibt ein bis drei Muenzen', () => {
  assert.deepEqual(SPANNE.holz, { von: 1, bis: 3 });
});

// --- Tagestruhe -------------------------------------------------------------

test('Die Tagestruhe laesst sich einmal oeffnen und schreibt Muenzen gut', async () => {
  const { ctx, accountId } = await konto();
  try {
    const vorher = await truhenFuer(ctx.db, accountId);
    assert.equal(vorher.tag.offen, true);
    assert.equal(vorher.tag.geholt, false);
    assert.equal(vorher.tag.coins, null);

    const fund = await truheOeffnen(ctx.db, accountId, vorher.tag.id);
    assert.ok(fund.coins >= 1 && fund.coins <= 3);
    assert.equal(fund.stand, fund.coins);
    assert.equal((await standVon(ctx.db, accountId)).coins, fund.coins);

    const nachher = await truhenFuer(ctx.db, accountId);
    assert.equal(nachher.tag.offen, false);
    assert.equal(nachher.tag.geholt, true);
    // Was drin war, steht jetzt fest und wird nicht neu gewuerfelt.
    assert.equal(nachher.tag.coins, fund.coins);
  } finally {
    await ctx.close();
  }
});

test('Zweimal oeffnen gibt keine zweiten Muenzen', async () => {
  const { ctx, accountId } = await konto();
  try {
    const id = tagesTruheId(heute());
    const fund = await truheOeffnen(ctx.db, accountId, id);

    await assert.rejects(
      () => truheOeffnen(ctx.db, accountId, id),
      (err: unknown) =>
        err instanceof AppError && err.code === 'chestAlreadyOpened' && err.status === 409,
    );
    assert.equal((await standVon(ctx.db, accountId)).coins, fund.coins);
  } finally {
    await ctx.close();
  }
});

test('Eine Tagestruhe von gestern laesst sich nicht nachholen', async () => {
  const { ctx, accountId } = await konto();
  try {
    await assert.rejects(
      () => truheOeffnen(ctx.db, accountId, tagesTruheId('2020-01-01')),
      (err: unknown) => err instanceof AppError && err.code === 'chestExpired',
    );
    assert.equal((await standVon(ctx.db, accountId)).coins, 0);
  } finally {
    await ctx.close();
  }
});

// --- Stufentruhen -----------------------------------------------------------

test('Ohne die Stufe bleibt die Stufentruhe zu — und die Anzeige sagt, wie weit es noch ist', async () => {
  const { ctx, accountId } = await konto();
  try {
    const ansicht = await truhenFuer(ctx.db, accountId);
    const erste = ansicht.stufen[0]!;
    assert.equal(erste.abStufe, 2);
    assert.equal(erste.offen, false);
    // Stufe 1 mit null Punkten: bis Stufe 2 fehlt genau eine Stufe.
    assert.equal(erste.fehltStufen, 1);

    await assert.rejects(
      () => truheOeffnen(ctx.db, accountId, erste.id),
      (err: unknown) => err instanceof AppError && err.code === 'chestLocked',
    );
    assert.equal((await standVon(ctx.db, accountId)).coins, 0);
  } finally {
    await ctx.close();
  }
});

test('Mit der Stufe geht sie auf, genau einmal', async () => {
  // Punkte fuer Stufe 5 - dort steht laut Liste eine Bronzetruhe.
  const { ctx, accountId } = await konto(punkteFuerStufe(5));
  try {
    const ansicht = await truhenFuer(ctx.db, accountId);
    const bronze = ansicht.stufen.find((t) => t.abStufe === 5)!;
    assert.equal(bronze.grad, 'bronze');
    assert.equal(bronze.offen, true);
    assert.equal(bronze.fehltStufen, null);

    // Alles bis Stufe 5 ist offen, alles darueber nicht.
    for (const truhe of ansicht.stufen) {
      assert.equal(truhe.offen, truhe.abStufe! <= 5, `Stufe ${truhe.abStufe}`);
    }

    const fund = await truheOeffnen(ctx.db, accountId, bronze.id);
    assert.equal(fund.grad, 'bronze');
    assert.ok(fund.coins >= SPANNE.bronze.von && fund.coins <= SPANNE.bronze.bis);

    await assert.rejects(
      () => truheOeffnen(ctx.db, accountId, bronze.id),
      (err: unknown) => err instanceof AppError && err.code === 'chestAlreadyOpened',
    );
  } finally {
    await ctx.close();
  }
});

test('Eine erfundene Truhenkennung gibt es nicht', async () => {
  const { ctx, accountId } = await konto(punkteFuerStufe(50));
  try {
    for (const id of ['stufe-999', 'stufe-4', 'gold-truhe']) {
      await assert.rejects(
        () => truheOeffnen(ctx.db, accountId, id),
        (err: unknown) => err instanceof AppError && err.code === 'chestUnknown',
        `${id} haette abgelehnt werden muessen`,
      );
    }
    assert.equal((await standVon(ctx.db, accountId)).coins, 0);
  } finally {
    await ctx.close();
  }
});

test('Die Stufentruhen steigen im Grad und wiederholen keine Stufe', () => {
  const stufen = STUFENTRUHEN.map((t) => t.stufe);
  assert.deepEqual(stufen, [...stufen].sort((a, b) => a - b), 'nicht aufsteigend');
  assert.equal(new Set(stufen).size, stufen.length, 'eine Stufe kommt doppelt');

  const rang = ['holz', 'bronze', 'silber', 'gold', 'diamant'];
  let letzter = 0;
  for (const truhe of STUFENTRUHEN) {
    const jetzt = rang.indexOf(truhe.grad);
    assert.ok(jetzt >= letzter, `Grad faellt bei Stufe ${truhe.stufe}`);
    letzter = jetzt;
  }
});

test('Der Verlauf bleibt: eine geholte Stufentruhe zaehlt nach dem Aufstieg nicht neu', async () => {
  const { ctx, accountId } = await konto(punkteFuerStufe(3));
  try {
    await truheOeffnen(ctx.db, accountId, stufenTruheId(2));
    await ctx.db
      .update(schema.account)
      .set({ xp: punkteFuerStufe(20) })
      .where(eq(schema.account.id, accountId));

    const ansicht = await truhenFuer(ctx.db, accountId);
    const zwei = ansicht.stufen.find((t) => t.abStufe === 2)!;
    assert.equal(zwei.geholt, true);
    assert.equal(zwei.offen, false);
  } finally {
    await ctx.close();
  }
});
