/**
 * Clanchat und Clankrieg.
 *
 * Der Krieg hat drei Regeln (Platz, Deckel, zwei Menschen) und vier
 * Zustaende. Beides zusammen ist genug, um sich zu vertun — deshalb wird
 * hier der ganze Weg gegangen: suchen, paaren, punkten, abrechnen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { createClub, clubsFor, leaveClub, setMemberRole } from '../src/clubs/service.js';
import { deleteMessage, listMessages, postMessage, postSystem } from '../src/clubs/chat.js';
import {
  PARTIEN_DECKEL,
  acceptWar,
  cancelWar,
  challengeWar,
  recordPartyResult,
  searchWar,
  settleDueWars,
  warState,
} from '../src/clubs/war.js';
import { AppError } from '../src/errors.js';
import * as s from '../src/db/schema.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

type Ctx = Awaited<ReturnType<typeof ctx>>;

/** Jedes frische Konto steckt im Beta-Clan — erst austreten, dann gruenden. */
async function gruende(c: Ctx, accountId: string, name: string): Promise<string> {
  for (const club of await clubsFor(c.db, accountId)) {
    await leaveClub(c.db, club.id, accountId);
  }
  const { id } = await createClub(c.db, accountId, {
    name,
    crest: 'wappen-2',
    joinMode: 'open',
  });
  return id;
}

/** Setzt das Ende eines Kriegs in die Vergangenheit, statt zu warten. */
async function laufeAb(c: Ctx, warId: string): Promise<void> {
  await c.db
    .update(s.clubWar)
    .set({ endsAt: new Date(Date.now() - 1000) })
    .where(eq(s.clubWar.id, warId));
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

test('Chat: schreiben, lesen, und nur Mitglieder duerfen es', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const clubId = await gruende(c, anna.accountId, 'Kegelclub Nord');

  await postMessage(c.db, clubId, anna.accountId, 'Moin zusammen');
  const zeilen = await listMessages(c.db, clubId, anna.accountId);
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0]!.body, 'Moin zusammen');
  assert.equal(zeilen[0]!.displayName, 'Anna');

  // Bert ist im Beta-Clan, nicht in Annas Verein.
  await assert.rejects(
    () => listMessages(c.db, clubId, bert.accountId),
    (e: unknown) => e instanceof AppError && e.code === 'notClubMember',
  );
  await assert.rejects(
    () => postMessage(c.db, clubId, bert.accountId, 'Hallo?'),
    (e: unknown) => e instanceof AppError && e.code === 'notClubMember',
  );
});

test('Chat: leere Nachricht wird abgewiesen, Rand-Leerraum faellt weg', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const clubId = await gruende(c, anna.accountId, 'Kegelclub Nord');

  await assert.rejects(
    () => postMessage(c.db, clubId, anna.accountId, '   '),
    (e: unknown) => e instanceof AppError && e.code === 'messageEmpty',
  );

  const nachricht = await postMessage(c.db, clubId, anna.accountId, '  Moin  ');
  assert.equal(nachricht.body, 'Moin');
});

test('Chat: `seit` liefert nur Neueres', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const clubId = await gruende(c, anna.accountId, 'Kegelclub Nord');

  const erste = await postMessage(c.db, clubId, anna.accountId, 'eins');
  await postMessage(c.db, clubId, anna.accountId, 'zwei');

  const neu = await listMessages(c.db, clubId, anna.accountId, new Date(erste.createdAt));
  assert.equal(neu.length, 1);
  assert.equal(neu[0]!.body, 'zwei');
});

test('Chat: Verfasser und Leitung loeschen, Systemzeilen bleiben stehen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const clubId = await gruende(c, anna.accountId, 'Kegelclub Nord');
  await c.db.insert(s.clubMember).values({ clubId, accountId: bert.accountId });

  const berts = await postMessage(c.db, clubId, bert.accountId, 'Vertippt');

  // Anna ist Admin und darf fremde Nachrichten wegraeumen.
  await deleteMessage(c.db, clubId, berts.id, anna.accountId);
  const nach = await listMessages(c.db, clubId, anna.accountId);
  assert.equal(nach[0]!.deleted, true);
  assert.equal(nach[0]!.body, null, 'der Text wird nicht mehr ausgeliefert');

  // Die Chronik laesst sich nicht frisieren.
  await postSystem(c.db, clubId, 'Krieg gewonnen');
  const alle = await listMessages(c.db, clubId, anna.accountId);
  const system = alle.find((z) => z.kind === 'system')!;
  await assert.rejects(
    () => deleteMessage(c.db, clubId, system.id, anna.accountId),
    (e: unknown) => e instanceof AppError && e.code === 'systemMessage',
  );

  // Ein einfaches Mitglied raeumt fremde Nachrichten NICHT weg.
  const annas = await postMessage(c.db, clubId, anna.accountId, 'Steht hier');
  await assert.rejects(
    () => deleteMessage(c.db, clubId, annas.id, bert.accountId),
    (e: unknown) => e instanceof AppError && e.code === 'notClubAdmin',
  );
});

// ---------------------------------------------------------------------------
// Krieg
// ---------------------------------------------------------------------------

test('Krieg: zwei suchende Clans werden gepaart', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const nord = await gruende(c, anna.accountId, 'Kegelclub Nord');
  const sued = await gruende(c, bert.accountId, 'Kegelclub Sued');

  const erste = await searchWar(c.db, nord, anna.accountId);
  assert.equal(erste.status, 'sucht', 'ohne Gegner wird gewartet');

  const zweite = await searchWar(c.db, sued, bert.accountId);
  assert.equal(zweite.status, 'gepaart');

  const stand = await warState(c.db, nord, anna.accountId);
  assert.equal(stand.aktuell?.status, 'laeuft');
  assert.equal(stand.aktuell?.gegner?.name, 'Kegelclub Sued');
  assert.ok(stand.aktuell?.endsAt, 'die Uhr laeuft');

  // Beide Seiten haben eine Systemmeldung im Chat.
  const chat = await listMessages(c.db, nord, anna.accountId);
  assert.ok(chat.some((z) => z.kind === 'system' && z.body?.includes('Kegelclub Sued')));
});

test('Krieg: nur die Leitung startet, und nur ein Krieg zur Zeit', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const nord = await gruende(c, anna.accountId, 'Kegelclub Nord');
  await c.db.insert(s.clubMember).values({ clubId: nord, accountId: bert.accountId });

  await assert.rejects(
    () => searchWar(c.db, nord, bert.accountId),
    (e: unknown) => e instanceof AppError && e.code === 'notClubAdmin',
  );

  await searchWar(c.db, nord, anna.accountId);
  await assert.rejects(
    () => searchWar(c.db, nord, anna.accountId),
    (e: unknown) => e instanceof AppError && e.code === 'warAlreadyActive',
  );

  // Zum Vize befoerdert, darf Bert es auch.
  await setMemberRole(c.db, nord, anna.accountId, bert.accountId, 'vize');
  const stand = await warState(c.db, nord, bert.accountId);
  assert.equal(stand.darfFuehren, true);
});

test('Krieg: herausfordern, annehmen und ablehnen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const nord = await gruende(c, anna.accountId, 'Kegelclub Nord');
  const sued = await gruende(c, bert.accountId, 'Kegelclub Sued');

  await challengeWar(c.db, nord, sued, anna.accountId);

  // Der Geforderte sieht die Anfrage, der Fordernde seinen eigenen Antrag.
  const beiSued = await warState(c.db, sued, bert.accountId);
  assert.equal(beiSued.offeneAnfragen.length, 1);
  assert.equal(beiSued.offeneAnfragen[0]!.gegner?.name, 'Kegelclub Nord');
  const beiNord = await warState(c.db, nord, anna.accountId);
  assert.equal(beiNord.aktuell?.status, 'angefragt');

  // Ablehnen gibt beide Seiten wieder frei.
  await cancelWar(c.db, beiSued.offeneAnfragen[0]!.id, bert.accountId);
  assert.equal((await warState(c.db, nord, anna.accountId)).aktuell, null);

  // Zweiter Anlauf, diesmal angenommen.
  await challengeWar(c.db, nord, sued, anna.accountId);
  const neu = await warState(c.db, sued, bert.accountId);
  await acceptWar(c.db, neu.offeneAnfragen[0]!.id, bert.accountId);
  assert.equal((await warState(c.db, sued, bert.accountId)).aktuell?.status, 'laeuft');
});

test('Krieg: Platz eins bringt drei Punkte, Platz zwei einen, sonst nichts', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const nord = await gruende(c, anna.accountId, 'Kegelclub Nord');
  const sued = await gruende(c, bert.accountId, 'Kegelclub Sued');
  await searchWar(c.db, nord, anna.accountId);
  await searchWar(c.db, sued, bert.accountId);

  await recordPartyResult(
    c.db,
    [
      { accountId: anna.accountId, place: 1 },
      { accountId: bert.accountId, place: 2 },
    ],
    2,
  );

  const stand = await warState(c.db, nord, anna.accountId);
  assert.equal(stand.aktuell?.wir.score, 3, 'Platz eins');
  assert.equal(stand.aktuell?.gegner?.score, 1, 'Platz zwei');
  assert.equal(stand.aktuell?.beitraege[0]?.displayName, 'Anna');
  assert.equal(stand.aktuell?.beitraege[0]?.games, 1);

  // Platz drei bringt nichts.
  await recordPartyResult(c.db, [{ accountId: anna.accountId, place: 3 }], 2);
  assert.equal((await warState(c.db, nord, anna.accountId)).aktuell?.wir.score, 3);
});

test('Krieg: Partien gegen Bots zaehlen nicht', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const nord = await gruende(c, anna.accountId, 'Kegelclub Nord');
  const sued = await gruende(c, bert.accountId, 'Kegelclub Sued');
  await searchWar(c.db, nord, anna.accountId);
  await searchWar(c.db, sued, bert.accountId);

  // Ein Mensch, drei Bots: kein Kriegspunkt, egal wie oft.
  for (let i = 0; i < 5; i++) {
    await recordPartyResult(c.db, [{ accountId: anna.accountId, place: 1 }], 1);
  }
  assert.equal((await warState(c.db, nord, anna.accountId)).aktuell?.wir.score, 0);
});

test('Krieg: je Mitglied zaehlen hoechstens zehn Partien', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const nord = await gruende(c, anna.accountId, 'Kegelclub Nord');
  const sued = await gruende(c, bert.accountId, 'Kegelclub Sued');
  await searchWar(c.db, nord, anna.accountId);
  await searchWar(c.db, sued, bert.accountId);

  for (let i = 0; i < PARTIEN_DECKEL + 5; i++) {
    await recordPartyResult(c.db, [{ accountId: anna.accountId, place: 1 }], 2);
  }

  const stand = await warState(c.db, nord, anna.accountId);
  assert.equal(stand.aktuell?.wir.score, PARTIEN_DECKEL * 3, 'ab der elften Partie nichts mehr');
  assert.equal(stand.aktuell?.beitraege[0]?.games, PARTIEN_DECKEL);
});

test('Krieg: laeuft die Zeit ab, wird abgerechnet und gemeldet', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const nord = await gruende(c, anna.accountId, 'Kegelclub Nord');
  const sued = await gruende(c, bert.accountId, 'Kegelclub Sued');
  await searchWar(c.db, nord, anna.accountId);
  await searchWar(c.db, sued, bert.accountId);

  await recordPartyResult(c.db, [{ accountId: anna.accountId, place: 1 }], 2);

  const laufend = await warState(c.db, nord, anna.accountId);
  await laufeAb(c, laufend.aktuell!.id);
  await settleDueWars(c.db);

  const stand = await warState(c.db, nord, anna.accountId);
  assert.equal(stand.aktuell, null, 'kein laufender Krieg mehr');
  assert.equal(stand.letzter?.status, 'beendet');
  assert.equal(stand.letzter?.ergebnis, 'wir');

  const beiSued = await warState(c.db, sued, bert.accountId);
  assert.equal(beiSued.letzter?.ergebnis, 'gegner');

  // Das Ergebnis steht in beiden Chats.
  const chat = await listMessages(c.db, nord, anna.accountId);
  assert.ok(chat.some((z) => z.kind === 'system' && z.body?.includes('gewonnen')));

  // Und danach darf wieder gesucht werden.
  assert.equal((await searchWar(c.db, nord, anna.accountId)).status, 'sucht');
});

test('Krieg: ein laufender Krieg laesst sich nicht absagen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const nord = await gruende(c, anna.accountId, 'Kegelclub Nord');
  const sued = await gruende(c, bert.accountId, 'Kegelclub Sued');
  await searchWar(c.db, nord, anna.accountId);
  await searchWar(c.db, sued, bert.accountId);

  const stand = await warState(c.db, nord, anna.accountId);
  await assert.rejects(
    () => cancelWar(c.db, stand.aktuell!.id, anna.accountId),
    (e: unknown) => e instanceof AppError && e.code === 'warRunning',
  );
});

test('Krieg: die eigene Suche laesst sich zuruecknehmen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const nord = await gruende(c, anna.accountId, 'Kegelclub Nord');

  await searchWar(c.db, nord, anna.accountId);
  const stand = await warState(c.db, nord, anna.accountId);
  await cancelWar(c.db, stand.aktuell!.id, anna.accountId);
  assert.equal((await warState(c.db, nord, anna.accountId)).aktuell, null);
});
