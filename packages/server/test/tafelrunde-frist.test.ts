/**
 * Die Frist der Platzierungsphase (`phaseMs` / `advancePhase`).
 *
 * Bei Tafelrunde ruesten ALLE gleichzeitig. `currentActor` nennt trotzdem
 * einen Sitz, damit der Tisch von der Plattform ueberhaupt Timer bekommt —
 * aber die Zugzeit taugt dort nicht als Restzeit: `schedule` stellt sie bei
 * JEDER Aktion IRGENDEINES Sitzes neu, und beim Botsitz laesst sie sie ganz
 * weg. Bis zum 06.09.2026 hatte die Vorbereitung deshalb gar keinen Deckel;
 * am Bildschirm stand statt einer Uhr "2 von 4 bereit".
 *
 * Geprueft wird hier die Plattformseite: dass die Frist gestellt, ausgeliefert
 * und nach Ablauf vollstreckt wird — und dass sie NICHT wie die Zugzeit
 * zurueckfaellt, sobald jemand etwas kauft. Was das Modul daraus macht, steht
 * in packages/game-tafelrunde/test/adapter.test.ts.
 *
 * Die echte Frist sind 45 Sekunden. Hier steht sie ueber `phaseMaxMs` auf
 * wenigen hundert Millisekunden — derselbe Griff wie `interludeMaxMs` bei den
 * Schaupausen, aus demselben Grund.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { tafelrunde } from '@brauweg/game-tafelrunde';

import { ENVELOPE_VERSION } from '../src/realtime/protocol.js';
import { startHarness, type Harness } from './harness.js';
import { createVerifiedAccount } from './helpers.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { TestClient } from './client.js';

/** Zwei Sitze, zwei Menschen — damit kein Bot die Vorbereitung von selbst beendet. */
async function tischZuZweit(h: Harness) {
  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const bert = await createVerifiedAccount(h.ctx, 'Bert');

  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'tafelrunde',
    // Weggelassen heisst: der Regelsatz des Moduls. Eine Kopie hier waere eine
    // zweite Wahrheit ueber die Frist, die dieser Test gerade misst.
    seats: 2,
    rounds: 1,
  });
  await joinTable(h.ctx.db, table.id, bert.accountId);

  return { anna, bert, table };
}

/** Beide sitzen still da: Nichts als die Frist darf die Runde bewegen. */
async function stillAmTisch(h: Harness, tableId: string, anna: string, bert: string) {
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna), 'anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert), 'bert');
  a.passive = true;
  b.passive = true;
  a.join(tableId, tafelrunde.protocolVersion, 'tafelrunde');
  b.join(tableId, tafelrunde.protocolVersion, 'tafelrunde');
  await a.waitFor(() => a.lastView !== null, 'erste Sicht');
  return { a, b };
}

test('die Platzierungsphase bekommt eine Frist und liefert sie aus', async (t) => {
  // Lang genug, dass sie waehrend der Pruefung wirklich noch laeuft.
  const h = await startHarness({ phaseMaxMs: 5_000, botDelayMs: 60_000 });
  t.after(() => h.close());

  const { anna, bert, table } = await tischZuZweit(h);
  const { a, b } = await stillAmTisch(h, table.id, anna.accountId, bert.accountId);

  const sicht = a.lastView!;
  assert.equal((sicht.view as { phase: string }).phase, 'vorbereitung');
  assert.ok(
    sicht.phaseDeadline !== null && sicht.phaseDeadline > Date.now(),
    `keine Frist in der Sicht (phaseDeadline: ${sicht.phaseDeadline})`,
  );
  // Sie gilt fuer den TISCH und nicht fuer einen Sitz: Bert sieht dieselbe.
  await b.waitFor(() => b.lastView !== null, 'Sicht fuer Bert');
  assert.equal(b.lastView!.phaseDeadline, sicht.phaseDeadline);

  a.close();
  b.close();
});

test('eine Aktion schiebt die Frist nicht auf — anders als die Zugzeit', async (t) => {
  /*
   * Der Kern der Sache. `turnDeadline` faellt bei jeder Aktion auf den vollen
   * Wert zurueck; bei einem Spiel, in dem alle gleichzeitig handeln, laeuft
   * sie deshalb nie ab. Kaufte man jede halbe Minute eine Einheit, waere die
   * Vorbereitung unendlich lang.
   */
  const h = await startHarness({ phaseMaxMs: 5_000, botDelayMs: 60_000 });
  t.after(() => h.close());

  const { anna, bert, table } = await tischZuZweit(h);
  const { a, b } = await stillAmTisch(h, table.id, anna.accountId, bert.accountId);

  const vorher = a.lastView!.phaseDeadline;
  const revision = a.lastView!.revision;

  // Der erste Ladenplatz kostet 1 Gold, und zwei hat jeder zum Start.
  a.raw({
    v: ENVELOPE_VERSION,
    game: 'tafelrunde',
    type: 'action',
    tableId: table.id,
    action: { typ: 'kaufen', platz: 0 },
  });
  await a.waitFor(() => a.lastView!.revision > revision, 'Sicht nach dem Kauf');

  assert.equal(a.lastView!.phaseDeadline, vorher, 'die Frist ist beim Kauf zurueckgefallen');

  a.close();
  b.close();
});

test('nach Ablauf der Frist beginnt der Kampf, ohne dass jemand bereit meldet', async (t) => {
  const h = await startHarness({ phaseMaxMs: 150, interludeMaxMs: 150, botDelayMs: 60_000 });
  t.after(() => h.close());

  const { anna, bert, table } = await tischZuZweit(h);
  const { a, b } = await stillAmTisch(h, table.id, anna.accountId, bert.accountId);

  await a.waitFor(
    () => (a.lastView!.view as { phase: string }).phase === 'kampf',
    'Kampfphase nach Ablauf der Frist',
  );
  // Und danach geht es weiter: Die Kampfphase ist eine Schaupause, die von
  // selbst endet — die naechste Vorbereitung bekommt eine frische Frist.
  await a.waitFor(
    () => (a.lastView!.view as { runde: number }).runde === 2,
    'zweite Runde',
  );
  assert.ok(
    a.lastView!.phaseDeadline !== null && a.lastView!.phaseDeadline > Date.now(),
    'die zweite Vorbereitung laeuft ohne Frist',
  );

  a.close();
  b.close();
});

test('waehrend der Kampfphase laeuft keine Phasenfrist', async (t) => {
  /*
   * Zwei Uhren nebeneinander waeren zwei Antworten auf dieselbe Frage. Im
   * Kampf gilt die Schaupause (`interludeDeadline`), und die Phasenfrist muss
   * dort auf null stehen — sonst zaehlte der Bildschirm die falsche herunter.
   */
  const h = await startHarness({ phaseMaxMs: 150, interludeMaxMs: 5_000, botDelayMs: 60_000 });
  t.after(() => h.close());

  const { anna, bert, table } = await tischZuZweit(h);
  const { a, b } = await stillAmTisch(h, table.id, anna.accountId, bert.accountId);

  await a.waitFor(
    () => (a.lastView!.view as { phase: string }).phase === 'kampf',
    'Kampfphase',
  );
  assert.equal(a.lastView!.phaseDeadline, null);
  assert.ok(a.lastView!.interludeDeadline !== null, 'keine Schaupause im Kampf');

  a.close();
  b.close();
});
