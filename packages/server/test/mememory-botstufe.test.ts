/**
 * Die Stufe, die beim Auffuellen eingestellt wird, kommt am Bot an.
 *
 * Der Weg ist nicht offensichtlich, und genau deshalb steht er hier: Der
 * REGELSATZ eines Tisches wird beim Erstellen festgeschrieben — wer einen
 * wartenden Tisch mit Bots auffuellt, kann ihm also keine `botStufen`
 * nachreichen. Die Tischeinstellung `botLevel` dagegen liegt in
 * `gameTable.filters` und laesst sich bis zum Start aendern.
 *
 * Seit dem 27. August 2026 reicht die Plattform beim Partiestart beides an
 * `createParty` durch: welche Plaetze ein Bot spielt (`botSeats`) und wie
 * stark (`botLevel`). Mememory baut daraus seine `botStufen` — und nur so
 * bekommt der Bot ueberhaupt ein Gedaechtnis, denn dessen Platz im Zustand
 * entsteht beim Aufbau der Partie und danach nie wieder.
 *
 * Ohne diesen Test waere der Regler im Wartebereich ein Knopf, der sich
 * bewegt und nichts tut — und das faellt niemandem auf, weil ein Bot ohne
 * Gedaechtnis einfach nur schlecht spielt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mememory } from '@brauweg/game-mememory';

import {
  createTable,
  setSeatBot,
  setTableBotLevel,
  tableWithSeats,
} from '../src/tables/service.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

const CONFIG = mememory.defaultConfig();

async function tischFuerDrei(t: { after(fn: () => unknown): void }) {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const tisch = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'mememory',
    config: CONFIG,
    seats: 3,
    rounds: 1,
  });
  const runtime = new PartyRuntime(ctx.db);
  t.after(() => runtime.shutdown());
  return { ctx, anna, tisch, runtime };
}

/** Die Stufen der Sitze aus dem laufenden Partiezustand. */
function stufenVon(runtime: PartyRuntime, tableId: string): Record<number, string> {
  const partie = runtime.get(tableId);
  assert.ok(partie, 'die Partie laeuft');
  return (partie.state as { regeln: { botStufen?: Record<number, string> } }).regeln.botStufen ?? {};
}

test('die eingestellte Stufe erreicht die aufgefuellten Bots', async (t) => {
  const { ctx, anna, tisch, runtime } = await tischFuerDrei(t);

  // Genau die Reihenfolge des Wartebereichs: erst die Staerke, dann die Bots.
  await setTableBotLevel(ctx.db, tisch.id, 'genie', anna.accountId);
  await setSeatBot(ctx.db, tisch.id, 1, true, anna.accountId);
  await setSeatBot(ctx.db, tisch.id, 2, true, anna.accountId);

  await runtime.start(tisch.id);

  assert.deepEqual(
    stufenVon(runtime, tisch.id),
    { 1: 'experte', 2: 'experte' },
    '"genie" der Plattform ist "experte" in diesem Spiel',
  );
});

test('die schwaechste Stufe kommt genauso an', async (t) => {
  const { ctx, anna, tisch, runtime } = await tischFuerDrei(t);

  await setTableBotLevel(ctx.db, tisch.id, 'anfaenger', anna.accountId);
  await setSeatBot(ctx.db, tisch.id, 1, true, anna.accountId);
  await setSeatBot(ctx.db, tisch.id, 2, true, anna.accountId);
  await runtime.start(tisch.id);

  assert.deepEqual(stufenVon(runtime, tisch.id), { 1: 'leicht', 2: 'leicht' });
});

test('ohne Einstellung spielt der Bot in der Mitte', async (t) => {
  const { ctx, anna, tisch, runtime } = await tischFuerDrei(t);

  await setSeatBot(ctx.db, tisch.id, 1, true, anna.accountId);
  await setSeatBot(ctx.db, tisch.id, 2, true, anna.accountId);
  await runtime.start(tisch.id);

  // DEFAULT_BOT_LEVEL der Plattform ist 'standard'.
  assert.deepEqual(stufenVon(runtime, tisch.id), { 1: 'mittel', 2: 'mittel' });
});

test('der Platz des Menschen bekommt keine Stufe', async (t) => {
  const { ctx, anna, tisch, runtime } = await tischFuerDrei(t);

  await setTableBotLevel(ctx.db, tisch.id, 'genie', anna.accountId);
  await setSeatBot(ctx.db, tisch.id, 1, true, anna.accountId);
  await setSeatBot(ctx.db, tisch.id, 2, true, anna.accountId);
  await runtime.start(tisch.id);

  const stufen = stufenVon(runtime, tisch.id);
  assert.equal(stufen[0], undefined, 'Sitz 0 ist Anna');
  // Und damit bekommt sie in ihrer Sicht auch kein Gedaechtnis mitgeschickt.
  const partie = runtime.get(tisch.id);
  assert.ok(partie);
  const sicht = partie.module.viewFor(partie.state, 0) as { erinnerung?: unknown };
  assert.equal(sicht.erinnerung, undefined);
});

test('eine Stufe in der config schlaegt die Tischeinstellung', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  // So macht es der KI-Bildschirm: jede Stufe je Sitz in der config.
  const tisch = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'mememory',
    config: { ...CONFIG, botStufen: { 1: 'leicht', 2: 'schwer' } },
    seats: 3,
    rounds: 1,
  });
  const runtime = new PartyRuntime(ctx.db);
  t.after(() => runtime.shutdown());

  await setTableBotLevel(ctx.db, tisch.id, 'genie', anna.accountId);
  await setSeatBot(ctx.db, tisch.id, 1, true, anna.accountId);
  await setSeatBot(ctx.db, tisch.id, 2, true, anna.accountId);
  await runtime.start(tisch.id);

  assert.deepEqual(
    stufenVon(runtime, tisch.id),
    { 1: 'leicht', 2: 'schwer' },
    'im KI-Match hat jeder Gegner seine eigene Stufe',
  );
  assert.equal((await tableWithSeats(ctx.db, tisch.id)).table.status, 'running');
});
