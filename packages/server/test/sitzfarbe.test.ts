/**
 * Der Farbwunsch eines Sitzes.
 *
 * Seit dem 07.09.2026 darf man in der Golf-Lobby seine Ballfarbe durchtippen.
 * Der Server verwahrt dafuer nur eine ZAHL je Konto in `gameTable.filters` —
 * welche Farbe das ist, weiss er nicht, und ob sie ein anderer schon traegt,
 * prueft er absichtlich nicht: Zwei Tipps im selben Moment waeren ein
 * Wettlauf, und der Verlierer stuende ohne Rueckmeldung da. Doppelfrei macht
 * es der Bildschirm mit einer reinen Funktion (client: `farbtafel`).
 *
 * Geprueft wird deshalb genau das, was der Server zusagt: nur wer sitzt, nur
 * solange gewartet wird, der Wunsch haengt am KONTO (und ueberlebt damit das
 * Umnummerieren beim Sofortstart), und ein Weggegangener haelt seine Farbe
 * nicht fuer immer fest.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTable,
  joinTable,
  leaveLobby,
  schrumpfeAufBesetzte,
  setSeatColor,
  sitzfarbWuensche,
  tableWithSeats,
} from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

async function golftisch(t: { after(fn: () => unknown): void }) {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const bea = await createVerifiedAccount(ctx, 'Bea');
  const tisch = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'golf',
    seats: 4,
    rounds: 3,
  });
  await joinTable(ctx.db, tisch.id, bea.accountId);
  return { ctx, anna, bea, tisch };
}

async function wuensche(ctx: { db: Parameters<typeof tableWithSeats>[0] }, tableId: string) {
  const { table } = await tableWithSeats(ctx.db, tableId);
  return sitzfarbWuensche(table.filters);
}

test('der Wunsch landet am Konto und ueberschreibt sich selbst', async (t) => {
  const { ctx, anna, bea, tisch } = await golftisch(t);

  await setSeatColor(ctx.db, tisch.id, 11, anna.accountId);
  await setSeatColor(ctx.db, tisch.id, 4, bea.accountId);
  await setSeatColor(ctx.db, tisch.id, 12, anna.accountId);

  assert.deepEqual(await wuensche(ctx, tisch.id), {
    [anna.accountId]: 12,
    [bea.accountId]: 4,
  });
});

test('zwei Sitze duerfen denselben Wunsch haben - der Server sortiert das nicht', async (t) => {
  const { ctx, anna, bea, tisch } = await golftisch(t);

  await setSeatColor(ctx.db, tisch.id, 6, anna.accountId);
  await setSeatColor(ctx.db, tisch.id, 6, bea.accountId);

  // Beide stehen drin. Doppelfrei wird es erst am Bildschirm.
  assert.deepEqual(await wuensche(ctx, tisch.id), {
    [anna.accountId]: 6,
    [bea.accountId]: 6,
  });
});

test('wer nicht am Tisch sitzt, faerbt nichts um', async (t) => {
  const { ctx, tisch } = await golftisch(t);
  const gast = await createVerifiedAccount(ctx, 'Gast');

  await assert.rejects(() => setSeatColor(ctx.db, tisch.id, 2, gast.accountId), /notSeated/);
});

test('eine krumme oder zu grosse Nummer wird abgewiesen', async (t) => {
  const { ctx, anna, tisch } = await golftisch(t);

  await assert.rejects(() => setSeatColor(ctx.db, tisch.id, -1, anna.accountId), /seatColorUnknown/);
  await assert.rejects(() => setSeatColor(ctx.db, tisch.id, 64, anna.accountId), /seatColorUnknown/);
  await assert.rejects(() => setSeatColor(ctx.db, tisch.id, 1.5, anna.accountId), /seatColorUnknown/);
});

test('der Wunsch ueberlebt das Umnummerieren beim Sofortstart', async (t) => {
  const { ctx, anna, bea, tisch } = await golftisch(t);
  // Anna sitzt auf 0, Bea auf 1; die Plaetze 2 und 3 sind leer und fallen
  // beim Sofortstart weg. Wuerde der Wunsch am Sitzindex haengen, waere er
  // danach am falschen Menschen.
  await setSeatColor(ctx.db, tisch.id, 9, bea.accountId);

  await schrumpfeAufBesetzte(ctx.db, tisch.id, anna.accountId, 3);

  assert.equal((await wuensche(ctx, tisch.id))[bea.accountId], 9);
});

test('wer geht, haelt seine Farbe nicht fest', async (t) => {
  const { ctx, anna, bea, tisch } = await golftisch(t);
  await setSeatColor(ctx.db, tisch.id, 5, bea.accountId);

  await leaveLobby(ctx.db, tisch.id, bea.accountId);
  // Der naechste Schreibvorgang raeumt die Wuensche der Weggegangenen weg.
  await setSeatColor(ctx.db, tisch.id, 1, anna.accountId);

  assert.deepEqual(await wuensche(ctx, tisch.id), { [anna.accountId]: 1 });
});
