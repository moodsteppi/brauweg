/**
 * Ein Herzschlag darf den Zug desselben Absenders nicht ueberholen.
 *
 * Am 10. August 2026 im Mitschnitt einer echten Partie gefunden
 * (docs/FELDHERR-DIAGNOSE.md): Der `takt`-Zweig des Gateways ist synchron
 * und geht sofort raus, der `action`-Zweig wartet auf die Datenbank. Weil
 * die Nachrichten EINER Verbindung nebeneinander liefen, kam beim Gegner
 * ein Puls an, der nach dem Zug abgeschickt worden war — und der Puls sagt
 * ihm, wie weit er rechnen darf. Er rechnete ueber den Takt des Zuges
 * hinaus, den er noch gar nicht hatte, und die Partie war strittig.
 *
 * Die Probe schickt beides unmittelbar hintereinander und sieht nach, was
 * beim Gegner zuerst ankommt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTable, joinTable } from '../src/tables/service.js';
import { ENVELOPE_VERSION } from '../src/realtime/protocol.js';
import { createVerifiedAccount } from './helpers.js';
import { startHarness, type Harness } from './harness.js';
import { TestClient } from './client.js';

async function feldherrTisch(h: Harness) {
  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const bert = await createVerifiedAccount(h.ctx, 'Bert');
  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'feldherr',
    config: { feld: 'mittel' },
    seats: 2,
    rounds: 1,
  });
  await joinTable(h.ctx.db, table.id, bert.accountId);
  return { anna, bert, table };
}

test('der Herzschlag ueberholt den Zug desselben Absenders nicht', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await feldherrTisch(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');
  t.after(() => {
    a.close();
    b.close();
  });
  a.passive = true;
  b.passive = true;
  a.join(table.id, 2, 'feldherr');
  b.join(table.id, 2, 'feldherr');
  await a.waitFor(() => a.lastView !== null, 'Partiebeginn bei Anna', 30_000);
  await b.waitFor(() => b.lastView !== null, 'Partiebeginn bei Bert', 30_000);

  const vorher = b.messages('view').length;

  /**
   * Zug und Herzschlag in derselben Schleifendrehung — genau die Reihenfolge,
   * die der Spielkern erzeugt: Er meldet den Zug und pulst kurz darauf
   * weiter. Der Puls traegt einen Stand, den die Gegenseite nur rechnen
   * darf, WENN sie den Zug schon hat.
   */
  a.raw({
    v: ENVELOPE_VERSION,
    game: 'feldherr',
    type: 'action',
    tableId: table.id,
    action: { art: 'zug', zug: { takt: 40, art: 'karte', karte: 'schwert', r: 5, c: 3 } },
  });
  a.raw({
    v: ENVELOPE_VERSION,
    game: 'feldherr',
    type: 'takt',
    tableId: table.id,
    takt: 30,
    grenzTakt: 0,
    pruef: 'abc',
    zuege: 0,
  });

  await b.waitFor(() => b.messages('view').length > vorher, 'Zug bei Bert', 30_000);
  await b.waitFor(() => b.messages('takt').length > 0, 'Herzschlag bei Bert', 30_000);

  /**
   * Der Beweis: In Bert's Verlauf steht die Sicht mit dem Zug VOR dem
   * Herzschlag. Ohne die Kette je Verbindung (siehe `accept` im Gateway)
   * ginge der Puls sofort raus, waehrend der Zug noch in der Datenbank
   * haengt — dann stuende er hier vorn.
   */
  const arten = b.verlauf.map((m) => m.type);
  const sicht = arten.indexOf('view', vorher > 0 ? arten.indexOf('view') + 1 : 0);
  const puls = arten.indexOf('takt');
  assert.ok(puls >= 0, 'der Herzschlag kommt an');
  assert.ok(sicht >= 0, 'die Sicht mit dem Zug kommt an');
  assert.ok(
    sicht < puls,
    `die Sicht mit dem Zug muss VOR dem Herzschlag ankommen (Sicht ${sicht}, Puls ${puls}): ` +
      arten.join(','),
  );
});

test('der Herzschlag reicht die Zugzahl unveraendert weiter', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await feldherrTisch(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');
  t.after(() => {
    a.close();
    b.close();
  });
  a.passive = true;
  b.passive = true;
  a.join(table.id, 2, 'feldherr');
  b.join(table.id, 2, 'feldherr');
  await b.waitFor(() => b.lastView !== null, 'Partiebeginn bei Bert', 30_000);

  a.raw({
    v: ENVELOPE_VERSION,
    game: 'feldherr',
    type: 'takt',
    tableId: table.id,
    takt: 12,
    grenzTakt: 0,
    pruef: 'x',
    zuege: 7,
  });
  await b.waitFor(() => b.messages('takt').length > 0, 'Herzschlag bei Bert', 30_000);

  /* Ohne diese Zahl loest die Gegenseite ihren Melde-Deckel beim eigenen
   * Echo — und genau das war die zweite Haelfte des Fehlers. */
  assert.equal(b.messages('takt')[0]!.zuege, 7);

  /* Und ohne das Feld bleibt es dabei: Ein aelterer Kern sendet es nicht,
   * und der Server darf dann auch keines erfinden.
   *
   * Die Pause muss sein: Das Gateway wirft Pulse weg, die dichter als
   * 60 ms aufeinander folgen (Bremse gegen Dauerfeuer). Ohne sie prueft man
   * die Bremse statt der Weitergabe. */
  await new Promise((fertig) => setTimeout(fertig, 120));
  a.raw({
    v: ENVELOPE_VERSION,
    game: 'feldherr',
    type: 'takt',
    tableId: table.id,
    takt: 13,
    grenzTakt: 0,
    pruef: 'x',
  });
  await b.waitFor(() => b.messages('takt').length > 1, 'zweiter Herzschlag', 30_000);
  assert.equal(b.messages('takt')[1]!.zuege, undefined);
});
