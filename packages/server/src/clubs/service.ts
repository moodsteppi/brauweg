/**
 * Clans (Plan 9.3).
 *
 * Spieluebergreifend, nicht nur Doppelkopf: Ein Clan gehoert zum Konto, nicht
 * zu einem Spiel. Darueber laufen Clantische (`club_only`), der clan-eigene
 * Regelsatz als Vorgabe und die Pause-Funktion.
 *
 * Zwei Entscheidungen ziehen sich durch die Datei:
 *
 *   1. **Genau ein Clan je Konto.** Das Schema erlaubt mehrere Zeilen in
 *      club_member, die Oberflaeche und alle Pruefungen hier gehen aber von
 *      einem aus. Mehrere Clans hiessen: ein Umschalter im Tab und bei jedem
 *      Clantisch die Rueckfrage, fuer welchen Clan. Das ist Aufwand ohne
 *      erkennbaren Gewinn — wer in zwei Gruppen spielt, macht zwei Tische.
 *
 *   2. **Der Admin verschwindet nie ersatzlos.** Tritt er aus oder loescht er
 *      sein Konto, rueckt das aelteste Mitglied nach; ist er der letzte, wird
 *      der Clan geloescht. Ein Clan ohne Admin waere unverwaltbar: niemand
 *      koennte mehr aufnehmen, rauswerfen oder die Regeln aendern.
 *
 * Schema-Tabellen heissen weiter club_* — Umbenennen waere reine Kosmetik.
 */

import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, sql } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { entitlementsFor } from '../entitlements.js';
import { darfBenutzen } from '../tischware.js';

export const BETA_CLUB_NAME = 'Brauweg';

/** Auswaehlbare Wappen — siehe docs/ASSETS-CLAN.md. */
export const CRESTS = [
  'wappen-1',
  'wappen-2',
  'wappen-3',
  'wappen-4',
  'wappen-5',
  'wappen-6',
  'wappen-7',
  'wappen-8',
  // Zweiter Satz. Wappen sind Sache des ganzen Vereins und deshalb nicht
  // kaeuflich: Sonst haengte das Zeichen eines Clans daran, ob sein Anfuehrer
  // Muenzen uebrig hat.
  'wappen-9',
  'wappen-10',
  'wappen-11',
  'wappen-12',
  'wappen-13',
  'wappen-14',
  'wappen-15',
  'wappen-16',
  'wappen-17',
  'wappen-18',
] as const;

export type Crest = (typeof CRESTS)[number];

/** Obergrenze aus dem Plan: bis 50 Mitglieder, kostenlos. */
export const MAX_MEMBERS = 50;

export const NAME_MIN = 3;
export const NAME_MAX = 24;
export const MOTTO_MAX = 120;

export type ClubRole = 'admin' | 'vize' | 'elder' | 'member' | 'guest';

/**
 * Wer den Clan verwalten darf.
 *
 * Anfuehrer und Vizeanfuehrer duerfen dasselbe — aufnehmen, rauswerfen,
 * Raenge vergeben, Regeln aendern. Ein Verein hat selten nur einen, der sich
 * kuemmert, und wer sich kuemmert, soll nicht auf einen einzigen warten.
 * "Aeltester" ist bisher eine Auszeichnung ohne Sonderrechte.
 */
export const LEITUNG: readonly ClubRole[] = ['admin', 'vize'];

export function istLeitung(rolle: ClubRole | null | undefined): boolean {
  return rolle === 'admin' || rolle === 'vize';
}

export interface ClubSummary {
  readonly id: string;
  readonly name: string;
  readonly crest: string;
  readonly motto: string | null;
  readonly joinMode: 'open' | 'on_request';
  readonly minTrophies: number;
  readonly members: number;
  readonly maxMembers: number;
  readonly trophies: number;
}

export interface ClubMemberView {
  readonly accountId: string;
  readonly displayName: string;
  readonly role: ClubRole;
  readonly trophies: number;
  readonly since: string;
}

export interface ClubDetail extends ClubSummary {
  /** Rolle des Abfragenden, `null` wenn er nicht Mitglied ist. */
  readonly myRole: ClubRole | null;
  readonly memberList: readonly ClubMemberView[];
  /** Offene Anfragen — nur fuer den Admin gefuellt, sonst leer. */
  readonly requests: readonly ClubMemberView[];
  readonly defaultRuleSetId: string | null;
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

/**
 * Summe der Trophaeen eines Mitglieds ueber alle Spiele.
 *
 * Als Unterabfrage, damit die Mitgliederliste eine Abfrage bleibt und nicht
 * eine je Mitglied. Bei 50 Mitgliedern faellt das noch nicht auf, bei der
 * Clanliste ueber alle Clans schon.
 */
const trophySum = sql<number>`coalesce((
  select sum(${s.accountGameStat.trophies})
  from ${s.accountGameStat}
  where ${s.accountGameStat.accountId} = ${s.clubMember.accountId}
), 0)`;

/** Clans des Kontos. In der Beta genau einer, im Zweifel der erste. */
export async function clubsFor(
  db: Db,
  accountId: string,
): Promise<{ id: string; name: string; crest: string }[]> {
  return db
    .select({ id: s.club.id, name: s.club.name, crest: s.club.crest })
    .from(s.clubMember)
    .innerJoin(s.club, eq(s.club.id, s.clubMember.clubId))
    .where(eq(s.clubMember.accountId, accountId))
    .orderBy(asc(s.clubMember.joinedAt));
}

/** Der eine Clan des Kontos, oder `null`. */
export async function clubOf(db: Db, accountId: string): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: s.clubMember.clubId })
    .from(s.clubMember)
    .where(eq(s.clubMember.accountId, accountId))
    .orderBy(asc(s.clubMember.joinedAt))
    .limit(1);
  return row ?? null;
}

/**
 * Clanliste zum Beitreten. Sortiert nach Mitgliederzahl, damit lebendige
 * Clans oben stehen — ein leerer Clan hilft niemandem, der einen sucht.
 */
export async function listClubs(
  db: Db,
  opts: { search?: string; limit?: number } = {},
): Promise<ClubSummary[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 50);
  const suche = opts.search?.trim();

  const rows = await db
    .select({
      id: s.club.id,
      name: s.club.name,
      crest: s.club.crest,
      motto: s.club.motto,
      joinMode: s.club.joinMode,
      minTrophies: s.club.minTrophies,
      maxMembers: s.club.maxMembers,
      members: count(s.clubMember.accountId),
      trophies: sql<number>`coalesce(sum(${trophySum}), 0)`,
    })
    .from(s.club)
    .leftJoin(s.clubMember, eq(s.clubMember.clubId, s.club.id))
    .where(suche ? ilike(s.club.name, `%${suche}%`) : undefined)
    .groupBy(s.club.id)
    .orderBy(desc(count(s.clubMember.accountId)), asc(s.club.name))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    members: Number(r.members),
    trophies: Number(r.trophies),
  }));
}

/** Ein Clan mit Mitgliedern; Anfragen nur, wenn der Abfragende Admin ist. */
export async function clubDetail(
  db: Db,
  clubId: string,
  viewerAccountId: string,
): Promise<ClubDetail> {
  const [row] = await db.select().from(s.club).where(eq(s.club.id, clubId));
  if (!row) throw notFound('clubUnknown');

  const members = await db
    .select({
      accountId: s.clubMember.accountId,
      displayName: s.account.displayName,
      role: s.clubMember.role,
      since: s.clubMember.joinedAt,
      trophies: trophySum,
      hasAvatar: sql<boolean>`${s.account.avatar} is not null`,
    })
    .from(s.clubMember)
    .innerJoin(s.account, eq(s.account.id, s.clubMember.accountId))
    .where(and(eq(s.clubMember.clubId, clubId), isNull(s.account.anonymizedAt)))
    .orderBy(desc(trophySum), asc(s.clubMember.joinedAt));

  const myRole = members.find((m) => m.accountId === viewerAccountId)?.role ?? null;

  // Anfragen sieht nur, wer sie auch beantworten kann. Sonst waere die
  // Bewerberliste jedes Clans oeffentlich einsehbar.
  const requests =
    myRole === 'admin'
      ? await db
          .select({
            accountId: s.clubJoinRequest.accountId,
            displayName: s.account.displayName,
            since: s.clubJoinRequest.createdAt,
            hasAvatar: sql<boolean>`${s.account.avatar} is not null`,
            trophies: sql<number>`coalesce((
              select sum(${s.accountGameStat.trophies})
              from ${s.accountGameStat}
              where ${s.accountGameStat.accountId} = ${s.clubJoinRequest.accountId}
            ), 0)`,
          })
          .from(s.clubJoinRequest)
          .innerJoin(s.account, eq(s.account.id, s.clubJoinRequest.accountId))
          .where(and(eq(s.clubJoinRequest.clubId, clubId), isNull(s.account.anonymizedAt)))
          .orderBy(asc(s.clubJoinRequest.createdAt))
      : [];

  return {
    id: row.id,
    name: row.name,
    crest: row.crest,
    motto: row.motto,
    joinMode: row.joinMode,
    minTrophies: row.minTrophies,
    maxMembers: row.maxMembers,
    members: members.length,
    trophies: members.reduce((sum, m) => sum + Number(m.trophies), 0),
    myRole,
    memberList: members.map((m) => ({
      accountId: m.accountId,
      displayName: m.displayName,
      role: m.role,
      trophies: Number(m.trophies),
      since: m.since.toISOString(),
      hasAvatar: Boolean(m.hasAvatar),
    })),
    requests: requests.map((r) => ({
      accountId: r.accountId,
      displayName: r.displayName,
      role: 'guest' as const,
      trophies: Number(r.trophies),
      since: r.since.toISOString(),
      hasAvatar: Boolean(r.hasAvatar),
    })),
    defaultRuleSetId: row.defaultRuleSetId,
  };
}

// ---------------------------------------------------------------------------
// Pruefungen fuer andere Dienste
// ---------------------------------------------------------------------------

export async function requireClubMember(
  db: Db,
  clubId: string,
  accountId: string,
): Promise<void> {
  const [row] = await db
    .select({ clubId: s.clubMember.clubId })
    .from(s.clubMember)
    .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));
  if (!row) throw forbidden('notClubMember');
}

export async function requireClubExists(db: Db, clubId: string): Promise<void> {
  const [row] = await db.select({ id: s.club.id }).from(s.club).where(eq(s.club.id, clubId));
  if (!row) throw notFound('clubUnknown');
}

/** Wirft, wenn das Konto nicht zur Leitung des Clans gehoert. */
async function requireLeitung(db: Db, clubId: string, accountId: string): Promise<void> {
  const [row] = await db
    .select({ role: s.clubMember.role })
    .from(s.clubMember)
    .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));
  if (!row) throw forbidden('notClubMember');
  if (!istLeitung(row.role)) throw forbidden('notClubAdmin');
}

// ---------------------------------------------------------------------------
// Beta-Clan
// ---------------------------------------------------------------------------

/**
 * Steckt ein frisches Konto in den Beta-Clan und legt ihn beim ersten Mal an.
 *
 * Wird **nur bei der Registrierung** gerufen, nicht bei jedem Lesen. Frueher
 * hing das an `clubsFor`, was bedeutet haette: Wer den Beta-Clan verlaesst,
 * um selbst zu gruenden, steht beim naechsten Laden wieder drin. Austreten
 * muss austreten bleiben.
 */
export async function ensureBetaClubMembership(
  db: Db,
  accountId: string,
): Promise<{ id: string; name: string }> {
  const [existing] = await db
    .select({ id: s.club.id, name: s.club.name })
    .from(s.clubMember)
    .innerJoin(s.club, eq(s.club.id, s.clubMember.clubId))
    .where(eq(s.clubMember.accountId, accountId))
    .limit(1);
  if (existing) return existing;

  const [found] = await db
    .select({ id: s.club.id, name: s.club.name })
    .from(s.club)
    .where(eq(s.club.name, BETA_CLUB_NAME))
    .limit(1);

  if (!found) {
    const [created] = await db
      .insert(s.club)
      .values({
        name: BETA_CLUB_NAME,
        adminAccountId: accountId,
        joinMode: 'open',
        crest: 'wappen-1',
      })
      .returning({ id: s.club.id, name: s.club.name });
    await db.insert(s.clubMember).values({
      clubId: created!.id,
      accountId,
      role: 'admin',
    });
    return created!;
  }

  await db
    .insert(s.clubMember)
    .values({ clubId: found.id, accountId, role: 'member' })
    .onConflictDoNothing();
  return found;
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

function pruefeName(name: string): string {
  const sauber = name.trim().replace(/\s+/g, ' ');
  if (sauber.length < NAME_MIN || sauber.length > NAME_MAX) throw badRequest('clubNameLength');
  return sauber;
}

function pruefeMotto(motto: string | null | undefined): string | null {
  if (motto == null) return null;
  const sauber = motto.trim().replace(/\s+/g, ' ');
  if (sauber.length === 0) return null;
  if (sauber.length > MOTTO_MAX) throw badRequest('clubMottoLength');
  return sauber;
}

function pruefeCrest(crest: string): Crest {
  if (!(CRESTS as readonly string[]).includes(crest)) throw badRequest('clubCrestUnknown');
  return crest as Crest;
}

/**
 * Wappen sind kaeuflich, das Setzen aber eine Vereinssache.
 *
 * Geprueft wird deshalb, ob DER SETZENDE es besitzt — nicht der Verein. Ein
 * Wappen gehoert einem Menschen, ein Verein hat kein Konto. Wer ein schoenes
 * Zeichen gekauft hat, darf es seinem Clan geben; verlaesst er ihn, bleibt es
 * dem Clan, denn ein Verein, dem beim Austritt eines Mitglieds das Wappen
 * abhandenkommt, waere ein Aergernis ohne Gewinn.
 */
async function requireCrestBesitz(
  db: Db,
  accountId: string,
  crest: string,
): Promise<void> {
  const [konto] = await db
    .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  const alles = konto ? entitlementsFor(konto).ownsEverything : false;
  if (!(await darfBenutzen(db, accountId, 'wappen', crest, alles))) {
    throw forbidden('itemNotOwned');
  }
}

export interface CreateClubInput {
  readonly name: string;
  readonly crest: string;
  readonly motto?: string | null;
  readonly joinMode?: 'open' | 'on_request';
  readonly minTrophies?: number;
}

/**
 * Gruendet einen Clan. Der Gruender wird Admin.
 *
 * Alles in einer Transaktion: Ein Clan ohne Admin-Mitgliedszeile waere ein
 * Clan, den niemand verwalten kann — genau der Zustand, den Punkt 2 oben
 * ausschliesst.
 */
export async function createClub(
  db: Db,
  accountId: string,
  input: CreateClubInput,
): Promise<{ id: string }> {
  const name = pruefeName(input.name);
  const crest = pruefeCrest(input.crest);
  await requireCrestBesitz(db, accountId, input.crest);
  const motto = pruefeMotto(input.motto);
  const minTrophies = Math.max(0, Math.trunc(input.minTrophies ?? 0));

  if (await clubOf(db, accountId)) throw conflict('alreadyInClub');

  return db.transaction(async (tx) => {
    const [vorhanden] = await tx
      .select({ id: s.club.id })
      .from(s.club)
      .where(eq(s.club.name, name));
    if (vorhanden) throw conflict('clubNameTaken');

    const [created] = await tx
      .insert(s.club)
      .values({
        name,
        crest,
        motto,
        adminAccountId: accountId,
        joinMode: input.joinMode ?? 'on_request',
        minTrophies,
        maxMembers: MAX_MEMBERS,
      })
      .returning({ id: s.club.id });

    await tx.insert(s.clubMember).values({
      clubId: created!.id,
      accountId,
      role: 'admin',
    });

    // Wer gruendet, braucht seine Bewerbungen anderswo nicht mehr.
    await tx.delete(s.clubJoinRequest).where(eq(s.clubJoinRequest.accountId, accountId));

    return { id: created!.id };
  });
}

/** Trophaeensumme eines Kontos ueber alle Spiele. */
async function trophiesOf(db: Db, accountId: string): Promise<number> {
  const [row] = await db
    .select({ sum: sql<number>`coalesce(sum(${s.accountGameStat.trophies}), 0)` })
    .from(s.accountGameStat)
    .where(eq(s.accountGameStat.accountId, accountId));
  return Number(row?.sum ?? 0);
}

export type JoinResult = { status: 'joined' } | { status: 'requested' };

/**
 * Beitreten. Bei `open` sofort, bei `on_request` als Anfrage.
 *
 * Die Mitgliedergrenze wird in derselben Transaktion geprueft wie das
 * Einfuegen — sonst kommen zwei gleichzeitige Beitritte auf 51.
 */
export async function joinClub(
  db: Db,
  clubId: string,
  accountId: string,
): Promise<JoinResult> {
  if (await clubOf(db, accountId)) throw conflict('alreadyInClub');

  const [club] = await db.select().from(s.club).where(eq(s.club.id, clubId));
  if (!club) throw notFound('clubUnknown');

  if (club.minTrophies > 0 && (await trophiesOf(db, accountId)) < club.minTrophies) {
    throw forbidden('clubTrophiesTooLow');
  }

  if (club.joinMode === 'on_request') {
    await db.insert(s.clubJoinRequest).values({ clubId, accountId }).onConflictDoNothing();
    return { status: 'requested' };
  }

  await db.transaction(async (tx) => {
    const [zahl] = await tx
      .select({ n: count() })
      .from(s.clubMember)
      .where(eq(s.clubMember.clubId, clubId));
    if (Number(zahl?.n ?? 0) >= club.maxMembers) throw conflict('clubFull');
    await tx
      .insert(s.clubMember)
      .values({ clubId, accountId, role: 'member' })
      .onConflictDoNothing();
    await tx.delete(s.clubJoinRequest).where(eq(s.clubJoinRequest.accountId, accountId));
  });

  return { status: 'joined' };
}

/** Eine offene Anfrage zuruecknehmen. */
export async function cancelJoinRequest(
  db: Db,
  clubId: string,
  accountId: string,
): Promise<void> {
  await db
    .delete(s.clubJoinRequest)
    .where(and(eq(s.clubJoinRequest.clubId, clubId), eq(s.clubJoinRequest.accountId, accountId)));
}

/** Clans, bei denen dieses Konto eine offene Anfrage hat. */
export async function pendingRequestsOf(db: Db, accountId: string): Promise<string[]> {
  const rows = await db
    .select({ clubId: s.clubJoinRequest.clubId })
    .from(s.clubJoinRequest)
    .where(eq(s.clubJoinRequest.accountId, accountId));
  return rows.map((r) => r.clubId);
}

/**
 * Austreten.
 *
 * Der Admin darf gehen — dann rueckt das aelteste Mitglied nach. Ist er der
 * letzte, verschwindet der Clan. Ihn stehenzulassen hiesse: ein Name ist
 * belegt, ein Wappen haengt, und niemand kommt je wieder hinein.
 */
export async function leaveClub(db: Db, clubId: string, accountId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [mine] = await tx
      .select({ role: s.clubMember.role })
      .from(s.clubMember)
      .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));
    if (!mine) throw forbidden('notClubMember');

    await tx
      .delete(s.clubMember)
      .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));

    if (mine.role === 'admin') await nachfolgeOderLoeschen(tx, clubId);
  });
}

/**
 * Nach dem Ausscheiden eines Admins: aeltestes verbliebenes Mitglied
 * befoerdern, sonst den Clan loeschen. Erwartet, dass der alte Admin bereits
 * aus club_member entfernt wurde.
 */
async function nachfolgeOderLoeschen(tx: Db, clubId: string): Promise<void> {
  // Ist noch ein Admin da, ist nichts zu tun: Admins sind gleichberechtigt,
  // und der Clan bleibt verwaltbar. Nachrueckt nur, wenn der letzte ging.
  const [verbliebene] = await tx
    .select({ n: count() })
    .from(s.clubMember)
    .innerJoin(s.account, eq(s.account.id, s.clubMember.accountId))
    .where(
      and(
        eq(s.clubMember.clubId, clubId),
        inArray(s.clubMember.role, [...LEITUNG]),
        isNull(s.account.anonymizedAt),
      ),
    );
  if (Number(verbliebene?.n ?? 0) > 0) return;

  const [naechster] = await tx
    .select({ accountId: s.clubMember.accountId })
    .from(s.clubMember)
    .innerJoin(s.account, eq(s.account.id, s.clubMember.accountId))
    .where(and(eq(s.clubMember.clubId, clubId), isNull(s.account.anonymizedAt)))
    .orderBy(asc(s.clubMember.joinedAt))
    .limit(1);

  if (!naechster) {
    // Cascade raeumt club_member, club_join_request und die Clanbindung der
    // Tische mit ab.
    await tx.delete(s.club).where(eq(s.club.id, clubId));
    return;
  }

  await tx
    .update(s.clubMember)
    .set({ role: 'admin' })
    .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, naechster.accountId)));
  await tx
    .update(s.club)
    .set({ adminAccountId: naechster.accountId })
    .where(eq(s.club.id, clubId));
}

/**
 * Raeumt die Clanzugehoerigkeit eines geloeschten Kontos auf.
 *
 * Wird aus der Kontoloeschung gerufen. Ohne das bliebe ein Clan mit einem
 * Admin namens "geloescht-a1b2c3d4" zurueck, den niemand mehr verwalten kann.
 */
export async function releaseClubMemberships(db: Db, accountId: string): Promise<void> {
  const rows = await db
    .select({ clubId: s.clubMember.clubId, role: s.clubMember.role })
    .from(s.clubMember)
    .where(eq(s.clubMember.accountId, accountId));

  for (const row of rows) {
    await db.transaction(async (tx) => {
      await tx
        .delete(s.clubMember)
        .where(and(eq(s.clubMember.clubId, row.clubId), eq(s.clubMember.accountId, accountId)));
      if (row.role === 'admin') await nachfolgeOderLoeschen(tx, row.clubId);
    });
  }

  await db.delete(s.clubJoinRequest).where(eq(s.clubJoinRequest.accountId, accountId));
}

// ---------------------------------------------------------------------------
// Verwaltung (nur Admin)
// ---------------------------------------------------------------------------

export interface UpdateClubInput {
  readonly name?: string;
  readonly crest?: string;
  readonly motto?: string | null;
  readonly joinMode?: 'open' | 'on_request';
  readonly minTrophies?: number;
  readonly defaultRuleSetId?: string | null;
}

export async function updateClub(
  db: Db,
  clubId: string,
  accountId: string,
  input: UpdateClubInput,
): Promise<void> {
  await requireLeitung(db, clubId, accountId);

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = pruefeName(input.name);
  if (input.crest !== undefined) {
    patch.crest = pruefeCrest(input.crest);
    await requireCrestBesitz(db, accountId, input.crest);
  }
  if (input.motto !== undefined) patch.motto = pruefeMotto(input.motto);
  if (input.joinMode !== undefined) patch.joinMode = input.joinMode;
  if (input.minTrophies !== undefined) {
    patch.minTrophies = Math.max(0, Math.trunc(input.minTrophies));
  }
  if (input.defaultRuleSetId !== undefined) patch.defaultRuleSetId = input.defaultRuleSetId;
  if (Object.keys(patch).length === 0) return;

  if (typeof patch.name === 'string') {
    const [vorhanden] = await db
      .select({ id: s.club.id })
      .from(s.club)
      .where(and(eq(s.club.name, patch.name), ne(s.club.id, clubId)));
    if (vorhanden) throw conflict('clubNameTaken');
  }

  await db.update(s.club).set(patch).where(eq(s.club.id, clubId));
}

/** Anfrage annehmen: Mitglied anlegen, Anfrage entfernen. */
export async function acceptJoinRequest(
  db: Db,
  clubId: string,
  adminAccountId: string,
  accountId: string,
): Promise<void> {
  await requireLeitung(db, clubId, adminAccountId);

  await db.transaction(async (tx) => {
    const [anfrage] = await tx
      .select({ accountId: s.clubJoinRequest.accountId })
      .from(s.clubJoinRequest)
      .where(
        and(eq(s.clubJoinRequest.clubId, clubId), eq(s.clubJoinRequest.accountId, accountId)),
      );
    if (!anfrage) throw notFound('joinRequestUnknown');

    // Zwischenzeitlich woanders eingetreten: Die Anfrage ist hinfaellig. Sie
    // verschwindet, und der Admin bekommt gesagt, warum nichts passiert ist.
    const [woanders] = await tx
      .select({ clubId: s.clubMember.clubId })
      .from(s.clubMember)
      .where(eq(s.clubMember.accountId, accountId))
      .limit(1);
    if (woanders) {
      await tx
        .delete(s.clubJoinRequest)
        .where(
          and(eq(s.clubJoinRequest.clubId, clubId), eq(s.clubJoinRequest.accountId, accountId)),
        );
      throw conflict('alreadyInClub');
    }

    const [club] = await tx
      .select({ maxMembers: s.club.maxMembers })
      .from(s.club)
      .where(eq(s.club.id, clubId));
    const [zahl] = await tx
      .select({ n: count() })
      .from(s.clubMember)
      .where(eq(s.clubMember.clubId, clubId));
    if (Number(zahl?.n ?? 0) >= (club?.maxMembers ?? MAX_MEMBERS)) throw conflict('clubFull');

    await tx.insert(s.clubMember).values({ clubId, accountId, role: 'member' });
    await tx.delete(s.clubJoinRequest).where(eq(s.clubJoinRequest.accountId, accountId));
  });
}

export async function rejectJoinRequest(
  db: Db,
  clubId: string,
  adminAccountId: string,
  accountId: string,
): Promise<void> {
  await requireLeitung(db, clubId, adminAccountId);
  await db
    .delete(s.clubJoinRequest)
    .where(and(eq(s.clubJoinRequest.clubId, clubId), eq(s.clubJoinRequest.accountId, accountId)));
}

/**
 * Rolle aendern.
 *
 * Befoerdert der Admin jemanden zum Admin, gibt er das Amt ab — es gibt genau
 * einen. Zwei Admins hiessen: einer wirft den anderen raus, und wer zuerst
 * tippt, gewinnt.
 */
export async function setMemberRole(
  db: Db,
  clubId: string,
  adminAccountId: string,
  accountId: string,
  role: ClubRole,
): Promise<void> {
  await requireLeitung(db, clubId, adminAccountId);
  if (accountId === adminAccountId) throw badRequest('cannotChangeOwnRole');

  await db.transaction(async (tx) => {
    const [ziel] = await tx
      .select({ role: s.clubMember.role })
      .from(s.clubMember)
      .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));
    if (!ziel) throw notFound('memberUnknown');

    // Wer die Leitung verlaesst, darf nicht der letzte darin sein: Ein Clan
    // ohne Anfuehrer und Vize ist unverwaltbar - niemand koennte mehr
    // aufnehmen, rauswerfen oder die Regeln aendern.
    if (istLeitung(ziel.role) && !istLeitung(role)) {
      await pruefeLetzteLeitung(tx, clubId, accountId);
    }

    await tx
      .update(s.clubMember)
      .set({ role })
      .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));

    // adminAccountId ist nur noch Buchhaltung: Die Spalte ist NOT NULL und
    // muss auf irgendeinen Admin zeigen. Wer wirklich darf, steht in
    // club_member.role - es gibt beliebig viele Admins, alle gleichberechtigt.
    if (role === 'admin') {
      await tx.update(s.club).set({ adminAccountId: accountId }).where(eq(s.club.id, clubId));
    }
  });
}

/** Wirft, wenn `accountId` der einzige verbliebene Admin des Clans ist. */
async function pruefeLetzteLeitung(tx: Db, clubId: string, accountId: string): Promise<void> {
  const [zahl] = await tx
    .select({ n: count() })
    .from(s.clubMember)
    .innerJoin(s.account, eq(s.account.id, s.clubMember.accountId))
    .where(
      and(
        eq(s.clubMember.clubId, clubId),
        inArray(s.clubMember.role, [...LEITUNG]),
        ne(s.clubMember.accountId, accountId),
        isNull(s.account.anonymizedAt),
      ),
    );
  if (Number(zahl?.n ?? 0) === 0) throw badRequest('lastAdmin');
}

export async function kickMember(
  db: Db,
  clubId: string,
  adminAccountId: string,
  accountId: string,
): Promise<void> {
  await requireLeitung(db, clubId, adminAccountId);
  if (accountId === adminAccountId) throw badRequest('cannotKickSelf');

  await db.transaction(async (tx) => {
    const [ziel] = await tx
      .select({ role: s.clubMember.role })
      .from(s.clubMember)
      .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));
    if (!ziel) throw notFound('memberUnknown');

    // Admins duerfen einander rauswerfen - sie sind gleichberechtigt. Nur der
    // letzte darf nicht gehen, sonst bleibt ein Clan ohne Verwaltung zurueck.
    if (istLeitung(ziel.role)) await pruefeLetzteLeitung(tx, clubId, accountId);

    await tx
      .delete(s.clubMember)
      .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));

    await richteAdminSpalte(tx, clubId, accountId);
  });
}

/**
 * Haelt `club.adminAccountId` auf einem existierenden Admin.
 *
 * Die Spalte ist NOT NULL und zeigte frueher auf "den" Admin. Bei mehreren
 * gleichberechtigten ist sie nur noch Buchhaltung - sie darf aber nicht auf
 * jemanden zeigen, der den Clan verlassen hat.
 */
async function richteAdminSpalte(tx: Db, clubId: string, ausgeschieden: string): Promise<void> {
  const [club] = await tx
    .select({ adminAccountId: s.club.adminAccountId })
    .from(s.club)
    .where(eq(s.club.id, clubId));
  if (!club || club.adminAccountId !== ausgeschieden) return;

  const [ersatz] = await tx
    .select({ accountId: s.clubMember.accountId })
    .from(s.clubMember)
    .where(and(eq(s.clubMember.clubId, clubId), inArray(s.clubMember.role, [...LEITUNG])))
    .orderBy(asc(s.clubMember.joinedAt))
    .limit(1);
  if (ersatz) {
    await tx
      .update(s.club)
      .set({ adminAccountId: ersatz.accountId })
      .where(eq(s.club.id, clubId));
  }
}

/** Namen mehrerer Clans auf einmal — fuer Listen, die Clans nur erwaehnen. */
export async function clubNames(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: s.club.id, name: s.club.name })
    .from(s.club)
    .where(inArray(s.club.id, [...ids]));
  return new Map(rows.map((r) => [r.id, r.name]));
}
