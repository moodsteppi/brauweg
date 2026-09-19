/**
 * Wartebereich.
 *
 * Ein Tisch mit freien Plaetzen ist kein Fehler, sondern der Normalzustand
 * jeder Lobby. Vorher lehnte der Server den Beitritt mit `tableNotFull` ab und
 * schickte keine Sicht — der Client wartete endlos auf etwas, das nie kam.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { type DokoView } from '@brauweg/game-doppelkopf';

import { type ViewMessage } from '../src/realtime/protocol.js';
import { joinTable } from '../src/tables/service.js';
import { createVerifiedAccount } from './helpers.js';
import { startHarness, waitingTable } from './harness.js';
import { TestClient } from './client.js';

/**
 * Die erste eingetroffene Sicht auf die FRISCH AUSGETEILTE erste Runde — nicht
 * die zuletzt eingetroffene.
 *
 * Kennzeichen ist die Vorbehaltsphase der Runde 0: Solange sie laeuft, hat
 * keine Karte die Hand verlassen. Das folgt aus dem Ablauf und ist keine
 * Faustregel — abgegeben wird erst beim Armutstausch (`armutExchange`) und
 * gelegt erst im Spiel (`playing`, siehe RoundPhase in round.ts). In der
 * Vorbehaltsphase haelt also jeder sein volles Blatt.
 *
 * Ohne das misst der Test unter Last etwas anderes, als er prueft: Die Bots
 * ziehen hier mit `botDelayMs: 0`, und `waitFor(() => lastView !== null)`
 * wartet zwar auf die erste Sicht, liefert aber die jeweils letzte. Ist
 * dazwischen ein Stich durchgelaufen, haelt Anna 11 Karten — derselbe Wackler
 * wie beim Cambio-Sichttest am 05.09.2026.
 */
function austeilsicht(client: TestClient): ViewMessage | null {
  for (const nachricht of client.verlauf) {
    if (nachricht.type !== 'view') continue;
    const sicht = nachricht.view as DokoView;
    if (sicht.roundIndex !== 0) continue;
    if (!sicht.round || sicht.round.phase !== 'vorbehalt') continue;
    return nachricht;
  }
  return null;
}

test('eine Nachricht direkt beim Verbinden geht nicht verloren', async (t) => {
  // Der Zuhoerer fuer eingehende Nachrichten hing frueher erst nach dem
  // Sitzungs-Nachschlag am Socket. Jeder Client schickt sein `join` aber
  // sofort beim Oeffnen - was in diese Luecke fiel, war weg: keine Antwort,
  // kein Fehler, endloses Laden. Ob es klappte, entschied die Tagesform der
  // Datenbank. Die Verzoegerung macht die Luecke hier sicher auf.
  const h = await startHarness({}, 150);
  t.after(() => h.close());

  const { anna, table } = await waitingTable(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;

  a.join(table.id);
  await a.waitFor(() => a.lastTable !== null, 'Antwort trotz langsamer Sitzungspruefung');
  assert.equal(a.lastTable!.status, 'waiting');
  assert.deepEqual(a.errors, []);

  a.close();
});

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
  // bekommt seine Karten. Gewartet wird auf die Austeilsicht selbst und nicht
  // auf "irgendeine Sicht" — die Bots ziehen hier ohne Verzoegerung weiter
  // (siehe austeilsicht oben). Die Zusicherung bleibt scharf: genau zwoelf
  // Karten, nicht "mindestens eine".
  await a.waitFor(() => austeilsicht(a) !== null, 'Partiebeginn', 30_000);
  const sicht = austeilsicht(a)!;
  assert.equal(sicht.seat, 0);
  assert.equal((sicht.view as DokoView).round!.hand.length, 12);
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
