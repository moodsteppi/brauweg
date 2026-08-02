/**
 * Datenmodell der Plattform (Plan 6.2).
 *
 * Zwei Grundsaetze, die sich durch das ganze Schema ziehen:
 *
 *   1. `game_id` gehoert an Tisch, Regelsatz, Partie und Statistik. Es
 *      nachzuruesten waere eine Migration ueber alle Kernfelder. Es ist
 *      bewusst `text` und kein Enum: ein neues Kartenspiel soll ein neues
 *      Paket sein und keine Schemaaenderung. Die Typsicherheit liefert
 *      `GameId` aus @brauweg/game-api.
 *
 *   2. Alles Spielabhaengige liegt in `jsonb`. Der Server kennt den Inhalt von
 *      `party_snapshot.state`, `round_summary.summary` und `rule_set.config`
 *      nicht und darf ihn nicht kennen.
 *
 * Kontoloeschung erfolgt als Anonymisierung (`account.anonymized_at`), nicht
 * als DELETE. Wuerde man Zeilen entfernen, zerfielen die Partiehistorien aller
 * Mitspieler.
 */

import type { GameId } from '@brauweg/game-api';
import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/** Spielkennung. Siehe Grundsatz 1 oben: bewusst kein Enum. */
const gameId = () => text().$type<GameId>().notNull();

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const tableVisibility = pgEnum('table_visibility', [
  'public',
  'on_request',
  'club_only',
]);

export const tableStatus = pgEnum('table_status', [
  'waiting',
  'running',
  'finished',
  'abandoned',
]);

export const partyStatus = pgEnum('party_status', [
  'running',
  'finished',
  'abandoned',
]);

export const clubJoinMode = pgEnum('club_join_mode', ['open', 'on_request']);

export const clubRole = pgEnum('club_role', ['admin', 'member', 'guest']);

export const friendshipStatus = pgEnum('friendship_status', [
  'pending',
  'accepted',
]);

export const authTokenPurpose = pgEnum('auth_token_purpose', [
  'email_verify',
  'password_reset',
]);

export const purchaseProvider = pgEnum('purchase_provider', [
  'stripe',
  'apple',
]);

/** Warum eine Trophaeenbuchung entstanden ist. */
export const trophyReason = pgEnum('trophy_reason', [
  'party_result',
  'leave_penalty',
  'checkpoint_protection',
  'manual_correction',
]);

// ---------------------------------------------------------------------------
// Konten
// ---------------------------------------------------------------------------

export const account = pgTable(
  'account',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Nach Anonymisierung null. Deshalb nullable trotz Anmeldepflicht. */
    email: text(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    passwordHash: text(),
    /** Eindeutig und aenderbar, Aenderung ist immer kostenpflichtig. */
    displayName: text().notNull(),
    createdAt: createdAt(),
    premiumUntil: timestamp({ withTimezone: true }),
    coins: integer().notNull().default(0),
    /**
     * Gewaehltes Kartenblatt. Reine Darstellung, deshalb bewusst nur eine
     * Kennung: Wie ein Deck aussieht, weiss allein der Client. Der Server
     * kennt die zulaessigen Kennungen (src/decks.ts), damit nichts Fremdes in
     * der Spalte landet, und sonst nichts.
     */
    cardDeck: text().notNull().default('text'),
    /**
     * Profilbild als data-URL (kleines, im Browser verkleinertes Quadrat).
     * Bewusst in der Zeile und nicht als Datei-Ablage: fuer die Beta ist das
     * einfach und ohne zusaetzlichen Dienst. Ausgeliefert wird es ueber
     * /api/avatars/:id, ueber die Leitung geht nur diese URL, nie die Bytes.
     */
    avatar: text(),
    anonymizedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('account_email_key').on(t.email),
    uniqueIndex('account_display_name_key').on(t.displayName),
  ],
);

/**
 * Ergaenzung zu Plan 6.2: Der Bestaetigungslink vor der ersten Anmeldung und
 * das Passwort-Zuruecksetzen (6.7) brauchen kurzlebige Token. Gespeichert wird
 * nur der Hash, damit ein Datenbankleck keine gueltigen Links liefert.
 */
export const authToken = pgTable(
  'auth_token',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    purpose: authTokenPurpose().notNull(),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('auth_token_hash_key').on(t.tokenHash),
    index('auth_token_account_idx').on(t.accountId),
  ],
);

/**
 * Anmeldesitzungen. Ergaenzung zu Plan 6.2.
 *
 * Bewusst serverseitig statt als JWT: Eine Sitzung muss sofort widerrufbar
 * sein. Kontoloeschung waehrend laufender Partie und Sperren aus der Moderation
 * verlangen genau das, ein ausgestelltes Token kann man nicht zurueckholen.
 *
 * Im Cookie steht ein Zufallswert, hier liegt nur dessen Hash.
 */
export const session = pgTable(
  'session',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('session_token_key').on(t.tokenHash),
    index('session_account_idx').on(t.accountId),
  ],
);

/** Rangliste je Spiel. Die Gesamtliste ist die Summe ueber alle Zeilen. */
export const accountGameStat = pgTable(
  'account_game_stat',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    /** Startwert 0, Untergrenze 0. */
    trophies: integer().notNull().default(0),
    /** Hoechster erreichter Checkpoint, schuetzt gegen Absturz. */
    highestCheckpoint: integer().notNull().default(0),
    parties: integer().notNull().default(0),
    wins: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.gameId] }),
    index('account_game_stat_ranking_idx').on(t.gameId, t.trophies),
  ],
);

/** Dauerhaft und aggregiert, damit Premium-Statistiken lange zurueckreichen. */
export const statCounter = pgTable(
  'stat_counter',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    key: text().notNull(),
    value: bigint({ mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.gameId, t.key] })],
);

export const inviteCode = pgTable('invite_code', {
  code: text().primaryKey(),
  maxUses: integer().notNull(),
  uses: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
});

/** Abstimmung, welches Vorschau-Spiel als naechstes kommt (Plan 4). */
export const gameVote = pgTable(
  'game_vote',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.gameId] })],
);

// ---------------------------------------------------------------------------
// Vereine
// ---------------------------------------------------------------------------

export const club = pgTable(
  'club',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    adminAccountId: uuid()
      .notNull()
      .references(() => account.id),
    /**
     * Zeigt auf eine Regelsatz-Familie, nicht auf eine feste Version: ein
     * Verein soll seine Vorgabe aendern koennen, ohne dass laufende Tische
     * ihre Regeln wechseln. Deshalb bewusst ohne Fremdschluessel, denn
     * rule_set ist ueber (id, version) verschluesselt.
     */
    defaultRuleSetId: uuid(),
    joinMode: clubJoinMode().notNull().default('on_request'),
    minTrophies: integer().notNull().default(0),
    maxMembers: integer().notNull().default(50),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('club_name_key').on(t.name)],
);

export const clubMember = pgTable(
  'club_member',
  {
    clubId: uuid()
      .notNull()
      .references(() => club.id, { onDelete: 'cascade' }),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    role: clubRole().notNull().default('member'),
    joinedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.accountId] })],
);

// ---------------------------------------------------------------------------
// Regelsaetze
// ---------------------------------------------------------------------------

/**
 * Versioniert ueber (id, version). Aeltere Versionen bleiben unveraendert
 * bestehen, damit eine spaetere Aenderung abgeschlossene Partien nicht
 * umdeutet. `config` ist spielabhaengig und wird vom Server nie ausgewertet,
 * sondern nur an GameModule.validateConfig durchgereicht.
 */
export const ruleSet = pgTable(
  'rule_set',
  {
    id: uuid().notNull().defaultRandom(),
    version: integer().notNull().default(1),
    gameId: gameId(),
    ownerAccountId: uuid().references(() => account.id, {
      onDelete: 'set null',
    }),
    clubId: uuid().references(() => club.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    config: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.version] }),
    index('rule_set_owner_idx').on(t.ownerAccountId, t.gameId),
    index('rule_set_club_idx').on(t.clubId, t.gameId),
  ],
);

// ---------------------------------------------------------------------------
// Tische und Partien
// ---------------------------------------------------------------------------

export const gameTable = pgTable(
  'table_',
  {
    id: uuid().primaryKey().defaultRandom(),
    gameId: gameId(),
    ruleSetId: uuid().notNull(),
    /** Feste Version, damit spaetere Regelaenderungen den Tisch nicht treffen. */
    ruleSetVersion: integer().notNull(),
    visibility: tableVisibility().notNull().default('public'),
    clubId: uuid().references(() => club.id, { onDelete: 'cascade' }),
    status: tableStatus().notNull().default('waiting'),
    seats: integer().notNull(),
    /** Oeffentlich und privat hoechstens 20, Vereinstisch hoechstens 100. */
    maxRounds: integer().notNull(),
    createdAt: createdAt(),
    /** Ein Tisch ohne Aktivitaet verfaellt nach 24 Stunden. */
    lastActivityAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /**
     * Lobby-Filter. Welche Filter es gibt, liefert das Spielmodul, nicht eine
     * feste Verdrahtung im Server. Deshalb jsonb.
     */
    filters: jsonb().notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    foreignKey({
      columns: [t.ruleSetId, t.ruleSetVersion],
      foreignColumns: [ruleSet.id, ruleSet.version],
      name: 'table_rule_set_fk',
    }),
    index('table_lobby_idx').on(t.gameId, t.status, t.visibility),
    index('table_activity_idx').on(t.lastActivityAt),
  ],
);

export const tableSeat = pgTable(
  'table_seat',
  {
    tableId: uuid()
      .notNull()
      .references(() => gameTable.id, { onDelete: 'cascade' }),
    seatIndex: integer().notNull(),
    /** Null bei freiem Platz. Bei Bot-Uebernahme bleibt das Konto stehen. */
    accountId: uuid().references(() => account.id, { onDelete: 'set null' }),
    /** Bot-Uebernahme ist fuer alle sichtbar. */
    isBot: boolean().notNull().default(false),
    joinedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.tableId, t.seatIndex] }),
    index('table_seat_account_idx').on(t.accountId),
  ],
);

export const party = pgTable(
  'party',
  {
    id: uuid().primaryKey().defaultRandom(),
    tableId: uuid()
      .notNull()
      .references(() => gameTable.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    /** Bestimmt jedes Geben. Gleicher Seed ergibt dieselbe Partie. */
    seed: bigint({ mode: 'number' }).notNull(),
    rounds: integer().notNull(),
    status: partyStatus().notNull().default('running'),
    startedAt: createdAt(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('party_table_idx').on(t.tableId)],
);

/**
 * Der Server haelt die laufende Partie massgeblich im Arbeitsspeicher und
 * schreibt nach jeder Aktion hierher. Railway startet den Container bei jedem
 * Deploy neu; reiner Arbeitsspeicher wuerde alle laufenden Tische verwerfen.
 *
 * Eine Zeile je Partie, `revision` zaehlt hoch. Der Client verwirft anhand
 * dieser Nummer veraltete Nachrichten.
 *
 * Aufbewahrung: nur die letzten 20 Partien je Account.
 */
export const partySnapshot = pgTable('party_snapshot', {
  partyId: uuid()
    .primaryKey()
    .references(() => party.id, { onDelete: 'cascade' }),
  revision: integer().notNull().default(0),
  /** Ergebnis von GameModule.serialize. Inhalt ist fuer den Server opak. */
  state: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Speichert bewusst nur jsonb: Die Struktur einer Runde ist spielabhaengig,
 * der Server darf sie nicht kennen.
 */
export const roundSummary = pgTable(
  'round_summary',
  {
    partyId: uuid()
      .notNull()
      .references(() => party.id, { onDelete: 'cascade' }),
    roundIndex: integer().notNull(),
    summary: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.partyId, t.roundIndex] })],
);

// ---------------------------------------------------------------------------
// Trophaeen
// ---------------------------------------------------------------------------

/**
 * Dauerhaft. Trophaeen entstehen aus der Platzierung ueber die gesamte Partie,
 * nie aus Spielpunkten, und sind deshalb regelunabhaengig.
 */
export const trophyLedger = pgTable(
  'trophy_ledger',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    gameId: gameId(),
    partyId: uuid().references(() => party.id, { onDelete: 'set null' }),
    delta: integer().notNull(),
    reason: trophyReason().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('trophy_ledger_account_idx').on(t.accountId, t.gameId)],
);

// ---------------------------------------------------------------------------
// Soziales und Moderation
// ---------------------------------------------------------------------------

export const friendship = pgTable(
  'friendship',
  {
    /** Der Anfragende. Richtung bleibt erhalten, solange status = pending. */
    accountA: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    accountB: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    status: friendshipStatus().notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.accountA, t.accountB] }),
    index('friendship_b_idx').on(t.accountB),
  ],
);

/** Blockierte Spieler werden nur an oeffentlichen Tischen ausgeschlossen. */
export const block = pgTable(
  'block',
  {
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    blockedAccountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.blockedAccountId] })],
);

/**
 * Schlank und laenger aufbewahrt, ausschliesslich fuer Absprache-Erkennung.
 * Konvention: accountA < accountB als Text, damit ein Paar genau eine
 * Schreibweise hat und die Haeufigkeitsabfrage ohne OR auskommt.
 */
export const pairingLog = pgTable(
  'pairing_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountA: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    accountB: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    partyId: uuid().references(() => party.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('pairing_log_pair_idx').on(t.accountA, t.accountB, t.createdAt)],
);

export const report = pgTable(
  'report',
  {
    id: uuid().primaryKey().defaultRandom(),
    reporterId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    targetId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    reason: text().notNull(),
    freeText: text(),
    createdAt: createdAt(),
  },
  (t) => [index('report_target_idx').on(t.targetId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Kaeufe
// ---------------------------------------------------------------------------

/**
 * Der Anspruch wird serverseitig gefuehrt, damit ein im Web gekauftes Abo auch
 * auf dem iPhone gilt. `amountCents` ist ganzzahlig, nie Gleitkomma.
 */
export const purchase = pgTable(
  'purchase',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    sku: text().notNull(),
    provider: purchaseProvider().notNull(),
    amountCents: integer().notNull(),
    currency: text().notNull().default('EUR'),
    createdAt: createdAt(),
  },
  (t) => [index('purchase_account_idx').on(t.accountId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Abgeleitete Typen
// ---------------------------------------------------------------------------

export type TableVisibility = (typeof tableVisibility.enumValues)[number];
export type TableStatus = (typeof tableStatus.enumValues)[number];
export type PartyStatus = (typeof partyStatus.enumValues)[number];
export type TrophyReason = (typeof trophyReason.enumValues)[number];

export type Account = typeof account.$inferSelect;
export type GameTable = typeof gameTable.$inferSelect;
export type TableSeat = typeof tableSeat.$inferSelect;
export type Party = typeof party.$inferSelect;

// ---------------------------------------------------------------------------
// Beziehungen
// ---------------------------------------------------------------------------

export const accountRelations = relations(account, ({ many }) => ({
  gameStats: many(accountGameStat),
  seats: many(tableSeat),
  trophyEntries: many(trophyLedger),
  clubMemberships: many(clubMember),
}));

export const gameTableRelations = relations(gameTable, ({ many, one }) => ({
  seats: many(tableSeat),
  parties: many(party),
  club: one(club, { fields: [gameTable.clubId], references: [club.id] }),
}));

export const partyRelations = relations(party, ({ one, many }) => ({
  table: one(gameTable, {
    fields: [party.tableId],
    references: [gameTable.id],
  }),
  snapshot: one(partySnapshot, {
    fields: [party.id],
    references: [partySnapshot.partyId],
  }),
  rounds: many(roundSummary),
}));

export const clubRelations = relations(club, ({ many, one }) => ({
  members: many(clubMember),
  admin: one(account, {
    fields: [club.adminAccountId],
    references: [account.id],
  }),
}));
