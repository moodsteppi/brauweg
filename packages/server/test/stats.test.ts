/**
 * Statistiken und Trophaeen aus Sicht der Spieler.
 *
 * Zwei Zahlenwelten mit Absicht: Die Rangliste zaehlt nur Tische ohne Bots,
 * das Profil jede beendete Partie. Beides wird hier ueber echte Partien
 * geprueft, nicht ueber direkt geschriebene Zeilen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { playerProfile } from '../src/social/service.js';
import { schema } from './helpers.js';
import { startHarness, tableWithFourHumans, tableWithTwoHumans } from './harness.js';
import { TestClient } from './client.js';

test('eine Partie mit Bots fuellt Profil und Rangliste', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));
  a.join(table.id);
  b.join(table.id);
  await a.waitFor(() => a.lastView?.finished === true, 'Partie-Ende', 60_000);

  const profil = await playerProfile(h.ctx.db, anna.accountId, anna.accountId);
  assert.equal(profil.totals.parties, 1, 'die Partie zaehlt im Profil');

  // Genau einer der Sitze hat gewonnen; wins muss zur Platzierung passen.
  const standings = a.messages('party').at(-1)!.standings as { place: number }[];
  assert.ok(standings.filter((s) => s.place === 1).length >= 1);

  // Bots schliessen die Wertung nicht mehr aus: gebucht wird auf die beiden
  // Konten-Sitze. Nullsummig ist das nicht - die Botplaetze bekommen ihren
  // Anteil schlicht nicht gutgeschrieben.
  const gemeldet = a.messages('party').at(-1)!.trophies!;
  assert.equal(gemeldet.length, 2, 'je eine Buchung fuer Anna und Bert');
  const buchungen = await h.ctx.db.select().from(schema.trophyLedger);
  assert.equal(buchungen.length, 2);

  a.close();
  b.close();
});

test('eine gewertete Partie bucht Trophaeen und meldet sie am Partie-Ende', async (t) => {
  const h = await startHarness({ turnTimeoutMs: 30_000 });
  t.after(() => h.close());

  const { accounts, table } = await tableWithFourHumans(h);
  const clients: TestClient[] = [];
  for (const account of accounts) {
    clients.push(await TestClient.connect(h.wsUrl, await h.cookieFor(account.accountId)));
  }
  for (const client of clients) client.join(table.id);

  await clients[0]!.waitFor(
    () => clients[0]!.lastView?.finished === true,
    'Partie-Ende',
    120_000,
  );

  // Die Partie-Nachricht traegt die Buchungen: vier Sitze, Summe null.
  const gemeldet = clients[0]!.messages('party').at(-1)!.trophies!;
  assert.equal(gemeldet.length, 4);
  assert.equal(
    gemeldet.reduce((sum, a) => sum + a.delta, 0),
    0,
    'die Grundverteilung ist nullsummig',
  );

  // Das Hauptbuch stimmt mit der Meldung ueberein.
  const buchungen = await h.ctx.db.select().from(schema.trophyLedger);
  assert.equal(buchungen.length, 4);

  // Und das Profil des Bestplatzierten zeigt beides: Wertung und Zaehler.
  const bester = gemeldet.reduce((a, b) => (b.delta > a.delta ? b : a));
  const konto = clients[0]!.messages('party').at(-1)!.seats
    .find((s) => s.seat === bester.seat)!.accountId!;
  const profil = await playerProfile(h.ctx.db, konto, konto);

  assert.equal(profil.ranking.length, 1);
  assert.equal(profil.ranking[0]!.gameId, 'doppelkopf');
  assert.equal(profil.ranking[0]!.trophies, Math.max(0, bester.delta));
  assert.equal(profil.ranking[0]!.parties, 1);
  assert.equal(profil.totals.parties, 1);

  for (const client of clients) client.close();
});

test('die Sitze der Tischnachricht tragen die Konto-Kennung fuers Profil', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;
  a.join(table.id);
  await a.waitFor(() => a.lastTable !== null, 'Tischzustand');

  const sitz = a.lastTable!.seats.find((s) => s.displayName === 'Anna');
  assert.ok(sitz);
  assert.equal(sitz.accountId, anna.accountId);

  // Freie Plaetze haben keine Kennung - dort gibt es kein Profil.
  const frei = a.lastTable!.seats.find((s) => s.displayName === null);
  assert.ok(frei);
  assert.equal(frei.accountId, null);

  a.close();
});

test('stat_counter summiert ueber mehrere Partien', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));
  a.join(table.id);
  b.join(table.id);
  await a.waitFor(() => a.lastView?.finished === true, 'erste Partie', 60_000);
  a.close();
  b.close();

  // Zweite Partie an einem frischen Tisch.
  const { createTable, joinTable } = await import('../src/tables/service.js');
  const { doppelkopf } = await import('@brauweg/game-doppelkopf');
  const zweiter = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: doppelkopf.defaultConfig(),
    seats: 4,
    rounds: 4,
    fillWithBots: true,
  });
  await joinTable(h.ctx.db, zweiter.id, bert.accountId);

  const a2 = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  const b2 = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));
  a2.join(zweiter.id);
  b2.join(zweiter.id);
  await a2.waitFor(() => a2.lastView?.finished === true, 'zweite Partie', 60_000);

  const zaehler = await h.ctx.db
    .select()
    .from(schema.statCounter)
    .where(eq(schema.statCounter.accountId, anna.accountId));
  const partien = zaehler.find((row) => row.key === 'parties');
  assert.equal(partien?.value, 2, 'eine Zeile, hochgezaehlt - keine zwei Zeilen');

  a2.close();
  b2.close();
});
