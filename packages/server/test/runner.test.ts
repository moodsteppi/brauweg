/**
 * Pro-Subway: Laufmeldung und Tagesliste.
 *
 * Geprüft wird der eine Aufruf am Lebensende des Laufs — denn dort hängen
 * drei Dinge aneinander, die zusammen stimmen müssen: Münzen (mit Kappen),
 * Tagesaufgaben und der Tagesbestwert. Und die Liste, die daraus entsteht.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import {
  RUNNER_MAX_PRO_LAUF,
  RUNNER_MAX_PRO_TAG,
  runnerLauf,
  runnerRangliste,
} from '../src/runner.js';
import { heute } from '../src/truhen.js';
import { AppError } from '../src/errors.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
  type TestContext,
} from './helpers.js';

async function konto(name = 'Anna'): Promise<{ ctx: TestContext; accountId: string }> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const { accountId } = await createVerifiedAccount(ctx, name);
  return { ctx, accountId };
}

test('ein Lauf schreibt Muenzen gut und kappt pro Lauf', async () => {
  const { ctx, accountId } = await konto();
  try {
    const r = await runnerLauf(ctx.db, accountId, { muenzen: 7, punkte: 250, meter: 180 });
    assert.equal(r.gutgeschrieben, 7);

    // Weit ueber der Laufkappe gemeldet — es bleibt bei RUNNER_MAX_PRO_LAUF.
    const r2 = await runnerLauf(ctx.db, accountId, { muenzen: 400, punkte: 900, meter: 500 });
    assert.equal(r2.gutgeschrieben, RUNNER_MAX_PRO_LAUF);
  } finally {
    await ctx.close();
  }
});

test('die Tageskappe haelt ueber mehrere Laeufe', async () => {
  const { ctx, accountId } = await konto();
  try {
    let gesamt = 0;
    for (let i = 0; i < 4; i++) {
      const r = await runnerLauf(ctx.db, accountId, { muenzen: 20, punkte: 100, meter: 80 });
      gesamt += r.gutgeschrieben;
    }
    assert.equal(gesamt, RUNNER_MAX_PRO_TAG);
  } finally {
    await ctx.close();
  }
});

test('ein Lauf rueckt die beiden Runner-Aufgaben vor — auch mit 0 Muenzen die Lauf-Aufgabe', async () => {
  const { ctx, accountId } = await konto();
  try {
    await runnerLauf(ctx.db, accountId, { muenzen: 0, punkte: 40, meter: 40 });

    const zeilen = await ctx.db
      .select()
      .from(schema.questProgress)
      .where(
        and(eq(schema.questProgress.accountId, accountId), eq(schema.questProgress.day, heute())),
      );
    const je = new Map(zeilen.map((z) => [z.questId, z.progress]));
    assert.equal(je.get('pro-subway-laufen'), 1);
    // 0 Muenzen: keine Zeile oder 0 — beides heisst "nichts vorgerueckt".
    assert.equal(je.get('pro-subway-muenzen') ?? 0, 0);

    await runnerLauf(ctx.db, accountId, { muenzen: 9, punkte: 200, meter: 110 });
    const danach = await ctx.db
      .select()
      .from(schema.questProgress)
      .where(
        and(eq(schema.questProgress.accountId, accountId), eq(schema.questProgress.day, heute())),
      );
    const je2 = new Map(danach.map((z) => [z.questId, z.progress]));
    assert.equal(je2.get('pro-subway-muenzen'), 9);

    // Deckel: 9 + 20 laege ueber dem Ziel 15 — es bleibt beim Ziel.
    await runnerLauf(ctx.db, accountId, { muenzen: 20, punkte: 300, meter: 100 });
    const zuletzt = await ctx.db
      .select()
      .from(schema.questProgress)
      .where(
        and(
          eq(schema.questProgress.accountId, accountId),
          eq(schema.questProgress.questId, 'pro-subway-muenzen'),
        ),
      );
    assert.equal(zuletzt[0]?.progress, 15);
  } finally {
    await ctx.close();
  }
});

test('der Tagesbestwert gehoert zum besten Lauf — kein Flickenteppich aus Maxima', async () => {
  const { ctx, accountId } = await konto();
  try {
    await runnerLauf(ctx.db, accountId, { muenzen: 3, punkte: 300, meter: 270 });
    // Schlechterer Lauf mit MEHR Muenzen: darf den Bestwert nicht anfassen.
    await runnerLauf(ctx.db, accountId, { muenzen: 12, punkte: 200, meter: 80 });

    const [best] = await ctx.db
      .select()
      .from(schema.runnerBest)
      .where(eq(schema.runnerBest.accountId, accountId));
    assert.equal(best?.punkte, 300);
    assert.equal(best?.meter, 270);
    assert.equal(best?.muenzen, 3);

    // Besserer Lauf ersetzt alle drei Spalten zusammen.
    await runnerLauf(ctx.db, accountId, { muenzen: 5, punkte: 450, meter: 400 });
    const [neu] = await ctx.db
      .select()
      .from(schema.runnerBest)
      .where(eq(schema.runnerBest.accountId, accountId));
    assert.equal(neu?.punkte, 450);
    assert.equal(neu?.meter, 400);
    assert.equal(neu?.muenzen, 5);
  } finally {
    await ctx.close();
  }
});

test('die Tagesliste sortiert nach Punkten und kennt den eigenen Platz', async () => {
  const ctx = await createTestContext();
  try {
    await seedInvite(ctx.db);
    const anna = (await createVerifiedAccount(ctx, 'Anna')).accountId;
    const bert = (await createVerifiedAccount(ctx, 'Bert')).accountId;
    const cleo = (await createVerifiedAccount(ctx, 'Cleo')).accountId;

    await runnerLauf(ctx.db, anna, { muenzen: 2, punkte: 150, meter: 130 });
    await runnerLauf(ctx.db, bert, { muenzen: 8, punkte: 500, meter: 420 });
    await runnerLauf(ctx.db, cleo, { muenzen: 4, punkte: 300, meter: 260 });

    const liste = await runnerRangliste(ctx.db, anna);
    assert.deepEqual(
      liste.eintraege.map((e) => [e.rang, e.displayName, e.punkte, e.du]),
      [
        [1, 'Bert', 500, false],
        [2, 'Cleo', 300, false],
        [3, 'Anna', 150, true],
      ],
    );
    assert.equal(liste.rang, 3);
    assert.equal(liste.punkte, 150);

    // Der Rang aus der Laufmeldung stimmt mit der Liste ueberein.
    const r = await runnerLauf(ctx.db, anna, { muenzen: 1, punkte: 600, meter: 580 });
    assert.equal(r.rangHeute, 1);
  } finally {
    await ctx.close();
  }
});

test('erfundene Punkte prallen ab', async () => {
  const { ctx, accountId } = await konto();
  try {
    await assert.rejects(
      () => runnerLauf(ctx.db, accountId, { muenzen: 0, punkte: 999_999_999, meter: 10 }),
      (e: unknown) => e instanceof AppError,
    );
  } finally {
    await ctx.close();
  }
});
