/**
 * Prüfstand: echter HTTP-Server, echter WebSocket, echte Datenbank (PGlite).
 * Nichts davon ist nachgebaut, damit die Tests dieselben Wege gehen wie der
 * Betrieb.
 */

import { doppelkopf } from '@brauweg/game-doppelkopf';

import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { Gateway } from '../src/realtime/gateway.js';
import { PartyRuntime, type RuntimeOptions } from '../src/runtime/party.js';
import { createSession, sessionFromToken } from '../src/auth/service.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, seedInvite, type TestContext } from './helpers.js';

export const CONFIG = doppelkopf.defaultConfig();

export interface Harness {
  readonly ctx: TestContext;
  readonly runtime: PartyRuntime;
  readonly wsUrl: string;
  cookieFor(accountId: string): Promise<string>;
  close(): Promise<void>;
}

export async function startHarness(
  options: RuntimeOptions = {},
  /** Verzoegert die Sitzungspruefung, um die Luecke beim Verbinden zu weiten. */
  sessionDelayMs = 0,
): Promise<Harness> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);

  const runtime = new PartyRuntime(ctx.db, {
    botDelayMs: 0,
    turnTimeoutMs: 60_000,
    ...options,
  });

  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const gateway = new Gateway(app.server, ctx.db, runtime, {
    lookupSession: async (token) => {
      if (sessionDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, sessionDelayMs));
      }
      return sessionFromToken(ctx.db, token);
    },
  });

  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    ctx,
    runtime,
    wsUrl: `ws://127.0.0.1:${port}/ws`,
    async cookieFor(accountId: string) {
      const token = await createSession(ctx.auth, accountId);
      return `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
    },
    async close() {
      runtime.shutdown();
      await gateway.close();
      await app.close();
      await ctx.close();
    },
  };
}

/** Vier Sitze, zwei Menschen, Rest Bot. Vier Runden sind eine volle Rotation. */
export async function tableWithTwoHumans(h: Harness) {
  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const bert = await createVerifiedAccount(h.ctx, 'Bert');

  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 4,
    fillWithBots: true,
  });
  await joinTable(h.ctx.db, table.id, bert.accountId);

  return { anna, bert, table };
}

/** Vier Sitze, nur ein Mensch, keine Bots: der Tisch wartet auf Mitspieler. */
export async function waitingTable(h: Harness) {
  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 4,
  });
  return { anna, table };
}

/** Vier Sitze, vier Menschen: nur so zaehlt der Tisch fuer die Rangliste. */
export async function tableWithFourHumans(h: Harness) {
  const names = ['Anna', 'Bert', 'Cara', 'Dora'];
  const accounts = [];
  for (const name of names) accounts.push(await createVerifiedAccount(h.ctx, name));

  const table = await createTable(h.ctx.db, {
    accountId: accounts[0]!.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 4,
  });
  for (const account of accounts.slice(1)) {
    await joinTable(h.ctx.db, table.id, account.accountId);
  }

  return { accounts, table };
}
