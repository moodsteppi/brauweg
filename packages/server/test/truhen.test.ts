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
  KAUFTRUHEN,
  SPANNE,
  STUFENTRUHEN,
  heute,
  stufenTruheId,
  tagesTruheId,
  truheKaufen,
  truheOeffnen,
  truhenFuer,
  wuerfeln,
  wuerfelnIn,
} from '../src/truhen.js';
import { punkteFuerStufe } from '../src/level.js';
import { gutschreiben, standVon } from '../src/waehrung.js';
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

// --- Kauftruhen -------------------------------------------------------------

test('Der Wurf einer Kauftruhe bleibt in ihrer eigenen Spanne', () => {
  for (const truhe of KAUFTRUHEN) {
    assert.equal(wuerfelnIn(truhe, () => 0), truhe.von);
    assert.equal(wuerfelnIn(truhe, () => 0.999_999), truhe.bis);
    // Die Kauftruhen tragen dieselben Grade wie die Stufentruhen, schuetten aber
    // ein Vielfaches aus. Genau deshalb haengt ihre Spanne an ihnen selbst und
    // nicht an SPANNE[grad] - dieser Test ist der Riegel dagegen, dass das
    // wieder zusammengelegt wird.
    assert.ok(
      truhe.von > SPANNE[truhe.grad].bis,
      `${truhe.id}: schuettet nicht mehr aus als die Stufentruhe desselben Grades`,
    );
  }
});

test('Eine Kauftruhe kostet Edelsteine, schuettet Muenzen aus und laesst sich wiederholen', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'gems', 60);
    const truhe = KAUFTRUHEN.find((t) => t.id === 'truhe-silber')!;

    const erster = await truheKaufen(ctx.db, accountId, truhe.id);
    assert.equal(erster.truheId, 'truhe-silber');
    assert.equal(erster.grad, 'silber');
    assert.equal(erster.bezahlt, truhe.gems);
    assert.ok(erster.coins >= truhe.von && erster.coins <= truhe.bis);
    assert.equal(erster.stand.gems, 60 - truhe.gems);
    assert.equal(erster.stand.coins, erster.coins);

    // Zweimal kaufen muss gehen — eine Kauftruhe ist kein Fund, der sich
    // erschoepft. Und die Kennungen muessen sich unterscheiden, sonst sperrt
    // der Primaerschluessel den zweiten Kauf.
    const zweiter = await truheKaufen(ctx.db, accountId, truhe.id);
    assert.notEqual(zweiter.chestId, erster.chestId);
    assert.equal(zweiter.stand.coins, erster.coins + zweiter.coins);
    assert.equal(zweiter.stand.gems, 60 - 2 * truhe.gems);
  } finally {
    await ctx.close();
  }
});

test('Ohne Edelsteine keine Truhe — und kein Wurf', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'gems', 24);

    await assert.rejects(
      () => truheKaufen(ctx.db, accountId, 'truhe-silber'),
      (err: unknown) => err instanceof AppError && err.code === 'gemsInsufficient',
    );

    assert.deepEqual(await standVon(ctx.db, accountId), { coins: 0, gems: 24 });
    const zeilen = await ctx.db
      .select({ chestId: schema.chestClaim.chestId })
      .from(schema.chestClaim)
      .where(eq(schema.chestClaim.accountId, accountId));
    assert.equal(zeilen.length, 0, 'ein gescheiterter Kauf darf keine Truhe eintragen');
  } finally {
    await ctx.close();
  }
});

/**
 * Der Riegel, ohne den derselbe Fund zweimal zaehlen wuerde.
 *
 * Die Kaufantwort nennt die Kennung. Ohne diese Sperre waere sie an
 * `/chests/:id/open` weitergegeben der Weg, den Wurf ein zweites Mal
 * gutzuschreiben.
 */
test('Eine gekaufte Truhe laesst sich nicht noch einmal oeffnen', async () => {
  const { ctx, accountId } = await konto(punkteFuerStufe(50));
  try {
    await gutschreiben(ctx.db, accountId, 'gems', 25);
    const kauf = await truheKaufen(ctx.db, accountId, 'truhe-silber');
    const nachKauf = await standVon(ctx.db, accountId);

    await assert.rejects(
      () => truheOeffnen(ctx.db, accountId, kauf.chestId),
      (err: unknown) => err instanceof AppError && err.code === 'chestUnknown',
    );
    // Auch eine frei erfundene Kaufkennung darf nichts ausschuetten.
    await assert.rejects(
      () => truheOeffnen(ctx.db, accountId, 'kauf-egal'),
      (err: unknown) => err instanceof AppError && err.code === 'chestUnknown',
    );

    assert.deepEqual(await standVon(ctx.db, accountId), nachKauf);
  } finally {
    await ctx.close();
  }
});

test('Eine Kauftruhe steht nicht in der Truhenansicht und nicht im Bereitschaftspunkt', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'gems', 25);
    await truheKaufen(ctx.db, accountId, 'truhe-silber');

    // Gekauft ist geoeffnet: Sie wartet auf nichts, also taucht sie auch
    // nirgends als offene Truhe auf.
    const ansicht = await truhenFuer(ctx.db, accountId);
    assert.equal(ansicht.tag.geholt, false, 'die Tagestruhe bleibt unberuehrt');
    assert.equal(
      ansicht.stufen.some((t) => t.geholt),
      false,
      'keine Stufentruhe darf durch einen Kauf als geholt gelten',
    );
  } finally {
    await ctx.close();
  }
});

test('Eine erfundene Kauftruhe gibt es nicht', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'gems', 10_000);
    for (const id of ['truhe-holz', 'truhe-platin', 'stufe-5']) {
      await assert.rejects(
        () => truheKaufen(ctx.db, accountId, id),
        (err: unknown) => err instanceof AppError && err.code === 'chestUnknown',
        `${id} haette abgelehnt werden muessen`,
      );
    }
    assert.deepEqual(await standVon(ctx.db, accountId), { coins: 0, gems: 10_000 });
  } finally {
    await ctx.close();
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
