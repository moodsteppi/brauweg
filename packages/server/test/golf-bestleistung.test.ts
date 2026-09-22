/**
 * Golf meldet seine Bestleistung je Bahn (seit dem 22.09.2026) — und die
 * Plattform traegt sie nach IHRER Regel ein.
 *
 * packages/game-golf/test/bestleistung.test.ts prueft, was das Modul meldet.
 * Hier laeuft dieselbe Meldung durch den echten Schreibweg
 * (`verbucheBestleistungen` mit `countsForRanking`): ein Gast am Tisch, und
 * Golf traegt fuer niemanden ein; ohne Gast je Konto und Bahn eine Zeile,
 * Richtung `tief`; der Botsitz bekommt nichts. Die Gastregel steht bewusst
 * NICHT im Modul — wer sie dort nachbaute, haette zwei Regeln, die beim
 * ersten Umbau auseinanderlaufen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { golf, pruefsummeDerTafel, type GolfAktion, type GolfPartie } from '@brauweg/game-golf';

import { verbucheBestleistungen } from '../src/bestleistung.js';
import { gastKonto } from '../src/auth/service.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, schema as s, seedInvite, type TestContext } from './helpers.js';

async function ctx(): Promise<TestContext> {
  const c = await createTestContext();
  await seedInvite(c.db);
  return c;
}

// Zwei Loecher, drei Sitze: Sitz 2 ist ein Bot.
const TAFEL = [
  [2, 4, 3],
  [3, 1, 3],
];

/** Eine beendete Golfpartie, in der beide Menschen dieselbe Tafel gemeldet haben. */
function beendetePartie(): GolfPartie {
  let p = golf.createParty({ config: golf.defaultConfig(), seats: 3, rounds: 2, seed: 99, botSeats: [2] });
  const meldung: GolfAktion = {
    art: 'ergebnis',
    schlaege: [5, 5, 6],
    pruef: pruefsummeDerTafel(TAFEL),
    jeLoch: TAFEL,
  };
  p = golf.act(p, 0, meldung);
  p = golf.act(p, 1, meldung);
  assert.equal(golf.isFinished(p), true);
  return p;
}

function ende(tableId: string, partie: GolfPartie, seats: { index: number; accountId: string | null }[]) {
  return {
    tableId,
    gameId: 'golf' as const,
    partyId: null,
    seats,
    standings: golf.standings(partie),
    segments: [],
  };
}

test('Golf am Tisch ohne Gast: je Konto und Bahn eine Zeile, Richtung tief, der Bot nichts', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId: anna } = await createVerifiedAccount(c, 'Anna');
  const { accountId: bert } = await createVerifiedAccount(c, 'Bert');

  const tisch = await createTable(c.db, { accountId: anna, gameId: 'golf', seats: 3, rounds: 2 });
  await joinTable(c.db, tisch.id, bert);
  const partie = beendetePartie();

  const n = await verbucheBestleistungen(
    c.db,
    ende(tisch.id, partie, [
      { index: 0, accountId: anna },
      { index: 1, accountId: bert },
      { index: 2, accountId: null },
    ]),
  );
  assert.equal(n, 4, 'zwei Konten, zwei Bahnen');

  const zeilen = await c.db.select().from(s.bestleistung);
  assert.equal(zeilen.length, 4);
  for (const z of zeilen) {
    assert.equal(z.gameId, 'golf');
    assert.equal(z.richtung, 'tief');
    assert.ok(partie.bahnen.includes(z.inhaltId), `${z.inhaltId} ist eine Bahn der Partie`);
  }
  const wert = (konto: string, loch: number) =>
    zeilen.find((z) => z.accountId === konto && z.inhaltId === partie.bahnen[loch])?.wert;
  assert.equal(wert(anna, 0), 2);
  assert.equal(wert(anna, 1), 3);
  assert.equal(wert(bert, 0), 4);
  assert.equal(wert(bert, 1), 1);
});

test('Golf mit einem Gast am Tisch traegt fuer niemanden ein', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId: anna } = await createVerifiedAccount(c, 'Anna');
  const gast = await gastKonto(c.auth, 'Laufkunde');

  const tisch = await createTable(c.db, { accountId: anna, gameId: 'golf', seats: 3, rounds: 2 });
  await joinTable(c.db, tisch.id, gast.accountId);

  const partie = beendetePartie();
  // Das Modul meldet trotzdem — ob der Tisch zaehlt, weiss es nicht und soll es nicht wissen.
  assert.ok(golf.standings(partie).some((st) => 'bestleistungen' in st));

  const n = await verbucheBestleistungen(
    c.db,
    ende(tisch.id, partie, [
      { index: 0, accountId: anna },
      { index: 1, accountId: gast.accountId },
      { index: 2, accountId: null },
    ]),
  );
  assert.equal(n, 0);
  assert.equal((await c.db.select().from(s.bestleistung)).length, 0);
});
