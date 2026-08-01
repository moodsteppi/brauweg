/**
 * Der Durchstich.
 *
 * Der Plan setzt die Messlatte selbst: "Erst wenn zwei Browser gegeneinander
 * eine Partie beenden koennen, geht es an die Gestaltung." Genau das wird hier
 * geprueft: zwei getrennte WebSocket-Verbindungen, zwei aufgefuellte
 * Botplaetze, eine vollstaendige Doppelkopf-Partie ueber die Schnittstelle.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { SESSION_COOKIE } from '../src/http/app.js';
import { login } from '../src/auth/service.js';
import { createVerifiedAccount, schema } from './helpers.js';
import { startHarness, tableWithTwoHumans } from './harness.js';
import { TestClient } from './client.js';


test('zwei Clients beenden eine vollstaendige Partie', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');

  a.join(table.id);
  await a.waitFor(() => a.lastView !== null, 'erste Sicht fuer Anna');
  b.join(table.id);
  await b.waitFor(() => b.lastView !== null, 'erste Sicht fuer Bert');

  assert.equal(a.lastView!.seat, 0);
  assert.equal(b.lastView!.seat, 1);
  assert.deepEqual([...a.lastView!.botSeats].sort(), [2, 3]);

  await a.waitFor(() => a.lastView?.finished === true, 'Partie-Ende', 60_000);
  await b.waitFor(() => b.lastView?.finished === true, 'Partie-Ende bei Bert', 60_000);

  assert.deepEqual(a.errors, [], 'kein Client-Fehler bei Anna');
  assert.deepEqual(b.errors, [], 'kein Client-Fehler bei Bert');

  // Die Partie ist abgerechnet und der Tisch geschlossen.
  const [party] = await h.ctx.db
    .select()
    .from(schema.party)
    .where(eq(schema.party.tableId, table.id));
  assert.equal(party!.status, 'finished');

  const [row] = await h.ctx.db
    .select()
    .from(schema.gameTable)
    .where(eq(schema.gameTable.id, table.id));
  assert.equal(row!.status, 'finished');

  // Vier Runden, vier abgelegte Rundenabrechnungen.
  const summaries = await h.ctx.db
    .select()
    .from(schema.roundSummary)
    .where(eq(schema.roundSummary.partyId, party!.id));
  assert.equal(summaries.length, 4);

  // Platzierungen liegen vor und sind vollstaendig.
  const standings = b.messages('party').at(-1)!.standings as { place: number }[];
  assert.equal(standings.length, 4);
  assert.ok(standings.some((standing) => standing.place === 1));

  a.close();
  b.close();
});

test('ein Tisch mit Bots zaehlt nicht fuer die Rangliste', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');

  a.join(table.id);
  b.join(table.id);
  await a.waitFor(() => a.lastView?.finished === true, 'Partie-Ende', 60_000);

  const ledger = await h.ctx.db.select().from(schema.trophyLedger);
  assert.equal(ledger.length, 0, 'Bots am Tisch schliessen die Wertung aus');

  a.close();
  b.close();
});

test('wer nicht am Tisch sitzt, bekommt die Zuschauersicht ohne Hand', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await tableWithTwoHumans(h);
  const cara = await createVerifiedAccount(h.ctx, 'Cara');

  const spieler = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  const zuschauer = await TestClient.connect(h.wsUrl, await h.cookieFor(cara.accountId));
  zuschauer.passive = true;

  spieler.passive = true;
  spieler.join(table.id);
  await spieler.waitFor(() => spieler.lastView !== null, 'Sicht des Spielers');
  zuschauer.join(table.id);
  await zuschauer.waitFor(() => zuschauer.lastView !== null, 'Sicht des Zuschauers');

  const view = zuschauer.lastView!;
  assert.equal(view.seat, null);
  assert.deepEqual(view.legalActions, []);

  const round = (view.view as { round: { hand: unknown[]; myParty: unknown } }).round;
  assert.deepEqual(round.hand, []);
  assert.equal(round.myParty, null);

  // Gegenprobe: Der Spieler sieht seine zwoelf Karten.
  const eigene = (spieler.lastView!.view as { round: { hand: unknown[] } }).round;
  assert.equal(eigene.hand.length, 12);

  spieler.close();
  zuschauer.close();
});

test('ein zu alter Client wird beim Beitritt abgewiesen, nicht mitten in der Partie', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await tableWithTwoHumans(h);
  const client = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  client.passive = true;

  // Das Modul steht auf Protokollversion 1, unterstuetzt werden 0 und 1.
  client.join(table.id, 99);
  await client.waitFor(() => client.errors.length > 0, 'Abweisung');
  assert.deepEqual(client.errors, ['clientTooOld']);

  client.close();
});

test('eine unbekannte Protokollversion des Rahmens wird abgewiesen', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await tableWithTwoHumans(h);
  const client = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  client.passive = true;

  client.raw({ v: 999, game: 'doppelkopf', type: 'join', tableId: table.id, moduleVersion: 1 });
  await client.waitFor(() => client.errors.length > 0, 'Abweisung');
  assert.deepEqual(client.errors, ['protocolVersionUnsupported']);

  client.close();
});

test('ohne gueltige Sitzung kommt keine Verbindung zustande', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const client = await TestClient.connect(h.wsUrl, `${SESSION_COOKIE}=ungueltig`);
  client.passive = true;
  await client.waitFor(() => client.errors.length > 0, 'Abweisung');
  assert.deepEqual(client.errors, ['unauthorized']);
});

test('eine regelwidrige Aktion wird abgewiesen, ohne den Tisch zu beschaedigen', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await tableWithTwoHumans(h);
  const client = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  client.passive = true;

  client.join(table.id);
  await client.waitFor(() => client.lastView !== null, 'erste Sicht');
  const revisionVorher = client.lastView!.revision;

  // Eine Karte, die dieser Sitz nicht hat, und ein fremder Sitz dazu.
  client.raw({
    v: 1,
    game: 'doppelkopf',
    type: 'action',
    tableId: table.id,
    action: { type: 'playCard', seat: 2, cardId: 999 },
  });

  await client.waitFor(() => client.errors.length > 0, 'Abweisung');
  assert.deepEqual(client.errors, ['actionRejected']);
  assert.equal(client.lastView!.revision, revisionVorher, 'der Zustand bleibt unberuehrt');

  client.close();
});

test('Reconnect liefert die vollstaendige aktuelle Sicht', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  // Beide Menschen muessen sitzen, sonst wartet die Partie zu Recht.
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));
  a.join(table.id);
  b.join(table.id);
  await a.waitFor(() => (a.lastView?.revision ?? 0) > 3, 'ein paar Zuege');

  const revision = a.lastView!.revision;
  a.close();

  // Neue Verbindung, neues Cookie derselben Person: Der Server schickt den
  // vollen Zustand, der Client haelt keinen eigenen Verlauf.
  const wieder = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  wieder.passive = true;
  wieder.join(table.id);
  await wieder.waitFor(() => wieder.lastView !== null, 'Sicht nach Reconnect');

  assert.ok(wieder.lastView!.revision >= revision);
  assert.equal(wieder.lastView!.seat, 0);
  assert.ok(
    (wieder.lastView!.view as { round: { hand: unknown[] } }).round.hand.length > 0,
    'die Hand ist wieder da',
  );

  b.close();
  wieder.close();
});

test('Anmeldung ueber HTTP setzt ein Cookie, das der WebSocket akzeptiert', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const { token } = await login(h.ctx.auth, anna.email, 'geheim-genug-1234');

  const client = await TestClient.connect(
    h.wsUrl,
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
  );
  client.passive = true;

  // Keine Fehlermeldung heisst: Die Sitzung wurde im Handshake akzeptiert.
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(client.errors, []);
  client.close();
});

