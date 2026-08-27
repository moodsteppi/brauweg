/**
 * Ein laufender Tisch gegen die KI schliesst sich, wenn sein Mensch geht.
 *
 * Der Unterschied zum Normalfall ist Absicht und keine Bequemlichkeit: Wer
 * eine Partie gegen ANDERE verlaesst, gibt seinen Platz an einen Bot ab und
 * kann zurueckkommen — so ueberlebt eine Partie eine U-Bahn-Fahrt, und die
 * Mitspieler stehen nicht vor einem leeren Stuhl. Gegen die KI gibt es
 * niemanden, fuer den das Weiterlaufen einen Sinn haette; der Tisch bliebe
 * nur als "Weiterspielen" im Menue stehen.
 *
 * Geprueft wird beides: dass der KI-Tisch geht UND dass der Tisch mit einem
 * zweiten Menschen bleibt. Nur der zweite Test faengt den Fehler, der hier
 * wirklich weh taete — eine laufende Partie, die jemandem unter den Haenden
 * verschwindet, weil sein Gegner kurz das Netz verliert.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { mememory } from '@brauweg/game-mememory';

import {
  createTable,
  joinTable,
  setSeatBot,
  tableWithSeats,
  verlasseKiTisch,
} from '../src/tables/service.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';

const CONFIG = mememory.defaultConfig();

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

test('ein laufender KI-Tisch wird beim Verlassen geschlossen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const tisch = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'mememory',
    config: CONFIG,
    seats: 2,
    rounds: 1,
  });
  await setSeatBot(c.db, tisch.id, 1, true, anna.accountId);

  const runtime = new PartyRuntime(c.db);
  t.after(() => runtime.shutdown());
  await runtime.start(tisch.id);
  assert.equal((await tableWithSeats(c.db, tisch.id)).table.status, 'running');

  assert.equal(await verlasseKiTisch(c.db, tisch.id, anna.accountId), true);
  await runtime.verwirf(tisch.id);

  assert.equal((await tableWithSeats(c.db, tisch.id)).table.status, 'abandoned');
  // Die Partie ist weggeworfen und NICHT abgerechnet: `finished` wuerde
  // Trophaeen, Erfahrung und Aufgaben buchen — Aufgeben waere dann eine
  // Abkuerzung.
  const partien = await c.db
    .select({ status: schema.party.status })
    .from(schema.party)
    .where(eq(schema.party.tableId, tisch.id));
  assert.deepEqual(
    partien.map((zeile) => zeile.status),
    ['abandoned'],
  );
  assert.equal(runtime.get(tisch.id), undefined, 'die Partie ist auch aus dem Speicher');
});

test('ein Tisch mit einem zweiten Menschen bleibt stehen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const tisch = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'mememory',
    config: CONFIG,
    seats: 2,
    rounds: 1,
  });
  await joinTable(c.db, tisch.id, bert.accountId);

  const runtime = new PartyRuntime(c.db);
  t.after(() => runtime.shutdown());
  await runtime.start(tisch.id);

  assert.equal(await verlasseKiTisch(c.db, tisch.id, anna.accountId), false);
  assert.equal(
    (await tableWithSeats(c.db, tisch.id)).table.status,
    'running',
    'Berts Partie laeuft weiter, ein Bot uebernimmt Annas Platz',
  );
});

test('ein Tisch, auf den noch jemand wartet, ist kein KI-Tisch', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const tisch = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'mememory',
    config: CONFIG,
    seats: 2,
    rounds: 1,
  });

  // Noch nicht gestartet: Hier greift die gewoehnliche Wartelogik
  // (leaveLobby), nicht dieser Sonderweg.
  assert.equal(await verlasseKiTisch(c.db, tisch.id, anna.accountId), false);
  assert.equal((await tableWithSeats(c.db, tisch.id)).table.status, 'waiting');
});

test('wer gar nicht am Tisch sitzt, schliesst ihn auch nicht', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const fremder = await createVerifiedAccount(c, 'Fremder');

  const tisch = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'mememory',
    config: CONFIG,
    seats: 2,
    rounds: 1,
  });
  await setSeatBot(c.db, tisch.id, 1, true, anna.accountId);

  const runtime = new PartyRuntime(c.db);
  t.after(() => runtime.shutdown());
  await runtime.start(tisch.id);

  assert.equal(await verlasseKiTisch(c.db, tisch.id, fremder.accountId), false);
  assert.equal((await tableWithSeats(c.db, tisch.id)).table.status, 'running');
});
