/**
 * Kartenmanufaktur (23.10.2026): erst die Regeln als reine Funktionen —
 * Zeit ist hier nur eine Zahl, Stunden laufen ohne Warten —, dann der
 * Dienst gegen die echte Datenbank (PGlite).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { manufakturAktion, manufakturHeute } from '../src/manufaktur/dienst.js';
import {
  type ManufakturStand,
  AktionAbgelehnt,
  MUENZEN_UMZUG,
  OFFLINE_MS,
  SCHICHT_MS,
  UMZUG_AB,
  ansicht,
  ausbauKosten,
  handle,
  neuerStand,
  presseRate,
  vorspulen,
} from '../src/manufaktur/regeln.js';
import * as s from '../src/db/schema.js';
import { AppError } from '../src/errors.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

const T0 = Date.parse('2026-10-23T10:00:00Z');
const STUNDE = 3_600_000;
const presse = { art: 'presse' as const, index: 0 };

function alleMeister(stand: ManufakturStand): ManufakturStand {
  return {
    ...stand,
    pressen: stand.pressen.map((p) => ({ ...p, meister: true })),
    laufband: { ...stand.laufband, meister: true },
    versand: { ...stand.versand, meister: true },
  };
}

test('ohne Tipp und ohne Meister passiert nichts', () => {
  const stand = vorspulen(neuerStand(T0), T0 + STUNDE);
  assert.equal(stand.taler, 0);
  assert.equal(stand.pressen[0]!.ablage, 0);
  assert.equal(stand.zeit, T0 + STUNDE);
});

test('eine Schicht: Presse druckt zehn Sekunden, Laufband holt, Versand verkauft', () => {
  let stand = handle(neuerStand(T0), { typ: 'schicht', ziel: presse }, T0).stand;
  stand = vorspulen(stand, T0 + 20_000);
  assert.equal(Math.round(stand.pressen[0]!.ablage), 10, 'Stufe 1 druckt 1 Taler je Sekunde, 10 s lang');
  stand = handle(stand, { typ: 'schicht', ziel: { art: 'laufband' } }, T0 + 20_000).stand;
  stand = vorspulen(stand, T0 + 40_000);
  assert.equal(Math.round(stand.lager), 10);
  assert.equal(stand.pressen[0]!.ablage, 0);
  stand = handle(stand, { typ: 'schicht', ziel: { art: 'versand' } }, T0 + 40_000).stand;
  stand = vorspulen(stand, T0 + 60_000);
  assert.equal(Math.round(stand.taler), 10);
  assert.equal(Math.round(stand.verdient), 10);
});

test('eine laufende Schicht wird durch Tippen nicht verlängert', () => {
  const erst = handle(neuerStand(T0), { typ: 'schicht', ziel: presse }, T0).stand;
  const nochmal = handle(erst, { typ: 'schicht', ziel: presse }, T0 + 5_000).stand;
  assert.equal(nochmal.pressen[0]!.aktivBis, T0 + SCHICHT_MS);
});

test('mit Meistern läuft die Kette von selbst — der Engpass bestimmt das Einkommen', () => {
  const stand = vorspulen(alleMeister(neuerStand(T0)), T0 + STUNDE);
  // Presse 1 Taler/s, Laufband und Versand je 4: Die Presse ist der Engpass.
  assert.equal(Math.round(stand.taler), 3600);
  const sicht = ansicht(stand, T0 + STUNDE);
  assert.equal(sicht.engpass, 'pressen');
  assert.equal(Math.round(sicht.proSekunde.taler), 1);
});

test('offline läuft die Manufaktur höchstens acht Stunden', () => {
  const stand = vorspulen(alleMeister(neuerStand(T0)), T0 + 20 * STUNDE);
  assert.equal(Math.round(stand.taler), OFFLINE_MS / 1000);
  assert.equal(stand.zeit, T0 + 20 * STUNDE, 'die Uhr springt trotzdem auf jetzt');
});

test('Ausbauen kostet Taler, erhöht die Leistung und weist ohne Geld ab', () => {
  const arm = neuerStand(T0);
  assert.throws(() => handle(arm, { typ: 'ausbauen', ziel: presse }, T0), (err: unknown) => err instanceof AktionAbgelehnt && err.code === 'manufakturZuTeuer');
  const reich = { ...arm, taler: 100 };
  const { stand } = handle(reich, { typ: 'ausbauen', ziel: presse }, T0);
  assert.equal(stand.pressen[0]!.stufe, 2);
  assert.equal(stand.taler, 100 - ausbauKosten(presse, 1));
  assert.equal(presseRate(0, 2, 1), 2);
  // Alle 25 Stufen verdoppelt sich die Leistung.
  assert.equal(presseRate(0, 25, 1), 50);
  // Eine tiefere Presse druckt neunmal so viel.
  assert.equal(presseRate(1, 1, 1), 9);
});

test('neue Presse freischalten und Meister kaufen', () => {
  const { stand } = handle({ ...neuerStand(T0), taler: 1000 }, { typ: 'freischalten' }, T0);
  assert.equal(stand.pressen.length, 2);
  assert.equal(stand.taler, 940);
  const mitMeister = handle(stand, { typ: 'meister', ziel: { art: 'laufband' } }, T0).stand;
  assert.equal(mitMeister.laufband.meister, true);
  assert.throws(() => handle(mitMeister, { typ: 'meister', ziel: { art: 'laufband' } }, T0), /manufakturHatMeister/);
});

test('Engpass Laufband, wenn die Pressen mehr drucken als es trägt', () => {
  const stand = alleMeister({
    ...neuerStand(T0),
    pressen: [
      { stufe: 10, meister: true, aktivBis: 0, ablage: 0 },
      { stufe: 1, meister: true, aktivBis: 0, ablage: 0 },
    ],
    versand: { stufe: 50, meister: true, aktivBis: 0 },
  });
  assert.equal(ansicht(stand, T0).engpass, 'laufband');
});

test('erste Million bringt Münzen, Umzug ab 10 Mrd. mit doppelter Leistung', () => {
  const reich = { ...neuerStand(T0), taler: 2e6, verdient: 2e6 };
  const million = handle(reich, { typ: 'schicht', ziel: presse }, T0);
  assert.deepEqual(million.meilensteine, [{ kennung: 'million-1', muenzen: 50 }]);
  // Kein zweites Mal.
  assert.deepEqual(handle(million.stand, { typ: 'schicht', ziel: presse }, T0 + 1).meilensteine, []);

  assert.throws(() => handle(million.stand, { typ: 'umziehen' }, T0), /manufakturUmzugZuFrueh/);
  const umzug = handle({ ...million.stand, verdient: UMZUG_AB }, { typ: 'umziehen' }, T0);
  assert.equal(umzug.stand.manufaktur, 2);
  assert.equal(umzug.stand.taler, 0);
  assert.equal(umzug.stand.pressen.length, 1);
  assert.deepEqual(umzug.meilensteine, [{ kennung: 'umzug-2', muenzen: MUENZEN_UMZUG }]);
  assert.ok(umzug.stand.meilensteine.includes('million-1'), 'Meilensteine bleiben');
  assert.equal(presseRate(0, 1, 2), 2);
});

test('Dienst: legt an, meldet Offline-Verdienst, zahlt Meilenstein-Münzen genau einmal', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Anna');
  const jetzt = new Date(T0);

  const erst = await manufakturHeute(c.db, accountId, jetzt);
  assert.equal(erst.ansicht.pressen.length, 1);
  assert.equal(erst.offline, null);

  await assert.rejects(
    () => manufakturAktion(c.db, accountId, { typ: 'ausbauen', ziel: presse }, jetzt),
    (err: unknown) => err instanceof AppError && err.code === 'manufakturZuTeuer',
  );

  // Ein reicher, voll besetzter Stand: nach einer Stunde Abwesenheit kommt die Meldung.
  const [zeile] = await c.db.select().from(s.manufaktur).where(eq(s.manufaktur.accountId, accountId));
  await c.db
    .update(s.manufaktur)
    .set({ stand: alleMeister({ ...zeile!.stand, verdient: 999_000 }) })
    .where(eq(s.manufaktur.accountId, accountId));
  const [vorher] = await c.db.select({ coins: s.account.coins }).from(s.account).where(eq(s.account.id, accountId));

  const spaeter = await manufakturHeute(c.db, accountId, new Date(T0 + STUNDE));
  assert.ok(spaeter.offline);
  assert.equal(spaeter.offline.sekunden, 3600);
  assert.equal(Math.round(spaeter.offline.taler), 3600);
  assert.equal(spaeter.muenzen, 50, 'die erste Million ist unterwegs gefallen');
  const [nachher] = await c.db.select({ coins: s.account.coins }).from(s.account).where(eq(s.account.id, accountId));
  assert.equal(nachher!.coins - vorher!.coins, 50);

  const nochmal = await manufakturHeute(c.db, accountId, new Date(T0 + STUNDE + 1000));
  assert.equal(nochmal.muenzen, 0);
  assert.equal(nochmal.offline, null);
});
