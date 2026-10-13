/**
 * Das „Weiter" der Partykiste ueber die Leitung: Die Marke `vertreten` setzt
 * nur der Bot (weiter-warten.ts, Punkt 4). Bis zum 13.10.2026 reichte die
 * Laufzeit die Aktion eines Menschen unveraendert an `act` weiter, und wer
 * die Marke mitschickte, trank als Letzter nie. Geprueft wird hier die
 * Plattformseite — dass `vomGeraet` (game-api) auf dem Weg vom Geraet
 * wirklich gerufen wird. Was das Modul daraus macht, steht in
 * packages/game-partykiste/test/weiter-warten.test.ts.
 *
 * Vier stille Menschen (`passive`) an einem Imposter-Tisch, Bots weit weg:
 * Getippt wird nur, was der Test schickt.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { partykiste } from '@brauweg/game-partykiste';

import { ENVELOPE_VERSION } from '../src/realtime/protocol.js';
import { startHarness } from './harness.js';
import { createVerifiedAccount } from './helpers.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { TestClient } from './client.js';

interface Sicht {
  weiterFehlen: number[] | null;
  letzterWurf: { sitz: number } | null;
}

function sicht(c: TestClient): Sicht {
  return c.lastView!.view as Sicht;
}

test('ein Mensch, der als Letzter vertreten mitschickt, wuerfelt trotzdem', async (t) => {
  const h = await startHarness({ botDelayMs: 60_000 });
  t.after(() => h.close());

  const namen = ['Anna', 'Bert', 'Cleo', 'Dana'];
  const konten = [];
  for (const name of namen) konten.push(await createVerifiedAccount(h.ctx, name));
  const table = await createTable(h.ctx.db, {
    accountId: konten[0]!.accountId,
    gameId: 'partykiste',
    config: { ...partykiste.defaultConfig(), minispiele: ['imposter'] },
    seats: 4,
    rounds: 3,
  });
  for (const konto of konten.slice(1)) await joinTable(h.ctx.db, table.id, konto.accountId);

  const clients: TestClient[] = [];
  for (const [i, konto] of konten.entries()) {
    const c = await TestClient.connect(h.wsUrl, await h.cookieFor(konto.accountId), namen[i]!);
    c.passive = true;
    c.join(table.id, partykiste.protocolVersion, 'partykiste');
    clients.push(c);
  }
  for (const c of clients) await c.waitFor(() => c.lastView !== null, 'erste Sicht');

  const tippe = (c: TestClient, action: object): void =>
    c.raw({ v: ENVELOPE_VERSION, game: 'partykiste', type: 'action', tableId: table.id, action });

  const [erster] = clients;
  assert.deepEqual(sicht(erster!).weiterFehlen, [0, 1, 2, 3], 'der Tisch wartet nicht auf alle vier');
  const nachSitz = [...clients].sort((a, b) => a.lastView!.seat! - b.lastView!.seat!);
  for (const c of nachSitz.slice(0, 3)) {
    const sitz = c.lastView!.seat!;
    tippe(c, { art: 'bereit' });
    await erster!.waitFor(() => !(sicht(erster!).weiterFehlen ?? []).includes(sitz), `Tipp von Sitz ${sitz}`);
  }
  assert.deepEqual(sicht(erster!).weiterFehlen, [3]);

  /* Der Letzte schickt die Marke des Bots mit — und bekommt den Wurf trotzdem. */
  tippe(nachSitz[3]!, { art: 'bereit', vertreten: true });
  await erster!.waitFor(() => sicht(erster!).letzterWurf !== null, 'Wurf fuer den Letzten');
  assert.equal(sicht(erster!).letzterWurf!.sitz, 3);
  for (const c of clients) c.close();
});
