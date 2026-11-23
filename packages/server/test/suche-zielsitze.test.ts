/**
 * Welche Tischgroesse die Match-Suche baut — und dass Filler zu viert nur
 * dort ankommt, wo es hingehoert.
 *
 * Filler meldet seit dem 23.11.2026 `seatCounts: [2, 4]`, vier Sitze gibt es
 * aber nur in Extreme; die Vorgabe des Moduls ist der Nebel. Jeder Verbraucher
 * von `meta.seatCounts`, der sich mit dem blossen Maximum begnuegt, baute
 * deshalb einen Vierertisch, den `validateConfig` abweist. Auf dem Server sind
 * das genau zwei Stellen:
 *
 *   - die Suche (`zielSitze`): waehlt seit dem 23.11.2026 nur Groessen, die
 *     die Vorgabe besteht — hier mit erfundenen Modulen fuer jeden Zweig und
 *     mit allen echten Spielen dagegen, dass sich ausser Filler etwas aendert;
 *   - der Tischbau (`createTable`): nimmt die Vier an der Sitzliste an, laesst
 *     sie aber an `validateConfig` scheitern, sobald die Spielart nicht
 *     Extreme ist — auch ohne mitgeschickte `config` (dann gilt die Vorgabe).
 *
 * Die Lobby, der dritte Verbraucher, erreicht Filler nicht: App.tsx leitet
 * `lobby` mit `gameId === 'filler'` auf den eigenen Bildschirm um.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ConfigProblem } from '@brauweg/game-api';

import { RuleSetInvalidError } from '../src/errors.js';
import { registry, requireModule } from '../src/games/registry.js';
import { tragfaehigeZielSitze, zielSitze } from '../src/suche/vermittlung.js';
import { createTable } from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

/** Ein Modul, das nur die drei Teile hat, die die Auswahl liest. */
function modul(
  seatCounts: number[],
  probleme: (sitze: number) => ConfigProblem[],
): Parameters<typeof tragfaehigeZielSitze>[0] {
  return {
    meta: { seatCounts } as unknown as Parameters<typeof tragfaehigeZielSitze>[0]['meta'],
    defaultConfig: () => ({ vorgabe: true }),
    validateConfig: (_config: unknown, sitze: number) => probleme(sitze),
  };
}

const fehler = (pfad: string): ConfigProblem => ({ path: pfad, messageKey: 'x', severity: 'error' });
const warnung = (pfad: string): ConfigProblem => ({ path: pfad, messageKey: 'x', severity: 'warning' });
const eineRunde = (): number => 1;

test('zielSitze: die groesste Groesse, die die Vorgabe besteht — nicht das blosse Maximum', () => {
  const nurZuZweit = modul([2, 4], (sitze) => (sitze === 4 ? [fehler('seats')] : []));
  assert.equal(tragfaehigeZielSitze(nurZuZweit, eineRunde), 2);
});

test('zielSitze: gilt die Vorgabe ueberall, bleibt es beim Maximum (Tafelrunde, Mememory)', () => {
  assert.equal(tragfaehigeZielSitze(modul([2, 3, 4, 5, 6, 7, 8], () => []), eineRunde), 8);
});

test('zielSitze: eine Warnung schliesst keine Groesse aus, nur ein Fehler', () => {
  assert.equal(tragfaehigeZielSitze(modul([2, 4], () => [warnung('farben')]), eineRunde), 4);
});

test('zielSitze: besteht die Vorgabe nirgends, das Maximum — der Tischbau soll den Fehler melden', () => {
  assert.equal(tragfaehigeZielSitze(modul([2, 4], () => [fehler('farben')]), eineRunde), 4);
});

test('zielSitze: die Rundenzahl kommt je Groesse aus der uebergebenen Rechnung', () => {
  const gesehen: [number, number][] = [];
  const m = {
    ...modul([2, 4], () => []),
    validateConfig: (_c: unknown, sitze: number, runden: number) => {
      gesehen.push([sitze, runden]);
      return [];
    },
  };
  tragfaehigeZielSitze(m, (sitze) => sitze * 10);
  assert.deepEqual(gesehen, [
    [2, 20],
    [4, 40],
  ]);
});

test('zielSitze mit den echten Spielen: nur Filler sucht unter seinem Maximum', () => {
  for (const meta of registry.all()) {
    let modulDa = true;
    try {
      requireModule(meta.id);
    } catch {
      modulDa = false; // Vorschau-Spiel ohne Modul: sucht niemand.
    }
    if (!modulDa) continue;
    const erwartet = meta.id === 'filler' ? 2 : Math.max(...meta.seatCounts);
    assert.equal(zielSitze(meta.id), erwartet, `${meta.id}: Suche baut ${zielSitze(meta.id)} Sitze`);
  }
  // Und Filler meldet die Vier tatsaechlich — sonst prueft die Zeile oben nichts.
  assert.deepEqual(requireModule('filler').meta.seatCounts, [2, 4]);
});

test('createTable: Filler zu viert nur in Extreme — ohne config und im Nebel abgewiesen', async (t) => {
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
});
