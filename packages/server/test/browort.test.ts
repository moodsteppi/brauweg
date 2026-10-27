/**
 * Browort und Clanwort (23.10.2026): Regeln als reine Funktionen, dann der
 * Dienst gegen die echte Datenbank (PGlite) mit festem Datum und fester
 * Saat — so laesst sich eine Serie ueber Tage pruefen, ohne zu warten.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import {
  browortHeute,
  browortProfil,
  browortRaten,
  clanwortHeute,
  clanwortRaten,
  clanwortWaehlen,
  faelligeBrowortErinnerungen,
} from '../src/browort/dienst.js';
import { MUENZEN_BROWORT, farben, tageswort } from '../src/browort/regeln.js';
import { ERLAUBT, LOESUNGEN } from '../src/browort/woerter.js';
import { createClub, joinClub } from '../src/clubs/service.js';
import { AppError } from '../src/errors.js';
import * as s from '../src/db/schema.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

const SALZ = 'test-salz';
/** Mittags in Berlin — eindeutig ein Tag, und die Clan-Wahlfrist ist gerade um. */
const tagUm = (tag: string, stunde = 10): Date => new Date(`${tag}T${String(stunde - 2).padStart(2, '0')}:00:00Z`);

/** Ein erlaubtes Wort, das nicht die Loesung ist und keinen Buchstaben mit ihr teilt, wenn moeglich. */
function falsch(loesung: string): string {
  return [...ERLAUBT].find((w) => w !== loesung && ![...w].some((b) => loesung.includes(b))) ?? [...ERLAUBT].find((w) => w !== loesung)!;
}

function istFehler(code: string) {
  return (err: unknown) => err instanceof AppError && err.code === code;
}

// ---------------------------------------------------------------------------
// Regeln
// ---------------------------------------------------------------------------

test('Farben: grün, gelb, grau — doppelte Buchstaben richtig gezählt', () => {
  assert.deepEqual(farben('ESSEN', 'ESSEN'), ['g', 'g', 'g', 'g', 'g']);
  // EBENE gegen ESSEN: erstes E grün; das zweite E gelb (ESSEN hat noch eins),
  // das dritte grau — es ist keins mehr übrig. N gelb.
  assert.deepEqual(farben('EBENE', 'ESSEN'), ['g', 'x', 'v', 'v', 'x']);
  // Nur EIN gelbes A, obwohl der Versuch zwei hat.
  assert.deepEqual(farben('AALEN', 'KAMEL'), ['x', 'g', 'v', 'g', 'x']);
  assert.deepEqual(farben('BLITZ', 'MAGEN'), ['x', 'x', 'x', 'x', 'x']);
});

test('Wortlisten: fünf Buchstaben, jede Lösung ist auch als Versuch erlaubt', () => {
  for (const wort of [...LOESUNGEN, ...ERLAUBT]) assert.match(wort, /^[A-ZÄÖÜ]{5}$/, wort);
  for (const wort of LOESUNGEN) assert.ok(ERLAUBT.has(wort), wort);
  assert.equal(new Set(LOESUNGEN).size, LOESUNGEN.length, 'keine doppelte Lösung');
  assert.ok(LOESUNGEN.length >= 500);
});

test('Tageswort: für alle gleich, kein Wort zweimal, bevor alle dran waren', () => {
  assert.equal(tageswort('2026-10-23', SALZ), tageswort('2026-10-23', SALZ));
  const gesehen = new Set<string>();
  for (let i = 0; i < LOESUNGEN.length; i += 1) {
    const tag = new Date(Date.parse('2026-10-23T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
    gesehen.add(tageswort(tag, SALZ));
  }
  assert.equal(gesehen.size, LOESUNGEN.length);
  // Anderes Salz, anderer Kalender.
  assert.notEqual(
    ['2026-10-23', '2026-10-24', '2026-10-25'].map((t) => tageswort(t, SALZ)).join(),
    ['2026-10-23', '2026-10-24', '2026-10-25'].map((t) => tageswort(t, 'anderes')).join(),
  );
});

// ---------------------------------------------------------------------------
// Browort
// ---------------------------------------------------------------------------

test('Browort: unbekanntes Wort kostet nichts, Lösung bringt Münzen, Serie und Schnitt', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Anna');
  const tag = '2026-10-23';
  const loesung = tageswort(tag, SALZ);

  await assert.rejects(() => browortRaten(c.db, accountId, 'QQQQQ', tagUm(tag), SALZ), istFehler('browortUnbekannt'));
  await assert.rejects(() => browortRaten(c.db, accountId, 'ZU', tagUm(tag), SALZ), istFehler('browortForm'));
  assert.equal((await browortHeute(c.db, accountId, tagUm(tag), SALZ)).versuche.length, 0);

  const erster = await browortRaten(c.db, accountId, falsch(loesung).toLowerCase(), tagUm(tag), SALZ);
  assert.equal(erster.versuche.length, 1);
  assert.equal(erster.fertig, false);
  assert.equal(erster.loesung, null, 'die Lösung bleibt geheim, solange die Runde läuft');

  const [vorher] = await c.db.select({ coins: s.account.coins, xp: s.account.xp }).from(s.account).where(eq(s.account.id, accountId));
  const zweiter = await browortRaten(c.db, accountId, loesung, tagUm(tag), SALZ);
  assert.equal(zweiter.geloest, true);
  assert.equal(zweiter.loesung, loesung);
  assert.deepEqual(zweiter.belohnung, { muenzen: MUENZEN_BROWORT[1], xp: 35 });
  assert.equal(zweiter.serie.serie, 1);
  assert.deepEqual(zweiter.statistik, { gespielt: 1, geloest: 1, schnitt: 2, verteilung: [0, 1, 0, 0, 0, 0] });
  const [nachher] = await c.db.select({ coins: s.account.coins, xp: s.account.xp }).from(s.account).where(eq(s.account.id, accountId));
  assert.equal(nachher!.coins - vorher!.coins, MUENZEN_BROWORT[1]);
  assert.equal(nachher!.xp - vorher!.xp, 35);

  await assert.rejects(() => browortRaten(c.db, accountId, loesung, tagUm(tag), SALZ), istFehler('browortFertig'));

  // Nächster Tag im ersten Versuch: Serie 2, Schnitt 1,5.
  const tag2 = '2026-10-24';
  const zwei = await browortRaten(c.db, accountId, tageswort(tag2, SALZ), tagUm(tag2), SALZ);
  assert.equal(zwei.serie.serie, 2);
  assert.equal(zwei.statistik.schnitt, 1.5);

  // Einen Tag ausgelassen: Der Wochenschutz hält die Serie.
  const tag4 = '2026-10-26';
  const vier = await browortRaten(c.db, accountId, tageswort(tag4, SALZ), tagUm(tag4), SALZ);
  assert.equal(vier.serie.serie, 3);
  assert.equal(vier.geschuetzt, true);

  // Sechsmal daneben: Runde verloren, Serie von vorn, Lösung jetzt sichtbar.
  const tag5 = '2026-10-27';
  const loesung5 = tageswort(tag5, SALZ);
  let stand = await browortHeute(c.db, accountId, tagUm(tag5), SALZ);
  for (let i = 0; i < 6; i += 1) stand = await browortRaten(c.db, accountId, falsch(loesung5), tagUm(tag5), SALZ);
  assert.equal(stand.fertig, true);
  assert.equal(stand.geloest, false);
  assert.equal(stand.loesung, loesung5);
  assert.equal(stand.serie.serie, 0);
  assert.equal(stand.statistik.gespielt, 4);
  assert.equal(stand.statistik.geloest, 3);

  const profil = await browortProfil(c.db, accountId, tagUm(tag5));
  assert.deepEqual(profil, { serie: 0, beste: 3, schnitt: 1.3, geloest: 3, gespielt: 4 });
});

test('Browort: Abend-Erinnerung nur mit laufender Serie und offenem Wort, einmal am Tag', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Bert');
  await browortRaten(c.db, accountId, tageswort('2026-10-23', SALZ), tagUm('2026-10-23'), SALZ);
  assert.deepEqual(await faelligeBrowortErinnerungen(c.db, tagUm('2026-10-24', 10)), [], 'morgens niemand');
  assert.deepEqual(await faelligeBrowortErinnerungen(c.db, tagUm('2026-10-24', 20)), [accountId]);
  assert.deepEqual(await faelligeBrowortErinnerungen(c.db, tagUm('2026-10-24', 21)), [], 'kein zweites Mal');
});

// ---------------------------------------------------------------------------
// Clanwort
// ---------------------------------------------------------------------------

test('Clanwort: Auslosung, Wahl, Raten, Rangliste — der Wortgeber rät nicht mit', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const { id: clubId } = await createClub(c.db, anna.accountId, { name: 'Wortclan', crest: 'wappen-1', joinMode: 'open' });
  await joinClub(c.db, clubId, bert.accountId);

  const tag = '2026-10-23';
  const ausgelost: string[] = [];
  const erste = await clanwortHeute(c.db, anna.accountId, tagUm(tag, 9), (id) => ausgelost.push(id));
  assert.ok(erste);
  assert.equal(ausgelost.length, 1, 'genau eine Auslosung');
  // Ein zweiter Aufruf lost nicht noch einmal aus.
  await clanwortHeute(c.db, bert.accountId, tagUm(tag, 9), (id) => ausgelost.push(id));
  assert.equal(ausgelost.length, 1);

  const waehler = ausgelost[0] === anna.accountId ? anna : bert;
  const rater = waehler === anna ? bert : anna;
  assert.equal((await clanwortHeute(c.db, waehler.accountId, tagUm(tag, 9)))!.phase, 'waehlen');
  assert.equal((await clanwortHeute(c.db, rater.accountId, tagUm(tag, 9)))!.phase, 'warten');
  await assert.rejects(() => clanwortRaten(c.db, rater.accountId, 'KATZE', tagUm(tag, 9)), istFehler('clanwortNochNicht'));
  await assert.rejects(() => clanwortWaehlen(c.db, rater.accountId, 'KATZE', tagUm(tag, 9)), istFehler('clanwortNichtDran'));

  const gewaehlt = await clanwortWaehlen(c.db, waehler.accountId, 'katze', tagUm(tag, 9));
  assert.equal(gewaehlt.phase, 'wortgeber');
  assert.equal(gewaehlt.loesung, 'KATZE', 'der Wortgeber sieht sein Wort');
  await assert.rejects(() => clanwortRaten(c.db, waehler.accountId, 'KATZE', tagUm(tag, 9)), istFehler('clanwortEigenes'));

  const offen = await clanwortHeute(c.db, rater.accountId, tagUm(tag, 9));
  assert.equal(offen!.phase, 'raten');
  assert.equal(offen!.loesung, null);
  await clanwortRaten(c.db, rater.accountId, 'TATZE', tagUm(tag, 9));
  const fertig = await clanwortRaten(c.db, rater.accountId, 'KATZE', tagUm(tag, 9));
  assert.equal(fertig.geloest, true);
  assert.ok(fertig.belohnung);
  assert.equal(fertig.serie.serie, 1);
  assert.deepEqual(
    fertig.rangliste.map((z) => [z.name, z.versuche, z.geloest]),
    [[rater === anna ? 'Anna' : 'Bert', 2, true]],
  );
});

test('Clanwort: Wer bis Mittag nicht wählt, dem nimmt der Server die Wahl ab', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const { id: clubId } = await createClub(c.db, anna.accountId, { name: 'Mittagsclan', crest: 'wappen-1', joinMode: 'open' });
  await joinClub(c.db, clubId, bert.accountId);

  const tag = '2026-10-23';
  await clanwortHeute(c.db, anna.accountId, tagUm(tag, 9));
  const mittags = await clanwortHeute(c.db, anna.accountId, tagUm(tag, 13));
  assert.equal(mittags!.zufall, true);
  // Auch der Ausgeloste darf jetzt raten — das Wort kennt er ja nicht.
  assert.equal(mittags!.phase, 'raten');
  assert.equal((await clanwortHeute(c.db, bert.accountId, tagUm(tag, 13)))!.phase, 'raten');
});

test('Clanwort: ohne Clan gibt es keins', async (t) => {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Cara');
  assert.equal(await clanwortHeute(c.db, accountId, tagUm('2026-10-23')), null);
});
