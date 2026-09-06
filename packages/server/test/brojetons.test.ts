/**
 * BroJetons am Pokertisch: Einzug beim Start, Auszahlung am Ende.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { easypoker } from '@brauweg/game-easypoker';

import { AppError } from '../src/errors.js';
import { zahleAus, zieheEinsatz } from '../src/brojetons.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { standVon, abbuchen } from '../src/waehrung.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
} from './helpers.js';

const CONFIG = easypoker.defaultConfig();

test('Ohne genug BroJetons geht kein Chip-Tisch auf', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const { accountId } = await createVerifiedAccount(ctx, 'Anna');
  await abbuchen(ctx.db, accountId, 'broJetons', 1000);

  await assert.rejects(
    () =>
      createTable(ctx.db, {
        accountId,
        gameId: 'easypoker',
        config: CONFIG,
        seats: 2,
        rounds: 4,
        fillWithBots: true,
      }),
    (err: unknown) => err instanceof AppError && err.code === 'broJetonsInsufficient',
  );
});

test('Beitreten ohne Stapel wird abgewiesen, der Platz bleibt frei', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const bert = await createVerifiedAccount(ctx, 'Bert');
  await abbuchen(ctx.db, bert.accountId, 'broJetons', 1000);

  const table = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'easypoker',
    config: CONFIG,
    seats: 2,
    rounds: 4,
  });

  await assert.rejects(
    () => joinTable(ctx.db, table.id, bert.accountId),
    (err: unknown) => err instanceof AppError && err.code === 'broJetonsInsufficient',
  );

  const sitze = await ctx.db
    .select()
    .from(schema.tableSeat)
    .where(eq(schema.tableSeat.tableId, table.id));
  assert.equal(sitze.filter((s) => s.accountId).length, 1);
});

test('Einzug und Auszahlung: der Reststapel kommt zurueck, kein zweites Mal', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');

  const table = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'easypoker',
    config: CONFIG,
    seats: 2,
    rounds: 4,
  });

  const vorher = (await standVon(ctx.db, anna.accountId)).broJetons;

  await zieheEinsatz(
    ctx.db,
    table.id,
    [{ accountId: anna.accountId, seat: 0 }],
    CONFIG.startJetons,
  );
  assert.equal((await standVon(ctx.db, anna.accountId)).broJetons, vorher - CONFIG.startJetons);

  await zieheEinsatz(
    ctx.db,
    table.id,
    [{ accountId: anna.accountId, seat: 0 }],
    CONFIG.startJetons,
  );
  assert.equal((await standVon(ctx.db, anna.accountId)).broJetons, vorher - CONFIG.startJetons);

  await zahleAus(ctx.db, table.id, { [anna.accountId]: 350 });
  assert.equal(
    (await standVon(ctx.db, anna.accountId)).broJetons,
    vorher - CONFIG.startJetons + 350,
  );

  await zahleAus(ctx.db, table.id, { [anna.accountId]: 350 });
  assert.equal(
    (await standVon(ctx.db, anna.accountId)).broJetons,
    vorher - CONFIG.startJetons + 350,
  );
});
