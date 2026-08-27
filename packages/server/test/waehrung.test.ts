/**
 * Die zwei Waehrungen.
 *
 * Geprueft wird vor allem, was NICHT passieren darf: kein negativer Stand,
 * kein zweites Abbuchen, kein Ueberlauf. Die Deckungspruefung steht in der
 * WHERE-Klausel — dass sie dort wirkt und nicht nur davor, ist der Kern
 * dieser Datei.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import {
  OBERGRENZE,
  STAFF_STAND,
  abbuchen,
  gutschreiben,
  sichtbarerStand,
  standVon,
} from '../src/waehrung.js';
import { AppError } from '../src/errors.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
  type TestContext,
} from './helpers.js';

async function konto(): Promise<{ ctx: TestContext; accountId: string }> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const { accountId } = await createVerifiedAccount(ctx, 'Anna');
  return { ctx, accountId };
}

test('Ein neues Konto hat null Muenzen und null Edelsteine', async () => {
  const { ctx, accountId } = await konto();
  try {
    assert.deepEqual(await standVon(ctx.db, accountId), { coins: 0, gems: 0, broJetons: 1000 });
  } finally {
    await ctx.close();
  }
});

test('Gutschreiben und Abbuchen fuehren beide Waehrungen getrennt', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 100);
    await gutschreiben(ctx.db, accountId, 'gems', 7);
    assert.deepEqual(await standVon(ctx.db, accountId), { coins: 100, gems: 7, broJetons: 1000 });

    await abbuchen(ctx.db, accountId, 'coins', 40);
    assert.deepEqual(await standVon(ctx.db, accountId), { coins: 60, gems: 7, broJetons: 1000 });

    // Muenzen abbuchen darf Edelsteine nie beruehren - es gibt keinen Kurs.
    await abbuchen(ctx.db, accountId, 'gems', 7);
    assert.deepEqual(await standVon(ctx.db, accountId), { coins: 60, gems: 0, broJetons: 1000 });
  } finally {
    await ctx.close();
  }
});

test('Abbuchen ohne Deckung schlaegt fehl und laesst den Stand unberuehrt', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 30);

    await assert.rejects(
      () => abbuchen(ctx.db, accountId, 'coins', 31),
      (err: unknown) =>
        err instanceof AppError && err.code === 'coinsInsufficient' && err.status === 409,
    );
    // Der Fehlversuch darf nichts angefasst haben.
    assert.equal((await standVon(ctx.db, accountId)).coins, 30);

    // Genau der Stand geht noch, auf null.
    assert.equal(await abbuchen(ctx.db, accountId, 'coins', 30), 0);
  } finally {
    await ctx.close();
  }
});

test('Edelsteine melden ihren eigenen Fehlerschluessel', async () => {
  const { ctx, accountId } = await konto();
  try {
    await assert.rejects(
      () => abbuchen(ctx.db, accountId, 'gems', 1),
      (err: unknown) => err instanceof AppError && err.code === 'gemsInsufficient',
    );
  } finally {
    await ctx.close();
  }
});

test('Abbuchen von 0 geht immer und aendert nichts', async () => {
  const { ctx, accountId } = await konto();
  try {
    assert.equal(await abbuchen(ctx.db, accountId, 'coins', 0), 0);
    assert.equal((await standVon(ctx.db, accountId)).coins, 0);
  } finally {
    await ctx.close();
  }
});

test('Eine Gutschrift laeuft nicht ueber die Obergrenze hinaus', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', OBERGRENZE);
    // Ohne Deckel wuerde die naechste Gutschrift den integer-Bereich
    // verlassen und die Anweisung abbrechen.
    const stand = await gutschreiben(ctx.db, accountId, 'coins', 1_000);
    assert.equal(stand, OBERGRENZE);
  } finally {
    await ctx.close();
  }
});

test('Eine Gutschrift mit Betrag 0 oder negativ ist ein Fehler, keine Abbuchung', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 50);
    for (const betrag of [0, -10]) {
      await assert.rejects(
        () => gutschreiben(ctx.db, accountId, 'coins', betrag),
        (err: unknown) => err instanceof AppError && err.status === 400,
      );
    }
    assert.equal((await standVon(ctx.db, accountId)).coins, 50);
  } finally {
    await ctx.close();
  }
});

test('Ein Testkonto zahlt nicht und sein Stand schrumpft nicht', async () => {
  const { ctx, accountId } = await konto();
  try {
    await ctx.db
      .update(schema.account)
      .set({ isStaff: true })
      .where(eq(schema.account.id, accountId));

    assert.deepEqual(await standVon(ctx.db, accountId), {
      coins: STAFF_STAND,
      gems: STAFF_STAND,
      broJetons: STAFF_STAND,
    });

    // Abbuchen meldet Erfolg, aber die Spalte bleibt bei null: Der Stand soll
    // nicht nach hundert Kaeufen doch leer sein.
    assert.equal(await abbuchen(ctx.db, accountId, 'gems', 5_000), STAFF_STAND);
    const [zeile] = await ctx.db
      .select({ coins: schema.account.coins, gems: schema.account.gems })
      .from(schema.account)
      .where(eq(schema.account.id, accountId));
    assert.deepEqual(zeile, { coins: 0, gems: 0 });

    // Und eine Gutschrift meldet denselben Festwert wie /api/me — nicht den
    // Spaltenwert. Sonst sagte eine geoeffnete Truhe "Stand: 2", waehrend die
    // Kopfzeile 9.999.999 zeigt.
    assert.equal(await gutschreiben(ctx.db, accountId, 'coins', 2), STAFF_STAND);
  } finally {
    await ctx.close();
  }
});

test('sichtbarerStand rechnet ohne zweite Abfrage dasselbe', () => {
  assert.deepEqual(
    sichtbarerStand({ coins: 12, gems: 3, broJetons: 9, premiumUntil: null, isStaff: false }),
    { coins: 12, gems: 3, broJetons: 9 },
  );
  assert.deepEqual(
    sichtbarerStand({ coins: 12, gems: 3, broJetons: 9, premiumUntil: null, isStaff: true }),
    { coins: STAFF_STAND, gems: STAFF_STAND, broJetons: STAFF_STAND },
  );
});

test('BroJetons sind ein eigenes Guthaben und haben einen eigenen Fehlerschluessel', async () => {
  const { ctx, accountId } = await konto();
  try {
    assert.equal((await standVon(ctx.db, accountId)).broJetons, 1000);
    await abbuchen(ctx.db, accountId, 'broJetons', 200);
    assert.equal((await standVon(ctx.db, accountId)).broJetons, 800);
    await assert.rejects(
      () => abbuchen(ctx.db, accountId, 'broJetons', 801),
      (err: unknown) =>
        err instanceof AppError && err.code === 'broJetonsInsufficient' && err.status === 409,
    );
    assert.equal((await standVon(ctx.db, accountId)).coins, 0);
  } finally {
    await ctx.close();
  }
});
