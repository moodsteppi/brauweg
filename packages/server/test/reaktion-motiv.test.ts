/**
 * Reaktionen mit Motiv (Mememory).
 *
 * Seit dem 26. August kann statt eines Emojis ein gesammeltes Meme ueber den
 * Tisch fliegen. Drei Dinge muessen dabei stimmen, und zwei davon sind
 * Altlasten-Fallen:
 *
 *   1. **Das Motiv kommt an.** Sonst tippt einer auf sein Meme und drueben
 *      passiert nichts.
 *   2. **Ein Client der Version 2 bekommt es NICHT.** Er kennt die Nachricht,
 *      nicht aber das Feld — er zeigte das Emoji Nummer 0 und damit etwas
 *      anderes, als geschickt wurde. Emojis muss er weiterhin bekommen.
 *   3. **Der Absender bekommt nichts zurueck.** Er hat sein Meme schon
 *      fliegen sehen, bevor die Nachricht draussen war.
 *   4. **Hoechstens eines je Sekunde** (seit dem 27. August). Ein Emoji darf
 *      viermal je Sekunde kommen; ein Bild quer ueber das Brett ist etwas
 *      anderes, und der Gegner will sich in derselben Zeit Karten merken.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTable, joinTable } from '../src/tables/service.js';
import { createVerifiedAccount } from './helpers.js';
import { startHarness } from './harness.js';
import { TestClient } from './client.js';
import { ENVELOPE_VERSION } from '../src/realtime/protocol.js';

/** Regelsatz wie ihn der Mememory-Bildschirm aufmacht. */
const REGELN = { spalten: 4, zeilen: 6, merkzeitMs: 1100 };

async function tischZuZweit(h: Awaited<ReturnType<typeof startHarness>>) {
  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const bert = await createVerifiedAccount(h.ctx, 'Bert');
  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'mememory',
    config: REGELN,
    seats: 2,
    rounds: 1,
  });
  await joinTable(h.ctx.db, table.id, bert.accountId);
  return { anna, bert, table };
}

test('Ein Motiv fliegt zur Gegenseite, der Absender bekommt nichts zurueck', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());
  const { anna, bert, table } = await tischZuZweit(h);

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');
  a.passive = true;
  b.passive = true;
  a.join(table.id, 3, 'mememory');
  await a.waitFor(() => a.lastView !== null, 'erste Sicht fuer Anna');
  b.join(table.id, 3, 'mememory');
  await b.waitFor(() => b.lastView !== null, 'erste Sicht fuer Bert');

  a.raw({
    v: ENVELOPE_VERSION,
    game: 'mememory',
    type: 'reaktion',
    tableId: table.id,
    zeichen: 0,
    motiv: 'hoch-aabbccddee',
  });

  await b.waitFor(() => b.messages('reaktion').length > 0, 'Reaktion bei Bert');
  const angekommen = b.messages('reaktion')[0]!;
  assert.equal(angekommen.motiv, 'hoch-aabbccddee');
  // Der Sitz wird vom Server gestempelt, nie vom Absender behauptet.
  assert.equal(angekommen.seat, 0);
  assert.deepEqual(a.messages('reaktion'), [], 'der Absender sieht sein eigenes Meme lokal');

  await a.close();
  await b.close();
});

test('Ein Client der Version 2 bekommt Emojis, aber kein Motiv', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());
  const { anna, bert, table } = await tischZuZweit(h);

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const alt = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Alt');
  a.passive = true;
  alt.passive = true;
  a.join(table.id, 3, 'mememory');
  await a.waitFor(() => a.lastView !== null, 'erste Sicht fuer Anna');
  // Version 2: kennt Reaktionen, kennt das Feld `motiv` aber nicht.
  alt.join(table.id, 2, 'mememory');
  await alt.waitFor(() => alt.lastView !== null, 'erste Sicht fuer den alten Client');

  a.raw({
    v: ENVELOPE_VERSION,
    game: 'mememory',
    type: 'reaktion',
    tableId: table.id,
    zeichen: 0,
    motiv: 'hoch-aabbccddee',
  });
  // Warten, bis der Server die Bremse wieder freigibt (250 ms), sonst faellt
  // das Emoji als zu schnell weg und der Test bewiese nichts.
  await new Promise((r) => setTimeout(r, 320));
  a.raw({
    v: ENVELOPE_VERSION,
    game: 'mememory',
    type: 'reaktion',
    tableId: table.id,
    zeichen: 3,
  });

  await alt.waitFor(() => alt.messages('reaktion').length > 0, 'Emoji beim alten Client');
  const alle = alt.messages('reaktion');
  assert.equal(alle.length, 1, 'das Motiv haette nicht durchgehen duerfen');
  assert.equal(alle[0]!.zeichen, 3);
  assert.equal(alle[0]!.motiv, undefined);

  await a.close();
  await alt.close();
});

test('Eine erfundene Motivform faellt still durch', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());
  const { anna, bert, table } = await tischZuZweit(h);

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');
  a.passive = true;
  b.passive = true;
  a.join(table.id, 3, 'mememory');
  await a.waitFor(() => a.lastView !== null, 'erste Sicht fuer Anna');
  b.join(table.id, 3, 'mememory');
  await b.waitFor(() => b.lastView !== null, 'erste Sicht fuer Bert');

  // Freitext in der Form einer Kennung ist keine: Grossbuchstaben und
  // Leerzeichen gehen nicht durch die Pruefung im Gateway.
  a.raw({
    v: ENVELOPE_VERSION,
    game: 'mememory',
    type: 'reaktion',
    tableId: table.id,
    zeichen: 0,
    motiv: 'Du bist doof',
  });
  await new Promise((r) => setTimeout(r, 400));
  assert.deepEqual(b.messages('reaktion'), [], 'Freitext darf den Tisch nicht erreichen');

  await a.close();
  await b.close();
});

test('Ein Motiv je Sekunde — Emojis bleiben davon unberuehrt', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());
  const { anna, bert, table } = await tischZuZweit(h);

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');
  a.passive = true;
  b.passive = true;
  a.join(table.id, 3, 'mememory');
  await a.waitFor(() => a.lastView !== null, 'erste Sicht fuer Anna');
  b.join(table.id, 3, 'mememory');
  await b.waitFor(() => b.lastView !== null, 'erste Sicht fuer Bert');

  const wirf = (motiv?: string, zeichen = 0): void =>
    a.raw({
      v: ENVELOPE_VERSION,
      game: 'mememory',
      type: 'reaktion',
      tableId: table.id,
      zeichen,
      ...(motiv ? { motiv } : {}),
    });
  const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  // Die Zeitpunkte sind der Kern des Tests und keine Willkuer:
  //   0 ms   erstes Motiv - geht durch
  //   400 ms zweites Motiv - waere am Emoji-Deckel (250 ms) VORBEI und faellt
  //          trotzdem, also am Motiv-Deckel. Genau das soll bewiesen werden.
  //   700 ms Emoji - beweist, dass die Motivbremse Emojis nicht mitbremst
  //   1100 ms drittes Motiv - die Sekunde ist um, es geht wieder
  wirf('erstes-motiv');
  await warte(400);
  wirf('zweites-motiv');
  await warte(300);
  wirf(undefined, 3);
  await warte(400);
  wirf('drittes-motiv');

  await b.waitFor(() => b.messages('reaktion').length >= 3, 'drei Reaktionen bei Bert');
  // Noch einen Moment warten: Waere das zweite Motiv doch durchgekommen, soll
  // es hier auftauchen und den Test rot machen.
  await warte(300);

  const angekommen = b.messages('reaktion');
  assert.deepEqual(
    angekommen.map((n) => n.motiv ?? `emoji ${n.zeichen}`),
    ['erstes-motiv', 'emoji 3', 'drittes-motiv'],
    'das zweite Motiv kam zu frueh und darf nicht dabei sein',
  );

  await a.close();
  await b.close();
});
