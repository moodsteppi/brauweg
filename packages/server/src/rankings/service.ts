/**
 * Oeffentliche Ranglisten aus account_game_stat.
 *
 * Die Wertung selbst entsteht in trophies.ts beim Partie-Ende; hier wird nur
 * gelesen. Anonymisierte Konten erscheinen nicht — sie haben keinen Namen mehr.
 */

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { GameId } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';

export interface RankingEntry {
  readonly rank: number;
  readonly accountId: string;
  readonly displayName: string;
  readonly trophies: number;
  readonly parties: number;
  readonly wins: number;
  readonly highestCheckpoint: number;
}

export async function rankingForGame(
  db: Db,
  gameId: GameId,
  limit = 50,
  offset = 0,
): Promise<RankingEntry[]> {
  const rows = await db
    .select({
      accountId: s.accountGameStat.accountId,
      displayName: s.account.displayName,
      trophies: s.accountGameStat.trophies,
      parties: s.accountGameStat.parties,
      wins: s.accountGameStat.wins,
      highestCheckpoint: s.accountGameStat.highestCheckpoint,
    })
    .from(s.accountGameStat)
    .innerJoin(s.account, eq(s.account.id, s.accountGameStat.accountId))
    .where(and(eq(s.accountGameStat.gameId, gameId), isNull(s.account.anonymizedAt)))
    .orderBy(desc(s.accountGameStat.trophies), s.account.displayName)
    .limit(Math.min(100, Math.max(1, limit)))
    .offset(Math.max(0, offset));

  return rows.map((row, index) => ({
    rank: offset + index + 1,
    ...row,
  }));
}

/** Summe der Trophäen über alle Spiele. */
export async function overallRanking(
  db: Db,
  limit = 50,
  offset = 0,
): Promise<RankingEntry[]> {
  const rows = await db
    .select({
      accountId: s.account.id,
      displayName: s.account.displayName,
      trophies: sql<number>`coalesce(sum(${s.accountGameStat.trophies}), 0)::int`,
      parties: sql<number>`coalesce(sum(${s.accountGameStat.parties}), 0)::int`,
      wins: sql<number>`coalesce(sum(${s.accountGameStat.wins}), 0)::int`,
      highestCheckpoint: sql<number>`coalesce(max(${s.accountGameStat.highestCheckpoint}), 0)::int`,
    })
    .from(s.account)
    .leftJoin(s.accountGameStat, eq(s.accountGameStat.accountId, s.account.id))
    .where(isNull(s.account.anonymizedAt))
    .groupBy(s.account.id, s.account.displayName)
    .having(sql`coalesce(sum(${s.accountGameStat.trophies}), 0) > 0`)
    .orderBy(sql`coalesce(sum(${s.accountGameStat.trophies}), 0) desc`, s.account.displayName)
    .limit(Math.min(100, Math.max(1, limit)))
    .offset(Math.max(0, offset));

  return rows.map((row, index) => ({
    rank: offset + index + 1,
    accountId: row.accountId,
    displayName: row.displayName,
    trophies: row.trophies,
    parties: row.parties,
    wins: row.wins,
    highestCheckpoint: row.highestCheckpoint,
  }));
}
