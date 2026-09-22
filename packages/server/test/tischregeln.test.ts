/**
 * Den Regelsatz eines wartenden Tisches in der Lobby ersetzen.
 *
 * Seit dem 22.09.2026 fuer die Bahnauswahl von Golf: Wer „Online spielen"
 * tippt, landet in einer offenen Gruppe, und erst dort stellt Sitz 0 Kurs,
 * Filter oder Bahnen ein. Geprueft wird, was der Server dabei zusagt: nur
 * Module, die es erlauben; nur Sitz 0; nur solange gewartet wird; das Modul
 * prueft den neuen Regelsatz; die Partie spielt ihn; `training` bleibt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';
import { KURSE } from '@brauweg/game-golf';

import * as schema from '../src/db/schema.js';
import {
  createTable,
  joinTable,
  schrumpfeAufBesetzte,
  setzeTischregeln,
  tableRules,
  tableWithSeats,
  listTables,
} from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

async function golfgruppe(t: { after(fn: () => unknown): void }) {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const bea = await createVerifiedAccount(ctx, 'Bea');
  const tisch = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'golf',
    seats: 8,
    rounds: 9,
  });
  await joinTable(ctx.db, tisch.id, bea.accountId);
  return { ctx, anna, bea, tisch };
}

test('Sitz 0 stellt den Kurs ein, der Tisch zeigt auf den neuen Regelsatz', async (t) => {
  const { ctx, anna, tisch } = await golfgruppe(t);

  await setzeTischregeln(ctx.db, tisch.id, { kurs: 'nachtkurs', variante: 'Nachtkurs' }, anna.accountId);

  assert.deepEqual(await tableRules(ctx.db, tisch.id), { kurs: 'nachtkurs', variante: 'Nachtkurs' });
  const { table } = await tableWithSeats(ctx.db, tisch.id);
  // Dieselbe Familie, eine Version weiter: Anna hat den Tisch aufgemacht.
  assert.equal(table.ruleSetId, tisch.ruleSetId);
  assert.equal(table.ruleSetVersion, tisch.ruleSetVersion + 1);
});

test('die Tischliste zeigt die Wahl als Spielart', async (t) => {
  const { ctx, anna, tisch } = await golfgruppe(t);
  await setzeTischregeln(ctx.db, tisch.id, { kurs: 'eiszeit', variante: 'Eiszeit' }, anna.accountId);

  const zeile = (await listTables(ctx.db, { gameId: 'golf' })).find((z) => z.id === tisch.id);
  assert.equal(zeile?.variante, 'Eiszeit');
});

test('nur Sitz 0 stellt ein — wer sonst sitzt, bekommt eine Absage', async (t) => {
  const { ctx, bea, tisch } = await golfgruppe(t);
  await assert.rejects(() => setzeTischregeln(ctx.db, tisch.id, { kurs: 'profi' }, bea.accountId), /nurErsterSitz/);
  const gast = await createVerifiedAccount(ctx, 'Gast');
  await assert.rejects(() => setzeTischregeln(ctx.db, tisch.id, { kurs: 'profi' }, gast.accountId), /notSeated/);
});

test('das Modul prueft den neuen Regelsatz — ein kaputter wird nicht gespeichert', async (t) => {
  const { ctx, anna, tisch } = await golfgruppe(t);
  await assert.rejects(
    () => setzeTischregeln(ctx.db, tisch.id, { kurs: 'gibtsnicht' }, anna.accountId),
    /ruleSetInvalid/,
  );
  await assert.rejects(
    () => setzeTischregeln(ctx.db, tisch.id, { bahnen: ['k99-weg', 'k01-der-erste-schlag'] }, anna.accountId),
    /ruleSetInvalid/,
  );
  assert.deepEqual(await tableRules(ctx.db, tisch.id), {});
});

test('ein Spiel ohne regelnInDerLobby laesst sich nicht umstellen', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const tisch = await createTable(ctx.db, { accountId: anna.accountId, gameId: 'doppelkopf', seats: 4, rounds: 4 });
  await assert.rejects(
    () => setzeTischregeln(ctx.db, tisch.id, { pflichtsolo: true }, anna.accountId),
    /regelnNichtAenderbar/,
  );
});

test('nach dem Start steht der Regelsatz fest', async (t) => {
  const { ctx, anna, tisch } = await golfgruppe(t);
  await schrumpfeAufBesetzte(ctx.db, tisch.id, anna.accountId, 9);
  // Der Start selbst laeuft ueber den Rundruf; hier genuegt der Status.
  await ctx.db.update(schema.gameTable).set({ status: 'running' }).where(eq(schema.gameTable.id, tisch.id));
  await assert.rejects(
    () => setzeTischregeln(ctx.db, tisch.id, { kurs: 'profi' }, anna.accountId),
    /tableAlreadyStarted/,
  );
});

test('training bleibt, wie es beim Anlegen war — die Lobby stellt keine Rangliste um', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const tisch = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'golf',
    seats: 4,
    rounds: 6,
    config: { training: true },
  });
  await setzeTischregeln(ctx.db, tisch.id, { kurs: 'anfaengerrunde', training: false }, anna.accountId);
  assert.equal((await tableRules(ctx.db, tisch.id)).training, true);

  const ohne = await createTable(ctx.db, { accountId: anna.accountId, gameId: 'golf', seats: 4, rounds: 6 });
  await setzeTischregeln(ctx.db, ohne.id, { kurs: 'anfaengerrunde', training: true }, anna.accountId);
  assert.equal('training' in (await tableRules(ctx.db, ohne.id)), false);
});

test('jeder Kurs des Moduls laesst sich als Regelsatz setzen', async (t) => {
  const { ctx, anna, tisch } = await golfgruppe(t);
  for (const kurs of KURSE) {
    await setzeTischregeln(ctx.db, tisch.id, { kurs: kurs.kennung, variante: kurs.name }, anna.accountId);
    assert.equal((await tableRules(ctx.db, tisch.id)).kurs, kurs.kennung);
  }
});
