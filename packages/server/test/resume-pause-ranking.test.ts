import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { doppelkopf } from '@brauweg/game-doppelkopf';

import { AppError } from '../src/errors.js';
import { ensureBetaClubMembership } from '../src/clubs/service.js';
import { overallRanking, rankingForGame } from '../src/rankings/service.js';
import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import {
  activeTableFor,
  createTable,
  expireStaleTables,
  joinTable,
  listTables,
  pauseTable,
  resumeTable,
} from '../src/tables/service.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
} from './helpers.js';

const CONFIG = doppelkopf.defaultConfig();

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

test('Weiterspielen: /api/me liefert den laufenden Tisch', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });

  const active = await activeTableFor(c.db, anna.accountId);
  assert.ok(active);
  assert.equal(active!.tableId, table.id);
  assert.equal(active!.status, 'waiting');
  assert.equal(active!.paused, false);

  const app = buildApp({
    db: c.db,
    runtime: new PartyRuntime(c.db),
    auth: c.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
  t.after(() => app.close());

  const token = await createSession(c.auth, anna.accountId);
  const me = await app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` },
  });
  assert.equal(me.statusCode, 200);
  const body = me.json() as {
    activeTable: { tableId: string; status: string } | null;
    clubs: { id: string; name: string }[];
  };
  assert.equal(body.activeTable?.tableId, table.id);
  assert.equal(body.clubs.length, 1);
  assert.equal(body.clubs[0]!.name, 'Brauweg');
});

test('Vereinstisch: nur Mitglieder sehen und betreten ihn', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const club = await ensureBetaClubMembership(c.db, anna.accountId);

  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 100,
    visibility: 'club_only',
    clubId: club.id,
  });

  const ohneClub = await listTables(c.db, { gameId: 'doppelkopf' });
  assert.equal(ohneClub.length, 0);

  const mitClub = await listTables(c.db, { gameId: 'doppelkopf', clubIds: [club.id] });
  assert.equal(mitClub.length, 1);
  assert.equal(mitClub[0]!.id, table.id);

  await joinTable(c.db, table.id, bert.accountId);
});

test('Pause: nur Vereinstische, und pausierte verfallen nicht', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const club = await ensureBetaClubMembership(c.db, anna.accountId);

  const oeffentlich = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  await assert.rejects(
    () => pauseTable(c.db, oeffentlich.id, anna.accountId),
    (err: AppError) => err.code === 'pauseClubOnly',
  );

  const verein = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 100,
    visibility: 'club_only',
    clubId: club.id,
  });

  await c.db
    .update(schema.gameTable)
    .set({ status: 'running' })
    .where(eq(schema.gameTable.id, verein.id));

  await pauseTable(c.db, verein.id, anna.accountId);
  const active = await activeTableFor(c.db, anna.accountId);
  assert.equal(active?.paused, true);

  await c.db
    .update(schema.gameTable)
    .set({ lastActivityAt: new Date(Date.now() - 48 * 3600_000) })
    .where(eq(schema.gameTable.id, verein.id));
  assert.equal(await expireStaleTables(c.db, 2, 24), 0);

  await resumeTable(c.db, verein.id, anna.accountId);
  const weiter = await activeTableFor(c.db, anna.accountId);
  assert.equal(weiter?.paused, false);
});

test('Rangliste: Trophaeen absteigend', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  await c.db.insert(schema.accountGameStat).values([
    {
      accountId: anna.accountId,
      gameId: 'doppelkopf',
      trophies: 120,
      highestCheckpoint: 100,
      parties: 3,
      wins: 2,
    },
    {
      accountId: bert.accountId,
      gameId: 'doppelkopf',
      trophies: 40,
      highestCheckpoint: 0,
      parties: 2,
      wins: 0,
    },
  ]);

  const list = await rankingForGame(c.db, 'doppelkopf');
  assert.equal(list.length, 2);
  assert.equal(list[0]!.displayName, 'Anna');
  assert.equal(list[0]!.trophies, 120);
  assert.equal(list[0]!.rank, 1);
  assert.equal(list[1]!.displayName, 'Bert');

  const gesamt = await overallRanking(c.db);
  assert.ok(gesamt.some((row) => row.displayName === 'Anna' && row.trophies === 120));
});
