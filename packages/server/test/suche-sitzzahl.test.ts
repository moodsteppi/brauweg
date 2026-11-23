/**
 * Mitspielersuche nach Sitzzahl: Filler Extreme 1v1 oder 1v1v1v1 (Wunsch
 * Niklas, 21.11.2026; seit dem 23.11.2026).
 *
 * Was hier festgehalten wird:
 *   - Zwei und vier sind getrennte Toepfe — wer zu zweit sucht, landet nie
 *     an einem Vierertisch und umgekehrt.
 *   - Der Vierertopf geht erst mit VIER Menschen sofort los, nicht schon mit
 *     zwei (die Werksgroesse von Filler).
 *   - Nach Ablauf fuellen Bots den Vierertisch auf, wie bei jeder Suche.
 *   - Was nicht geht, faellt beim Eintritt durch: drei Sitze, vier im Nebel,
 *     und eine Sitzwahl bei einem Spiel, das keine kennt (die Suche der
 *     anderen Spiele bleibt, wie sie war).
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createTestContext, createVerifiedAccount, seedInvite, type TestContext } from './helpers.js';
import { Vermittlung } from '../src/suche/vermittlung.js';
import { isReadyToStart, tableRules, tableWithSeats } from '../src/tables/service.js';

const FENSTER_MS = 30_000;
const EXTREME = { spalten: 8, zeilen: 7, farben: 7, barrieren: 10, variante: 'extreme' };
const NEBEL = { spalten: 8, zeilen: 7, farben: 6, barrieren: 10, variante: 'nebel' };

interface Stand {
  ctx: TestContext;
  vermittlung: Vermittlung;
  vor(ms: number): void;
  konto(name: string): Promise<string>;
}

async function stand(): Promise<Stand> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  let uhr = 1_000_000;
  const vermittlung = new Vermittlung(
    ctx.db,
    { notify: () => {} },
    {
      jetzt: () => uhr,
      // Ein verschluckter Fehler liesse die Probe mit "kein Tisch" scheitern
      // und verschwiege den Grund.
      beiFehler: (_gameId, fehler) => {
        throw fehler;
      },
    },
  );
  return {
    ctx,
    vermittlung,
    vor: (ms) => {
      uhr += ms;
    },
    konto: async (name) => (await createVerifiedAccount(ctx, name)).accountId,
  };
}

/** Das Fenster ablaufen lassen, waehrend die Konten nachfragen (Lebenszeichen). */
async function abwarten(s: Stand, konten: readonly string[]): Promise<void> {
  for (let offen = FENSTER_MS; offen > 0; offen -= 2_000) {
    s.vor(2_000);
    for (const konto of konten) await s.vermittlung.abruf('filler', konto);
  }
}

test('Filler Extreme: zwei und vier Sitze sind getrennte Toepfe', async (t) => {
  const s = await stand();
  t.after(() => s.ctx.close());

  const anna = await s.konto('Anna');
  const bert = await s.konto('Bert');
  const cara = await s.konto('Cara');

  await s.vermittlung.betritt('filler', anna, EXTREME, 4);
  const bertsStand = await s.vermittlung.betritt('filler', bert, EXTREME, 2);
  // Gleiche Spielart, andere Sitzzahl: Bert sieht Anna nicht.
  assert.equal(bertsStand.suchende, 1);
  assert.equal((await s.vermittlung.abruf('filler', anna)).suchende, 1);

  // Cara sucht zu zweit: Der Zweiertisch ist voll und geht sofort los —
  // ohne Anna, die zu viert sucht.
  const carasStand = await s.vermittlung.betritt('filler', cara, EXTREME, 2);
  assert.ok(carasStand.tischId, 'Cara bekommt sofort ihren Zweiertisch');
  assert.equal((await s.vermittlung.abruf('filler', bert)).tischId, carasStand.tischId);
  const zweier = await tableWithSeats(s.ctx.db, carasStand.tischId!);
  assert.equal(zweier.table.seats, 2);
  assert.ok(!zweier.seats.some((sitz) => sitz.accountId === anna), 'Anna sitzt nicht am Zweiertisch');

  assert.equal((await s.vermittlung.abruf('filler', anna)).sucht, true, 'Anna sucht weiter zu viert');
});

test('Filler Extreme zu viert: zwei Suchende gehen NICHT sofort los, nach Ablauf fuellen Bots auf', async (t) => {
  const s = await stand();
  t.after(() => s.ctx.close());

  const anna = await s.konto('Anna');
  const bert = await s.konto('Bert');
  await s.vermittlung.betritt('filler', anna, EXTREME, 4);
  const bertsStand = await s.vermittlung.betritt('filler', bert, EXTREME, 4);
  // Zu zweit waere das ein voller Filler-Tisch — im Vierertopf ist es halb.
  assert.equal(bertsStand.tischId, null, 'zwei von vier: es wird weiter gewartet');
  assert.equal(bertsStand.suchende, 2);

  await abwarten(s, [anna, bert]);
  const tischId = (await s.vermittlung.abruf('filler', anna)).tischId;
  assert.ok(tischId, 'nach dem Fenster steht der Tisch');
  assert.equal((await s.vermittlung.abruf('filler', bert)).tischId, tischId);

  const { table, seats } = await tableWithSeats(s.ctx.db, tischId!);
  assert.equal(table.gameId, 'filler');
  assert.equal(table.seats, 4);
  assert.equal(table.visibility, 'on_request');
  assert.equal(seats.filter((sitz) => sitz.accountId).length, 2, 'zwei Menschen');
  assert.equal((table.filters as { fillWithBots?: boolean }).fillWithBots, true);
  assert.equal(isReadyToStart(table, seats), true, 'die zwei freien Plaetze fuellen Bots');
  assert.equal((await tableRules(s.ctx.db, tischId!))['variante'], 'extreme');
});

test('Filler Extreme zu viert: vier Menschen starten sofort an EINEM Tisch', async (t) => {
  const s = await stand();
  t.after(() => s.ctx.close());

  const konten: string[] = [];
  for (const name of ['Anna', 'Bert', 'Cara', 'Dora']) konten.push(await s.konto(name));
  let letzter = null as string | null;
  for (const konto of konten) letzter = (await s.vermittlung.betritt('filler', konto, EXTREME, 4)).tischId;
  assert.ok(letzter, 'der Vierte bekommt sofort den Tisch');

  const { table, seats } = await tableWithSeats(s.ctx.db, letzter!);
  assert.equal(table.seats, 4);
  const menschen = seats.filter((sitz) => sitz.accountId).map((sitz) => sitz.accountId);
  assert.equal(menschen.length, 4);
  for (const konto of konten) {
    assert.ok(menschen.includes(konto));
    assert.equal((await s.vermittlung.abruf('filler', konto)).tischId, letzter);
  }
});

test('Filler: allein zu viert bekommt man drei Bots', async (t) => {
  const s = await stand();
  t.after(() => s.ctx.close());
  const anna = await s.konto('Anna');
  await s.vermittlung.betritt('filler', anna, EXTREME, 4);
  await abwarten(s, [anna]);
  const tischId = (await s.vermittlung.abruf('filler', anna)).tischId;
  assert.ok(tischId);
  const { table, seats } = await tableWithSeats(s.ctx.db, tischId!);
  assert.equal(table.seats, 4);
  assert.equal(seats.filter((sitz) => sitz.accountId).length, 1);
  assert.equal(isReadyToStart(table, seats), true);
});

test('Ausdruecklich zwei steht im selben Topf wie ein Client ohne Sitzzahl', async (t) => {
  const s = await stand();
  t.after(() => s.ctx.close());
  const anna = await s.konto('Anna');
  const bert = await s.konto('Bert');
  await s.vermittlung.betritt('filler', anna, EXTREME);
  const bertsStand = await s.vermittlung.betritt('filler', bert, EXTREME, 2);
  assert.ok(bertsStand.tischId, 'alter und neuer Client finden sich');
});

test('Wer die Sitzzahl wechselt, steht nur noch im neuen Topf', async (t) => {
  const s = await stand();
  t.after(() => s.ctx.close());
  const anna = await s.konto('Anna');
  const bert = await s.konto('Bert');
  await s.vermittlung.betritt('filler', anna, EXTREME, 2);
  await s.vermittlung.betritt('filler', anna, EXTREME, 4);
  const bertsStand = await s.vermittlung.betritt('filler', bert, EXTREME, 2);
  assert.equal(bertsStand.tischId, null, 'Anna steht nicht mehr im Zweiertopf');
  assert.equal(bertsStand.suchende, 1);
  assert.equal((await s.vermittlung.abruf('filler', anna)).suchende, 1);
});

test('Abgewiesen beim Eintritt: drei Sitze, vier im Nebel, vier ohne Regelsatz', async (t) => {
  const s = await stand();
  t.after(() => s.ctx.close());
  const anna = await s.konto('Anna');
  await assert.rejects(s.vermittlung.betritt('filler', anna, EXTREME, 3), /ruleSetInvalid/);
  await assert.rejects(s.vermittlung.betritt('filler', anna, NEBEL, 4), /ruleSetInvalid/);
  // Ohne Regelsatz gilt die Vorgabe (Nebel) — und die gibt es nicht zu viert.
  await assert.rejects(s.vermittlung.betritt('filler', anna, null, 4), /ruleSetInvalid/);
  assert.equal((await s.vermittlung.abruf('filler', anna)).sucht, false, 'Anna steht in keiner Schlange');
});

test('Andere Spiele: keine Sitzwahl ausser der Groesse ab Werk', async (t) => {
  const s = await stand();
  t.after(() => s.ctx.close());
  const anna = await s.konto('Anna');
  // Mememory sucht vier; zwei steht zwar in seatCounts, ist aber keine Wahl
  // der Suche — die bleibt fuer alle Spiele ausser Filler, wie sie war.
  await assert.rejects(s.vermittlung.betritt('mememory', anna, null, 2), /ruleSetInvalid/);
  const stand4 = await s.vermittlung.betritt('mememory', anna, null, 4);
  assert.equal(stand4.sucht, true, 'die Werksgroesse ist erlaubt');
});

test('Die Sitzzahl ueber HTTP: zu viert suchen', async (t) => {
  const { startHarness } = await import('./harness.js');
  const h = await startHarness();
  t.after(() => h.close());
  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const cookie = await h.cookieFor(anna.accountId);
  const ruf = (body: unknown): Promise<Response> =>
    fetch(`${h.baseUrl}/api/suche/filler`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  assert.equal((await ruf({ config: EXTREME, sitze: 3 })).status, 400);
  const antwort = await ruf({ config: EXTREME, sitze: 4 });
  assert.equal(antwort.status, 200);
  assert.equal(((await antwort.json()) as { sucht: boolean }).sucht, true);
});
