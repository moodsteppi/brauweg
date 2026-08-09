/**
 * Die Sicht einer Feldherr-Partie waechst nicht mehr mit.
 *
 * Feldherr rechnet im Gleichschritt: Der Server verwahrt nur Saatkorn und
 * Zugliste, die Geraete rechnen daraus dieselbe Partie. Die Zugliste ist
 * damit das Gedaechtnis der ganzen Partie — und sie wurde bei JEDEM Zug
 * vollstaendig an beide Geraete geschickt. Ueber eine Partie hinweg kostet
 * das das Quadrat: gemessen 40 MB statt 0,1 MB bei 800 Zuegen, und jedes
 * einzelne dieser Pakete muss ein Handy mitten in der laufenden Simulation
 * zerlegen. Genau das war das Ruckeln, das mit der Spieldauer schlimmer
 * wurde.
 *
 * Jetzt schickt der Rundruf nur den Zuwachs (`abIndex`), und das `join`
 * bleibt die vollstaendige Sicht — damit niemand auf einem Loch sitzt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTable, joinTable } from '../src/tables/service.js';
import { ENVELOPE_VERSION } from '../src/realtime/protocol.js';
import { createVerifiedAccount } from './helpers.js';
import { startHarness, type Harness } from './harness.js';
import { TestClient } from './client.js';

interface FeldherrSicht {
  readonly saat: number;
  readonly zuege: readonly { readonly takt: number; readonly sitz: number }[];
  readonly abIndex: number;
}

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

/** Ein Zug, wie ihn der Spielkern meldet. */
function zug(client: TestClient, tableId: string, takt: number): void {
  client.raw({
    v: ENVELOPE_VERSION,
    game: 'feldherr',
    type: 'action',
    tableId,
    action: { art: 'zug', zug: { takt, art: 'karte', karte: 'schwert', r: 5, c: 3 } },
  });
}

/** Alle Sichten dieses Clients, in der Reihenfolge des Eintreffens. */
function sichten(client: TestClient): FeldherrSicht[] {
  return client.messages('view').map((m) => m.view as unknown as FeldherrSicht);
}

test('der Rundruf nach einem Zug traegt nur den Zuwachs', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await feldherrTisch(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');
  a.passive = true;
  b.passive = true;
  a.join(table.id, 1, 'feldherr');
  b.join(table.id, 1, 'feldherr');
  await a.waitFor(() => a.lastView !== null, 'Partiebeginn bei Anna', 30_000);
  await b.waitFor(() => b.lastView !== null, 'Partiebeginn bei Bert', 30_000);

  // Die erste Sicht ist die Antwort auf das `join` und deshalb vollstaendig.
  assert.equal(sichten(a)[0]!.abIndex, 0, 'das join beantwortet der Server voll');
  assert.ok(sichten(a)[0]!.saat > 0, 'das Saatkorn steht in jeder Sicht');

  // Zwoelf Zuege im Wechsel, wie in einer echten Partie.
  const takte: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    const wer = i % 2 === 0 ? a : b;
    const takt = 20 + i * 10;
    takte.push(takt);
    zug(wer, table.id, takt);
    await a.waitFor(
      () => zusammengesetzt(a).length === i + 1,
      `Anna sieht Zug ${i + 1}`,
      10_000,
    );
    await b.waitFor(
      () => zusammengesetzt(b).length === i + 1,
      `Bert sieht Zug ${i + 1}`,
      10_000,
    );
  }

  assert.deepEqual(a.errors, [], 'kein Zug wurde abgelehnt');
  assert.deepEqual(b.errors, []);

  // Der Kern der Sache: Jede Sicht NACH dem join traegt hoechstens den
  // Zuwachs, nie die ganze Liste. Frueher wuchs jede einzelne mit.
  for (const [i, s] of sichten(a).entries()) {
    if (i === 0) continue;
    assert.ok(
      s.zuege.length <= 2,
      `Sicht ${i} traegt ${s.zuege.length} Zuege — der Rundruf soll nur den Zuwachs schicken`,
    );
  }
  const groesste = Math.max(...sichten(a).slice(1).map((s) => s.zuege.length));
  assert.ok(groesste < 12, 'keine Sicht traegt die volle Zugliste');

  // Und beide Geraete kommen aus lauter Ausschnitten auf genau dieselbe
  // Liste — das ist die Bedingung fuer den Gleichschritt.
  assert.deepEqual(zusammengesetzt(a), takte, 'Annas Liste stimmt');
  assert.deepEqual(zusammengesetzt(b), takte, 'Berts Liste stimmt');

  a.close();
  b.close();
});

test('ein zweites join liefert die ganze Liste zurueck', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await feldherrTisch(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');
  a.passive = true;
  b.passive = true;
  a.join(table.id, 1, 'feldherr');
  b.join(table.id, 1, 'feldherr');
  await a.waitFor(() => a.lastView !== null, 'Partiebeginn', 30_000);
  await b.waitFor(() => b.lastView !== null, 'Partiebeginn', 30_000);

  for (let i = 0; i < 5; i += 1) {
    zug(i % 2 === 0 ? a : b, table.id, 20 + i * 10);
    await a.waitFor(() => zusammengesetzt(a).length === i + 1, `Zug ${i + 1}`, 10_000);
  }

  /**
   * Genau das macht der Client nach jedem Wiederverbinden und bei jeder
   * Rueckkehr in den Tab (useTable.resync). Danach darf nichts fehlen —
   * sonst rechnete das Geraet mit einem Loch weiter, und die Partie liefe
   * still auseinander.
   */
  const vorher = a.messages('view').length;
  a.join(table.id, 1, 'feldherr');
  await a.waitFor(() => a.messages('view').length > vorher, 'Antwort auf den Abgleich');

  const abgleich = sichten(a).at(-1)!;
  assert.equal(abgleich.abIndex, 0, 'der Abgleich faengt bei null an');
  assert.equal(abgleich.zuege.length, 5, 'und traegt alle bisherigen Zuege');

  // Der Client haengt nur den echten Zuwachs an — nach dem Abgleich darf
  // kein Zug doppelt in seiner Liste stehen.
  assert.equal(zusammengesetzt(a).length, 5, 'nichts doppelt nach dem Abgleich');

  a.close();
  b.close();
});

test('wortgleiche Tisch- und Partienachrichten gehen nicht noch einmal raus', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await feldherrTisch(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');
  a.passive = true;
  b.passive = true;
  a.join(table.id, 1, 'feldherr');
  b.join(table.id, 1, 'feldherr');
  await a.waitFor(() => a.lastView !== null, 'Partiebeginn', 30_000);
  await b.waitFor(() => b.lastView !== null, 'Partiebeginn', 30_000);

  const tischeVorher = a.messages('table').length;
  for (let i = 0; i < 6; i += 1) {
    zug(i % 2 === 0 ? a : b, table.id, 20 + i * 10);
    await a.waitFor(() => zusammengesetzt(a).length === i + 1, `Zug ${i + 1}`, 10_000);
  }

  /**
   * Sitze und Tischzustand aendert ein Zug nicht. Die Nachrichten trotzdem
   * zu schicken kostet nicht nur Bytes — der Client setzt daraufhin seinen
   * Zustand neu und zeichnet den ganzen Tisch mit, mehrmals je Sekunde.
   */
  assert.equal(
    a.messages('table').length,
    tischeVorher,
    'die Tischnachricht wiederholt sich nicht Zug um Zug',
  );

  a.close();
  b.close();
});

/**
 * Setzt die Ausschnitte so zusammen, wie es der Client tut (FeldherrTisch.tsx,
 * `nimmZuege`), und liefert die Takte der Zugliste. Ein Loch faellt dabei als
 * Ausnahme auf, statt still ueberrannt zu werden.
 */
function zusammengesetzt(client: TestClient): number[] {
  const liste: { takt: number; sitz: number }[] = [];
  for (const s of sichten(client)) {
    const ab = s.abIndex ?? 0;
    assert.ok(ab <= liste.length, `Loch in der Zugliste: ab ${ab}, vorhanden ${liste.length}`);
    for (let i = liste.length - ab; i < s.zuege.length; i += 1) liste.push(s.zuege[i]!);
  }
  return liste.map((z) => z.takt);
}
