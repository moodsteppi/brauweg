/**
 * Bots auf freie Plaetze.
 *
 * Bots werden nicht mehr vorab beim Tischbau gewaehlt, sondern am wartenden
 * Tisch auf die freien Plaetze gesetzt. Geprueft wird: ein freier Platz wird
 * startbereit, sobald alle Plaetze belegt sind; nur wer am Tisch sitzt, darf
 * setzen; ein von einem Menschen belegter Platz bleibt unangetastet.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { doppelkopf } from '@brauweg/game-doppelkopf';

import {
  createTable,
  isReadyToStart,
  setSeatBot,
  tableWithSeats,
} from '../src/tables/service.js';
import { AppError } from '../src/errors.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

const CONFIG = doppelkopf.defaultConfig();

async function waitingTable() {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const table = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 4,
  });
  return { ctx, anna, table };
}

test('ein Tisch mit freien Plaetzen ist noch nicht startbereit', async (t) => {
  const { ctx, table } = await waitingTable();
  t.after(() => ctx.close());

  const { table: tb, seats } = await tableWithSeats(ctx.db, table.id);
  assert.equal(isReadyToStart(tb, seats), false);
});

test('Bots auf alle freien Plaetze machen den Tisch startbereit', async (t) => {
  const { ctx, anna, table } = await waitingTable();
  t.after(() => ctx.close());

  for (const seat of [1, 2, 3]) {
    await setSeatBot(ctx.db, table.id, seat, true, anna.accountId);
  }

  const { table: tb, seats } = await tableWithSeats(ctx.db, table.id);
  assert.equal(seats.filter((s) => s.isBot).length, 3);
  assert.equal(isReadyToStart(tb, seats), true);
});

test('ein gesetzter Bot laesst sich wieder entfernen', async (t) => {
  const { ctx, anna, table } = await waitingTable();
  t.after(() => ctx.close());

  await setSeatBot(ctx.db, table.id, 1, true, anna.accountId);
  await setSeatBot(ctx.db, table.id, 1, false, anna.accountId);

  const { seats } = await tableWithSeats(ctx.db, table.id);
  assert.equal(seats.find((s) => s.seatIndex === 1)?.isBot, false);
});

test('nur wer am Tisch sitzt, darf Bots setzen', async (t) => {
  const { ctx, table } = await waitingTable();
  t.after(() => ctx.close());

  const fremd = await createVerifiedAccount(ctx, 'Fremd');
  await assert.rejects(
    () => setSeatBot(ctx.db, table.id, 1, true, fremd.accountId),
    (err: AppError) => err.code === 'notSeated',
  );
});

test('ein von einem Menschen belegter Platz wird nicht zum Bot', async (t) => {
  const { ctx, anna, table } = await waitingTable();
  t.after(() => ctx.close());

  // Sitz 0 gehoert Anna.
  await assert.rejects(
    () => setSeatBot(ctx.db, table.id, 0, true, anna.accountId),
    (err: AppError) => err.code === 'seatTaken',
  );
});
