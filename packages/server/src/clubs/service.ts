/**
 * Vereine — schlank fuer die Beta.
 *
 * Alle, die mit dem Einladungscode reinkommen, landen im gemeinsamen
 * Brauweg-Verein. Darueber laufen Vereinstische (club_only) und Pause.
 * Volle Vereinsverwaltung (Rollen, Beitrittsanfragen, Saison) kommt spaeter.
 */

import { and, eq } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { forbidden, notFound } from '../errors.js';

export const BETA_CLUB_NAME = 'Brauweg';

/**
 * Stellt sicher, dass das Konto Mitglied im Beta-Verein ist, und legt den
 * Verein bei Bedarf an. Der erste Beitretende wird Admin.
 */
export async function ensureBetaClubMembership(
  db: Db,
  accountId: string,
): Promise<{ id: string; name: string }> {
  const existing = await db
    .select({ id: s.club.id, name: s.club.name })
    .from(s.clubMember)
    .innerJoin(s.club, eq(s.club.id, s.clubMember.clubId))
    .where(eq(s.clubMember.accountId, accountId))
    .limit(1);
  if (existing[0]) return existing[0];

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

/** Vereine des Kontos — in der Beta typischerweise genau einer. */
export async function clubsFor(
  db: Db,
  accountId: string,
): Promise<{ id: string; name: string }[]> {
  await ensureBetaClubMembership(db, accountId);
  return db
    .select({ id: s.club.id, name: s.club.name })
    .from(s.clubMember)
    .innerJoin(s.club, eq(s.club.id, s.clubMember.clubId))
    .where(eq(s.clubMember.accountId, accountId));
}

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
