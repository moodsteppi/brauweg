/**
 * Trophaeenweg.
 *
 * Was hier schiefgehen kann und deshalb gepruefte Zeilen hat: eine Stufe
 * holen, die man nicht erreicht hat, dieselbe Stufe zweimal (auch
 * gleichzeitig) holen, einen Gegenstand verschenken, den man schon gekauft
 * hat, und die Stufen, die keine Station sind — Checkpoints mit festen Muenzen
 * und die Silbertruhen ueber 1000. Dazu der Katalog selbst: Eine vertippte
 * Kennung wuerde still nichts schenken.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  CHECKPOINT_MUENZEN,
  WEG_STATIONEN,
  wegSichtbarBis,
  wegStufe,
  wegStufenBis,
} from '../src/trophaeenweg-katalog.js';
import { offeneWegBelohnungen, trophaeenSumme, wegFuer, wegHolen } from '../src/trophaeenweg.js';
import { SPANNE } from '../src/truhen.js';
import { stueckMit } from '../src/kosmetik.js';
import { istFrei, wareMit } from '../src/tischware.js';
import { kaufen } from '../src/shop.js';
import { gutschreiben, standVon } from '../src/waehrung.js';
import { AppError } from '../src/errors.js';
import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
  type TestContext,
} from './helpers.js';

/** Ein Konto mit Trophaeen, verteilt auf zwei Spiele — der Weg zaehlt die Summe. */
async function konto(doppelkopf = 0, skat = 0): Promise<{ ctx: TestContext; accountId: string }> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const { accountId } = await createVerifiedAccount(ctx, 'Anna');
  await setzeTrophaeen(ctx, accountId, doppelkopf, skat);
  return { ctx, accountId };
}

async function setzeTrophaeen(
  ctx: TestContext,
  accountId: string,
  doppelkopf: number,
  skat = 0,
): Promise<void> {
  for (const [gameId, trophies] of [
    ['doppelkopf', doppelkopf],
    ['skat', skat],
  ] as const) {
    await ctx.db
      .insert(schema.accountGameStat)
      .values({ accountId, gameId, trophies })
      .onConflictDoUpdate({
        target: [schema.accountGameStat.accountId, schema.accountGameStat.gameId],
        set: { trophies },
      });
  }
}

async function besitzt(ctx: TestContext, accountId: string, itemId: string): Promise<number> {
  const zeilen = await ctx.db
    .select()
    .from(schema.accountCosmetic)
    .where(and(eq(schema.accountCosmetic.accountId, accountId), eq(schema.accountCosmetic.itemId, itemId)));
  return zeilen.length;
}

const istFehler = (code: string, status: number) => (err: unknown) =>
  err instanceof AppError && err.code === code && err.status === status;

// --- Katalog ----------------------------------------------------------------

test('Die Stationen stehen bei 100, 250, 500, 750 und 1000 — wie BIOME im Client', () => {
  // Der Client-Test (trophaeenweg.test.ts) haelt dieselbe Liste gegen BIOME;
  // hier steht sie ausgeschrieben, damit eine Aenderung in beiden Paketen
  // auffaellt und nicht nur in einem.
  assert.deepEqual(
    WEG_STATIONEN.map((s) => [s.schwelle, s.truhe, s.gegenstand]),
    [
      [100, 'bronze', 'hut-strohhut'],
      [250, 'silber', 'ruecken-sommerwiese'],
      [500, 'gold', 'szene-kaminzimmer'],
      [750, 'gold', 'blatt-winterhof'],
      [1000, 'diamant', 'aura-sterne'],
    ],
  );
});

test('Jeder Gegenstand des Weges steht im Katalog und kostet dort etwas', () => {
  for (const { gegenstand } of WEG_STATIONEN) {
    const stueck = stueckMit(gegenstand);
    const ware = wareMit(gegenstand);
    assert.ok(stueck ?? ware, `${gegenstand} steht weder in kosmetik.ts noch in tischware.ts`);
    // Ein Gegenstand, der allen gehoert, waere als Belohnung eine leere Schachtel.
    if (stueck) assert.ok(stueck.preis.coins > 0 && stueck.herkunft === 'shop', gegenstand);
    if (ware) assert.equal(istFrei(ware), false, gegenstand);
  }
});

test('Checkpoints alle 100 bis 1000, darueber alle 250 eine Silbertruhe', () => {
  assert.deepEqual(
    wegStufenBis(1000).filter((s) => s.art === 'checkpoint').map((s) => s.schwelle),
    [200, 300, 400, 600, 700, 800, 900],
  );
  for (const s of wegStufenBis(1000).filter((s) => s.art === 'checkpoint')) {
    assert.equal(s.muenzen, CHECKPOINT_MUENZEN);
    assert.equal(s.truhe, null);
  }
  assert.deepEqual(
    wegStufenBis(2000).filter((s) => s.art === 'weiter').map((s) => [s.schwelle, s.truhe]),
    [
      [1250, 'silber'],
      [1500, 'silber'],
      [1750, 'silber'],
      [2000, 'silber'],
    ],
  );
  // Zwischenwerte sind keine Stufen.
  for (const keine of [0, 50, 150, 1100, 1300, -100, 100.5]) assert.equal(wegStufe(keine), null, String(keine));
  // Gezeigt wird alles Erreichte plus die naechste Stufe ueber 1000.
  assert.equal(wegSichtbarBis(773), 1250);
  assert.equal(wegSichtbarBis(1250), 1500);
});

// --- Freischalten -----------------------------------------------------------

test('Die Summe ueber alle Spiele schaltet frei, nicht ein einzelnes Spiel', async () => {
  // 60 + 50: in keinem Spiel 100, zusammen 110.
  const { ctx, accountId } = await konto(60, 50);
  try {
    assert.equal(await trophaeenSumme(ctx.db, accountId), 110);
    const weg = await wegFuer(ctx.db, accountId);
    assert.equal(weg.trophaeen, 110);
    const wiesen = weg.stufen.find((s) => s.schwelle === 100)!;
    assert.equal(wiesen.erreicht, true);
    assert.equal(wiesen.geholt, false);
    assert.deepEqual(wiesen.truhe, { grad: 'bronze', ...SPANNE.bronze });
    assert.equal(wiesen.gegenstand, 'hut-strohhut');
    assert.equal(weg.stufen.find((s) => s.schwelle === 200)!.erreicht, false);
    assert.equal(weg.bereit, 1);
    assert.equal(await offeneWegBelohnungen(ctx.db, accountId, 110), 1);
  } finally {
    await ctx.close();
  }
});

test('Ohne die Trophaeen bleibt die Stufe zu, und es gibt nichts', async () => {
  const { ctx, accountId } = await konto(99);
  try {
    await assert.rejects(() => wegHolen(ctx.db, accountId, 100), istFehler('wegNichtErreicht', 409));
    assert.equal((await standVon(ctx.db, accountId)).coins, 0);
    assert.equal(await besitzt(ctx, accountId, 'hut-strohhut'), 0);
    assert.equal(await offeneWegBelohnungen(ctx.db, accountId, 99), 0);
  } finally {
    await ctx.close();
  }
});

test('Eine erfundene Schwelle gibt es nicht', async () => {
  const { ctx, accountId } = await konto(5000);
  try {
    await assert.rejects(() => wegHolen(ctx.db, accountId, 150), istFehler('wegStufeUnbekannt', 404));
    await assert.rejects(() => wegHolen(ctx.db, accountId, 1100), istFehler('wegStufeUnbekannt', 404));
    assert.equal((await standVon(ctx.db, accountId)).coins, 0);
  } finally {
    await ctx.close();
  }
});

// --- Abholen ----------------------------------------------------------------

test('Eine Station gibt ihre Truhe und den Gegenstand, gespeichert statt neu gewuerfelt', async () => {
  const { ctx, accountId } = await konto(120);
  try {
    const fund = await wegHolen(ctx.db, accountId, 100);
    assert.equal(fund.grad, 'bronze');
    assert.ok(fund.coins >= SPANNE.bronze.von && fund.coins <= SPANNE.bronze.bis, String(fund.coins));
    assert.equal(fund.gegenstand, 'hut-strohhut');
    assert.equal(fund.gegenstandNeu, true);
    assert.equal(fund.stand, fund.coins);
    assert.equal(await besitzt(ctx, accountId, 'hut-strohhut'), 1);

    const weg = await wegFuer(ctx.db, accountId);
    const wiesen = weg.stufen.find((s) => s.schwelle === 100)!;
    assert.equal(wiesen.geholt, true);
    // Was drin war, steht fest — ein zweites Laden zeigt denselben Betrag.
    assert.equal(wiesen.coins, fund.coins);
    assert.equal(weg.bereit, 0);
  } finally {
    await ctx.close();
  }
});

test('Zweimal holen zahlt einmal — auch zwei Anfragen zugleich', async () => {
  const { ctx, accountId } = await konto(300);
  try {
    const ergebnisse = await Promise.allSettled([
      wegHolen(ctx.db, accountId, 250),
      wegHolen(ctx.db, accountId, 250),
    ]);
    const erfolge = ergebnisse.filter((e) => e.status === 'fulfilled');
    const absagen = ergebnisse.filter((e) => e.status === 'rejected');
    assert.equal(erfolge.length, 1);
    assert.equal(absagen.length, 1);
    assert.ok(istFehler('wegSchonGeholt', 409)((absagen[0] as PromiseRejectedResult).reason));

    const fund = (erfolge[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof wegHolen>>>).value;
    assert.equal((await standVon(ctx.db, accountId)).coins, fund.coins);
    assert.equal(await besitzt(ctx, accountId, 'ruecken-sommerwiese'), 1);

    // Und spaeter noch einmal: dieselbe Absage.
    await assert.rejects(() => wegHolen(ctx.db, accountId, 250), istFehler('wegSchonGeholt', 409));
    assert.equal((await standVon(ctx.db, accountId)).coins, fund.coins);
  } finally {
    await ctx.close();
  }
});

test('Ein gekaufter Gegenstand bleibt Besitz — die Truhe gibt es trotzdem, keine zweite Zeile', async () => {
  const { ctx, accountId } = await konto(120);
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 500);
    await kaufen(ctx.db, accountId, 'hut-strohhut', 'coins');
    const nachKauf = (await standVon(ctx.db, accountId)).coins;

    const fund = await wegHolen(ctx.db, accountId, 100);
    assert.equal(fund.gegenstandNeu, false);
    assert.equal(await besitzt(ctx, accountId, 'hut-strohhut'), 1);
    assert.equal((await standVon(ctx.db, accountId)).coins, nachKauf + fund.coins);
  } finally {
    await ctx.close();
  }
});

test('Tischware von der Station liegt danach im Besitz (Tisch, Blatt, Aura)', async () => {
  const { ctx, accountId } = await konto(1000);
  try {
    for (const schwelle of [500, 750, 1000]) await wegHolen(ctx.db, accountId, schwelle);
    assert.equal(await besitzt(ctx, accountId, 'szene-kaminzimmer'), 1);
    assert.equal(await besitzt(ctx, accountId, 'blatt-winterhof'), 1);
    assert.equal(await besitzt(ctx, accountId, 'aura-sterne'), 1);
  } finally {
    await ctx.close();
  }
});

test('Ein Checkpoint gibt genau 25 Muenzen und keinen Gegenstand', async () => {
  const { ctx, accountId } = await konto(210);
  try {
    const fund = await wegHolen(ctx.db, accountId, 200);
    assert.deepEqual(
      { grad: fund.grad, coins: fund.coins, gegenstand: fund.gegenstand, stand: fund.stand },
      { grad: null, coins: CHECKPOINT_MUENZEN, gegenstand: null, stand: CHECKPOINT_MUENZEN },
    );
    const weg = await wegFuer(ctx.db, accountId);
    const cp = weg.stufen.find((s) => s.schwelle === 200)!;
    assert.equal(cp.art, 'checkpoint');
    assert.equal(cp.geholt, true);
    assert.equal(cp.coins, CHECKPOINT_MUENZEN);
  } finally {
    await ctx.close();
  }
});

test('Ueber 1000 gibt es alle 250 eine Silbertruhe, die naechste steht schon da', async () => {
  const { ctx, accountId } = await konto(1300, 300);
  try {
    const weg = await wegFuer(ctx.db, accountId);
    const weiter = weg.stufen.filter((s) => s.art === 'weiter');
    assert.deepEqual(
      weiter.map((s) => [s.schwelle, s.erreicht]),
      [
        [1250, true],
        [1500, true],
        [1750, false],
      ],
    );
    // 5 Stationen + 7 Checkpoints + 2 Silbertruhen
    assert.equal(weg.bereit, 14);
    assert.equal(await offeneWegBelohnungen(ctx.db, accountId, 1600), 14);

    const fund = await wegHolen(ctx.db, accountId, 1500);
    assert.equal(fund.grad, 'silber');
    assert.equal(fund.gegenstand, null);
    assert.ok(fund.coins >= SPANNE.silber.von && fund.coins <= SPANNE.silber.bis);
    await assert.rejects(() => wegHolen(ctx.db, accountId, 1750), istFehler('wegNichtErreicht', 409));
    assert.equal(await offeneWegBelohnungen(ctx.db, accountId, 1600), 13);
  } finally {
    await ctx.close();
  }
});

test('Geholt bleibt geholt, auch wenn die Summe wieder faellt', async () => {
  const { ctx, accountId } = await konto(260);
  try {
    await wegHolen(ctx.db, accountId, 250);
    await setzeTrophaeen(ctx, accountId, 150);

    const weg = await wegFuer(ctx.db, accountId);
    const strand = weg.stufen.find((s) => s.schwelle === 250)!;
    assert.equal(strand.erreicht, false);
    assert.equal(strand.geholt, true);
    // Offen sind jetzt nur die 100 — die geholte 250 liegt ueber der Summe und
    // darf von der Zaehlung nichts abziehen.
    assert.equal(weg.bereit, 1);
    assert.equal(await offeneWegBelohnungen(ctx.db, accountId, 150), 1);
    // Die noch nicht geholte 200 ist wieder zu.
    await assert.rejects(() => wegHolen(ctx.db, accountId, 200), istFehler('wegNichtErreicht', 409));
  } finally {
    await ctx.close();
  }
});

// --- Ueber die Leitung ------------------------------------------------------

interface Aufbau {
  readonly ctx: TestContext;
  readonly app: FastifyInstance;
  readonly accountId: string;
  readonly cookie: Record<string, string>;
}

async function aufbau(trophaeen: number): Promise<Aufbau> {
  const { ctx, accountId } = await konto(trophaeen);
  const app = await buildApp({
    db: ctx.db,
    runtime: new PartyRuntime(ctx.db),
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
  const token = await createSession(ctx.auth, accountId);
  return { ctx, app, accountId, cookie: { [SESSION_COOKIE]: token } };
}

test('Ohne Anmeldung gibt der Weg nichts her', async () => {
  const a = await aufbau(500);
  try {
    assert.equal((await a.app.inject({ method: 'GET', url: '/api/weg' })).statusCode, 401);
    assert.equal((await a.app.inject({ method: 'POST', url: '/api/weg/100/holen' })).statusCode, 401);
  } finally {
    await a.app.close();
    await a.ctx.close();
  }
});

test('Ueber die Leitung: Weg lesen, holen, /api/me zaehlt mit', async () => {
  const a = await aufbau(260);
  try {
    const me = (await a.app.inject({ method: 'GET', url: '/api/me', cookies: a.cookie })).json();
    // 100, 200 und 250 sind erreicht.
    assert.equal(me.bereit.weg, 3);

    const weg = (await a.app.inject({ method: 'GET', url: '/api/weg', cookies: a.cookie })).json();
    assert.equal(weg.trophaeen, 260);
    assert.equal(weg.bereit, 3);

    const holen = await a.app.inject({ method: 'POST', url: '/api/weg/200/holen', cookies: a.cookie });
    assert.equal(holen.statusCode, 200);
    assert.equal(holen.json().coins, CHECKPOINT_MUENZEN);

    const nochmal = await a.app.inject({ method: 'POST', url: '/api/weg/200/holen', cookies: a.cookie });
    assert.equal(nochmal.statusCode, 409);
    assert.equal(nochmal.json().code, 'wegSchonGeholt');

    // Unsinn in der Adresse ist eine Absage in der Form, keine Stufe.
    for (const url of ['/api/weg/abc/holen', '/api/weg/0/holen', '/api/weg/-100/holen', '/api/weg/12345678/holen']) {
      const antwort = await a.app.inject({ method: 'POST', url, cookies: a.cookie });
      assert.equal(antwort.statusCode, 400, url);
    }

    const danach = (await a.app.inject({ method: 'GET', url: '/api/me', cookies: a.cookie })).json();
    assert.equal(danach.bereit.weg, 2);
    assert.equal(danach.coins, CHECKPOINT_MUENZEN);
  } finally {
    await a.app.close();
    await a.ctx.close();
  }
});
