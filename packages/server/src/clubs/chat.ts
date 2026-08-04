/**
 * Clanchat.
 *
 * Ein Verein braucht einen Ort, an dem geredet wird — sonst ist er eine
 * Mitgliederliste. Der Chat ist bewusst schlicht: eine Spur von Nachrichten,
 * neueste unten, keine Threads, keine Bilder, keine Reaktionen.
 *
 * Zwei Sorten Nachricht: was Mitglieder schreiben (`text`) und was der Server
 * selbst vermerkt (`system`) — Beitritte, Kriegsbeginn, Kriegsende. Die
 * Systemzeilen machen aus dem Chat nebenbei die Chronik des Clans, und weil
 * sie kein Konto tragen, kann sie niemand einem Mitglied unterschieben.
 *
 * Geloescht wird nie wirklich: `deletedAt` markiert, der Text bleibt stehen.
 * Das haelt die Reihenfolge stabil und macht eine Loeschung nachvollziehbar.
 */

import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { istLeitung } from './service.js';

/** Laenge einer Nachricht. Genug fuer einen Absatz, zu wenig fuer einen Roman. */
export const MAX_LAENGE = 500;

/** So viele Nachrichten holt eine Abfrage hoechstens. */
const SEITE = 60;

export interface ChatMessage {
  readonly id: string;
  readonly kind: 'text' | 'system';
  /** Leer bei Systemmeldungen. */
  readonly accountId: string | null;
  readonly displayName: string | null;
  readonly hasAvatar: boolean;
  /** Leer, wenn geloescht — der Client zeigt dann einen Platzhalter. */
  readonly body: string | null;
  readonly deleted: boolean;
  readonly createdAt: string;
}

/**
 * Die letzten Nachrichten, aelteste zuerst.
 *
 * `seit` holt nur Neues: Der Client fragt im Sekundentakt nach und schickt
 * den Zeitstempel seiner juengsten Zeile mit. Ohne das liefe bei jedem
 * Abgleich die volle Seite ueber die Leitung.
 */
export async function listMessages(
  db: Db,
  clubId: string,
  accountId: string,
  seit?: Date,
): Promise<ChatMessage[]> {
  await requireMitglied(db, clubId, accountId);

  const rows = await db
    .select({
      id: s.clubMessage.id,
      kind: s.clubMessage.kind,
      accountId: s.clubMessage.accountId,
      body: s.clubMessage.body,
      createdAt: s.clubMessage.createdAt,
      deletedAt: s.clubMessage.deletedAt,
      displayName: s.account.displayName,
      hasAvatar: sql<boolean>`${s.account.avatar} is not null`,
    })
    .from(s.clubMessage)
    .leftJoin(s.account, eq(s.account.id, s.clubMessage.accountId))
    .where(
      seit
        ? and(eq(s.clubMessage.clubId, clubId), gt(s.clubMessage.createdAt, seit))
        : eq(s.clubMessage.clubId, clubId),
    )
    // Neueste zuerst holen und danach drehen: Sonst lieferte die Seite bei
    // langer Geschichte die aeltesten sechzig statt der juengsten.
    .orderBy(desc(s.clubMessage.createdAt))
    .limit(SEITE);

  return rows.reverse().map((r) => ({
    id: r.id,
    kind: r.kind,
    accountId: r.accountId,
    displayName: r.displayName,
    hasAvatar: Boolean(r.hasAvatar),
    body: r.deletedAt ? null : r.body,
    deleted: Boolean(r.deletedAt),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Schreibt eine Nachricht und gibt sie zurueck, wie der Chat sie zeigt. */
export async function postMessage(
  db: Db,
  clubId: string,
  accountId: string,
  body: string,
): Promise<ChatMessage> {
  await requireMitglied(db, clubId, accountId);

  // Rand-Leerraum weg, Zeilenumbrueche bleiben: Wer einen Absatz setzt, meint
  // ihn. Eine Nachricht aus lauter Leerzeichen ist keine.
  const text = body.trim();
  if (text.length === 0) throw badRequest('messageEmpty');
  if (text.length > MAX_LAENGE) throw badRequest('messageTooLong');

  const [row] = await db
    .insert(s.clubMessage)
    .values({ clubId, accountId, kind: 'text', body: text })
    .returning();

  const [wer] = await db
    .select({
      displayName: s.account.displayName,
      hasAvatar: sql<boolean>`${s.account.avatar} is not null`,
    })
    .from(s.account)
    .where(eq(s.account.id, accountId));

  return {
    id: row!.id,
    kind: 'text',
    accountId,
    displayName: wer?.displayName ?? null,
    hasAvatar: Boolean(wer?.hasAvatar),
    body: row!.body,
    deleted: false,
    createdAt: row!.createdAt.toISOString(),
  };
}

/**
 * Systemmeldung. Kommt vom Server, nie von einem Konto.
 *
 * Schlaegt bewusst nie fehl: Eine Chronikzeile ist nie wichtig genug, um den
 * Beitritt oder das Kriegsende scheitern zu lassen, in deren Verlauf sie
 * entsteht.
 */
export async function postSystem(db: Db, clubId: string, body: string): Promise<void> {
  try {
    await db.insert(s.clubMessage).values({ clubId, accountId: null, kind: 'system', body });
  } catch (err) {
    console.error(`Systemmeldung an Clan ${clubId}:`, err);
  }
}

/**
 * Loeschen durch die Leitung — oder durch den Verfasser selbst.
 *
 * Wer sich vertippt hat, soll nicht auf einen Anfuehrer warten muessen;
 * fremde Nachrichten raeumt nur die Leitung weg. Systemmeldungen bleiben
 * stehen: Sie sind die Chronik, und eine Chronik, die sich frisieren laesst,
 * ist keine.
 */
export async function deleteMessage(
  db: Db,
  clubId: string,
  messageId: string,
  accountId: string,
): Promise<void> {
  const [row] = await db
    .select({ accountId: s.clubMessage.accountId, kind: s.clubMessage.kind })
    .from(s.clubMessage)
    .where(and(eq(s.clubMessage.id, messageId), eq(s.clubMessage.clubId, clubId)));
  if (!row) throw notFound('messageUnknown');
  if (row.kind === 'system') throw forbidden('systemMessage');

  if (row.accountId !== accountId) {
    const [mitglied] = await db
      .select({ role: s.clubMember.role })
      .from(s.clubMember)
      .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));
    if (!mitglied) throw forbidden('notClubMember');
    if (!istLeitung(mitglied.role)) throw forbidden('notClubAdmin');
  }

  await db
    .update(s.clubMessage)
    .set({ deletedAt: new Date() })
    .where(and(eq(s.clubMessage.id, messageId), isNull(s.clubMessage.deletedAt)));
}

async function requireMitglied(db: Db, clubId: string, accountId: string): Promise<void> {
  const [row] = await db
    .select({ clubId: s.clubMember.clubId })
    .from(s.clubMember)
    .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));
  if (!row) throw forbidden('notClubMember');
}
