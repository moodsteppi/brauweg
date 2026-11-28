/**
 * Spielarten (seit dem 28.11.2026): fertige Regelsaetze im Modul
 * (`GameMeta.spielarten`), ausgeliefert ueber `GET /api/games/:id/spielarten`,
 * gesucht ueber die gewoehnliche Schlange.
 *
 * Was hier festgehalten wird — fuer JEDES Modul mit Spielarten, ueber die
 * Registrierung und ohne Spielnamen, damit ein neues Spiel automatisch
 * mitgeprueft wird:
 *   - Jede Spielart traegt `variante` = ihre Kennung. Ohne das stuenden zwei
 *     Spielarten im selben Topf der Suche (schlange.ts, `schluessel`), und es
 *     galte der Regelsatz des ersten Suchenden.
 *   - Jede besteht `validateConfig` bei jeder Sitzzahl des Moduls — mit der
 *     Rundenzahl, die auch die Suche nimmt.
 *   - Mit jeder laeuft eine Bot-Partie zu Ende (Muster:
 *     plattform-invarianten.test.ts).
 *   - Name und Satz stehen im Woerterbuch des Clients.
 * Dazu die Route und, an Golf, dass eine Suche die Rundenzahl der Spielart
 * nimmt statt zwei Loecher.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AnyGameModule, GameMeta, Spielart } from '@brauweg/game-api';

import { buildApp } from '../src/http/app.js';
import { registry } from '../src/games/registry.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { Vermittlung } from '../src/suche/vermittlung.js';
import { MAX_ROUNDS, tableWithSeats } from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';
import { woerterbuchSchluessel } from './woerterbuch.js';

type Modul = AnyGameModule & Record<string, any>;

const ZUG_GRENZE = 40_000;
const STUFEN = ['anfaenger', 'standard', 'experte', 'genie'] as const;

const mitSpielarten = registry
  .all()
  .filter((meta) => meta.availability === 'playable' && (meta.spielarten?.length ?? 0) > 0)
  .map((meta) => registry.get(meta.id) as Modul);

/** Dieselbe Rechnung wie `runden` in suche/vermittlung.ts — mit Spielart. */
function suchRunden(meta: GameMeta, sitze: number, art: Spielart): number {
  const rotation = meta.rotationSize(sitze);
  const grenze = MAX_ROUNDS.on_request;
  const passt = (r: number): boolean => r % rotation === 0 && r >= rotation && r <= grenze;
  if (art.runden !== undefined && passt(art.runden)) return art.runden;
  return meta.suggestedRounds(sitze).find(passt) ?? rotation;
}

/** Eine Partie mit lauter Bots zu Ende spielen; liefert die Zugzahl. */
function spieleDurch(spiel: Modul, config: unknown, seats: number, rounds: number, seed: number): number {
  let partie = spiel.createParty({
    config,
    seats,
    rounds,
    seed,
    botSeats: Array.from({ length: seats }, (_, i) => i),
  });
  let zuege = 0;
  while (!spiel.isFinished(partie)) {
    assert.ok(++zuege <= ZUG_GRENZE, `endet nicht binnen ${ZUG_GRENZE} Zügen`);
    const sitz = spiel.currentActor(partie);
    if (sitz === null) {
      assert.ok(spiel.advanceInterlude, 'niemand am Zug und keine Schaupause');
      partie = spiel.advanceInterlude!(partie);
      continue;
    }
    const aktion = spiel.botAction(spiel.viewFor(partie, sitz), STUFEN[zuege % STUFEN.length]);
    partie = spiel.act(partie, sitz, aktion);
  }
  return zuege;
}

test('mindestens die bestellten Spiele haben Spielarten', () => {
  const ids = mitSpielarten.map((m) => m.meta.id).sort();
  for (const id of ['brochess', 'cambio', 'doppelkopf', 'easypoker', 'eiland', 'filler', 'golf', 'partykiste', 'skat', 'wizard']) {
    assert.ok(ids.includes(id as never), `${id} hat keine Spielarten — ${ids.join(', ')}`);
  }
});

const WOERTERBUCH = woerterbuchSchluessel();

for (const spiel of mitSpielarten) {
  const meta = spiel.meta;
  const arten = meta.spielarten!;

  test(`${meta.id}: jede Spielart hat eine eigene Kennung und traegt sie als variante`, () => {
    const ids = arten.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, `doppelte Kennung: ${ids.join(', ')}`);
    for (const art of arten) {
      assert.match(art.id, /^[a-z0-9-]{1,24}$/, `Kennung ${art.id}`);
      const variante = (art.config as Record<string, unknown>)['variante'];
      assert.equal(variante, art.id, `${art.id}: variante ist ${String(variante)}`);
    }
  });

  test(`${meta.id}: jede Spielart besteht validateConfig bei jeder Sitzzahl`, () => {
    for (const art of arten) {
      for (const sitze of meta.seatCounts) {
        const runden = suchRunden(meta, sitze, art);
        const fehler = spiel
          .validateConfig(art.config, sitze, runden)
          .filter((p: { severity: string }) => p.severity === 'error');
        assert.deepEqual(fehler, [], `${art.id} bei ${sitze} Sitzen und ${runden} Runden`);
      }
    }
  });

  test(`${meta.id}: mit jeder Spielart laeuft eine Bot-Partie zu Ende`, () => {
    // Die Sitzzahl der Suche (`zielSitze` in vermittlung.ts), damit genau der
    // Tisch geprueft wird, den Quick-Play baut.
    const sitze =
      meta.suchSitze !== undefined && meta.seatCounts.includes(meta.suchSitze)
        ? meta.suchSitze
        : Math.max(...meta.seatCounts);
    arten.forEach((art, n) => {
      const runden = suchRunden(meta, sitze, art);
      const zuege = spieleDurch(spiel, art.config, sitze, runden, 4_200 + n);
      assert.ok(zuege > 0, `${art.id}: kein einziger Zug`);
    });
  });

  test(`${meta.id}: Name und Satz jeder Spielart stehen im Woerterbuch`, () => {
    const fehlt = arten
      .flatMap((art) => [`spielart.${meta.id}.${art.id}.name`, `spielart.${meta.id}.${art.id}.text`])
      .filter((k) => !WOERTERBUCH.has(k));
    assert.deepEqual(fehlt, []);
  });
}

test('Doppelkopf: Standard ist Robins Regelsatz und steht vorn', () => {
  const art = registry.get('doppelkopf')!.meta.spielarten![0]!;
  assert.equal(art.id, 'standard');
  const c = art.config as Record<string, unknown>;
  assert.equal(c['deck'], 'without9');
  assert.equal(c['pflichtsolo'], true);
  assert.equal(c['feigling'], true);
  assert.deepEqual(c['bockTriggers'], ['zeroResult', 'reAndKontra']);
  assert.equal(c['countPoints'], false);
  assert.equal(c['tableSize'], 4);
});

async function appStand() {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({ db: ctx.db, runtime, auth: ctx.auth, cookieSecure: false, sessionTtlDays: 30 });
  return {
    ctx,
    app,
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

test('GET /api/games/:id/spielarten liefert die Spielarten des Moduls, leer ohne', async (t) => {
  const s = await appStand();
  t.after(() => s.close());

  const doko = await s.app.inject({ url: '/api/games/doppelkopf/spielarten' });
  assert.equal(doko.statusCode, 200, doko.body);
  const arten = doko.json().spielarten as { id: string; config: Record<string, unknown> }[];
  assert.deepEqual(
    arten.map((a) => a.id),
    registry.get('doppelkopf')!.meta.spielarten!.map((a) => a.id),
  );
  assert.equal(arten[0]!.config['variante'], 'standard');

  const golf = await s.app.inject({ url: '/api/games/golf/spielarten' });
  const ersterKurs = (golf.json().spielarten as { runden?: number }[])[0]!;
  assert.ok((ersterKurs.runden ?? 0) >= 6, JSON.stringify(ersterKurs));

  const ohne = await s.app.inject({ url: '/api/games/tafelrunde/spielarten' });
  assert.equal(ohne.statusCode, 200);
  assert.deepEqual(ohne.json(), { spielarten: [] });

  const unbekannt = await s.app.inject({ url: '/api/games/gibtsnicht/spielarten' });
  assert.ok(unbekannt.statusCode >= 400);
});

test('Suche mit Spielart: eigener Topf je Spielart, Golf spielt den ganzen Kurs', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  let uhr = 1_000_000;
  const vermittlung = new Vermittlung(
    ctx.db,
    { notify: () => {} },
    {
      jetzt: () => uhr,
      beiFehler: (_gameId, fehler) => {
        throw fehler;
      },
    },
  );
  const anna = (await createVerifiedAccount(ctx, 'Anna')).accountId;
  const bert = (await createVerifiedAccount(ctx, 'Bert')).accountId;

  const [standard, , , hart] = registry.get('doppelkopf')!.meta.spielarten!;
  await vermittlung.betritt('doppelkopf', anna, standard!.config);
  const bertsStand = await vermittlung.betritt('doppelkopf', bert, hart!.config);
  assert.equal(bertsStand.suchende, 1, 'Hart und Standard stehen im selben Topf');
  vermittlung.verlaesst('doppelkopf', anna);
  vermittlung.verlaesst('doppelkopf', bert);

  const kurs = registry.get('golf')!.meta.spielarten![0]!;
  await vermittlung.betritt('golf', anna, kurs.config);
  let stand = await vermittlung.abruf('golf', anna);
  for (let offen = 31_000; offen > 0 && !stand.tischId; offen -= 2_000) {
    uhr += 2_000;
    stand = await vermittlung.abruf('golf', anna);
  }
  assert.ok(stand.tischId, 'die Suche hat keinen Tisch gebaut');
  const { table } = await tableWithSeats(ctx.db, stand.tischId!);
  assert.equal(table.maxRounds, kurs.runden, 'die Suche nimmt die Bahnzahl des Kurses');
});

