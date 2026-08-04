/**
 * Tagesaufgaben.
 *
 * Zwei Sorten Pruefung: die Messung (welches Ereignis bringt welche Aufgabe
 * voran) ohne Datenbank, und das Abholen mit — denn dort liegt der Fehler, der
 * Geld kostet: zweimal abholen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import {
  AUFGABEN,
  TAGESSUMME,
  aufgabeAbholen,
  aufgabenFuer,
  fortschreiben,
  zuwachs,
  type Ereignis,
} from '../src/quests.js';
import { heute } from '../src/truhen.js';
import { standVon } from '../src/waehrung.js';
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

function ereignis(teil: Partial<Ereignis> = {}): Ereignis {
  return { accountId: 'x', gameId: 'doppelkopf', platz: 3, karten: 12, ...teil };
}

// --- Messung ----------------------------------------------------------------

test('Eine beendete Partie bringt die Partie-Aufgaben voran, egal wie sie ausging', () => {
  const partie = AUFGABEN.find((a) => a.id === 'partie-spielen')!;
  assert.equal(zuwachs(partie, ereignis({ platz: 4 })), 1);
  assert.equal(zuwachs(partie, ereignis({ platz: 1 })), 1);
});

test('Die Sieg-Aufgabe zaehlt nur den ersten Platz', () => {
  const sieg = AUFGABEN.find((a) => a.id === 'partie-gewinnen')!;
  assert.equal(zuwachs(sieg, ereignis({ platz: 1 })), 1);
  assert.equal(zuwachs(sieg, ereignis({ platz: 2 })), 0);
});

test('Die Spiel-Aufgaben zaehlen nur ihr eigenes Spiel', () => {
  const doko = AUFGABEN.find((a) => a.id === 'doppelkopf-am-tag')!;
  const zauber = AUFGABEN.find((a) => a.id === 'zauberer-am-tag')!;

  assert.equal(zuwachs(doko, ereignis({ gameId: 'doppelkopf' })), 1);
  assert.equal(zuwachs(doko, ereignis({ gameId: 'wizard' })), 0);
  assert.equal(zuwachs(zauber, ereignis({ gameId: 'wizard' })), 1);
  assert.equal(zuwachs(zauber, ereignis({ gameId: 'doppelkopf' })), 0);
});

test('Die Kartenaufgabe zaehlt die gelegten Karten, nie negativ', () => {
  const karten = AUFGABEN.find((a) => a.id === 'karten-legen')!;
  assert.equal(zuwachs(karten, ereignis({ karten: 48 })), 48);
  // Liefert ein Modul nichts, gibt es null statt einer geratenen Zahl.
  assert.equal(zuwachs(karten, ereignis({ karten: 0 })), 0);
  assert.equal(zuwachs(karten, ereignis({ karten: -5 })), 0);
});

test('Die Tagessumme ist die Summe der Belohnungen', () => {
  assert.equal(
    TAGESSUMME,
    AUFGABEN.reduce((s, a) => s + a.belohnung.betrag, 0),
  );
  // Sie liegt bewusst ueber der Tagestruhe (1 bis 3 Muenzen): Spielen soll
  // mehr bringen als Antippen.
  assert.ok(TAGESSUMME > 3);
});

// --- Fortschritt ------------------------------------------------------------

test('Eine Partie fuellt genau die Aufgaben, auf die sie passt', async () => {
  const { ctx, accountId } = await konto();
  try {
    await fortschreiben(ctx.db, {
      accountId,
      gameId: 'doppelkopf',
      platz: 1,
      karten: 48,
    });

    const { aufgaben } = await aufgabenFuer(ctx.db, accountId);
    const stand = new Map(aufgaben.map((a) => [a.id, a]));

    assert.equal(stand.get('partie-spielen')!.fertig, true);
    assert.equal(stand.get('partie-gewinnen')!.fertig, true);
    assert.equal(stand.get('doppelkopf-am-tag')!.fertig, true);
    // Drei Partien: eine ist erst ein Drittel.
    assert.equal(stand.get('drei-partien')!.fortschritt, 1);
    assert.equal(stand.get('drei-partien')!.fertig, false);
    // Zauberer war nicht dabei.
    assert.equal(stand.get('zauberer-am-tag')!.fortschritt, 0);
    // 48 von 60 Karten.
    assert.equal(stand.get('karten-legen')!.fortschritt, 48);
    assert.equal(stand.get('karten-legen')!.fertig, false);
  } finally {
    await ctx.close();
  }
});

test('Der Fortschritt wird auf das Ziel gedeckelt', async () => {
  const { ctx, accountId } = await konto();
  try {
    // Dreimal 48 Karten waeren 144 - die Anzeige soll 60 von 60 sagen und
    // nicht 144 von 60.
    for (let i = 0; i < 3; i++) {
      await fortschreiben(ctx.db, { accountId, gameId: 'doppelkopf', platz: 2, karten: 48 });
    }

    const { aufgaben } = await aufgabenFuer(ctx.db, accountId);
    const karten = aufgaben.find((a) => a.id === 'karten-legen')!;
    assert.equal(karten.fortschritt, 60);
    assert.equal(karten.fertig, true);

    const drei = aufgaben.find((a) => a.id === 'drei-partien')!;
    assert.equal(drei.fortschritt, 3);

    // Auch in der Datenbank steht der gedeckelte Wert, nicht 144.
    const [zeile] = await ctx.db
      .select({ progress: schema.questProgress.progress })
      .from(schema.questProgress)
      .where(
        and(
          eq(schema.questProgress.accountId, accountId),
          eq(schema.questProgress.questId, 'karten-legen'),
          eq(schema.questProgress.day, heute()),
        ),
      );
    assert.equal(zeile!.progress, 60);
  } finally {
    await ctx.close();
  }
});

test('Ein Konto ohne Partie hat alle Aufgaben auf null und nichts offen', async () => {
  const { ctx, accountId } = await konto();
  try {
    const ansicht = await aufgabenFuer(ctx.db, accountId);
    assert.equal(ansicht.aufgaben.length, AUFGABEN.length);
    assert.equal(ansicht.offeneBelohnung, 0);
    for (const aufgabe of ansicht.aufgaben) {
      assert.equal(aufgabe.fortschritt, 0);
      assert.equal(aufgabe.fertig, false);
      assert.equal(aufgabe.abgeholt, false);
    }
  } finally {
    await ctx.close();
  }
});

// --- Abholen ----------------------------------------------------------------

test('Die Belohnung laesst sich einmal abholen', async () => {
  const { ctx, accountId } = await konto();
  try {
    await fortschreiben(ctx.db, { accountId, gameId: 'doppelkopf', platz: 1, karten: 10 });

    const ergebnis = await aufgabeAbholen(ctx.db, accountId, 'partie-spielen');
    assert.equal(ergebnis.betrag, 5);
    assert.equal(ergebnis.waehrung, 'coins');
    assert.equal(ergebnis.stand, 5);
    assert.equal((await standVon(ctx.db, accountId)).coins, 5);

    await assert.rejects(
      () => aufgabeAbholen(ctx.db, accountId, 'partie-spielen'),
      (err: unknown) =>
        err instanceof AppError && err.code === 'questAlreadyClaimed' && err.status === 409,
    );
    // Der zweite Versuch darf nichts gutgeschrieben haben.
    assert.equal((await standVon(ctx.db, accountId)).coins, 5);

    const { aufgaben, offeneBelohnung } = await aufgabenFuer(ctx.db, accountId);
    assert.equal(aufgaben.find((a) => a.id === 'partie-spielen')!.abgeholt, true);
    // Sieg und Doppelkopf sind fertig, aber noch nicht abgeholt: 10 + 5.
    assert.equal(offeneBelohnung, 15);
  } finally {
    await ctx.close();
  }
});

test('Eine unfertige Aufgabe gibt nichts her', async () => {
  const { ctx, accountId } = await konto();
  try {
    await fortschreiben(ctx.db, { accountId, gameId: 'doppelkopf', platz: 2, karten: 5 });

    await assert.rejects(
      () => aufgabeAbholen(ctx.db, accountId, 'drei-partien'),
      (err: unknown) => err instanceof AppError && err.code === 'questNotDone',
    );
    // Und eine, zu der es gar keine Zeile gibt.
    await assert.rejects(
      () => aufgabeAbholen(ctx.db, accountId, 'zauberer-am-tag'),
      (err: unknown) => err instanceof AppError && err.code === 'questNotDone',
    );
    assert.equal((await standVon(ctx.db, accountId)).coins, 0);
  } finally {
    await ctx.close();
  }
});

test('Eine erfundene Aufgabenkennung gibt es nicht', async () => {
  const { ctx, accountId } = await konto();
  try {
    await assert.rejects(
      () => aufgabeAbholen(ctx.db, accountId, 'alles-gewinnen'),
      (err: unknown) => err instanceof AppError && err.code === 'questUnknown',
    );
  } finally {
    await ctx.close();
  }
});

test('Der Fortschritt haengt am Kalendertag: gestern erledigt ist heute nicht abholbar', async () => {
  const { ctx, accountId } = await konto();
  try {
    // Fertige Aufgabe von gestern von Hand einsetzen.
    await ctx.db.insert(schema.questProgress).values({
      accountId,
      questId: 'partie-spielen',
      day: '2020-01-01',
      progress: 1,
    });

    await assert.rejects(
      () => aufgabeAbholen(ctx.db, accountId, 'partie-spielen'),
      (err: unknown) => err instanceof AppError && err.code === 'questNotDone',
    );

    // Und die Ansicht von heute kennt sie nicht.
    const { aufgaben } = await aufgabenFuer(ctx.db, accountId);
    assert.equal(aufgaben.find((a) => a.id === 'partie-spielen')!.fortschritt, 0);
  } finally {
    await ctx.close();
  }
});
