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
import { anziehen, getragenVon, kaufen, shopFuer } from '../src/shop.js';
import { gutschreiben, standVon } from '../src/waehrung.js';
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
      (stueck) => stueck.slot === slot && stueck.preis === 0 && stueck.herkunft === 'shop',
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
    assert.equal(kauf.bezahlt, stueck.preis);
    assert.equal(kauf.waehrung, 'coins');
    assert.equal(kauf.stand, 300 - stueck.preis);
    assert.equal((await standVon(ctx.db, accountId)).coins, 300 - stueck.preis);

    const garderobe = await garderobeVon(ctx.db, accountId);
    assert.equal(garderobe.besitz.has(stueck.id), true);

    await assert.rejects(
      () => kaufen(ctx.db, accountId, stueck.id),
      (err: unknown) => err instanceof AppError && err.code === 'itemAlreadyOwned',
    );
    // Der zweite Versuch darf nicht noch einmal zahlen.
    assert.equal((await standVon(ctx.db, accountId)).coins, 300 - stueck.preis);
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

test('Ein Edelstein-Stueck ist mit Muenzen nicht zu haben', async () => {
  const { ctx, accountId } = await konto();
  try {
    // Muenzen im Ueberfluss, kein einziger Edelstein.
    await gutschreiben(ctx.db, accountId, 'coins', 1_000_000);

    await assert.rejects(
      () => kaufen(ctx.db, accountId, 'hut-krone'),
      (err: unknown) => err instanceof AppError && err.code === 'gemsInsufficient',
    );

    // Mit Edelsteinen dagegen schon, und die Muenzen bleiben liegen.
    await gutschreiben(ctx.db, accountId, 'gems', 40);
    const kauf = await kaufen(ctx.db, accountId, 'hut-krone');
    assert.equal(kauf.waehrung, 'gems');
    assert.equal(kauf.stand, 0);
    assert.equal((await standVon(ctx.db, accountId)).coins, 1_000_000);
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

    // Die Geldangebote stehen da, aber es gibt keinen Weg, sie zu kaufen -
    // es gibt schlicht keinen Endpunkt dafuer.
    assert.ok(shop.muenzpakete.length >= 3);
    assert.ok(shop.edelsteinpakete.length >= 3);
    assert.ok(shop.paesse.length >= 2);
    for (const paket of [...shop.muenzpakete, ...shop.edelsteinpakete, ...shop.paesse]) {
      assert.equal(Number.isInteger(paket.cents), true, `${paket.id}: Cent muessen ganz sein`);
      assert.ok(paket.cents > 0);
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
