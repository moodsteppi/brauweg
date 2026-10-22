/**
 * Schachuhr in der Laufzeit (`schachuhr` in game-api), seit dem 22.10.2026.
 *
 * Die Plattform misst, das Modul regelt: Hier wird geprueft, dass die
 * Laufzeit die verbrauchte Zeit vor dem Zug bucht, dass nach Ablauf KEIN Bot
 * fuer den Menschen zieht, sondern die Partie auf Zeit endet, und dass die
 * Frist an die Geraete geht.
 *
 * Langsam mit Absicht: Die kuerzeste erlaubte Bedenkzeit sind 20 Sekunden
 * (`BEDENKZEIT_MIN_MS` in game-brochess), und den Regelsatz pruefen auch
 * Tests nicht vorbei — sonst stuende hier eine Uhr, die es am Tisch nie gibt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './harness.js';
import { TestClient } from './client.js';
import { createTable } from '../src/tables/service.js';
import { createVerifiedAccount } from './helpers.js';

interface SchachSicht {
  uhr: { restMs: number[]; bedenkzeitMs: number; zuschlagMs: number } | null;
  ende: { ausgang: string; sieger: number | null } | null;
}

test('Schachuhr: Zug bucht Zeit plus Zuschlag, Ablauf heisst verloren statt Bot', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'brochess',
    config: { bedenkzeitMs: 20_000, zuschlagMs: 1_000 },
    seats: 2,
    rounds: 1,
    fillWithBots: true,
  });

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  a.passive = true;
  a.join(table.id, 2, 'brochess');

  const ihrZug = () =>
    a.lastView !== null && a.lastView.seat !== null && a.lastView.currentActor === a.lastView.seat;
  await a.waitFor(ihrZug, 'Anna ist am Zug');
  const sitz = a.lastView!.seat!;
  const sicht = () => a.lastView!.view as SchachSicht;

  assert.equal(sicht().uhr?.restMs[sitz], 20_000);
  // Die Frist ist das Ende ihres Kontos, nicht die Zugzeit von 60 Sekunden.
  const frist = a.lastView!.turnDeadline!;
  assert.ok(frist - Date.now() <= 20_000 && frist - Date.now() > 15_000, `Frist ${frist - Date.now()} ms`);

  // Ein Zug nach etwa 300 ms: abgebucht, dann 1 s Zuschlag.
  await new Promise((fertig) => setTimeout(fertig, 300));
  const revision = a.lastView!.revision;
  a.raw({
    v: 1,
    game: 'brochess',
    type: 'action',
    tableId: table.id,
    action: a.lastView!.legalActions[0],
  });
  await a.waitFor(() => a.lastView!.revision > revision && ihrZug(), 'Bot hat geantwortet');
  const rest = sicht().uhr!.restMs[sitz]!;
  assert.ok(rest > 20_000 && rest < 20_800, `Rest nach dem Zug: ${rest} ms`);

  // Jetzt sitzt sie die Zeit aus. Kein Bot springt ein — die Uhr entscheidet.
  await a.waitFor(() => a.lastView?.finished === true, 'Zeitablauf', 40_000);
  assert.deepEqual(sicht().ende, { ausgang: 'zeit', sieger: 1 - sitz });
  const verlauf = a.messages('view');
  assert.ok(
    verlauf.every((nachricht) => !nachricht.botSeats.includes(sitz)),
    'kein Bot hat fuer Anna gezogen',
  );
  assert.deepEqual(a.errors, []);
  a.close();
});
