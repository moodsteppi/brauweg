/**
 * Die Uhr der Partykiste (`phaseMs` / `phaseKey` / `phaseHidden` /
 * `advancePhase`), seit dem 23.09.2026 fuer Bombe, 10 Sekunden und
 * Koenigsbecher.
 *
 * Robins Entscheidung vom 22.09.2026: Die Uhr lebt auf dem SERVER, keine
 * Client-Uhr als zweite Fassung der Regel. Geprueft wird hier die
 * Plattformseite — dass die Frist ablaeuft und weiterschaltet, OHNE dass ein
 * Geraet etwas schickt, und dass die Restzeit der Bombe nie ueber die Leitung
 * geht. Was das Modul daraus macht, steht in
 * packages/game-partykiste/test/zeitdruck.test.ts.
 *
 * Vier Menschen, alle still (`passive`), dazu `botDelayMs` hoch: Kein Bot und
 * kein Testclient darf die Runde bewegen, nur die Frist. Die echten Fristen
 * (8 bis 25 s, 10 s) stehen ueber `phaseMaxMs` auf wenigen hundert
 * Millisekunden — derselbe Griff wie bei Eiland und Tafelrunde.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { partykiste } from '@brauweg/game-partykiste';

import { ENVELOPE_VERSION } from '../src/realtime/protocol.js';
import { startHarness, type Harness } from './harness.js';
import { createVerifiedAccount } from './helpers.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { TestClient } from './client.js';

interface Daten {
  art: string;
  verlierer?: number;
  sprecher?: number;
  schritt?: string;
}

function daten(c: TestClient): Daten {
  return (c.lastView!.view as { daten: Daten }).daten;
}

/** Vier Menschen an einem Tisch mit genau einem Minispiel. */
async function tischZuViert(h: Harness, minispiel: string) {
  const namen = ['Anna', 'Bert', 'Cleo', 'Dana'];
  const konten = [];
  for (const name of namen) konten.push(await createVerifiedAccount(h.ctx, name));
  const table = await createTable(h.ctx.db, {
    accountId: konten[0]!.accountId,
    gameId: 'partykiste',
    config: { ...partykiste.defaultConfig(), minispiele: [minispiel] },
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
  return { table, clients };
}

test('die Bombe geht auf dem Server hoch, ohne dass ein Geraet etwas schickt', async (t) => {
  const h = await startHarness({ phaseMaxMs: 400, botDelayMs: 60_000 });
  t.after(() => h.close());

  const { clients } = await tischZuViert(h, 'bombe');
  const [a] = clients;
  assert.equal(daten(a!).art, 'bombe');
  /* Der Tisch laeuft schon, waehrend die Clients sich verbinden — unter Last
     kann die Bombe bis zur ersten Sicht hochgegangen sein. Das ist dieselbe
     Aussage: Keiner der vier hat etwas geschickt. */
  await a!.waitFor(() => (daten(a!).verlierer ?? -1) >= 0, 'Knall nach Ablauf der Frist');
  assert.equal((a!.lastView!.view as { phase: string }).phase, 'ergebnis');

  /*
   * Und die Restzeit war nie auf dem Draht: In KEINER Sicht, die einer der
   * vier bekam, stand eine Frist — obwohl der Server eine gestellt hat (sonst
   * waere die Bombe nie hochgegangen).
   */
  for (const c of clients) {
    const sichten = c.verlauf.filter((m) => m.type === 'view') as { phaseDeadline: number | null }[];
    assert.ok(sichten.length > 0);
    assert.deepEqual(
      sichten.map((s) => s.phaseDeadline),
      sichten.map(() => null),
      'die Frist der Bombe ging ueber die Leitung',
    );
  }
  for (const c of clients) c.close();
});

test('10 Sekunden: nach „Los" schaltet die Uhr des Servers aufs Urteil', async (t) => {
  const h = await startHarness({ phaseMaxMs: 400, botDelayMs: 60_000 });
  t.after(() => h.close());

  const { table, clients } = await tischZuViert(h, 'zehnsekunden');
  const sprecher = daten(clients[0]!).sprecher!;
  const s = clients.find((c) => c.lastView!.seat === sprecher)!;
  assert.equal(daten(s).schritt, 'bereit');
  assert.equal(s.lastView!.phaseDeadline, null, 'vor „Los" laeuft schon eine Uhr');

  const revision = s.lastView!.revision;
  s.raw({ v: ENVELOPE_VERSION, game: 'partykiste', type: 'action', tableId: table.id, action: { art: 'bereit' } });
  await s.waitFor(() => s.lastView!.revision > revision, 'Sicht nach „Los"');

  /* Wenn die Last den Rundruf verzoegert, kann das Urteil schon da sein — dann gab es die Frist trotzdem. */
  if (daten(s).schritt === 'sprechen') {
    const frist = s.lastView!.phaseDeadline;
    assert.ok(frist !== null && frist > Date.now() - 5_000, 'die zehn Sekunden kamen ohne Frist');
  }

  /* Ab hier schickt niemand etwas. */
  for (const c of clients) await c.waitFor(() => daten(c).schritt === 'urteil', 'Urteil nach Ablauf der Frist');
  assert.equal(s.lastView!.phaseDeadline, null, 'geurteilt wird ohne Uhr');
  for (const c of clients) c.close();
});
