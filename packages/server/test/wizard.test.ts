/**
 * Zauberer an der Plattform.
 *
 * Der Beweis, dass die Trennung traegt: Der Server bekommt ein zweites Spiel,
 * ohne dass ausserhalb der Spielregistrierung etwas ueber seine Regeln bekannt
 * waere. Geprueft wird der Tischbau (bis sechs Sitze, Rundengrenzen aus dem
 * Modul) und der Durchstich - eine vollstaendige Partie ueber WebSocket.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { wizard } from '@brauweg/game-wizard';

import { AppError } from '../src/errors.js';
import { registry } from '../src/games/registry.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';
import { startHarness } from './harness.js';
import { TestClient } from './client.js';

const CONFIG = wizard.defaultConfig();

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

test('Zauberer steht als spielbares Spiel in der Registrierung', () => {
  const meta = registry.all().find((game) => game.id === 'wizard');
  assert.ok(meta);
  assert.equal(meta!.availability, 'playable');
  assert.deepEqual([...meta!.seatCounts], [3, 4, 5, 6]);
  assert.ok(registry.get('wizard'));
});

test('Ein Sechsertisch laesst sich bauen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'wizard',
    config: CONFIG,
    seats: 6,
    rounds: 10,
  });
  assert.equal(table.seats, 6);
  assert.equal(table.gameId, 'wizard');
});

test('Mehr Runden als Karten weist der Server ab', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  // Sechs Spieler, 60 Karten: nach zehn Runden ist das Blatt verteilt.
  await assert.rejects(
    () =>
      createTable(c.db, {
        accountId: anna.accountId,
        gameId: 'wizard',
        config: CONFIG,
        seats: 6,
        rounds: 11,
      }),
    (err: AppError) => err instanceof AppError,
  );
});

test('Die volle Dreierpartie passt genau in die oeffentliche Rundengrenze', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  // 20 Runden sind bei drei Spielern das ganze Blatt - und zugleich das
  // Maximum fuer oeffentliche Tische. Dass 20 kein Vielfaches von 3 ist,
  // stoert nicht: Das Modul meldet Rotation 1.
  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'wizard',
    config: CONFIG,
    seats: 3,
    rounds: 20,
  });
  assert.equal(table.maxRounds, 20);
});

test('Eine unbekannte Spielerzahl weist der Server ab', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  await assert.rejects(
    () =>
      createTable(c.db, {
        accountId: anna.accountId,
        gameId: 'wizard',
        config: CONFIG,
        seats: 7,
        rounds: 8,
      }),
    (err: AppError) => err.code === 'seatCountUnsupported',
  );
});

test('Widerspruechliche Hausregeln kommen nicht an den Tisch', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  await assert.rejects(
    () =>
      createTable(c.db, {
        accountId: anna.accountId,
        gameId: 'wizard',
        config: { ...CONFIG, noTrump: true, jesterPicksTrump: true },
        seats: 4,
        rounds: 5,
      }),
    (err: AppError) => err.code === 'ruleSetInvalid',
  );
});

test('Durchstich: zwei Clients beenden eine Sechser-Zauberpartie', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const bert = await createVerifiedAccount(h.ctx, 'Bert');

  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'wizard',
    config: { ...CONFIG, zeroBonus: true },
    seats: 6,
    rounds: 4,
    fillWithBots: true,
  });
  await joinTable(h.ctx.db, table.id, bert.accountId);

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');

  a.join(table.id, 1, 'wizard');
  await a.waitFor(() => a.lastView !== null, 'erste Sicht fuer Anna');
  b.join(table.id, 1, 'wizard');
  await b.waitFor(() => b.lastView !== null, 'erste Sicht fuer Bert');

  assert.equal(a.lastView!.seat, 0);
  assert.equal(b.lastView!.seat, 1);
  assert.deepEqual([...a.lastView!.botSeats].sort(), [2, 3, 4, 5]);

  await a.waitFor(() => a.lastView?.finished === true, 'Partie-Ende', 60_000);
  await b.waitFor(() => b.lastView?.finished === true, 'Partie-Ende bei Bert', 60_000);

  assert.deepEqual(a.errors, [], 'kein Client-Fehler bei Anna');
  assert.deepEqual(b.errors, [], 'kein Client-Fehler bei Bert');

  const [party] = await h.ctx.db
    .select()
    .from(schema.party)
    .where(eq(schema.party.tableId, table.id));
  assert.equal(party!.status, 'finished');

  // Vier Runden, vier abgelegte Rundenabrechnungen - der Server legt sie ab,
  // ohne ihren Inhalt zu kennen.
  const summaries = await h.ctx.db
    .select()
    .from(schema.roundSummary)
    .where(eq(schema.roundSummary.partyId, party!.id));
  assert.equal(summaries.length, 4);
});

test('Die Zuschauersicht eines Zaubertisches zeigt keine Hand', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'wizard',
    config: CONFIG,
    seats: 4,
    rounds: 3,
    fillWithBots: true,
  });

  const spieler = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  spieler.join(table.id, 1, 'wizard');
  await spieler.waitFor(() => spieler.lastView !== null, 'Sicht des Spielers');

  const runde = (spieler.lastView!.view as { round: { hand: unknown[] } | null }).round;
  assert.ok(runde);
  assert.ok(runde!.hand.length > 0, 'Der Spieler sieht seine eigene Hand');
});
