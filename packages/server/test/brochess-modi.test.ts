/**
 * Secret Dame von der Plattform aus: Umfang, Freigabe und Bot-Tisch
 * (Projekt „BroChess Spezial-Modi", Tom, 13.11.2026).
 *
 * Tom fand den Modus weder auf staging noch in TestFlight. Verdächtig waren
 * UMFANG, die Registry (`FREIGABE`) und eine Weiche für die App. Diese Datei
 * belegt, dass keiner davon den Modus sperrt: Unter der Release-Zeile von
 * UMFANG, aus dem Web und aus der App, nimmt der Server einen Secret-Dame-
 * Tisch gegen den Bot an — und der Bot spielt ihn auch. Bis zum 13.11.2026
 * warf `botAction` dort; der Tisch wäre angelegt worden und am ersten Zug des
 * Bots stehengeblieben. Die eigentliche Ursache war die Oberfläche (siehe
 * packages/client/src/screens/Lobby.spezialmodi.test.tsx). Dass er in
 * TestFlight auch nach dem Merge fehlen kann, liegt am Bau der App, nicht am
 * Server: Ein Release-Build bringt seinen Client mit und spricht mit der
 * Produktion (docs/APP-RELEASE.md, 3.3).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { APP_ORIGIN, buildApp } from '../src/http/app.js';
import { freigabeAuf, umfangKennungen } from '../src/games/registry.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTable } from '../src/tables/service.js';
import { umfangAusUmgebung } from '../src/umfang.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';
import { startHarness } from './harness.js';
import { TestClient } from './client.js';

/** Die Release-Zeile aus dem Kopf von src/umfang.ts. */
const UMFANG_RELEASE =
  'doppelkopf,skat,filler,brochess,kartenmanufaktur,browort,clanwort,lernpfad,' +
  'abstimmung,mehrkampf,schafkopf,romme,maumau,schwimmen,backgammon,bauernskat,phase10,dreckbro';

const SECRET_DAME_B = { modus: 'secretDame', schachDurchVerdeckte: 'B' };

test('Umfang und Freigabe: BroChess ist in Web und App spielbar, auch unter der Release-Zeile', () => {
  const { umfang, unbekannt } = umfangAusUmgebung(
    UMFANG_RELEASE,
    umfangKennungen(),
  );
  assert.deepEqual(unbekannt, []);
  for (const plattform of ['web', 'app'] as const) {
    assert.equal(freigabeAuf('brochess', plattform, umfang), 'spielbar', plattform);
  }
});

test('Secret Dame gegen den Bot: der Server legt den Tisch an — aus Web und App, unter der Release-Zeile', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    umfang: umfangAusUmgebung(UMFANG_RELEASE, umfangKennungen()).umfang,
  });
  t.after(async () => {
    runtime.shutdown();
    await app.close();
    await ctx.close();
  });
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const token = await createSession(ctx.auth, anna.accountId);

  for (const plattform of ['web', 'app'] as const) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tables',
      headers: {
        authorization: `Bearer ${token}`,
        ...(plattform === 'app' ? { origin: APP_ORIGIN } : {}),
      },
      // Dieselben Felder wie Lobby.tsx (`starteGegenBot`) sie schickt.
      payload: {
        gameId: 'brochess',
        seats: 2,
        rounds: 1,
        fillWithBots: true,
        visibility: 'on_request',
        botLevel: 'standard',
        config: SECRET_DAME_B,
      },
    });
    assert.equal(res.statusCode, 201, `${plattform}: ${res.body}`);
  }
});

interface Sicht {
  secretDame: { meineZuege: unknown[] } | null;
}

test('Secret Dame gegen den Bot: der Bot wählt seine Dame und antwortet auf einen Zug', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'brochess',
    config: SECRET_DAME_B,
    seats: 2,
    rounds: 1,
    fillWithBots: true,
  });

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  a.passive = true;
  a.join(table.id, 2, 'brochess');

  const ihrZug = (art: string) => () =>
    a.lastView !== null &&
    a.lastView.seat !== null &&
    a.lastView.currentActor === a.lastView.seat &&
    (a.lastView.legalActions[0] as { type?: string } | undefined)?.type === art;
  const handle = (aktion: unknown): void =>
    a.raw({ v: 1, game: 'brochess', type: 'action', tableId: table.id, action: aktion });

  // Erst wählt Anna ihre Dame; der Bot wählt seine selbst.
  await a.waitFor(ihrZug('wahl'), 'Anna wählt ihre Dame');
  handle(a.lastView!.legalActions[0]);

  // Dann ist sie am Zug — ist der Bot Weiss, hat er schon gezogen.
  await a.waitFor(ihrZug('zug'), 'Anna ist am Zug');
  const sicht = a.lastView!.view as Sicht;
  assert.ok((sicht.secretDame?.meineZuege.length ?? 0) > 0, 'die Sicht trägt Annas erlaubte Züge');

  const revision = a.lastView!.revision;
  handle(a.lastView!.legalActions[0]);
  await a.waitFor(() => a.lastView!.revision > revision + 1 && ihrZug('zug')(), 'der Bot hat geantwortet');
  assert.equal(a.lastView!.finished, false, 'kein Aufgeben, kein Abbruch');
});
