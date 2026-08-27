/**
 * Shop und Kleiderschrank.
 *
 * Der Kern dieser Datei ist eine einzige Frage: Kann jemand etwas tragen, das
 * er nicht besitzt? Die Antwort muss an jeder Stelle nein sein — beim Kaufen,
 * beim Anziehen und ueber die Schnittstelle.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import {
  GEBURTSTAGS_OUTFIT,
  KATALOG,
  SLOTS,
  besitzt,
  garderobeVon,
  requireStueck,
  schenken,
  stueckMit,
} from '../src/kosmetik.js';
import {
  EDELSTEINPAKETE,
  JETONPAKETE,
  MUENZPAKETE,
  PAESSE,
  anziehen,
  getragenVon,
  kaufen,
  paketKaufen,
  shopFuer,
} from '../src/shop.js';
import { KAUFTRUHEN } from '../src/truhen.js';
import { MUENZEN_JE_EDELSTEIN, gutschreiben, standVon } from '../src/waehrung.js';
import { AppError } from '../src/errors.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
  type TestContext,
} from './helpers.js';

async function konto(): Promise<{ ctx: TestContext; accountId: string }> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const { accountId } = await createVerifiedAccount(ctx, 'Anna');
  return { ctx, accountId };
}

// --- Katalog ----------------------------------------------------------------

test('Jeder Platz hat mindestens ein freies Stueck', () => {
  for (const slot of SLOTS) {
    const frei = KATALOG.filter(
      (stueck) =>
        stueck.slot === slot &&
        stueck.preis.coins === 0 &&
        stueck.preis.gems === 0 &&
        stueck.herkunft === 'shop',
    );
    assert.ok(
      frei.length >= 1,
      `${slot} hat kein freies Stueck — der Kleiderschrank waere beim ersten Oeffnen leer`,
    );
  }
});

test('Kennungen sind eindeutig und tragen ihren Platz im Namen', () => {
  const ids = KATALOG.map((stueck) => stueck.id);
  assert.equal(new Set(ids).size, ids.length, 'eine Kennung kommt doppelt');
  for (const stueck of KATALOG) {
    assert.ok(
      stueck.id.startsWith(`${stueck.slot}-`),
      `${stueck.id} gehoert zu ${stueck.slot}, sagt es aber nicht`,
    );
    assert.equal(stueck.nameKey, `kosmetik.${stueck.id}`);
  }
});

test('Geschenke stehen in keinem Regal und sind nicht kaufbar', async () => {
  const { ctx, accountId } = await konto();
  try {
    for (const id of GEBURTSTAGS_OUTFIT) {
      assert.equal(requireStueck(id).herkunft, 'geschenk');
    }

    await gutschreiben(ctx.db, accountId, 'coins', 10_000);
    await assert.rejects(
      () => kaufen(ctx.db, accountId, 'hut-partyhut'),
      (err: unknown) => err instanceof AppError && err.code === 'itemNotForSale',
    );
    // Das Guthaben bleibt unberuehrt.
    assert.equal((await standVon(ctx.db, accountId)).coins, 10_000);
  } finally {
    await ctx.close();
  }
});

test('Freie Stuecke gehoeren allen, ohne dass eine Besitzzeile entsteht', async () => {
  const { ctx, accountId } = await konto();
  try {
    const garderobe = await garderobeVon(ctx.db, accountId);
    assert.equal(garderobe.besitz.size, 0);
    assert.equal(besitzt(requireStueck('hut-wollmuetze'), garderobe), true);
    assert.equal(besitzt(requireStueck('hut-krone'), garderobe), false);
  } finally {
    await ctx.close();
  }
});

// --- Kaufen -----------------------------------------------------------------

test('Kaufen bucht ab, traegt den Besitz ein und geht nur einmal', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 300);
    const stueck = requireStueck('hut-strohhut');

    const kauf = await kaufen(ctx.db, accountId, stueck.id);
    assert.equal(kauf.bezahlt, stueck.preis.coins);
    assert.equal(kauf.waehrung, 'coins');
    assert.equal(kauf.stand, 300 - stueck.preis.coins);
    assert.equal((await standVon(ctx.db, accountId)).coins, 300 - stueck.preis.coins);

    const garderobe = await garderobeVon(ctx.db, accountId);
    assert.equal(garderobe.besitz.has(stueck.id), true);

    await assert.rejects(
      () => kaufen(ctx.db, accountId, stueck.id),
      (err: unknown) => err instanceof AppError && err.code === 'itemAlreadyOwned',
    );
    // Der zweite Versuch darf nicht noch einmal zahlen.
    assert.equal((await standVon(ctx.db, accountId)).coins, 300 - stueck.preis.coins);
  } finally {
    await ctx.close();
  }
});

test('Ohne Deckung gibt es nichts — und der Besitz entsteht nicht halb', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 50);

    await assert.rejects(
      () => kaufen(ctx.db, accountId, 'hut-strohhut'),
      (err: unknown) => err instanceof AppError && err.code === 'coinsInsufficient',
    );

    assert.equal((await standVon(ctx.db, accountId)).coins, 50);
    const garderobe = await garderobeVon(ctx.db, accountId);
    assert.equal(garderobe.besitz.has('hut-strohhut'), false);
  } finally {
    await ctx.close();
  }
});

/**
 * Der Doppelpreis.
 *
 * Hier stand bis zum 4. August das Gegenteil: „Ein Edelstein-Stueck ist mit
 * Muenzen nicht zu haben". Seit Edelsteine die universelle Waehrung sind, ist
 * jedes Stueck in beiden zu haben — und der Test haelt jetzt fest, dass das an
 * beiden Enden gilt, auch am legendaeren.
 */
test('Jedes Stueck ist in beiden Waehrungen zu haben, zum Kurs umgerechnet', () => {
  for (const stueck of KATALOG) {
    if (stueck.herkunft === 'geschenk') continue;
    if (stueck.preis.coins === 0) {
      assert.equal(stueck.preis.gems, 0, `${stueck.id}: frei in Muenzen, aber nicht in Edelsteinen`);
      continue;
    }

    assert.ok(stueck.preis.gems > 0, `${stueck.id} hat keinen Edelsteinpreis`);
    // Aufgerundet, damit der direkte Edelsteinpreis nie billiger ist als
    // derselbe Betrag ueber den Umtausch.
    assert.equal(
      stueck.preis.gems,
      Math.ceil(stueck.preis.coins / MUENZEN_JE_EDELSTEIN),
      `${stueck.id}: Edelsteinpreis passt nicht zum Kurs`,
    );
  }
});

test('Das legendaere Stueck geht in Edelsteinen und in Muenzen', async () => {
  const { ctx, accountId } = await konto();
  try {
    const krone = requireStueck('hut-krone');
    // Der Muenzpreis ist das Fuenfzehnfache: teuer, aber erreichbar.
    assert.equal(krone.preis.gems, 40);
    assert.equal(krone.preis.coins, 40 * MUENZEN_JE_EDELSTEIN);

    // Zu wenig von beidem: Die Waehrung der Anfrage entscheidet, welcher
    // Fehler kommt.
    await gutschreiben(ctx.db, accountId, 'coins', 100);
    await assert.rejects(
      () => kaufen(ctx.db, accountId, 'hut-krone', 'gems'),
      (err: unknown) => err instanceof AppError && err.code === 'gemsInsufficient',
    );
    await assert.rejects(
      () => kaufen(ctx.db, accountId, 'hut-krone', 'coins'),
      (err: unknown) => err instanceof AppError && err.code === 'coinsInsufficient',
    );

    // Mit Edelsteinen geht es, und die Muenzen bleiben unberuehrt liegen.
    await gutschreiben(ctx.db, accountId, 'gems', 40);
    const kauf = await kaufen(ctx.db, accountId, 'hut-krone', 'gems');
    assert.equal(kauf.waehrung, 'gems');
    assert.equal(kauf.bezahlt, 40);
    assert.equal(kauf.stand, 0);
    assert.equal((await standVon(ctx.db, accountId)).coins, 100);
  } finally {
    await ctx.close();
  }
});

test('Ein Muenzen-Stueck geht auch gegen Edelsteine', async () => {
  const { ctx, accountId } = await konto();
  try {
    const hut = requireStueck('hut-strohhut');
    assert.equal(hut.preis.coins, 120);
    assert.equal(hut.preis.gems, 8);

    // Kein einziger Muenzbetrag auf dem Konto, nur Edelsteine.
    await gutschreiben(ctx.db, accountId, 'gems', 10);
    const kauf = await kaufen(ctx.db, accountId, hut.id, 'gems');
    assert.equal(kauf.waehrung, 'gems');
    assert.equal(kauf.bezahlt, 8);

    const stand = await standVon(ctx.db, accountId);
    assert.equal(stand.gems, 2);
    assert.equal(stand.coins, 0, 'der Muenzstand darf sich dabei nicht bewegen');
    assert.equal((await garderobeVon(ctx.db, accountId)).besitz.has(hut.id), true);
  } finally {
    await ctx.close();
  }
});

test('Ohne Angabe wird in Muenzen bezahlt', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 200);
    await gutschreiben(ctx.db, accountId, 'gems', 200);

    const kauf = await kaufen(ctx.db, accountId, 'hut-strohhut');
    assert.equal(kauf.waehrung, 'coins');
    assert.equal((await standVon(ctx.db, accountId)).gems, 200, 'Edelsteine bleiben unberuehrt');
  } finally {
    await ctx.close();
  }
});

test('Ein freies Stueck kaufen ist kein Kauf, sondern schon erledigt', async () => {
  const { ctx, accountId } = await konto();
  try {
    await assert.rejects(
      () => kaufen(ctx.db, accountId, 'hut-wollmuetze'),
      (err: unknown) => err instanceof AppError && err.code === 'itemAlreadyOwned',
    );
  } finally {
    await ctx.close();
  }
});

// --- Anziehen ---------------------------------------------------------------

test('Was man nicht besitzt, laesst sich nicht anziehen', async () => {
  const { ctx, accountId } = await konto();
  try {
    await assert.rejects(
      () => anziehen(ctx.db, accountId, 'hut', 'hut-krone'),
      (err: unknown) =>
        err instanceof AppError && err.code === 'itemNotOwned' && err.status === 403,
    );
    assert.deepEqual(await getragenVon(ctx.db, accountId), {});
  } finally {
    await ctx.close();
  }
});

test('Ein Stueck gehoert in seinen Platz und in keinen anderen', async () => {
  const { ctx, accountId } = await konto();
  try {
    await assert.rejects(
      () => anziehen(ctx.db, accountId, 'schuhe', 'hut-wollmuetze'),
      (err: unknown) => err instanceof AppError && err.code === 'itemWrongSlot',
    );
  } finally {
    await ctx.close();
  }
});

test('Anziehen, umziehen, ausziehen — je Platz genau ein Stueck', async () => {
  const { ctx, accountId } = await konto();
  try {
    await anziehen(ctx.db, accountId, 'hut', 'hut-wollmuetze');
    assert.deepEqual(await getragenVon(ctx.db, accountId), { hut: 'hut-wollmuetze' });

    // Umziehen ersetzt, es entsteht keine zweite Zeile.
    await gutschreiben(ctx.db, accountId, 'coins', 200);
    await kaufen(ctx.db, accountId, 'hut-strohhut');
    await anziehen(ctx.db, accountId, 'hut', 'hut-strohhut');
    assert.deepEqual(await getragenVon(ctx.db, accountId), { hut: 'hut-strohhut' });

    // Zwei verschiedene Plaetze stehen nebeneinander.
    await anziehen(ctx.db, accountId, 'schuhe', 'schuhe-flossen');
    assert.deepEqual(await getragenVon(ctx.db, accountId), {
      hut: 'hut-strohhut',
      schuhe: 'schuhe-flossen',
    });

    // null macht den Platz leer - kein Eintrag, kein null-Wert.
    await anziehen(ctx.db, accountId, 'hut', null);
    assert.deepEqual(await getragenVon(ctx.db, accountId), { schuhe: 'schuhe-flossen' });
  } finally {
    await ctx.close();
  }
});

test('Eine unbekannte Kennung wird abgewiesen, nicht gespeichert', async () => {
  const { ctx, accountId } = await konto();
  try {
    assert.equal(stueckMit('hut-diamanthelm'), undefined);
    await assert.rejects(
      () => anziehen(ctx.db, accountId, 'hut', 'hut-diamanthelm'),
      (err: unknown) => err instanceof AppError && err.code === 'itemUnknown',
    );
  } finally {
    await ctx.close();
  }
});

test('Geschenktes laesst sich tragen, obwohl es nicht kaufbar ist', async () => {
  const { ctx, accountId } = await konto();
  try {
    await schenken(ctx.db, accountId, GEBURTSTAGS_OUTFIT);
    await anziehen(ctx.db, accountId, 'hut', 'hut-partyhut');
    await anziehen(ctx.db, accountId, 'aura', 'aura-konfetti');
    assert.deepEqual(await getragenVon(ctx.db, accountId), {
      hut: 'hut-partyhut',
      aura: 'aura-konfetti',
    });
  } finally {
    await ctx.close();
  }
});

test('Schenken ist idempotent und uebergeht Unbekanntes', async () => {
  const { ctx, accountId } = await konto();
  try {
    await schenken(ctx.db, accountId, ['hut-partyhut', 'gibt-es-nicht']);
    await schenken(ctx.db, accountId, ['hut-partyhut']);
    const garderobe = await garderobeVon(ctx.db, accountId);
    assert.deepEqual([...garderobe.besitz], ['hut-partyhut']);
  } finally {
    await ctx.close();
  }
});

test('Ein Platz, den der Katalog nicht mehr kennt, wird uebergangen statt angezeigt', async () => {
  const { ctx, accountId } = await konto();
  try {
    // So eine Zeile entsteht, wenn ein Platz je umbenannt wird.
    await ctx.db
      .insert(schema.accountAvatar)
      .values({ accountId, slot: 'ruecken', itemId: 'ruecken-umhang' });
    await anziehen(ctx.db, accountId, 'hut', 'hut-wollmuetze');

    assert.deepEqual(await getragenVon(ctx.db, accountId), { hut: 'hut-wollmuetze' });
  } finally {
    await ctx.close();
  }
});

// --- Regale -----------------------------------------------------------------

test('Der Shop zeigt jeden Platz als Regal, mit Besitzstand', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 200);
    await kaufen(ctx.db, accountId, 'hut-strohhut');

    const shop = await shopFuer(ctx.db, accountId);
    assert.deepEqual(
      shop.regale.map((regal) => regal.slot),
      [...SLOTS],
    );

    const huete = shop.regale.find((regal) => regal.slot === 'hut')!.stuecke;
    assert.equal(huete.find((s) => s.id === 'hut-strohhut')!.besessen, true);
    assert.equal(huete.find((s) => s.id === 'hut-wollmuetze')!.besessen, true, 'frei = besessen');
    assert.equal(huete.find((s) => s.id === 'hut-krone')!.besessen, false);
    assert.equal(huete.find((s) => s.id === 'hut-partyhut')!.geschenk, true);

    assert.ok(shop.muenzpakete.length >= 3);
    assert.ok(shop.edelsteinpakete.length >= 3);
    assert.ok(shop.jetonpakete.length >= 3);
    assert.ok(shop.paesse.length >= 2);
    assert.ok(shop.truhen.length >= 3);
    assert.equal(shop.kurs, MUENZEN_JE_EDELSTEIN, 'der Kurs muss mitgehen');

    // Jedes Angebot hat genau EINEN Preis: Cent oder Edelsteine, nie beides.
    // Beides waere ein Wechselkurs an der Kachel, und den fuehrt waehrung.ts.
    for (const paket of [...shop.muenzpakete, ...shop.edelsteinpakete, ...shop.paesse]) {
      const preise = [paket.cents, paket.gems].filter((p) => p !== null);
      assert.equal(preise.length, 1, `${paket.id}: braucht genau einen Preis, hat ${preise.length}`);
      assert.equal(Number.isInteger(preise[0]), true, `${paket.id}: Preise muessen ganz sein`);
      assert.ok(preise[0]! > 0, `${paket.id}: ein Preis von 0 waere ein Versprechen`);
    }
  } finally {
    await ctx.close();
  }
});

// --- Pakete gegen Edelsteine ------------------------------------------------

/**
 * Die Preisordnung des Shops, als Rechnung festgehalten.
 *
 * Nicht aus Ordnungsliebe: Diese drei Zusicherungen sind die einzige Sperre
 * dagegen, dass ein spaeteres Nachjustieren der Zahlen aus einem Angebot
 * unbemerkt den einzigen Weg macht, der sich noch lohnt.
 */
test('Geld kauft nur Edelsteine, Edelsteine kaufen alles andere', () => {
  for (const paket of MUENZPAKETE) {
    assert.equal(paket.cents, null, `${paket.id}: Muenzen kosten kein Geld mehr`);
    assert.ok(paket.gems !== null && paket.gems > 0);
    assert.equal(paket.kaufbar, true);
  }
  for (const paket of EDELSTEINPAKETE) {
    assert.ok(paket.cents !== null && paket.cents > 0, `${paket.id}: kostet Geld`);
    assert.equal(paket.gems, null, 'Edelsteine gegen Edelsteine waere ein Kreis');
    assert.equal(paket.kaufbar, false, 'fuer Geld fehlt der Bezahlweg');
  }
  for (const pass of PAESSE) {
    assert.equal(pass.kaufbar, false, `${pass.id}: noch nicht kaufbar`);
    assert.equal(pass.gibt, null, 'ein Pass ist ein Zeitraum, kein Guthaben');
  }
});

test('Die Muenzpakete liegen um den Kurs herum, nicht daneben', () => {
  for (const paket of MUENZPAKETE) {
    const jeEdelstein = paket.gibt!.betrag / paket.gems!;
    // Das kleine Paket liegt knapp unter dem Kurs, das grosse darueber - der
    // uebliche Mengenrabatt. Weiter darf es nicht auseinanderlaufen: Ein Paket
    // deutlich ueber dem Kurs waere der einzige Kauf, der noch zaehlt.
    assert.ok(
      jeEdelstein >= MUENZEN_JE_EDELSTEIN - 1 && jeEdelstein <= MUENZEN_JE_EDELSTEIN + 1,
      `${paket.id}: ${jeEdelstein} Muenzen je Edelstein liegt zu weit vom Kurs ${MUENZEN_JE_EDELSTEIN}`,
    );
  }
});

test('Die Mitte jeder Kauftruhe ist genau der Kurs', () => {
  for (const truhe of KAUFTRUHEN) {
    assert.ok(truhe.von < truhe.bis, `${truhe.id}: eine Spanne braucht zwei Enden`);
    assert.equal(
      (truhe.von + truhe.bis) / 2,
      truhe.gems * MUENZEN_JE_EDELSTEIN,
      `${truhe.id}: Wuerfeln darf im Erwartungswert nichts kosten`,
    );
  }
});

test('Ein Muenzpaket kostet Edelsteine und bringt Muenzen', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'gems', 120);

    const kauf = await paketKaufen(ctx.db, accountId, 'muenzen-mittel');
    assert.equal(kauf.bezahlt, 100);
    assert.deepEqual(kauf.gibt, { waehrung: 'coins', betrag: 1_500 });
    assert.deepEqual(kauf.stand, { coins: 1_500, gems: 20, broJetons: 1000 });
    assert.deepEqual(await standVon(ctx.db, accountId), { coins: 1_500, gems: 20, broJetons: 1000 });
  } finally {
    await ctx.close();
  }
});

test('Ohne Edelsteine kein Paket — und keine halben Muenzen', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'gems', 34);

    await assert.rejects(
      () => paketKaufen(ctx.db, accountId, 'muenzen-klein'),
      (err: unknown) => err instanceof AppError && err.code === 'gemsInsufficient',
    );

    assert.deepEqual(await standVon(ctx.db, accountId), { coins: 0, gems: 34, broJetons: 1000 });
  } finally {
    await ctx.close();
  }
});

/**
 * Der wichtigste Riegel am Paketkauf.
 *
 * Ohne ihn waere `edelsteine-gross` der Weg, 400 Edelsteine gegen null zu
 * bekommen: Dort steht kein Edelsteinpreis, und ein fehlender Preis ist in einer
 * Abbuchung schnell eine Null.
 */
test('Was nicht gegen Edelsteine zu haben ist, laesst sich nicht so kaufen', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'gems', 10_000);

    for (const id of ['edelsteine-klein', 'edelsteine-gross', 'vip-pass', 'season-pass']) {
      await assert.rejects(
        () => paketKaufen(ctx.db, accountId, id),
        (err: unknown) => err instanceof AppError && err.code === 'packNotForSale',
        `${id} darf so nicht kaufbar sein`,
      );
    }

    await assert.rejects(
      () => paketKaufen(ctx.db, accountId, 'gibtsnicht'),
      (err: unknown) => err instanceof AppError && err.code === 'packUnknown',
    );

    assert.deepEqual(await standVon(ctx.db, accountId), { coins: 0, gems: 10_000, broJetons: 1000 });
  } finally {
    await ctx.close();
  }
});

test('BroJetons kauft man gegen Muenzen, nicht gegen Edelsteine', async () => {
  const { ctx, accountId } = await konto();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 100);
    const kauf = await paketKaufen(ctx.db, accountId, 'brojetons-klein');
    assert.equal(kauf.bezahlt, 40);
    assert.deepEqual(kauf.gibt, { waehrung: 'broJetons', betrag: 500 });
    assert.deepEqual(await standVon(ctx.db, accountId), {
      coins: 60,
      gems: 0,
      broJetons: 1500,
    });

    for (const paket of JETONPAKETE) {
      assert.ok(paket.coins !== null && paket.coins > 0, `${paket.id}: kostet Muenzen`);
      assert.equal(paket.gems, null);
      assert.equal(paket.cents, null);
      assert.equal(paket.gibt?.waehrung, 'broJetons');
    }
  } finally {
    await ctx.close();
  }
});

test('Ein Testkonto besitzt alles, ohne eine einzige Besitzzeile', async () => {
  const { ctx, accountId } = await konto();
  try {
    await ctx.db
      .update(schema.account)
      .set({ isStaff: true })
      .where(eq(schema.account.id, accountId));

    const shop = await shopFuer(ctx.db, accountId);
    for (const regal of shop.regale) {
      for (const stueck of regal.stuecke) {
        assert.equal(stueck.besessen, true, `${stueck.id} sollte dem Testkonto gehoeren`);
      }
    }

    // Und es darf alles tragen, ohne gekauft zu haben.
    await anziehen(ctx.db, accountId, 'aura', 'aura-sterne');
    assert.deepEqual(await getragenVon(ctx.db, accountId), { aura: 'aura-sterne' });
  } finally {
    await ctx.close();
  }
});
