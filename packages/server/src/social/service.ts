/**
 * Spielerprofile und Freundschaften.
 *
 * Ein Profil ist oeffentlich fuer alle Angemeldeten: Anzeigename, Trophaeen,
 * Partien, Siege. Mehr nicht - keine E-Mail, kein Beitrittsdatum auf die
 * Minute, nichts, was jemand nicht selbst durch Spielen veroeffentlicht hat.
 *
 * Freundschaften liegen in einer Zeile je Paar. Solange sie offen ist, traegt
 * die Richtung Bedeutung (accountA hat gefragt); nach Annahme ist sie egal.
 * Da der Primaerschluessel (A,B) das gedrehte Paar (B,A) nicht verhindert,
 * prueft dieser Dienst immer beide Richtungen.
 */

import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, conflict, notFound } from '../errors.js';

export type Relationship = 'self' | 'friends' | 'incoming' | 'outgoing' | 'none';

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

export interface PlayerProfile {
  readonly id: string;
  readonly displayName: string;
  /** Nur der Monat. Genauer muss ein fremdes Konto niemanden interessieren. */
  readonly memberSince: string;
  readonly relationship: Relationship;
  /** Gewertete Zahlen je Spiel, Grundlage der Rangliste. */
  readonly ranking: readonly {
    readonly gameId: string;
    readonly trophies: number;
    readonly highestCheckpoint: number;
    readonly parties: number;
    readonly wins: number;
  }[];
  /**
   * Alle Partien, auch die mit Bots. Getrennt von der Wertung: Wer fuenf
   * Partien gegen Bots gespielt hat, soll kein leeres Profil sehen - aber in
   * die Rangliste gehoeren diese Partien trotzdem nicht.
   */
  readonly totals: { readonly parties: number; readonly wins: number; readonly trophies: number };
}

export async function playerProfile(
  db: Db,
  viewerId: string,
  accountId: string,
): Promise<PlayerProfile> {
  const [acc] = await db
    .select({
      id: s.account.id,
      displayName: s.account.displayName,
      createdAt: s.account.createdAt,
      anonymizedAt: s.account.anonymizedAt,
    })
    .from(s.account)
    .where(eq(s.account.id, accountId));

  // Anonymisierte Konten sind fuer die Aussenwelt geloescht.
  if (!acc || acc.anonymizedAt) throw notFound('playerUnknown');

  const ranking = await db
    .select({
      gameId: s.accountGameStat.gameId,
      trophies: s.accountGameStat.trophies,
      highestCheckpoint: s.accountGameStat.highestCheckpoint,
      parties: s.accountGameStat.parties,
      wins: s.accountGameStat.wins,
    })
    .from(s.accountGameStat)
    .where(eq(s.accountGameStat.accountId, accountId))
    .orderBy(desc(s.accountGameStat.trophies));

  const counters = await db
    .select({ key: s.statCounter.key, value: sql<number>`sum(${s.statCounter.value})::int` })
    .from(s.statCounter)
    .where(eq(s.statCounter.accountId, accountId))
    .groupBy(s.statCounter.key);
  const counterOf = new Map(counters.map((row) => [row.key, row.value]));

  return {
    id: acc.id,
    displayName: acc.displayName,
    memberSince: acc.createdAt.toISOString().slice(0, 7),
    relationship: await relationshipBetween(db, viewerId, accountId),
    ranking,
    totals: {
      parties: counterOf.get('parties') ?? 0,
      wins: counterOf.get('wins') ?? 0,
      trophies: ranking.reduce((sum, row) => sum + row.trophies, 0),
    },
  };
}

/** Namenssuche fuer das Anfreunden. Nur Angemeldete, nur echte Konten. */
export async function searchPlayers(
  db: Db,
  viewerId: string,
  query: string,
): Promise<{ id: string; displayName: string }[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // % und _ sind in LIKE Platzhalter und waeren sonst ein Suchtrick.
  const safe = trimmed.replace(/[\\%_]/g, (ch) => `\\${ch}`);

  return db
    .select({ id: s.account.id, displayName: s.account.displayName })
    .from(s.account)
    .where(
      and(
        ilike(s.account.displayName, `%${safe}%`),
        sql`${s.account.anonymizedAt} is null`,
        ne(s.account.id, viewerId),
      ),
    )
    .orderBy(s.account.displayName)
    .limit(10);
}

// ---------------------------------------------------------------------------
// Freundschaften
// ---------------------------------------------------------------------------

async function pairRow(db: Db, a: string, b: string) {
  const [row] = await db
    .select()
    .from(s.friendship)
    .where(
      or(
        and(eq(s.friendship.accountA, a), eq(s.friendship.accountB, b)),
        and(eq(s.friendship.accountA, b), eq(s.friendship.accountB, a)),
      ),
    );
  return row;
}

export async function relationshipBetween(
  db: Db,
  viewerId: string,
  otherId: string,
): Promise<Relationship> {
  if (viewerId === otherId) return 'self';
  const row = await pairRow(db, viewerId, otherId);
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  return row.accountA === viewerId ? 'outgoing' : 'incoming';
}

/**
 * Freundschaft anfragen.
 *
 * Fragen beide unabhaengig voneinander an, ist das eine Annahme: Wer selbst
 * eine Anfrage stellt, waehrend die des anderen offen ist, will offenkundig
 * dasselbe. Ihn stattdessen auf den Annehmen-Knopf umzuleiten waere Pedanterie.
 */
export async function requestFriendship(
  db: Db,
  fromId: string,
  toId: string,
): Promise<{ status: 'pending' | 'accepted' }> {
  if (fromId === toId) throw badRequest('friendSelf');

  const [target] = await db
    .select({ id: s.account.id, anonymizedAt: s.account.anonymizedAt })
    .from(s.account)
    .where(eq(s.account.id, toId));
  if (!target || target.anonymizedAt) throw notFound('playerUnknown');

  const existing = await pairRow(db, fromId, toId);
  if (!existing) {
    await db.insert(s.friendship).values({ accountA: fromId, accountB: toId });
    return { status: 'pending' };
  }
  if (existing.status === 'accepted') throw conflict('alreadyFriends');
  if (existing.accountA === fromId) return { status: 'pending' }; // schon gefragt, unschaedlich
  await db
    .update(s.friendship)
    .set({ status: 'accepted' })
    .where(and(eq(s.friendship.accountA, toId), eq(s.friendship.accountB, fromId)));
  return { status: 'accepted' };
}

export async function acceptFriendship(db: Db, meId: string, fromId: string): Promise<void> {
  const updated = await db
    .update(s.friendship)
    .set({ status: 'accepted' })
    .where(
      and(
        eq(s.friendship.accountA, fromId),
        eq(s.friendship.accountB, meId),
        eq(s.friendship.status, 'pending'),
      ),
    )
    .returning();
  if (updated.length === 0) throw notFound('friendRequestUnknown');
}

/** Entfernt Freundschaft, lehnt eine eingehende ab oder zieht die eigene zurueck. */
export async function removeFriendship(db: Db, meId: string, otherId: string): Promise<void> {
  await db
    .delete(s.friendship)
    .where(
      or(
        and(eq(s.friendship.accountA, meId), eq(s.friendship.accountB, otherId)),
        and(eq(s.friendship.accountA, otherId), eq(s.friendship.accountB, meId)),
      ),
    );
}

export interface FriendLists {
  readonly friends: readonly { id: string; displayName: string }[];
  readonly incoming: readonly { id: string; displayName: string }[];
  readonly outgoing: readonly { id: string; displayName: string }[];
}

export async function listFriendships(db: Db, meId: string): Promise<FriendLists> {
  const rows = await db
    .select({
      accountA: s.friendship.accountA,
      accountB: s.friendship.accountB,
      status: s.friendship.status,
    })
    .from(s.friendship)
    .where(or(eq(s.friendship.accountA, meId), eq(s.friendship.accountB, meId)));

  const otherIds = rows.map((row) => (row.accountA === meId ? row.accountB : row.accountA));
  if (otherIds.length === 0) return { friends: [], incoming: [], outgoing: [] };

  const names = await db
    .select({ id: s.account.id, displayName: s.account.displayName, anonymizedAt: s.account.anonymizedAt })
    .from(s.account)
    .where(sql`${s.account.id} in ${otherIds}`);
  const nameOf = new Map(
    names.filter((row) => !row.anonymizedAt).map((row) => [row.id, row.displayName]),
  );

  const friends: { id: string; displayName: string }[] = [];
  const incoming: { id: string; displayName: string }[] = [];
  const outgoing: { id: string; displayName: string }[] = [];

  for (const row of rows) {
    const otherId = row.accountA === meId ? row.accountB : row.accountA;
    const displayName = nameOf.get(otherId);
    if (!displayName) continue; // anonymisiert: still verschwinden lassen
    const entry = { id: otherId, displayName };
    if (row.status === 'accepted') friends.push(entry);
    else if (row.accountA === meId) outgoing.push(entry);
    else incoming.push(entry);
  }

  const byName = (a: { displayName: string }, b: { displayName: string }) =>
    a.displayName.localeCompare(b.displayName, 'de');
  friends.sort(byName);
  incoming.sort(byName);
  outgoing.sort(byName);

  return { friends, incoming, outgoing };
}
