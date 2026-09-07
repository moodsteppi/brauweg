/**
 * Die Rundenfrist von Eiland (`phaseMs` / `phaseKey` / `advancePhase`).
 *
 * Eiland ist das zweite Spiel, in dem beide Sitze GLEICHZEITIG waehlen;
 * `currentActor` nennt nur deshalb einen Sitz, damit der Tisch von der
 * Plattform ueberhaupt Timer bekommt. Die Zugzeit taugt dort so wenig wie bei
 * Tafelrunde: Sie faellt bei jeder Aktion irgendeines Sitzes auf den vollen
 * Wert zurueck und am Botsitz ganz weg.
 *
 * Der Unterschied zu Tafelrunde — und der Grund, warum diese Datei neben
 * tafelrunde-frist.test.ts steht: Dort liegt zwischen zwei Vorbereitungen die
 * Kampfphase, und an ihrem null erkennt die Plattform die neue Phase. Hier
 * folgen die Runden OHNE etwas dazwischen aufeinander. Die neue Frist haengt
 * deshalb allein an `phaseKey` (der Rundennummer) — geht der Vergleich in
 * `schedulePhase` verloren, laeuft die Frist der ersten Runde weiter und jede
 * spaetere Runde endet augenblicklich.
 *
 * Die echte Frist sind 60 Sekunden. Hier steht sie ueber `phaseMaxMs` auf
 * wenigen hundert Millisekunden — derselbe Griff wie bei den Schaupausen.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { eiland } from '@brauweg/game-eiland';

import { ENVELOPE_VERSION } from '../src/realtime/protocol.js';
import { startHarness, type Harness } from './harness.js';
import { createVerifiedAccount } from './helpers.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { TestClient } from './client.js';

/** Zwei Menschen — damit kein Bot die Runde von selbst beendet. */
async function tischZuZweit(h: Harness) {
  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const bert = await createVerifiedAccount(h.ctx, 'Bert');

  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'eiland',
    // Ohne `config`: Der Regelsatz kommt vom Modul. Eine Kopie hier waere eine
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
  a.join(tableId, eiland.protocolVersion, 'eiland');
  b.join(tableId, eiland.protocolVersion, 'eiland');
  await a.waitFor(() => a.lastView !== null, 'erste Sicht');
  await b.waitFor(() => b.lastView !== null, 'Sicht fuer Bert');
  return { a, b };
}

test('die Runde bekommt eine Frist, und beide Sitze sehen dieselbe', async (t) => {
  const h = await startHarness({ phaseMaxMs: 5_000, botDelayMs: 60_000 });
  t.after(() => h.close());

  const { anna, bert, table } = await tischZuZweit(h);
  const { a, b } = await stillAmTisch(h, table.id, anna.accountId, bert.accountId);

  const sicht = a.lastView!;
  assert.ok(
    sicht.phaseDeadline !== null && sicht.phaseDeadline > Date.now(),
    `keine Frist in der Sicht (phaseDeadline: ${sicht.phaseDeadline})`,
  );
  // Sie gilt fuer den TISCH und nicht fuer einen Sitz.
  assert.equal(b.lastView!.phaseDeadline, sicht.phaseDeadline);

  a.close();
  b.close();
});

test('ein abgegebener Zettel schiebt die Frist nicht auf', async (t) => {
  /*
   * Der Kern der Sache: `turnDeadline` faellt bei jeder Aktion auf den vollen
   * Wert zurueck. Gaebe Anna jede halbe Minute ab, waere die Runde ohne diese
   * Frist unendlich lang, solange Bert nichts tut.
   */
  const h = await startHarness({ phaseMaxMs: 5_000, botDelayMs: 60_000 });
  t.after(() => h.close());

  const { anna, bert, table } = await tischZuZweit(h);
  const { a, b } = await stillAmTisch(h, table.id, anna.accountId, bert.accountId);

  const vorher = a.lastView!.phaseDeadline;
  const revision = a.lastView!.revision;
  const feld = (a.lastView!.view as { waehlbar: number[] }).waehlbar[0]!;

  a.raw({
    v: ENVELOPE_VERSION,
    game: 'eiland',
    type: 'action',
    tableId: table.id,
    action: { typ: 'plan', felder: [feld] },
  });
  await a.waitFor(() => a.lastView!.revision > revision, 'Sicht nach der Abgabe');

  assert.equal(a.lastView!.phaseDeadline, vorher, 'die Frist ist bei der Abgabe zurueckgefallen');

  a.close();
  b.close();
});

test('nach Ablauf wird aufgeloest, und die naechste Runde bekommt eine frische Frist', async (t) => {
  /*
   * Ohne den Vergleich ueber `phaseKey` bliebe die Uhr der ersten Runde
   * stehen: Sie liefe entweder bis zum Partieende durch (dann endete jede
   * weitere Runde sofort) oder gar nicht mehr. Genau das prueft dieser Test —
   * die zweite Runde muss eine Frist bekommen, die SPAETER liegt als die
   * erste.
   */
  const h = await startHarness({ phaseMaxMs: 200, botDelayMs: 60_000 });
  t.after(() => h.close());

  const { anna, bert, table } = await tischZuZweit(h);
  const { a, b } = await stillAmTisch(h, table.id, anna.accountId, bert.accountId);

  const ersteFrist = a.lastView!.phaseDeadline!;
  await a.waitFor(
    () => (a.lastView!.view as { runde: number }).runde >= 2,
    'zweite Runde nach Ablauf der Frist',
  );

  const zweiteFrist = a.lastView!.phaseDeadline;
  assert.ok(
    zweiteFrist !== null && zweiteFrist > ersteFrist,
    `die zweite Runde erbte die Frist der ersten (${zweiteFrist} gegen ${ersteFrist})`,
  );

  // Und weiter als bis zur dritten Runde kommt ein toter Tisch nicht: Zwei
  // Runden ohne Feldwechsel beenden die Partie (LEERRUNDEN_MAX in partie.ts).
  await a.waitFor(() => a.lastView!.finished, 'Partieende nach zwei Leerrunden');
  assert.equal(a.lastView!.phaseDeadline, null, 'am Partieende laeuft noch eine Frist');

  a.close();
  b.close();
});
