/**
 * Verdeckte Bot-Vertretung fuer Broweg-Admins (src/admin.ts).
 *
 * Geht ein Admin vom Tisch weg (App im Hintergrund, Verbindung zu) oder
 * tippt „Bot uebernimmt", spielt fuer ihn sofort ein Bot auf hoechster Stufe
 * — und niemand am Tisch sieht es: kein `isBot`, nicht in `botSeats`. Fuer
 * alle anderen Konten bleibt alles wie bisher.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AdminListe, adminVertretungAn } from '../src/admin.js';
import { TestClient } from './client.js';
import { startHarness, tableWithTwoHumans } from './harness.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

test('Schalter: staging an, Produktion aus, per ADMIN_VERTRETUNG umstellbar', () => {
  assert.equal(adminVertretungAn('staging', {}), true);
  assert.equal(adminVertretungAn('production', {}), false);
  assert.equal(adminVertretungAn('production', { ADMIN_VERTRETUNG: 'an' }), true);
  assert.equal(adminVertretungAn('staging', { ADMIN_VERTRETUNG: ' Aus ' }), false);
});

test('AdminListe: nur Adressen aus ADMIN_EMAILS, Gross-/Kleinschreibung egal', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  t.after(() => ctx.close());
  const tom = await createVerifiedAccount(ctx, 'Tom', 'tom@example.org');
  const gast = await createVerifiedAccount(ctx, 'Gast', 'gast@example.org');
  const liste = new AdminListe(ctx.db, ' TOM@example.org , robin@example.org');
  assert.equal(await liste.istAdmin(tom.accountId), true);
  assert.equal(await liste.istAdmin(gast.accountId), false);
  assert.equal(await new AdminListe(ctx.db, undefined).istAdmin(tom.accountId), false);
});

async function aufbau() {
  // Bots stillgestellt: Nur der verdeckte Admin-Bot darf ohne Wartezeit
  // ziehen (`menschlicheDenkzeit` ist bei botDelayMs 0 null). So zeigt ein
  // Fortschritt am Sitz des Admins, dass wirklich der Bot fuer ihn zog.
  const h = await startHarness({ botDelayMs: 0 }, 0, {
    admins: { istAdmin: async (id: string) => id === admin },
  });
  const { anna, bert, table } = await tableWithTwoHumans(h);
  const admin = anna.accountId;
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');
  a.passive = true;
  b.passive = true;
  a.join(table.id);
  b.join(table.id);
  await a.waitFor(() => a.lastView !== null, 'Sicht fuer Anna');
  await b.waitFor(() => b.lastView !== null, 'Sicht fuer Bert');
  const party = h.runtime.get(table.id)!;
  const annaSitz = party.seats.find((sitz) => sitz.accountId === anna.accountId)!.index;
  return { h, a, b, table, party, annaSitz, anna, bert };
}

test('Admin geht in den Hintergrund: der Bot vertritt ihn sofort, unsichtbar fuer den Tisch', async (t) => {
  const { h, a, b, table, party, annaSitz } = await aufbau();
  t.after(async () => {
    a.close();
    b.close();
    await h.close();
  });

  a.roh({ type: 'hintergrund', tableId: table.id });
  await b.waitFor(() => party.vertreten.has(annaSitz), 'Vertretung an');

  assert.ok(!party.botControlled.has(annaSitz), 'nicht als Bot-Uebernahme gefuehrt');
  // Bert sieht Anna weiter als Mensch.
  await b.waitForRuhe();
  assert.ok(!b.lastView!.botSeats.includes(annaSitz), 'nicht in botSeats');
  assert.equal(b.lastTable!.seats.find((sitz) => sitz.seat === annaSitz)!.isBot, false);

  // Zurueck an den Tisch: Anna spielt wieder selbst.
  a.join(table.id);
  await a.waitFor(() => !party.vertreten.has(annaSitz), 'Vertretung aus');
});

test('„Bot uebernimmt" duerfen nur Admins — fuer alle anderen ein Fehler', async (t) => {
  const { h, a, b, table, party, annaSitz } = await aufbau();
  t.after(async () => {
    a.close();
    b.close();
    await h.close();
  });

  b.roh({ type: 'vertreten', tableId: table.id });
  await b.waitFor(() => b.errors.includes('notAdmin'), 'Fehler fuer Bert');
  const bertSitz = party.seats.find((sitz) => sitz.accountId !== null && sitz.index !== annaSitz && !sitz.permanentBot)!;
  assert.ok(!party.vertreten.has(bertSitz.index));

  a.roh({ type: 'vertreten', tableId: table.id });
  await a.waitFor(() => party.vertreten.has(annaSitz), 'Vertretung per Knopf');
  assert.deepEqual(a.errors, []);
});

test('Verbindung weg: auch das schaltet die Vertretung ein, und der Bot zieht fuer den Admin', async (t) => {
  const { h, a, b, table, party, annaSitz } = await aufbau();
  t.after(async () => {
    b.close();
    await h.close();
  });

  const revisionVorher = party.revision;
  a.close();
  await b.waitFor(() => party.vertreten.has(annaSitz), 'Vertretung nach Verbindungsende');
  // Die Partie laeuft weiter, obwohl Anna nichts tut: Bert spielt mit, der
  // Rest sind Bots — und fuer Anna zieht der Vertreter.
  b.passive = false;
  await b.waitFor(() => party.revision > revisionVorher + 8 || party.finished, 'Partie laeuft weiter');
  assert.ok(!b.lastView!.botSeats.includes(annaSitz));
  assert.equal(table.id, party.tableId);
});
