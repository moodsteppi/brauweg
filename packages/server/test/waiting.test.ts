/**
 * Wartebereich.
 *
 * Ein Tisch mit freien Plaetzen ist kein Fehler, sondern der Normalzustand
 * jeder Lobby. Vorher lehnte der Server den Beitritt mit `tableNotFull` ab und
 * schickte keine Sicht — der Client wartete endlos auf etwas, das nie kam.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { joinTable } from '../src/tables/service.js';
import { createVerifiedAccount } from './helpers.js';
import { startHarness, waitingTable } from './harness.js';
import { TestClient } from './client.js';

test('ein Tisch mit freien Plaetzen antwortet mit dem Wartebereich, nicht mit einem Fehler', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await waitingTable(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;

  a.join(table.id);
  await a.waitFor(() => a.lastTable !== null, 'Tischzustand');

  assert.deepEqual(a.errors, [], 'kein Fehler, der Tisch wartet nur');
  assert.equal(a.lastTable!.status, 'waiting');
  assert.equal(a.lastTable!.missing, 3, 'drei Plaetze sind noch frei');
  assert.equal(a.lastTable!.seats.length, 4);
  assert.equal(a.lastTable!.seats[0]!.displayName, 'Anna');
  assert.equal(a.lastTable!.seats[1]!.displayName, null);
  assert.equal(a.lastView, null, 'ohne Partie gibt es keine Sicht');

  a.close();
});

test('wer schon wartet, sieht den Tisch sich fuellen', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await waitingTable(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;
  a.join(table.id);
  await a.waitFor(() => a.lastTable?.missing === 3, 'Ausgangslage');

  // Bert tritt ueber HTTP bei. Ohne Rundmeldung saesse Anna weiter vor "drei
  // Plaetze frei" und wuesste nichts davon.
  const bert = await createVerifiedAccount(h.ctx, 'Bert');
  await joinTable(h.ctx.db, table.id, bert.accountId);
  h.runtime.notify(table.id);

  await a.waitFor(() => a.lastTable?.missing === 2, 'aktualisierter Tischzustand');
  assert.equal(a.lastTable!.seats[1]!.displayName, 'Bert');

  a.close();
});

test('mit dem letzten Platz startet die Partie von selbst', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await waitingTable(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;
  a.join(table.id);
  await a.waitFor(() => a.lastTable !== null, 'Wartebereich');
  assert.equal(a.lastView, null);

  for (const name of ['Bert', 'Cara', 'Dora']) {
    const account = await createVerifiedAccount(h.ctx, name);
    await joinTable(h.ctx.db, table.id, account.accountId);
    h.runtime.notify(table.id);
  }

  // Kein weiterer Handgriff: Der volle Tisch startet, und wer schon wartet,
  // bekommt seine Karten.
  await a.waitFor(() => a.lastView !== null, 'Partiebeginn', 30_000);
  assert.equal(a.lastView!.seat, 0);
  assert.equal(
    (a.lastView!.view as { round: { hand: unknown[] } }).round.hand.length,
    12,
  );
  assert.deepEqual(a.errors, []);

  a.close();
});

test('ein spaeter Beitretender bekommt sofort die laufende Partie', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await waitingTable(h);
  const spaet = await createVerifiedAccount(h.ctx, 'Bert');

  for (const name of ['Cara', 'Dora']) {
    const account = await createVerifiedAccount(h.ctx, name);
    await joinTable(h.ctx.db, table.id, account.accountId);
  }
  await joinTable(h.ctx.db, table.id, spaet.accountId);

  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(spaet.accountId));
  b.passive = true;
  b.join(table.id);

  await b.waitFor(() => b.lastView !== null, 'Sicht des Beitretenden', 30_000);
  assert.ok(b.lastView!.seat !== null);
  assert.deepEqual(b.errors, []);

  void anna;
  b.close();
});
