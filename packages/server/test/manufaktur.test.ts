/**
 * Kartenmanufaktur: der Dienst gegen die echte Datenbank (PGlite). Die Regeln
 * selbst prueft packages/manufaktur-kern/test/ — hier geht es darum, was der
 * Server festhaelt: anlegen, alte Fassungen uebernehmen, Offline-Meldung,
 * Muenzen genau einmal.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { type ManufakturStand, FASSUNG, MAX_PRESSEN, migriere, neuePresse } from '@brauweg/manufaktur-kern';

import { manufakturAktion, manufakturHeute } from '../src/manufaktur/dienst.js';
import * as s from '../src/db/schema.js';
import { AppError } from '../src/errors.js';
import { kaufen } from '../src/shop.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

const T0 = Date.parse('2026-10-23T10:00:00Z');
const STUNDE = 3_600_000;
const presse = { art: 'presse' as const, index: 0 };

function mitMeistern(stand: ManufakturStand): ManufakturStand {
  return {
    ...stand,
    pressen: stand.pressen.map((p) => ({ ...p, meister: true })),
    paternoster: { ...stand.paternoster, meister: true },
    versand: { ...stand.versand, meister: true },
  };
}

test('Dienst: legt an, lehnt ab, was zu teuer ist, und rechnet einen Tipp', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  const erst = await manufakturHeute(c.db, accountId, new Date(T0));
  assert.equal(erst.stand.pressen.length, 1);
  assert.equal(erst.stand.fassung, FASSUNG);
  assert.equal(erst.zeit, T0);
  assert.equal(erst.offline, null);

  await assert.rejects(
    () => manufakturAktion(c.db, accountId, { typ: 'ausbauen', ziel: presse, menge: 1 }, new Date(T0)),
    (err: unknown) => err instanceof AppError && err.code === 'manufakturZuTeuer',
  );

  const tipp = await manufakturAktion(c.db, accountId, { typ: 'arbeiten', ziel: presse }, new Date(T0 + 1000));
  assert.equal(tipp.stand.pressen[0]!.laeuft, true);
  const spaeter = await manufakturHeute(c.db, accountId, new Date(T0 + 30_000));
  assert.ok(spaeter.stand.pressen[0]!.kiste > 0, 'der Zyklus ist in der Kiste angekommen');
});

test('Dienst: uebernimmt einen Stand der alten Fassung, statt ihn zu verwerfen', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Bert');
  await c.db.insert(s.manufaktur).values({
    accountId,
    version: 1,
    aktualisiert: new Date(T0),
    stand: {
      manufaktur: 1,
      taler: 500,
      verdient: 900,
      pressen: [{ stufe: 9, meister: false, aktivBis: 0, ablage: 12 }],
      laufband: { stufe: 4, meister: false, aktivBis: 0 },
      versand: { stufe: 3, meister: false, aktivBis: 0 },
      lager: 7,
      meilensteine: [],
      zeit: T0,
    },
  });
  const antwort = await manufakturHeute(c.db, accountId, new Date(T0 + 1000));
  assert.equal(antwort.stand.taler, 500);
  assert.equal(antwort.stand.pressen[0]!.stufe, 9);
  assert.equal(antwort.stand.paternoster.stufe, 4);
  const [zeile] = await c.db.select().from(s.manufaktur).where(eq(s.manufaktur.accountId, accountId));
  assert.equal((zeile!.stand as ManufakturStand).fassung, FASSUNG, 'gespeichert wird die neue Fassung');
});

test('Dienst: meldet Offline-Verdienst und zahlt Meilenstein-Muenzen genau einmal', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Clara');
  await manufakturHeute(c.db, accountId, new Date(T0));

  // Ein voll besetzter Stand kurz vor der ersten Million.
  const [zeile] = await c.db.select().from(s.manufaktur).where(eq(s.manufaktur.accountId, accountId));
  const stand = mitMeistern(migriere(zeile!.stand));
  stand.pressen = Array.from({ length: 4 }, () => ({ ...stand.pressen[0]!, stufe: 60 }));
  stand.paternoster.stufe = 120;
  stand.versand.stufe = 120;
  stand.verdient = 999_000;
  await c.db.update(s.manufaktur).set({ stand }).where(eq(s.manufaktur.accountId, accountId));
  const [vorher] = await c.db.select({ coins: s.account.coins }).from(s.account).where(eq(s.account.id, accountId));

  const spaeter = await manufakturHeute(c.db, accountId, new Date(T0 + 5 * STUNDE));
  assert.ok(spaeter.offline);
  assert.equal(spaeter.offline.sekunden, 3600, 'gemeldet wird hoechstens die Offline-Grenze');
  assert.ok(spaeter.offline.taler > 0);
  assert.ok(spaeter.offline.produziert >= spaeter.offline.taler, 'verkauft wird nur, was gepresst wurde');
  assert.equal(spaeter.muenzen, 50, 'die erste Million ist unterwegs gefallen');
  const [nachher] = await c.db.select({ coins: s.account.coins }).from(s.account).where(eq(s.account.id, accountId));
  assert.equal(nachher!.coins - vorher!.coins, 50);

  const nochmal = await manufakturHeute(c.db, accountId, new Date(T0 + 5 * STUNDE + 1000));
  assert.equal(nochmal.muenzen, 0);
  assert.equal(nochmal.offline, null);
});

test('Dienst: meldet einen Stau — gepresst, aber nichts verkauft', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Dora');
  await manufakturHeute(c.db, accountId, new Date(T0));
  const [zeile] = await c.db.select().from(s.manufaktur).where(eq(s.manufaktur.accountId, accountId));
  const stand = migriere(zeile!.stand);
  stand.pressen[0]!.meister = true;
  await c.db.update(s.manufaktur).set({ stand }).where(eq(s.manufaktur.accountId, accountId));
  const spaeter = await manufakturHeute(c.db, accountId, new Date(T0 + STUNDE));
  assert.ok(spaeter.offline);
  assert.equal(spaeter.offline.taler, 0);
  assert.ok(spaeter.offline.produziert > 0);
});

test('Dienst: Wer umzieht, bekommt den Kartenruecken seiner Manufaktur — kaufen kann man ihn nicht', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Emil');
  await manufakturHeute(c.db, accountId, new Date(T0));

  await assert.rejects(
    () => kaufen(c.db, accountId, 'ruecken-manufaktur-dorf'),
    (err: unknown) => err instanceof AppError && err.code === 'itemNurErspielt',
  );

  const [zeile] = await c.db.select().from(s.manufaktur).where(eq(s.manufaktur.accountId, accountId));
  const stand = migriere(zeile!.stand);
  stand.pressen = Array.from({ length: MAX_PRESSEN }, neuePresse);
  await c.db.update(s.manufaktur).set({ stand }).where(eq(s.manufaktur.accountId, accountId));

  const umzug = await manufakturAktion(c.db, accountId, { typ: 'umziehen' }, new Date(T0 + 1000));
  assert.equal(umzug.stand.manufaktur, 2);
  const besitz = await c.db
    .select({ itemId: s.accountCosmetic.itemId })
    .from(s.accountCosmetic)
    .where(eq(s.accountCosmetic.accountId, accountId));
  assert.ok(besitz.some((b) => b.itemId === 'ruecken-manufaktur-dorf'));
});
