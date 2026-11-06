/**
 * Flying Bro: der Dienst gegen die echte Datenbank (PGlite). Die Regeln
 * selbst (Sterne, Meilen, Muenzrechnung) prueft packages/flyingbro-kern/test/
 * — hier geht es darum, was der Server festhaelt: Startvorrat genau einmal,
 * ein Start traegt genau eine Meldung, Hilfsmittel werden einmal bezahlt,
 * die Kappen halten ueber mehrere Meldungen und ueber den Tageswechsel, und
 * die Flugmeilen beruehren das Hub-Guthaben nicht.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import {
  FLYINGBRO_MAX_PRO_LEVEL,
  FLYINGBRO_MAX_PRO_TAG,
  FLYINGBRO_WELT_MUENZEN,
  HILFSMITTEL_KATALOG,
  LEVELS,
  MEILEN,
  MELDUNG,
  STARTVORRAT,
  ZIERDE_KATALOG,
} from '@brauweg/flyingbro-kern';

import { flyingbroErgebnis, flyingbroKauf, flyingbroStand, flyingbroStart } from '../src/flyingbro.js';
import * as s from '../src/db/schema.js';
import { AppError } from '../src/errors.js';
import { standVon } from '../src/waehrung.js';
import { createTestContext, createVerifiedAccount, seedInvite, type TestContext } from './helpers.js';

// Mittag in Berlin, damit ein paar Minuten Spielzeit nie ueber Mitternacht laufen.
const T0 = Date.parse('2026-11-06T11:00:00Z');
const TAG = 24 * 3_600_000;
const L1 = LEVELS[0]!;
const L2 = LEVELS[1]!;

async function konto(t: { after(f: () => Promise<void>): void }): Promise<{ c: TestContext; id: string }> {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  const { accountId } = await createVerifiedAccount(c, 'Anna');
  return { c, id: accountId };
}

function mitCode(code: string, status?: number) {
  return (err: unknown) => err instanceof AppError && err.code === code && (status === undefined || err.status === status);
}

/**
 * Ein ganzer Versuch: Start zur Zeit `ab`, Meldung so spaet, wie es die
 * Plausibilitaet fuer die verschossenen Bros verlangt.
 */
async function spiele(
  c: TestContext,
  id: string,
  ab: number,
  v: { levelId: string; geschafft?: boolean; punkte: number; verschossen?: number; hilfsmittel?: string[] },
) {
  const verschossen = v.verschossen ?? 1;
  await flyingbroStart(c.db, id, { levelId: v.levelId, hilfsmittel: v.hilfsmittel ?? [] }, new Date(ab));
  return flyingbroErgebnis(
    c.db,
    id,
    { levelId: v.levelId, geschafft: v.geschafft ?? true, punkte: v.punkte, verschossen },
    new Date(ab + verschossen * MELDUNG.msJeBro),
  );
}

test('Stand: der erste Aufruf legt an, mit dem Startvorrat — und nur einmal', async (t) => {
  const { c, id } = await konto(t);
  const erst = await flyingbroStand(c.db, id, new Date(T0));
  assert.equal(erst.meilen, 0);
  assert.deepEqual(erst.vorrat, STARTVORRAT);
  assert.deepEqual(erst.zierde, []);
  assert.deepEqual(erst.level, {});
  assert.equal(erst.offenerStart, null);
  assert.equal(erst.heute.limitMuenzen, FLYINGBRO_MAX_PRO_TAG);
  assert.equal(erst.heute.restWiederholungen, MEILEN.wiederholungenJeTag);

  // Zweimal gleichzeitig oeffnen: eine Zeile, ein Geschenk.
  await Promise.all([flyingbroStand(c.db, id), flyingbroStand(c.db, id)]);
  const zeilen = await c.db.select().from(s.flyingbroStand).where(eq(s.flyingbroStand.accountId, id));
  assert.equal(zeilen.length, 1);
});

test('Start: unbekanntes und noch nicht freigeschaltetes Level werden abgewiesen', async (t) => {
  const { c, id } = await konto(t);
  await assert.rejects(() => flyingbroStart(c.db, id, { levelId: 'w9-99', hilfsmittel: [] }), mitCode('flyingbroLevelUnbekannt', 400));
  await assert.rejects(() => flyingbroStart(c.db, id, { levelId: L2.id, hilfsmittel: [] }), mitCode('flyingbroNichtFreigeschaltet', 400));
  await assert.rejects(
    () => flyingbroStart(c.db, id, { levelId: L1.id, hilfsmittel: ['fernrohr', 'fernrohr'] }),
    mitCode('flyingbroHilfsmittelUngueltig', 400),
  );
  await assert.rejects(() => flyingbroStart(c.db, id, { levelId: L1.id, hilfsmittel: ['raketenrucksack'] }), mitCode('flyingbroHilfsmittelUngueltig', 400));
  // Bauplan liegt zum Start nicht im Vorrat (STARTVORRAT.bauplan = 0).
  await assert.rejects(() => flyingbroStart(c.db, id, { levelId: L1.id, hilfsmittel: ['bauplan'] }), mitCode('flyingbroNichtImVorrat', 409));

  const start = await flyingbroStart(c.db, id, { levelId: L1.id, hilfsmittel: [] }, new Date(T0));
  assert.equal(start.start, T0);

  // Nach dem ersten geschafften Level ist das zweite offen.
  await flyingbroErgebnis(c.db, id, { levelId: L1.id, geschafft: true, punkte: 0, verschossen: 1 }, new Date(T0 + MELDUNG.msJeBro));
  await flyingbroStart(c.db, id, { levelId: L2.id, hilfsmittel: [] }, new Date(T0 + 10_000));
});

test('Ergebnis: drei Sterne, Meilen und Hub-Muenzen in einem Aufruf — und genau einmal je Start', async (t) => {
  const { c, id } = await konto(t);
  const vorher = (await standVon(c.db, id)).coins;

  const r = await spiele(c, id, T0, { levelId: L1.id, punkte: L1.sterne[2] });
  assert.equal(r.sterne, 3);
  assert.equal(r.neueSterne, 3);
  assert.equal(r.meilen.summe, MEILEN.erstmalsGeschafft + 3 * MEILEN.jeNeuerStern);
  assert.equal(r.muenzen.gutschrift, FLYINGBRO_MAX_PRO_LEVEL);
  assert.equal(r.hubMuenzen, vorher + FLYINGBRO_MAX_PRO_LEVEL);
  assert.equal(r.stand.meilen, r.meilen.summe);
  assert.deepEqual(r.stand.level[L1.id], { sterne: 3, bestpunkte: L1.sterne[2] });
  assert.equal(r.stand.heute.muenzen, FLYINGBRO_MAX_PRO_LEVEL);
  assert.equal(r.stand.offenerStart, null);

  // Dieselbe Meldung noch einmal: Der Start ist verbraucht.
  await assert.rejects(
    () => flyingbroErgebnis(c.db, id, { levelId: L1.id, geschafft: true, punkte: L1.sterne[2], verschossen: 1 }, new Date(T0 + 60_000)),
    mitCode('flyingbroKeinStart', 409),
  );
  assert.equal((await standVon(c.db, id)).coins, vorher + FLYINGBRO_MAX_PRO_LEVEL);
});

test('Ergebnis: zu schnell, zu viele Punkte, zu viele Bros und falsches Level — der Start bleibt offen', async (t) => {
  const { c, id } = await konto(t);
  await flyingbroStart(c.db, id, { levelId: L1.id, hilfsmittel: [] }, new Date(T0));
  const melde = (v: { punkte?: number; verschossen?: number; levelId?: string }, nach: number) =>
    flyingbroErgebnis(
      c.db,
      id,
      { levelId: v.levelId ?? L1.id, geschafft: true, punkte: v.punkte ?? 0, verschossen: v.verschossen ?? 2 },
      new Date(T0 + nach),
    );

  // Zwei Bros verlangen 8 s.
  await assert.rejects(() => melde({}, 2 * MELDUNG.msJeBro - 1), mitCode('flyingbroZuSchnell', 400));
  await assert.rejects(() => melde({ punkte: 10_000_000 }, 60_000), mitCode('flyingbroPunkteUngueltig', 400));
  await assert.rejects(() => melde({ verschossen: L1.bros.length + 1 }, 60_000), mitCode('flyingbroBrosUngueltig', 400));
  await assert.rejects(() => melde({ levelId: L2.id }, 60_000), mitCode('flyingbroFalschesLevel', 400));
  assert.deepEqual((await flyingbroStand(c.db, id)).offenerStart, { levelId: L1.id, hilfsmittel: [] });

  const r = await melde({}, 2 * MELDUNG.msJeBro);
  assert.equal(r.sterne, 1);
});

test('Ergebnis: ein verlorener Versuch schliesst den Start und bringt nichts', async (t) => {
  const { c, id } = await konto(t);
  const r = await spiele(c, id, T0, { levelId: L1.id, geschafft: false, punkte: 4000, verschossen: L1.bros.length });
  assert.equal(r.sterne, 0);
  assert.equal(r.meilen.summe, 0);
  assert.equal(r.muenzen.gutschrift, 0);
  assert.deepEqual(r.stand.level, {});
  assert.equal(r.stand.offenerStart, null);
});

test('Hilfsmittel: einmal bezahlt, auch bei „Nochmal" — und mit Hilfsmittel hoechstens zwei Sterne', async (t) => {
  const { c, id } = await konto(t);
  const erst = await flyingbroStart(c.db, id, { levelId: L1.id, hilfsmittel: ['fernrohr'] }, new Date(T0));
  assert.equal(erst.vorrat.fernrohr, STARTVORRAT.fernrohr - 1);

  // Nochmal mit demselben Fernrohr: nichts weiter abgebucht.
  const nochmal = await flyingbroStart(c.db, id, { levelId: L1.id, hilfsmittel: ['fernrohr', 'ersatz-pelle'] }, new Date(T0 + 5000));
  assert.equal(nochmal.vorrat.fernrohr, STARTVORRAT.fernrohr - 1);
  assert.equal(nochmal.vorrat['ersatz-pelle'], STARTVORRAT['ersatz-pelle'] - 1);
  // Nochmal ohne Ersatz-Pelle: Sie geht zurueck in den Vorrat.
  const ohne = await flyingbroStart(c.db, id, { levelId: L1.id, hilfsmittel: ['fernrohr'] }, new Date(T0 + 10_000));
  assert.equal(ohne.vorrat['ersatz-pelle'], STARTVORRAT['ersatz-pelle']);

  // Der Client darf die Hilfsmittel nicht verschweigen, um den dritten Stern zu holen.
  await assert.rejects(
    () => flyingbroErgebnis(c.db, id, { levelId: L1.id, geschafft: true, punkte: L1.sterne[2], verschossen: 1, hilfsmittel: [] }, new Date(T0 + 60_000)),
    mitCode('flyingbroHilfsmittelUngueltig', 400),
  );
  // Ohne das Feld gilt, was beim Start bezahlt wurde.
  const r = await flyingbroErgebnis(c.db, id, { levelId: L1.id, geschafft: true, punkte: L1.sterne[2], verschossen: 1 }, new Date(T0 + 60_000));
  assert.equal(r.sterne, 2);
  assert.equal(r.muenzen.gutschrift, 2 * 2);

  // Ein spaeterer Versuch ohne Hilfsmittel holt den dritten Stern nach — Sterne und Bestpunkte steigen getrennt.
  const ohneHilfe = await spiele(c, id, T0 + 120_000, { levelId: L1.id, punkte: L1.sterne[2] });
  assert.equal(ohneHilfe.besteSterne, 3);
  assert.equal(ohneHilfe.neueSterne, 1);
  const schwach = await spiele(c, id, T0 + 180_000, { levelId: L1.id, punkte: 0 });
  assert.equal(schwach.besteSterne, 3);
  assert.deepEqual(schwach.stand.level[L1.id], { sterne: 3, bestpunkte: L1.sterne[2] });
});

test('Ein Start fuer ein anderes Level ersetzt den offenen — dessen Hilfsmittel sind verbraucht', async (t) => {
  const { c, id } = await konto(t);
  await spiele(c, id, T0, { levelId: L1.id, punkte: 0 });
  await flyingbroStart(c.db, id, { levelId: L2.id, hilfsmittel: ['fernrohr'] }, new Date(T0 + 60_000));
  const zurueck = await flyingbroStart(c.db, id, { levelId: L1.id, hilfsmittel: [] }, new Date(T0 + 70_000));
  assert.equal(zurueck.vorrat.fernrohr, STARTVORRAT.fernrohr - 1);
  await assert.rejects(
    () => flyingbroErgebnis(c.db, id, { levelId: L2.id, geschafft: true, punkte: 0, verschossen: 1 }, new Date(T0 + 90_000)),
    mitCode('flyingbroFalschesLevel', 400),
  );
});

test('Wiederholungen: Meilen nur fuer die ersten zehn am Tag, Muenzen nie', async (t) => {
  const { c, id } = await konto(t);
  await spiele(c, id, T0, { levelId: L1.id, punkte: L1.sterne[2] });

  let meilen = 0;
  for (let i = 1; i <= MEILEN.wiederholungenJeTag + 2; i++) {
    const r = await spiele(c, id, T0 + i * 60_000, { levelId: L1.id, punkte: L1.sterne[2] });
    assert.equal(r.muenzen.gutschrift, 0, `Wiederholung ${i}`);
    meilen += r.meilen.summe;
  }
  assert.equal(meilen, MEILEN.wiederholungenJeTag * MEILEN.erneutGeschafft);
  const stand = await flyingbroStand(c.db, id, new Date(T0 + 30 * 60_000));
  assert.equal(stand.heute.wiederholungen, MEILEN.wiederholungenJeTag);
  assert.equal(stand.heute.restWiederholungen, 0);

  // Am naechsten Berliner Tag zaehlt es wieder.
  const morgen = await spiele(c, id, T0 + TAG, { levelId: L1.id, punkte: L1.sterne[2] });
  assert.equal(morgen.meilen.summe, MEILEN.erneutGeschafft);
});

test('Kappen: die Zahlen aus der Spezifikation stehen fest — wer sie aendert, aendert die Wirtschaft', () => {
  // Der Server rechnet mit dem Kern (@brauweg/flyingbro-kern, Workspace-Paket);
  // diese Zahlen haelt hier ein Test fest, damit eine stille Aenderung dort auffaellt.
  assert.equal(FLYINGBRO_MAX_PRO_LEVEL, 6);
  assert.equal(FLYINGBRO_MAX_PRO_TAG, 40);
  assert.equal(FLYINGBRO_WELT_MUENZEN, 50);
  assert.equal(MEILEN.wiederholungenJeTag, 10);
  assert.equal(MELDUNG.msJeBro, 4000);
});

test('Tageskappe: hoechstens 40 Hub-Muenzen am Tag, der Rest kommt am naechsten Tag', async (t) => {
  const { c, id } = await konto(t);
  const vorher = (await standVon(c.db, id)).coins;

  // Die ersten zehn Level (alle aus Welt 1, die Welt bleibt unvollendet) mit
  // drei Sternen an einem Abend: 60 Muenzen Anspruch. Ein Durchspielen aller
  // LEVELS schlosse Welten ab und brachte den Weltbonus, der ausserhalb der
  // Tageskappe liegt und diese Zahl verfaelschte.
  const gespielt = LEVELS.slice(0, 10);
  let gutgeschrieben = 0;
  let ab = T0;
  for (const level of gespielt) {
    const r = await spiele(c, id, ab, { levelId: level.id, punkte: level.sterne[2] });
    assert.equal(r.sterne, 3, level.id);
    gutgeschrieben += r.muenzen.gutschrift;
    ab += 60_000;
  }
  const anspruch = gespielt.length * FLYINGBRO_MAX_PRO_LEVEL;
  assert.equal(gutgeschrieben, FLYINGBRO_MAX_PRO_TAG);
  const abends = await flyingbroStand(c.db, id, new Date(ab));
  assert.equal(abends.muenzenOffen, anspruch - FLYINGBRO_MAX_PRO_TAG);
  assert.equal(abends.heute.restMuenzen, 0);
  assert.equal((await standVon(c.db, id)).coins, vorher + FLYINGBRO_MAX_PRO_TAG);

  // Am naechsten Tag zahlt schon ein verlorener Versuch den Rest nach.
  const morgen = await spiele(c, id, T0 + TAG, { levelId: L1.id, geschafft: false, punkte: 0 });
  assert.equal(morgen.muenzen.gutschrift, anspruch - FLYINGBRO_MAX_PRO_TAG);
  assert.equal(morgen.muenzen.offen, 0);
  assert.equal(morgen.stand.muenzenOffen, 0);
  assert.equal((await standVon(c.db, id)).coins, vorher + anspruch);

  // Danach gibt es nichts mehr — Muenzen nur fuer neue Sterne, die Lebenssumme ist gedeckelt.
  const nochmal = await spiele(c, id, T0 + TAG + 60_000, { levelId: L1.id, punkte: L1.sterne[2] });
  assert.equal(nochmal.muenzen.gutschrift, 0);
});

test('Kauf: nur mit Meilen, Preise aus dem Katalog, Zierde einmal — das Hub-Guthaben bleibt unberuehrt', async (t) => {
  const { c, id } = await konto(t);
  const fernrohr = HILFSMITTEL_KATALOG.find((a) => a.id === 'fernrohr')!;
  const band = ZIERDE_KATALOG[0]!;

  await assert.rejects(() => flyingbroKauf(c.db, id, 'fernrohr'), mitCode('flyingbroZuWenigMeilen', 409));
  await assert.rejects(() => flyingbroKauf(c.db, id, 'goldbarren'), mitCode('flyingbroArtikelUnbekannt', 400));

  // Genug Meilen fuer ein Fernrohr und ein Schleuderband, direkt gesetzt. Die
  // abgelehnten Kaeufe oben haben die Zeile mit zurueckgerollt — erst anlegen.
  await flyingbroStand(c.db, id);
  await c.db
    .update(s.flyingbroStand)
    .set({ meilen: fernrohr.preis + band.preis })
    .where(eq(s.flyingbroStand.accountId, id));
  const muenzenVorher = await standVon(c.db, id);

  const k1 = await flyingbroKauf(c.db, id, 'fernrohr');
  assert.equal(k1.meilen, band.preis);
  assert.equal(k1.vorrat.fernrohr, STARTVORRAT.fernrohr + 1);
  const k2 = await flyingbroKauf(c.db, id, band.id);
  assert.equal(k2.meilen, 0);
  assert.deepEqual(k2.zierde, [band.id]);

  await c.db.update(s.flyingbroStand).set({ meilen: band.preis }).where(eq(s.flyingbroStand.accountId, id));
  await assert.rejects(() => flyingbroKauf(c.db, id, band.id), mitCode('flyingbroSchonGekauft', 409));

  assert.deepEqual(await standVon(c.db, id), muenzenVorher);
});

test('Kauf: zwei Kaeufe im selben Augenblick bezahlen nicht einmal fuer zwei', async (t) => {
  const { c, id } = await konto(t);
  await flyingbroStand(c.db, id);
  const fernrohr = HILFSMITTEL_KATALOG.find((a) => a.id === 'fernrohr')!;
  await c.db.update(s.flyingbroStand).set({ meilen: fernrohr.preis }).where(eq(s.flyingbroStand.accountId, id));

  const ergebnisse = await Promise.allSettled([flyingbroKauf(c.db, id, 'fernrohr'), flyingbroKauf(c.db, id, 'fernrohr')]);
  assert.equal(ergebnisse.filter((e) => e.status === 'fulfilled').length, 1);
  const stand = await flyingbroStand(c.db, id);
  assert.equal(stand.meilen, 0);
  assert.equal(stand.vorrat.fernrohr, STARTVORRAT.fernrohr + 1);
});

test('Vorrat aus einer alten Zeile: ein fehlendes Hilfsmittel zaehlt 0, nicht NaN', async (t) => {
  const { c, id } = await konto(t);
  await c.db.insert(s.flyingbroStand).values({ accountId: id, vorrat: { fernrohr: 1 } });
  const stand = await flyingbroStand(c.db, id);
  assert.deepEqual(stand.vorrat, { fernrohr: 1, bauplan: 0, 'ersatz-pelle': 0 });
});
