/**
 * Regelsaetze, Tische und Lobby.
 *
 * Diese Schicht arbeitet ausschliesslich gegen GameModule. Sie weiss nicht,
 * welches Kartenspiel gespielt wird, und darf es nicht wissen: welche
 * Regeloptionen es gibt, ob eine Rundenzahl aufgeht und welche Filter die Lobby
 * anbietet, beantwortet immer das Modul.
 */

import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { GameId } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { RuleSetInvalidError, badRequest, conflict, forbidden, notFound } from '../errors.js';
import { requireModule } from '../games/registry.js';

/**
 * Oeffentliche und private Tische muessen in einer Sitzung durchlaufen, daher
 * die niedrigere Grenze. Vereinstische duerfen pausieren.
 */
export const MAX_ROUNDS: Record<s.TableVisibility, number> = {
  public: 20,
  on_request: 20,
  club_only: 100,
};

export interface CreateTableInput {
  readonly accountId: string;
  readonly gameId: GameId;
  readonly name?: string;
  /** Vollstaendiger Regelsatz. Wird immer als eigene Version festgeschrieben. */
  readonly config: unknown;
  readonly seats: number;
  readonly rounds: number;
  readonly visibility?: s.TableVisibility;
  readonly clubId?: string | null;
  /**
   * Freie Plaetze mit Bots auffuellen, statt auf Menschen zu warten.
   *
   * Nicht Teil des Zielbilds, sondern Beta-Werkzeug: So laesst sich zu zweit
   * eine vollstaendige Partie spielen. Solche Tische zaehlen nicht fuer die
   * Rangliste.
   */
  readonly fillWithBots?: boolean;
}

// ---------------------------------------------------------------------------
// Regelsaetze
// ---------------------------------------------------------------------------

/**
 * Legt eine neue, unveraenderliche Version an. Bestehende Versionen bleiben
 * stehen, damit laufende und abgeschlossene Partien ihre Regeln behalten.
 */
export async function saveRuleSet(
  db: Db,
  input: {
    accountId: string;
    gameId: GameId;
    name: string;
    config: unknown;
    seats: number;
    rounds: number;
    /** Weglassen legt eine neue Familie an. */
    ruleSetId?: string;
    clubId?: string | null;
  },
): Promise<{ id: string; version: number }> {
  const module = requireModule(input.gameId);

  const problems = module.validateConfig(input.config, input.seats, input.rounds);
  const errors = problems.filter((p) => p.severity === 'error');
  if (errors.length > 0) throw new RuleSetInvalidError(errors);

  let version = 1;
  if (input.ruleSetId) {
    const [latest] = await db
      .select({ version: s.ruleSet.version })
      .from(s.ruleSet)
      .where(eq(s.ruleSet.id, input.ruleSetId))
      .orderBy(desc(s.ruleSet.version))
      .limit(1);
    if (!latest) throw notFound('ruleSetUnknown');
    version = latest.version + 1;
  }

  const [row] = await db
    .insert(s.ruleSet)
    .values({
      ...(input.ruleSetId ? { id: input.ruleSetId } : {}),
      version,
      gameId: input.gameId,
      ownerAccountId: input.accountId,
      clubId: input.clubId ?? null,
      name: input.name,
      config: input.config as object,
    })
    .returning({ id: s.ruleSet.id, version: s.ruleSet.version });

  return row!;
}

export async function listRuleSets(db: Db, accountId: string, gameId: GameId) {
  // Nur die jeweils hoechste Version je Familie interessiert in der Auswahl.
  return db
    .select()
    .from(s.ruleSet)
    .where(and(eq(s.ruleSet.ownerAccountId, accountId), eq(s.ruleSet.gameId, gameId)))
    .orderBy(desc(s.ruleSet.createdAt));
}

// ---------------------------------------------------------------------------
// Tische
// ---------------------------------------------------------------------------

export async function createTable(db: Db, input: CreateTableInput) {
  const module = requireModule(input.gameId);
  const visibility = input.visibility ?? 'public';

  if (!module.meta.seatCounts.includes(input.seats)) {
    throw badRequest('seatCountUnsupported');
  }

  // Die Geberrotation ist spielabhaengig, also fragt der Server das Modul,
  // statt eine Zahl fest zu verdrahten.
  const rotation = module.meta.rotationSize(input.seats);
  if (input.rounds % rotation !== 0) throw badRequest('roundsNotMultipleOfRotation');
  if (input.rounds < rotation) throw badRequest('roundsTooFew');
  if (input.rounds > MAX_ROUNDS[visibility]) throw badRequest('roundsTooMany');

  const ruleSet = await saveRuleSet(db, {
    accountId: input.accountId,
    gameId: input.gameId,
    name: input.name ?? 'Tischregeln',
    config: input.config,
    seats: input.seats,
    rounds: input.rounds,
    clubId: input.clubId ?? null,
  });

  const [table] = await db
    .insert(s.gameTable)
    .values({
      gameId: input.gameId,
      ruleSetId: ruleSet.id,
      ruleSetVersion: ruleSet.version,
      visibility,
      clubId: input.clubId ?? null,
      seats: input.seats,
      maxRounds: input.rounds,
      filters: { fillWithBots: input.fillWithBots === true },
    })
    .returning();

  await db.insert(s.tableSeat).values(
    Array.from({ length: input.seats }, (_, seatIndex) => ({
      tableId: table!.id,
      seatIndex,
      accountId: seatIndex === 0 ? input.accountId : null,
    })),
  );

  return table!;
}

export interface LobbyFilter {
  readonly gameId: GameId;
  readonly seats?: number;
  readonly rounds?: number;
  readonly clubId?: string | null;
}

export async function listTables(db: Db, filter: LobbyFilter) {
  const conditions = [
    eq(s.gameTable.gameId, filter.gameId),
    eq(s.gameTable.status, 'waiting'),
  ];
  if (filter.seats) conditions.push(eq(s.gameTable.seats, filter.seats));
  if (filter.rounds) conditions.push(eq(s.gameTable.maxRounds, filter.rounds));
  if (filter.clubId) conditions.push(eq(s.gameTable.clubId, filter.clubId));
  else conditions.push(or(isNull(s.gameTable.clubId), eq(s.gameTable.visibility, 'public'))!);

  const tables = await db
    .select()
    .from(s.gameTable)
    .where(and(...conditions))
    .orderBy(desc(s.gameTable.createdAt));

  if (tables.length === 0) return [];

  const seats = await db
    .select()
    .from(s.tableSeat)
    .where(
      inArray(
        s.tableSeat.tableId,
        tables.map((t) => t.id),
      ),
    );

  return tables.map((table) => ({
    ...table,
    occupied: seats.filter((seat) => seat.tableId === table.id && seat.accountId).length,
  }));
}

export async function tableWithSeats(db: Db, tableId: string) {
  const [table] = await db.select().from(s.gameTable).where(eq(s.gameTable.id, tableId));
  if (!table) throw notFound('tableUnknown');

  const seats = await db
    .select()
    .from(s.tableSeat)
    .where(eq(s.tableSeat.tableId, tableId))
    .orderBy(s.tableSeat.seatIndex);

  return { table, seats };
}

/**
 * Setzt den Beitretenden auf den ersten freien Platz.
 *
 * Die Bedingung `account_id is null` steht in der UPDATE-Anweisung selbst: Zwei
 * gleichzeitige Beitritte duerfen nicht beide denselben Platz bekommen, und ein
 * vorheriges SELECT wuerde genau das zulassen.
 */
export async function joinTable(db: Db, tableId: string, accountId: string) {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');
  if (seats.some((seat) => seat.accountId === accountId)) return table;

  if (table.visibility === 'public') {
    // Blockierte Spieler werden nur an oeffentlichen Tischen ausgeschlossen.
    const occupants = seats.map((seat) => seat.accountId).filter(Boolean) as string[];
    if (occupants.length > 0) {
      const blocks = await db
        .select()
        .from(s.block)
        .where(
          or(
            and(eq(s.block.accountId, accountId), inArray(s.block.blockedAccountId, occupants)),
            and(eq(s.block.blockedAccountId, accountId), inArray(s.block.accountId, occupants)),
          ),
        );
      if (blocks.length > 0) throw forbidden('blockedAtTable');
    }
  }

  const free = seats.find((seat) => !seat.accountId && !seat.isBot);
  if (!free) throw conflict('tableFull');

  const claimed = await db
    .update(s.tableSeat)
    .set({ accountId, joinedAt: new Date() })
    .where(
      and(
        eq(s.tableSeat.tableId, tableId),
        eq(s.tableSeat.seatIndex, free.seatIndex),
        isNull(s.tableSeat.accountId),
      ),
    )
    .returning();

  if (claimed.length === 0) throw conflict('seatTaken');

  await touch(db, tableId);
  return table;
}

/** Vor dem Start ist Verlassen straffrei und raeumt nur den Platz. */
export async function leaveLobby(db: Db, tableId: string, accountId: string) {
  const { table } = await tableWithSeats(db, tableId);
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');

  await db
    .update(s.tableSeat)
    .set({ accountId: null })
    .where(and(eq(s.tableSeat.tableId, tableId), eq(s.tableSeat.accountId, accountId)));

  const { seats } = await tableWithSeats(db, tableId);
  if (seats.every((seat) => !seat.accountId)) {
    await db
      .update(s.gameTable)
      .set({ status: 'abandoned' })
      .where(eq(s.gameTable.id, tableId));
  }
}

export async function touch(db: Db, tableId: string): Promise<void> {
  await db
    .update(s.gameTable)
    .set({ lastActivityAt: new Date() })
    .where(eq(s.gameTable.id, tableId));
}

/**
 * Setzt einen freien Platz auf Bot oder gibt ihn wieder frei.
 *
 * Bots werden nicht mehr vorab beim Tischbau gewaehlt, sondern am Tisch auf
 * die freien Plaetze gesetzt. So kann man zu zweit oder zu dritt beitreten und
 * den Rest mit Bots auffuellen, ohne dass der Tisch vorher fuer Menschen
 * gesperrt ist. Nur wer selbst am Tisch sitzt, darf das.
 */
export async function setSeatBot(
  db: Db,
  tableId: string,
  seatIndex: number,
  wantBot: boolean,
  byAccountId: string,
): Promise<void> {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');
  if (!seats.some((seat) => seat.accountId === byAccountId)) throw forbidden('notSeated');

  const target = seats.find((seat) => seat.seatIndex === seatIndex);
  if (!target) throw notFound('tableUnknown');
  // Ein von einem Menschen besetzter Platz wird nicht angetastet.
  if (target.accountId) throw conflict('seatTaken');

  await db
    .update(s.tableSeat)
    .set({ isBot: wantBot })
    .where(and(eq(s.tableSeat.tableId, tableId), eq(s.tableSeat.seatIndex, seatIndex)));
  await touch(db, tableId);
}

/** Alle Plaetze besetzt, entweder durch Menschen oder durch gesetzte Bots. */
export function isReadyToStart(
  table: { seats: number; filters: unknown },
  seats: { accountId: string | null; isBot: boolean }[],
): boolean {
  const humans = seats.filter((seat) => seat.accountId).length;
  if (humans === 0) return false;
  // Kein Platz mehr frei: alles ist entweder Mensch oder gesetzter Bot.
  if (seats.every((seat) => seat.accountId || seat.isBot)) return true;
  // Alt-Weg fuer Tische, die noch mit dem Vorab-Haken gebaut wurden.
  const fill = (table.filters as { fillWithBots?: boolean } | null)?.fillWithBots;
  return fill === true;
}

/** Zaehlt der Tisch fuer die Rangliste? Bots und Training schliessen das aus. */
export async function countsForRanking(db: Db, tableId: string): Promise<boolean> {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (seats.some((seat) => seat.isBot || !seat.accountId)) return false;

  const [rs] = await db
    .select({ config: s.ruleSet.config })
    .from(s.ruleSet)
    .where(
      and(eq(s.ruleSet.id, table.ruleSetId), eq(s.ruleSet.version, table.ruleSetVersion)),
    );

  // `training` ist eine Regelsatz-Option des Spiels. Der Server liest hier
  // ausnahmsweise ein Feld, weil die Rangliste eine Plattformfrage ist; fehlt
  // das Feld, zaehlt der Tisch.
  return (rs?.config as { training?: boolean } | null)?.training !== true;
}

/** Tische ohne Aktivitaet verfallen nach 24 Stunden. */
export async function expireStaleTables(db: Db, olderThanHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 3600_000);
  const rows = await db
    .update(s.gameTable)
    .set({ status: 'abandoned' })
    .where(
      and(
        inArray(s.gameTable.status, ['waiting', 'running']),
        sql`${s.gameTable.lastActivityAt} < ${cutoff}`,
      ),
    )
    .returning({ id: s.gameTable.id });
  return rows.length;
}
