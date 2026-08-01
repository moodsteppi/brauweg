/**
 * Zugzeit, Bot-Uebernahme und Verlassen.
 *
 * Die Zugzeit betraegt im Betrieb 60 Sekunden und wird serverseitig gemessen.
 * Hier steht sie auf wenigen Millisekunden, damit dieselbe Logik in
 * vertretbarer Zeit durchlaeuft.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { schema } from './helpers.js';
import { startHarness, tableWithFourHumans, tableWithTwoHumans } from './harness.js';
import { TestClient } from './client.js';

test('ein einzelner Timeout loest den Tisch nicht auf, der Bot springt ein', async (t) => {
  const h = await startHarness({ turnTimeoutMs: 40, timeoutsUntilLeave: 3 });
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

test('drei aufeinanderfolgende Timeouts gelten als Verlassen', async (t) => {
  const h = await startHarness({ turnTimeoutMs: 30, timeoutsUntilLeave: 3 });
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));
  b.passive = true;

  a.join(table.id);
  b.join(table.id);

  await a.waitFor(
    () => (a.lastView?.leftSeats.length ?? 0) > 0 || a.lastView?.finished === true,
    'Wertung als Verlassen',
    30_000,
  );

  const party = h.runtime.get(table.id);
  assert.ok(party, 'die Partie liegt noch fuer das Partie-Ende bereit');
  assert.ok(party.leftSeats.size > 0, 'mindestens ein Sitz gilt als ausgestiegen');

  a.close();
  b.close();
});

test('ein Zug beendet die Bot-Uebernahme und setzt den Zaehler zurueck', async (t) => {
  // Grosszuegige Zugzeit, damit der zurueckkehrende Client sie sicher trifft.
  const h = await startHarness({ turnTimeoutMs: 400, timeoutsUntilLeave: 3 });
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

  a.close();
  b.close();
});

test('Verlassen kostet zehn Trophaeen und wird als Letzter gewertet', async (t) => {
  const h = await startHarness({ turnTimeoutMs: 25, timeoutsUntilLeave: 3, graceRounds: 0 });
  t.after(() => h.close());

  // Vier Menschen: Nur ein Tisch ohne Bots zaehlt fuer die Rangliste.
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

  a.close();
  b.close();
});

