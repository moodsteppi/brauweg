/**
 * Kontoloeschung fuer JEDES Konto — auch fuer die ohne Passwort.
 *
 * Apple verlangt, dass sich ein Konto in der App loeschen laesst, die es
 * angelegt hat (Richtlinie 5.1.1(v)). Bis zum 23.09.2026 fragte die
 * Loeschung das Passwort ab — und zwei Sorten Konten haben keins:
 *
 * - **Gaeste** (`gastSeit`, ohne Mail, ohne Passwort). Es gibt nichts, womit
 *   sie sich ausweisen koennten, ausser der Sitzung selbst. Sie bestaetigen
 *   deshalb mit dem Wort LÖSCHEN. Das schuetzt nicht vor dem kurz aus der
 *   Hand gelegten Handy, aber vor dem versehentlichen Tipp — und mehr als die
 *   Sitzung hat ein Gast ohnehin nicht.
 * - **Anbieter-Konten** (nur Google oder Apple, mit Mail). Sie bekommen einen
 *   Code an die Adresse des Kontos. Eine erneute Anbieter-Anmeldung waere
 *   die Alternative gewesen; in der App gibt es die Anbieter-Knoepfe aber
 *   gar nicht (AnbieterKnoepfe.tsx), und der Code funktioniert ueberall.
 *
 * Konten mit Passwort bleiben beim Passwort: Das ist der staerkere Nachweis.
 */

import { randomInt } from 'node:crypto';

import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { baueHtml } from '../mail/vorlage.js';
import { hashToken } from './secrets.js';
import type { AuthDeps } from './service.js';

export type LoeschWeg = 'passwort' | 'code' | 'bestaetigung';

/** Das Wort, mit dem ein Gast bestaetigt. Gross/klein und OE statt Ö zaehlen mit. */
export const LOESCH_WORT = 'LÖSCHEN';

/** Wie lange ein Loeschcode gilt. Kurz: Er ist zum sofortigen Eintippen da. */
const CODE_MINUTEN = 15;

/** Wie lange nach einem Code kein zweiter kommt — Schutz fuers Postfach. */
const SPERRE_MS = 60_000;

/**
 * Zeichenvorrat ohne Verwechsler (0/O, 1/I/L). Acht Zeichen aus 31 sind rund
 * 850 Milliarden Moeglichkeiten — bei der Ratengrenze der Anmelderouten in
 * fuenfzehn Minuten nicht durchzuprobieren.
 */
const ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LAENGE = 8;

export function loeschWeg(konto: {
  readonly passwordHash: string | null;
  readonly email: string | null;
}): LoeschWeg {
  if (konto.passwordHash) return 'passwort';
  if (konto.email) return 'code';
  return 'bestaetigung';
}

/** Hat der Gast das Wort getippt? Leerzeichen, Gross/klein und OE sind egal. */
export function wortBestaetigt(eingabe: string | undefined): boolean {
  if (!eingabe) return false;
  const wort = eingabe.trim().toUpperCase().replace('OE', 'Ö');
  return wort === LOESCH_WORT;
}

function normalisiere(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function neuerCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LAENGE; i += 1) code += ZEICHEN[randomInt(ZEICHEN.length)];
  return code;
}

/**
 * Schickt einen Loeschcode an die Adresse des Kontos.
 *
 * Gibt zurueck, ob eine Mail hinausging. `false` auch in der Sperrminute —
 * dann gilt der vorige Code weiter, und das sagt der Client so.
 */
export async function loeschCodeSenden(deps: AuthDeps, accountId: string): Promise<boolean> {
  const [konto] = await deps.db
    .select({ email: s.account.email })
    .from(s.account)
    .where(and(eq(s.account.id, accountId), isNull(s.account.anonymizedAt)));
  if (!konto?.email) return false;

  const [kuerzlich] = await deps.db
    .select({ id: s.authToken.id })
    .from(s.authToken)
    .where(
      and(
        eq(s.authToken.accountId, accountId),
        eq(s.authToken.purpose, 'account_delete'),
        gt(s.authToken.createdAt, new Date(Date.now() - SPERRE_MS)),
      ),
    )
    .limit(1);
  if (kuerzlich) return false;

  // Es gilt immer nur der juengste Code.
  await deps.db
    .update(s.authToken)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(s.authToken.accountId, accountId),
        eq(s.authToken.purpose, 'account_delete'),
        sql`${s.authToken.usedAt} is null`,
      ),
    );

  const code = neuerCode();
  await deps.db.insert(s.authToken).values({
    accountId,
    purpose: 'account_delete',
    tokenHash: hashToken(`loeschen:${accountId}:${code}`),
    expiresAt: new Date(Date.now() + CODE_MINUTEN * 60_000),
  });

  const lesbar = `${code.slice(0, 4)}-${code.slice(4)}`;
  await deps.mailer.send({
    to: konto.email,
    subject: 'Brauweg: Code zum Löschen deines Kontos',
    text:
      `Dein Code zum Löschen deines Brauweg-Kontos: ${lesbar}\n\n` +
      `Er gilt ${CODE_MINUTEN} Minuten. Warst du das nicht, ignoriere diese Mail — ` +
      `dann bleibt dein Konto, wie es ist.`,
    html: baueHtml({
      publicUrl: deps.publicUrl,
      ueberschrift: 'Konto löschen',
      absaetze: [
        'Du hast das Löschen deines Kontos angefordert. Gib diesen Code in Brauweg ein:',
        lesbar,
      ],
      knopfText: 'Brauweg öffnen',
      knopfLink: deps.publicUrl,
      fussnote: `Der Code gilt ${CODE_MINUTEN} Minuten. Warst du das nicht, ignoriere diese Mail — dann bleibt dein Konto, wie es ist.`,
    }),
  });
  return true;
}

/**
 * Prueft den Code und verbraucht ihn. Der Hash haengt an der Kontokennung:
 * Ein Code, der fuer ein anderes Konto ausgestellt wurde, passt nie.
 */
export async function loeschCodeEinloesen(
  db: Db,
  accountId: string,
  eingabe: string | undefined,
): Promise<boolean> {
  if (!eingabe) return false;
  const code = normalisiere(eingabe);
  if (code.length !== CODE_LAENGE) return false;
  const [treffer] = await db
    .update(s.authToken)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(s.authToken.accountId, accountId),
        eq(s.authToken.purpose, 'account_delete'),
        eq(s.authToken.tokenHash, hashToken(`loeschen:${accountId}:${code}`)),
        isNull(s.authToken.usedAt),
        gt(s.authToken.expiresAt, new Date()),
      ),
    )
    .returning({ id: s.authToken.id });
  return treffer !== undefined;
}
