/**
 * Gastkonten: ohne Anmeldung an den Tisch — und was das kosten darf.
 *
 * Drei Zusagen, die hier festgehalten sind, weil jede fuer sich lautlos
 * bricht:
 *
 *   1. Ein Gast kommt mit EINEM Aufruf herein und hat eine gueltige Sitzung.
 *   2. Ein Tisch, an dem ein Gast sitzt, zaehlt fuer NIEMANDEN
 *      (`countsForRanking`). Wuerde nur der Gast selbst leer ausgehen, waeren
 *      fuenf Gaeste das billigste Futter fuer die Rangliste eines echten
 *      Kontos.
 *   3. Sichern macht aus der Gastzeile ein richtiges Konto — dieselbe Zeile,
 *      derselbe Spielstand — und danach zaehlt der Tisch wieder.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { gastKonto, gastSichern, istGast, sessionFromToken } from '../src/auth/service.js';
import { countsForRanking, createTable, joinTable } from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, schema as s, seedInvite } from './helpers.js';

async function ctx() {
  const c = await createTestContext();
  await seedInvite(c.db);
  return c;
}

test('ein Gast kommt mit einem Aufruf herein und hat eine Sitzung', async () => {
  const c = await ctx();
  const gast = await gastKonto(c.auth, '  Robin ');

  assert.equal(gast.displayName, 'Robin', 'Leerzeichen am Rand fliegen raus');
  const sitzung = await sessionFromToken(c.db, gast.token);
  assert.equal(sitzung?.accountId, gast.accountId, 'das Token gehoert zum neuen Konto');
  assert.equal(await istGast(c.db, gast.accountId), true);

  const [zeile] = await c.db.select().from(s.account).where(eq(s.account.id, gast.accountId));
  assert.equal(zeile?.email, null, 'ein Gast hat keine Mail');
  assert.equal(zeile?.passwordHash, null, 'und kein Passwort');
  assert.notEqual(zeile?.gastSeit, null);
});

test('ein belegter Wunschname bekommt eine Zahl, statt zu scheitern', async () => {
  const c = await ctx();
  await createVerifiedAccount(c, 'Max');
  const gast = await gastKonto(c.auth, 'Max');
  assert.notEqual(gast.displayName, 'Max');
  assert.ok(gast.displayName.startsWith('Max '), `bekam ${gast.displayName}`);
});

test('ein zu kurzer Name wird abgewiesen', async () => {
  const c = await ctx();
  await assert.rejects(() => gastKonto(c.auth, ' x '), /displayNameTooShort/);
});

test('ein Tisch mit Gast zaehlt fuer niemanden — ohne Gast zaehlt er', async () => {
  const c = await ctx();
  const { accountId: wirt } = await createVerifiedAccount(c, 'Wirt');
  const { accountId: stamm } = await createVerifiedAccount(c, 'Stammgast');
  const gast = await gastKonto(c.auth, 'Laufkunde');

  const tisch = await createTable(c.db, {
    accountId: wirt,
    gameId: 'partykiste',
    seats: 4,
    rounds: 3,
  });
  await joinTable(c.db, tisch.id, stamm);
  assert.equal(await countsForRanking(c.db, tisch.id), true, 'zwei echte Konten: zaehlt');

  await joinTable(c.db, tisch.id, gast.accountId);
  assert.equal(await countsForRanking(c.db, tisch.id), false, 'ein Gast dabei: zaehlt nicht');
});

test('Sichern macht ein richtiges Konto daraus — dieselbe Zeile, und der Tisch zaehlt wieder', async () => {
  const c = await ctx();
  const { accountId: wirt } = await createVerifiedAccount(c, 'Wirt');
  const gast = await gastKonto(c.auth, 'Laufkunde');
  const tisch = await createTable(c.db, { accountId: wirt, gameId: 'partykiste', seats: 4, rounds: 3 });
  await joinTable(c.db, tisch.id, gast.accountId);
  assert.equal(await countsForRanking(c.db, tisch.id), false);

  await gastSichern(c.auth, gast.accountId, {
    email: 'laufkunde@example.org',
    password: 'geheim-genug-1234',
    birthday: '1990-06-15',
  });

  assert.equal(await istGast(c.db, gast.accountId), false);
  const [zeile] = await c.db.select().from(s.account).where(eq(s.account.id, gast.accountId));
  assert.equal(zeile?.email, 'laufkunde@example.org');
  assert.equal(zeile?.displayName, 'Laufkunde', 'der Name bleibt');
  assert.equal(zeile?.gastSeit, null);
  assert.equal(await countsForRanking(c.db, tisch.id), true, 'gesichert: der Tisch zaehlt wieder');

  /* Die Bestaetigungsmail geht raus wie bei jeder Registrierung. */
  assert.ok(c.mailer.tokenFrom('laufkunde@example.org'), 'keine Bestaetigungsmail verschickt');
});

test('ein richtiges Konto laesst sich nicht "sichern", eine vergebene Mail nicht nehmen', async () => {
  const c = await ctx();
  const { accountId: echt, email } = await createVerifiedAccount(c, 'Echt');
  await assert.rejects(
    () => gastSichern(c.auth, echt, { email: 'neu@example.org', password: 'geheim-genug-1234', birthday: '1990-06-15' }),
    /keinGastkonto/,
  );

  const gast = await gastKonto(c.auth, 'Laufkunde');
  await assert.rejects(
    () => gastSichern(c.auth, gast.accountId, { email, password: 'geheim-genug-1234', birthday: '1990-06-15' }),
    /emailTaken/,
  );
  assert.equal(await istGast(c.db, gast.accountId), true, 'der gescheiterte Versuch aendert nichts');
});
