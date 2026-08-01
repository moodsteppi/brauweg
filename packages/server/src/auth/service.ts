/**
 * Konten, Anmeldung, Sitzungen.
 *
 * Der Beta-Zugang laeuft ueber einen gemeinsamen, mehrfach nutzbaren
 * Einladungscode. Vor der ersten Anmeldung steht die E-Mail-Bestaetigung.
 */

import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, conflict, forbidden, unauthorized } from '../errors.js';
import type { Mailer } from '../mail/index.js';
import {
  hashPassword,
  hashToken,
  newToken,
  verifyPassword,
} from './secrets.js';

const VERIFY_TTL_HOURS = 48;
const RESET_TTL_HOURS = 2;
/** Sperrfrist zwischen zwei angeforderten Bestaetigungslinks. */
const RESEND_COOLDOWN_MS = 60_000;

export interface AuthDeps {
  readonly db: Db;
  readonly mailer: Mailer;
  readonly publicUrl: string;
  readonly sessionTtlDays: number;
}

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly inviteCode: string;
}

export interface SessionInfo {
  readonly accountId: string;
  readonly sessionId: string;
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3600_000);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Name des verletzten Constraints. Drizzle verpackt den Postgres-Fehler, das
 * Feld liegt also eine oder mehrere Ebenen tiefer in der Ursachenkette.
 */
function constraintOf(err: unknown): string | null {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth++) {
    const candidate = (current as { constraint?: unknown }).constraint;
    if (typeof candidate === 'string') return candidate;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Registrierung
// ---------------------------------------------------------------------------

export async function register(
  deps: AuthDeps,
  input: RegisterInput,
): Promise<{ accountId: string }> {
  const { db } = deps;
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();

  // Der Einladungscode wird in einem Schritt geprueft und verbraucht. Zwei
  // getrennte Schritte liessen sich bei gleichzeitigen Anmeldungen ueberholen,
  // und dann gilt max_uses nicht mehr.
  const claimed = await db
    .update(s.inviteCode)
    .set({ uses: sql`${s.inviteCode.uses} + 1` })
    .where(
      and(
        eq(s.inviteCode.code, input.inviteCode),
        eq(s.inviteCode.active, true),
        sql`${s.inviteCode.uses} < ${s.inviteCode.maxUses}`,
      ),
    )
    .returning({ code: s.inviteCode.code });

  if (claimed.length === 0) throw forbidden('inviteCodeInvalid');

  const passwordHash = await hashPassword(input.password);

  let accountId: string;
  try {
    const [row] = await db
      .insert(s.account)
      .values({ email, passwordHash, displayName })
      .returning({ id: s.account.id });
    accountId = row!.id;
  } catch (err) {
    // Der eindeutige Index hat zugeschlagen. Welcher, steht im Postgres-Fehler
    // unter der Drizzle-Meldung, nicht in ihr.
    const constraint = constraintOf(err);
    if (constraint === 'account_display_name_key') throw conflict('displayNameTaken');
    if (constraint === 'account_email_key') throw conflict('emailTaken');
    throw err;
  }

  // Der Versand steht bewusst NACH dem Konto und darf es nicht mehr umwerfen.
  // Scheitert er - Versanddienst nicht erreichbar, Schluessel falsch,
  // Tageslimit erreicht -, dann ist das Konto trotzdem angelegt. Wuerde hier
  // durchgeworfen, saehe die Person einen Fehler, haette keinen Link, und beim
  // zweiten Versuch hiesse es "Adresse schon vergeben": eine Sackgasse, aus der
  // sie ohne fremde Hilfe nicht herauskommt.
  await sendVerification(deps, accountId, email).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(`Bestaetigungsmail an ${email} fehlgeschlagen:`, err);
  });

  return { accountId };
}

/**
 * Bestaetigungslink erneut anfordern.
 *
 * Braucht es unabhaengig von Versandfehlern: Mails landen im Spam, werden
 * geloescht, oder der Link ist nach 48 Stunden abgelaufen.
 *
 * Antwortet immer gleich, egal ob es die Adresse gibt. Sonst wird das Formular
 * zum Verzeichnis registrierter Adressen.
 */
export async function requestVerification(
  deps: AuthDeps,
  email: string,
): Promise<void> {
  const [acc] = await deps.db
    .select()
    .from(s.account)
    .where(eq(s.account.email, normalizeEmail(email)));

  if (!acc || acc.anonymizedAt || acc.emailVerifiedAt) return;

  // Sperrfrist: Ohne sie liesse sich ueber dieses Formular ein fremdes
  // Postfach zumuellen.
  const [recent] = await deps.db
    .select({ createdAt: s.authToken.createdAt })
    .from(s.authToken)
    .where(
      and(
        eq(s.authToken.accountId, acc.id),
        eq(s.authToken.purpose, 'email_verify'),
        gt(s.authToken.createdAt, new Date(Date.now() - RESEND_COOLDOWN_MS)),
      ),
    )
    .limit(1);
  if (recent) return;

  // Aeltere Links entwerten, damit immer nur der neueste gilt.
  await deps.db
    .update(s.authToken)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(s.authToken.accountId, acc.id),
        eq(s.authToken.purpose, 'email_verify'),
        isNull(s.authToken.usedAt),
      ),
    );

  await sendVerification(deps, acc.id, acc.email!);
}

async function sendVerification(
  deps: AuthDeps,
  accountId: string,
  email: string,
): Promise<void> {
  const token = newToken();
  const [row] = await deps.db
    .insert(s.authToken)
    .values({
      accountId,
      purpose: 'email_verify',
      tokenHash: hashToken(token),
      expiresAt: hoursFromNow(VERIFY_TTL_HOURS),
    })
    .returning({ id: s.authToken.id });

  try {
    await deps.mailer.send({
      to: email,
      subject: 'Brauweg: E-Mail bestaetigen',
      text:
        `Willkommen bei Brauweg.\n\n` +
        `Bestaetige deine Adresse: ${deps.publicUrl}/verify?token=${token}\n\n` +
        `Der Link gilt ${VERIFY_TTL_HOURS} Stunden.`,
    });
  } catch (err) {
    // Ein Token, dessen Mail nie hinausging, ist wertlos - und schlimmer:
    // Es wuerde die Sperrfrist ausloesen und damit genau die Wiederholung
    // blockieren, die jetzt gebraucht wird. Also wieder entfernen.
    await deps.db.delete(s.authToken).where(eq(s.authToken.id, row!.id));
    throw err;
  }
}

/** Gibt die Konto-Kennung zurueck, damit der Aufrufer direkt anmelden koennte. */
export async function verifyEmail(db: Db, token: string): Promise<string> {
  const [row] = await db
    .select()
    .from(s.authToken)
    .where(
      and(
        eq(s.authToken.tokenHash, hashToken(token)),
        eq(s.authToken.purpose, 'email_verify'),
        isNull(s.authToken.usedAt),
        gt(s.authToken.expiresAt, new Date()),
      ),
    );

  if (!row) throw badRequest('tokenInvalid');

  await db
    .update(s.authToken)
    .set({ usedAt: new Date() })
    .where(eq(s.authToken.id, row.id));

  await db
    .update(s.account)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(s.account.id, row.accountId));

  return row.accountId;
}

// ---------------------------------------------------------------------------
// Anmeldung und Sitzungen
// ---------------------------------------------------------------------------

export async function login(
  deps: AuthDeps,
  email: string,
  password: string,
): Promise<{ token: string; accountId: string }> {
  const [acc] = await deps.db
    .select()
    .from(s.account)
    .where(eq(s.account.email, normalizeEmail(email)));

  // Bewusst dieselbe Meldung fuer "kein Konto" und "falsches Passwort": sonst
  // laesst sich abfragen, welche Adressen registriert sind.
  const ok = await verifyPassword(acc?.passwordHash ?? null, password);
  if (!acc || !ok || acc.anonymizedAt) throw unauthorized('credentialsInvalid');
  if (!acc.emailVerifiedAt) throw forbidden('emailNotVerified');

  const token = await createSession(deps, acc.id);
  return { token, accountId: acc.id };
}

export async function createSession(
  deps: AuthDeps,
  accountId: string,
): Promise<string> {
  const token = newToken();
  await deps.db.insert(s.session).values({
    accountId,
    tokenHash: hashToken(token),
    expiresAt: hoursFromNow(deps.sessionTtlDays * 24),
  });
  return token;
}

/** Null statt Fehler: Der Aufrufer entscheidet, ob Anonymitaet erlaubt ist. */
export async function sessionFromToken(
  db: Db,
  token: string | undefined,
): Promise<SessionInfo | null> {
  if (!token) return null;

  const [row] = await db
    .select({
      id: s.session.id,
      accountId: s.session.accountId,
      anonymizedAt: s.account.anonymizedAt,
    })
    .from(s.session)
    .innerJoin(s.account, eq(s.account.id, s.session.accountId))
    .where(
      and(
        eq(s.session.tokenHash, hashToken(token)),
        isNull(s.session.revokedAt),
        gt(s.session.expiresAt, new Date()),
      ),
    );

  if (!row || row.anonymizedAt) return null;

  await db
    .update(s.session)
    .set({ lastSeenAt: new Date() })
    .where(eq(s.session.id, row.id));

  return { accountId: row.accountId, sessionId: row.id };
}

export async function logout(db: Db, sessionId: string): Promise<void> {
  await db
    .update(s.session)
    .set({ revokedAt: new Date() })
    .where(eq(s.session.id, sessionId));
}

// ---------------------------------------------------------------------------
// Passwort zuruecksetzen
// ---------------------------------------------------------------------------

export async function requestPasswordReset(
  deps: AuthDeps,
  email: string,
): Promise<void> {
  const [acc] = await deps.db
    .select()
    .from(s.account)
    .where(eq(s.account.email, normalizeEmail(email)));

  // Kein Fehler, wenn es die Adresse nicht gibt: Sonst wird das Formular zum
  // Verzeichnis registrierter Adressen.
  if (!acc || acc.anonymizedAt) return;

  const token = newToken();
  await deps.db.insert(s.authToken).values({
    accountId: acc.id,
    purpose: 'password_reset',
    tokenHash: hashToken(token),
    expiresAt: hoursFromNow(RESET_TTL_HOURS),
  });

  await deps.mailer.send({
    to: acc.email!,
    subject: 'Brauweg: Passwort zuruecksetzen',
    text:
      `Neues Passwort setzen: ${deps.publicUrl}/reset?token=${token}\n\n` +
      `Der Link gilt ${RESET_TTL_HOURS} Stunden. Warst du das nicht, ` +
      `ignoriere diese Mail.`,
  });
}

export async function resetPassword(
  db: Db,
  token: string,
  password: string,
): Promise<void> {
  const [row] = await db
    .select()
    .from(s.authToken)
    .where(
      and(
        eq(s.authToken.tokenHash, hashToken(token)),
        eq(s.authToken.purpose, 'password_reset'),
        isNull(s.authToken.usedAt),
        gt(s.authToken.expiresAt, new Date()),
      ),
    );

  if (!row) throw badRequest('tokenInvalid');

  await db.update(s.authToken).set({ usedAt: new Date() }).where(eq(s.authToken.id, row.id));
  await db
    .update(s.account)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(s.account.id, row.accountId));

  // Ein zurueckgesetztes Passwort beendet alle offenen Sitzungen. Sonst bleibt
  // ein Angreifer, der das Passwort erraten hatte, weiter angemeldet.
  await db
    .update(s.session)
    .set({ revokedAt: new Date() })
    .where(and(eq(s.session.accountId, row.accountId), isNull(s.session.revokedAt)));
}

// ---------------------------------------------------------------------------
// Kontoloeschung
// ---------------------------------------------------------------------------

/**
 * Loeschen heisst anonymisieren. Zeilen zu entfernen wuerde die
 * Partiehistorien aller Mitspieler zerfallen lassen. Personenbezug ist weg,
 * Nachvollziehbarkeit bleibt.
 *
 * Ob eine laufende Partie als Verlassen gilt, entscheidet der Aufrufer: Diese
 * Funktion kennt keine Tische.
 */
export async function anonymizeAccount(db: Db, accountId: string): Promise<void> {
  const now = new Date();
  await db
    .update(s.account)
    .set({
      email: null,
      passwordHash: null,
      emailVerifiedAt: null,
      displayName: `geloescht-${accountId.slice(0, 8)}`,
      anonymizedAt: now,
    })
    .where(eq(s.account.id, accountId));

  await db
    .update(s.session)
    .set({ revokedAt: now })
    .where(and(eq(s.session.accountId, accountId), isNull(s.session.revokedAt)));
}
