/**
 * Filler zu viert (Extreme 1v1v1v1, seit dem 23.11.2026) und die Plattform.
 *
 * Die Vier steht NICHT in `seatCounts`, sondern in `sitzeNurMitRegelsatz`:
 * `seatCounts` verspricht, dass die Vorgabe auf jeder Zahl gilt, und die
 * Vorgabe von Filler ist der Nebel — zu viert gibt es den nicht. Wer
 * `seatCounts` liest, sieht deshalb weiter nur die Zwei:
 *
 *   - die Suche (`zielSitze`, groesste Zahl aus `seatCounts`): weiter zu
 *     zweit — festgehalten in suche.test.ts ("Filler/Eiland 2");
 *   - die Lobby: erreicht Filler nicht (App.tsx leitet um), und sie bekaeme
 *     ohnehin nur `seatCounts`;
 *   - plattform-invarianten.test.ts: spielt jede Zahl aus `seatCounts` mit
 *     der Vorgabe durch — mit der Vier dort fiel sie sofort.
 *
 * Gelesen wird `sitzeNurMitRegelsatz` allein vom Tischbau. Was der damit
 * annimmt und was nicht, steht hier.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { RuleSetInvalidError } from '../src/errors.js';
import { registry, requireModule } from '../src/games/registry.js';
import { createTable } from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

test('sitzeNurMitRegelsatz: keine Zahl steht zugleich in seatCounts, und die Vorgabe traegt sie nicht', () => {
  for (const meta of registry.all()) {
    const nurMit = meta.sitzeNurMitRegelsatz ?? [];
    for (const sitze of nurMit) {
      assert.ok(!meta.seatCounts.includes(sitze), `${meta.id}: ${sitze} steht doppelt`);
    }
    if (nurMit.length === 0) continue;
    // Truege die Vorgabe die Zahl, gehoerte sie nach seatCounts.
    const modul = requireModule(meta.id);
    for (const sitze of nurMit) {
      const probleme = modul.validateConfig(modul.defaultConfig(), sitze, 1);
      assert.ok(
        probleme.some((p) => p.severity === 'error'),
        `${meta.id}: die Vorgabe traegt ${sitze} Sitze — dann gehoert die Zahl nach seatCounts`,
      );
    }
  }
  assert.deepEqual(requireModule('filler').meta.seatCounts, [2]);
  assert.deepEqual(requireModule('filler').meta.sitzeNurMitRegelsatz, [4]);
});

test('createTable: Filler zu viert nur in Extreme — ohne config und in Klar abgewiesen', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Vierer');
  const vorgabe = requireModule('filler').defaultConfig() as Record<string, unknown>;

  await assert.rejects(
    createTable(c.db, { accountId, gameId: 'filler', seats: 4, rounds: 1 }),
    RuleSetInvalidError,
    'ohne config gilt die Vorgabe (Nebel) — zu viert unzulaessig',
  );
  await assert.rejects(
    createTable(c.db, { accountId, gameId: 'filler', seats: 4, rounds: 1, config: { ...vorgabe, variante: 'klar' } }),
    RuleSetInvalidError,
  );
  // Zu dritt steht nirgends — schon die Sitzzahl faellt durch, nicht erst der Regelsatz.
  await assert.rejects(
    createTable(c.db, { accountId, gameId: 'filler', seats: 3, rounds: 1, config: { ...vorgabe, variante: 'extreme' } }),
    /seatCountUnsupported/,
  );

  const vierer = await createTable(c.db, {
    accountId,
    gameId: 'filler',
    seats: 4,
    rounds: 1,
    visibility: 'on_request',
    config: { ...vorgabe, variante: 'extreme' },
  });
  assert.ok(vierer.id, 'Extreme zu viert ist ein gueltiger Tisch');

  const zweier = await createTable(c.db, { accountId, gameId: 'filler', seats: 2, rounds: 1 });
  assert.ok(zweier.id, 'zu zweit mit der Vorgabe bleibt, wie es war');
});

test('createTable: ein Spiel ohne sitzeNurMitRegelsatz nimmt weiter nur seatCounts an', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Zweier');
  assert.equal(requireModule('eiland').meta.sitzeNurMitRegelsatz, undefined);
  await assert.rejects(
    createTable(c.db, { accountId, gameId: 'eiland', seats: 4, rounds: 1 }),
    /seatCountUnsupported/,
  );
});
