/**
 * Zugzeit, Bot-Uebernahme und Verlassen.
 *
 * Die Zugzeit betraegt im Betrieb 60 Sekunden und wird serverseitig gemessen,
 * die Abwesenheitsgrenze 5 Minuten. Hier stehen beide auf wenigen
 * Millisekunden, damit dieselbe Logik in vertretbarer Zeit durchlaeuft.
 *
 * Die Regel dahinter, festgelegt am 19. August 2026:
 *
 * - **Tisch mit Botsitz:** wird nie aufgeloest. Verschwindet jemand,
 *   uebernimmt ein Bot und die Partie laeuft zu Ende — ein Bot mehr ist dort
 *   der Normalfall.
 * - **Reiner Vierertisch:** ein Bot uebernimmt auch, aber wer laenger als
 *   `absenceMs` weg bleibt, gilt als ausgestiegen. Aufgeloest wird dann erst
 *   an der Rundengrenze, nie mitten in der Runde.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { schema } from './helpers.js';
import { startHarness, tableWithFourHumans, tableWithTwoHumans } from './harness.js';
import { TestClient } from './client.js';

test('ein einzelner Timeout loest den Tisch nicht auf, der Bot springt ein', async (t) => {
  const h = await startHarness({ turnTimeoutMs: 40, absenceMs: 60_000 });
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);

  // Anna sitzt da und tut nichts. Ein Funkloch, eine Tuerklingel.
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));
  b.passive = true;

  a.join(table.id);
  b.join(table.id);
  await a.waitFor(() => a.lastView !== null, 'erste Sicht');

  await a.waitFor(
    () => a.lastView?.botSeats.includes(0),
    'Bot-Uebernahme fuer Sitz 0',
  );

  // Bot-Uebernahme ist fuer alle sichtbar, nicht nur fuer den Betroffenen.
  await b.waitFor(() => b.lastView?.botSeats.includes(0), 'Sichtbarkeit fuer Bert');

  // Der Spieler bleibt am Tisch: Sitz 0 gehoert weiterhin Anna.
  const seats = await h.ctx.db
    .select()
    .from(schema.tableSeat)
    .where(eq(schema.tableSeat.tableId, table.id));
  assert.equal(seats.find((seat) => seat.seatIndex === 0)!.accountId, anna.accountId);

  a.close();
  b.close();
});

test('Am aufgefuellten Tisch wird niemand rausgeworfen — der Bot spielt zu Ende', async (t) => {
  // Frueher galten drei verpasste Zuege als Verlassen und der Tisch loeste
  // sich auf. An einem Tisch, an dem ohnehin zwei Bots sitzen, ist das kein
  // Gewinn fuer irgendwen: Der dritte Bot faellt niemandem auf, ein
  // abgebrochener Tisch schon.
  const h = await startHarness({ turnTimeoutMs: 20, absenceMs: 30 });
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));
  b.passive = true;

  a.join(table.id);
  b.join(table.id);

  // Beide sitzen die ganze Partie aus. Die Bots spielen sie regulaer zu Ende.
  await a.waitFor(() => a.lastView?.finished === true, 'Partie laeuft durch', 60_000);

  const party = h.runtime.get(table.id)!;
  assert.equal(party.endAfterRound, false, 'ein Bottisch wird nicht aufgeloest');

  // Alle vier Runden sind gespielt, nicht mittendrin abgerechnet.
  const runden = await h.ctx.db
    .select()
    .from(schema.roundSummary)
    .where(eq(schema.roundSummary.partyId, party.partyId));
  assert.equal(runden.length, 4, 'die Partie ist ueber die volle Distanz gegangen');

  a.close();
  b.close();
});

test('ein Zug beendet die Bot-Uebernahme und setzt die Abwesenheit zurueck', async (t) => {
  // Grosszuegige Zugzeit, damit der zurueckkehrende Client sie sicher trifft.
  const h = await startHarness({ turnTimeoutMs: 400, absenceMs: 60_000 });
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));

  a.join(table.id);
  b.join(table.id);
  await a.waitFor(() => a.lastView?.botSeats.includes(0), 'Bot-Uebernahme');

  // Anna kommt zurueck und spielt wieder selbst.
  a.passive = false;
  await a.waitFor(
    () => !a.lastView?.botSeats.includes(0) || a.lastView?.finished === true,
    'Rueckkehr an den eigenen Sitz',
    30_000,
  );

  const party = h.runtime.get(table.id);
  assert.equal(party?.absentSince.has(0), false, 'die Abwesenheitsuhr steht wieder');

  a.close();
  b.close();
});

test('Verlassen kostet zehn Trophaeen und wird als Letzter gewertet', async (t) => {
  const h = await startHarness({ turnTimeoutMs: 25, absenceMs: 20 });
  t.after(() => h.close());

  // Vier Menschen: Nur ein Tisch ohne Bots loest sich ueberhaupt auf.
  const { accounts, table } = await tableWithFourHumans(h);

  const clients: TestClient[] = [];
  for (const account of accounts) {
    clients.push(await TestClient.connect(h.wsUrl, await h.cookieFor(account.accountId)));
  }
  // Dora reagiert nicht.
  clients[3]!.passive = true;

  for (const client of clients) client.join(table.id);

  await clients[0]!.waitFor(
    () => clients[0]!.lastView?.finished === true,
    'Partie-Ende nach Verlassen',
    60_000,
  );

  const ledger = await h.ctx.db.select().from(schema.trophyLedger);
  const strafe = ledger.filter((entry) => entry.reason === 'leave_penalty');

  assert.ok(strafe.length > 0, 'die Verlassen-Strafe muss gebucht sein');
  assert.equal(strafe[0]!.delta, -10);
  assert.ok(
    ledger.some((entry) => entry.reason === 'party_result'),
    'die regulaere Wertung wird zusaetzlich gebucht',
  );

  // Der Kern des Fehlers vom 19. August: Abgerechnet wird an der
  // Rundengrenze. Eine angefangene Runde darf nicht verfallen — es muss
  // mindestens eine vollstaendige Runde in den Buechern stehen.
  const party = h.runtime.get(table.id)!;
  const runden = await h.ctx.db
    .select()
    .from(schema.roundSummary)
    .where(eq(schema.roundSummary.partyId, party.partyId));
  assert.ok(runden.length > 0, 'die laufende Runde wurde zu Ende gespielt');

  for (const client of clients) client.close();
});

test('Kontoloeschung waehrend laufender Partie gilt als Verlassen', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));
  b.passive = true;

  a.join(table.id);
  b.join(table.id);
  await a.waitFor(() => a.lastView !== null, 'erste Sicht');

  await h.runtime.markLeftByAccount(table.id, anna.accountId);

  const party = h.runtime.get(table.id);
  assert.ok(party!.leftSeats.has(0));
  assert.ok(party!.botControlled.has(0), 'der Bot uebernimmt den Sitz');
  // Der Account ist weg, aber der Tisch hat Botsitze: Er laeuft weiter.
  assert.equal(party!.endAfterRound, false, 'ein Bottisch wird nicht aufgeloest');

  a.close();
  b.close();
});
