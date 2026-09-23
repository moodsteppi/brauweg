/**
 * Konten, Anmeldung, Sitzungen.
 *
 * Der Beta-Zugang laeuft ueber einen gemeinsamen, mehrfach nutzbaren
 * Einladungscode. Vor der ersten Anmeldung steht die E-Mail-Bestaetigung.
 */

import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import { assertValidBirthday } from '../birthday.js';
import { ensureBetaClubMembership } from '../clubs/service.js';
import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, conflict, forbidden, unauthorized } from '../errors.js';
import type { Mailer } from '../mail/index.js';
import { baueHtml } from '../mail/vorlage.js';
import { loescheGeraeteDerSitzung, loescheGeraeteDesKontos } from '../push/geraete.js';
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
  /**
   * Muss die Adresse vor der ersten Anmeldung bestaetigt sein? Fehlt der
   * Wert, gilt ja. Der Start setzt ihn auf nein, wenn in der Produktion kein
   * Versanddienst haengt (siehe index.ts): Ein Link, der nie ankommt, darf
   * niemanden aussperren.
   */
  readonly bestaetigungPflicht?: boolean;
}

/** Siehe `AuthDeps.bestaetigungPflicht`. */
export function bestaetigungNoetig(deps: AuthDeps): boolean {
  return deps.bestaetigungPflicht !== false;
}

/** Was nach Registrieren oder Sichern ueber den Versand feststeht. */
export interface VersandAuskunft {
  /** Hat der Versanddienst die Mail angenommen? Beim Log-Mailer nie. */
  readonly mailVersandt: boolean;
  /** Muss der Link angeklickt werden, bevor man sich anmelden kann? */
  readonly bestaetigungNoetig: boolean;
}

/** Nur die Domain — ganze Adressen gehoeren nicht ins Betriebslog. */
function nurDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 0 ? '(ohne Domain)' : `@${email.slice(at + 1)}`;
}

/**
 * Versand versuchen und das Ergebnis melden, statt es zu verschlucken.
 *
 * Die Fehlerzeile traegt die Marke "MAILFEHLER" wie die des Mailers selbst,
 * damit eine Suche im Log beide findet — die des Mailers nennt Resends
 * Grund, diese hier, WELCHE Mail es war.
 */
async function versuche(
  deps: AuthDeps,
  wozu: string,
  email: string,
  senden: () => Promise<void>,
): Promise<boolean> {
  try {
    await senden();
    return deps.mailer.art === 'resend';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `MAILFEHLER ${wozu} an ${nurDomain(email)} nicht verschickt:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  /**
   * Seit der Oeffnung optional: Die Registrierung steht allen offen. Ein
   * mitgeschickter Code wird weiterhin geprueft und verbraucht — alte Clients
   * und ausgegebene Codes bleiben so gueltig.
   */
  readonly inviteCode?: string;
  /** ISO-Kalendertag YYYY-MM-DD. */
  readonly birthday: string;
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
): Promise<{ accountId: string } & VersandAuskunft> {
  const { db } = deps;
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  const birthday = assertValidBirthday(input.birthday);

  const passwordHash = await hashPassword(input.password);

  /**
   * Code verbrauchen und Konto anlegen gehoeren in EINE Transaktion.
   *
   * Getrennt kostete jeder gescheiterte Versuch - etwa ein schon vergebener
   * Anzeigename - eine Nutzung des Einladungscodes. Wer den Beta-Code kennt
   * (und den kennen alle Beta-Spieler), konnte damit in Sekunden alle
   * Nutzungen verbrennen und die Registrierung fuer alle sperren. Schlaegt
   * jetzt etwas fehl, rollt der Zaehler mit zurueck.
   */
  const accountId = await db.transaction(async (tx) => {
    // Ohne Code einfach durch — wer aber einen eingibt, bekommt ihn geprueft:
    // Ein Tippfehler soll ein Fehler sein, kein stilles Ignorieren.
    const code = input.inviteCode?.trim();
    if (code) {
      const claimed = await tx
        .update(s.inviteCode)
        .set({ uses: sql`${s.inviteCode.uses} + 1` })
        .where(
          and(
            eq(s.inviteCode.code, code),
            eq(s.inviteCode.active, true),
            sql`${s.inviteCode.uses} < ${s.inviteCode.maxUses}`,
          ),
        )
        .returning({ code: s.inviteCode.code });

      if (claimed.length === 0) throw forbidden('inviteCodeInvalid');
    }

    try {
      const [row] = await tx
        .insert(s.account)
        .values({ email, passwordHash, displayName, birthday })
        .returning({ id: s.account.id });
      return row!.id;
    } catch (err) {
      // Der eindeutige Index hat zugeschlagen. Welcher, steht im Postgres-Fehler
      // unter der Drizzle-Meldung, nicht in ihr.
      const constraint = constraintOf(err);
      if (constraint === 'account_display_name_key') throw conflict('displayNameTaken');
      if (constraint === 'account_email_key') throw conflict('emailTaken');
      throw err;
    }
  });

  // Beta: jeder Einladungs-Nutzer landet im gemeinsamen Clan — sonst
  // gaebe es keine Clantische und keine Pause.
  await ensureBetaClubMembership(db, accountId);

  // Der Versand steht bewusst NACH dem Konto und darf es nicht mehr umwerfen.
  // Scheitert er - Versanddienst nicht erreichbar, Schluessel falsch,
  // Tageslimit erreicht -, dann ist das Konto trotzdem angelegt. Wuerde hier
  // durchgeworfen, saehe die Person einen Fehler, haette keinen Link, und beim
  // zweiten Versuch hiesse es "Adresse schon vergeben": eine Sackgasse, aus der
  // sie ohne fremde Hilfe nicht herauskommt.
  //
  // Verschluckt wird er aber nicht mehr: Das Ergebnis geht an den Client, der
  // dann ehrlich sagt, dass keine Mail unterwegs ist, und den neuen Link
  // anbietet. Die Registrierung verraet damit nichts, was sie nicht ohnehin
  // verraet — "Adresse schon vergeben" kennt sie seit jeher.
  const mailVersandt = await versuche(deps, 'Bestaetigungsmail', email, () =>
    sendVerification(deps, accountId, email),
  );

  return { accountId, mailVersandt, bestaetigungNoetig: bestaetigungNoetig(deps) };
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

  // Ein Versandfehler wird laut geloggt, aber nicht an den Aufrufer gereicht:
  // Ein 500 NUR fuer bekannte Adressen machte das Formular wieder zum
  // Verzeichnis. Wer nichts bekommt, sieht es in der Mail-Diagnose.
  await versuche(deps, 'Bestaetigungsmail (erneut)', acc.email!, () =>
    sendVerification(deps, acc.id, acc.email!),
  );
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
    const link = `${deps.publicUrl}/verify?token=${token}`;
    await deps.mailer.send({
      to: email,
      subject: 'Brauweg: E-Mail bestaetigen',
      text:
        `Willkommen bei Brauweg.\n\n` +
        `Bestaetige deine Adresse: ${link}\n\n` +
        `Der Link gilt ${VERIFY_TTL_HOURS} Stunden.`,
      html: baueHtml({
        publicUrl: deps.publicUrl,
        ueberschrift: 'Willkommen bei Brauweg',
        absaetze: [
          'Schön, dass du dabei bist. Bestätige einmal kurz deine Adresse, dann kann es losgehen.',
        ],
        knopfText: 'Adresse bestätigen',
        knopfLink: link,
        fussnote: `Der Link gilt ${VERIFY_TTL_HOURS} Stunden. Hast du dich nicht angemeldet, ignoriere diese Mail einfach.`,
      }),
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
  if (!acc.emailVerifiedAt && bestaetigungNoetig(deps)) throw forbidden('emailNotVerified');

  const token = await createSession(deps, acc.id);
  return { token, accountId: acc.id };
}

// ---------------------------------------------------------------------------
// Gastkonten
// ---------------------------------------------------------------------------

/**
 * Wie oft ein belegter Anzeigename mit angehaengter Zahl neu versucht wird.
 *
 * Acht, weil der Zufallsbereich mit jedem Versuch waechst (siehe unten) und
 * die Wahrscheinlichkeit, achtmal hintereinander danebenzugreifen, damit
 * verschwindet. Eine Endlosschleife waere hier der falsche Mut: Sie haenge
 * genau dann, wenn jemand absichtlich Namen blockiert.
 */
const GAST_NAME_VERSUCHE = 8;

/** Erlaubte Laenge eines Gastnamens — dieselbe Spanne wie beim Registrieren. */
export const GAST_NAME_MIN = 2;
export const GAST_NAME_MAX = 30;

/**
 * Ein Gastkonto anlegen und sofort anmelden.
 *
 * Es ist ein ganz normales Konto: dieselbe Tabelle, dieselbe Sitzung,
 * dieselben Spielstaende. Nur `email` und `passwordHash` bleiben leer —
 * womit es auch keinen Weg zurueck gibt, wenn die Sitzung verloren geht. Das
 * ist der Preis fuer "ohne Anmeldung", und der Client sagt es auch.
 *
 * KEINE Mitgliedschaft im Beta-Clan (anders als bei `register`): Ein Gast,
 * der mit einem Klick entsteht, stuende sonst binnen einer Party zu Dutzenden
 * in der Mitgliederliste, die echte Leute pflegen.
 *
 * KEIN Geburtstag: Der Client fragt danach nicht, also steht dort nichts.
 * `assertValidBirthday` gilt weiter fuer jeden, der ein richtiges Konto
 * anlegt — auch beim Sichern eines Gastkontos.
 */
export async function gastKonto(
  deps: AuthDeps,
  wunschname: string,
): Promise<{ token: string; accountId: string; displayName: string }> {
  const basis = wunschname.trim().slice(0, GAST_NAME_MAX);
  if (basis.length < GAST_NAME_MIN) throw badRequest('displayNameTooShort');

  for (let versuch = 0; versuch < GAST_NAME_VERSUCHE; versuch++) {
    /*
     * Beim ersten Versuch der Wunschname, danach mit angehaengter Zahl. Der
     * Bereich waechst mit jedem Versuch (10, 100, 1000 …): Bei einem sehr
     * beliebten Namen — "Max" auf einer Party — waere ein fester Bereich nach
     * ein paar Gaesten dicht, und alle weiteren liefen in denselben Fehler.
     */
    const displayName =
      versuch === 0
        ? basis
        : `${basis.slice(0, GAST_NAME_MAX - 1 - versuch)} ${
            1 + Math.floor(Math.random() * 10 ** versuch)
          }`;

    try {
      const [row] = await deps.db
        .insert(s.account)
        .values({ displayName, gastSeit: new Date() })
        .returning({ id: s.account.id });

      const token = await createSession(deps, row!.id);
      return { token, accountId: row!.id, displayName };
    } catch (err) {
      if (constraintOf(err) === 'account_display_name_key') continue;
      throw err;
    }
  }

  throw conflict('displayNameTaken');
}

/**
 * Ein Gastkonto sichern: Mail und Passwort nachtragen.
 *
 * Dieselbe Zeile, derselbe Spielstand — nur ist das Konto danach keins mehr,
 * das mit der Sitzung verschwindet. `gastSeit` faellt auf NULL, und ab dem
 * Moment zaehlen die Tische dieses Kontos wieder fuer die Rangliste.
 *
 * Die Bestaetigungsmail geht raus wie bei jeder Registrierung, und `login`
 * verlangt sie auch — wer sich also spaeter neu anmelden will, muss den Link
 * angeklickt haben. Die LAUFENDE Sitzung bleibt davon unberuehrt: Jemanden
 * mitten in der Partie hinauszuwerfen, weil er gerade sein Konto gesichert
 * hat, waere die Strafe fuer genau das Richtige.
 */
export async function gastSichern(
  deps: AuthDeps,
  accountId: string,
  input: { email: string; password: string; birthday: string },
): Promise<VersandAuskunft> {
  const email = normalizeEmail(input.email);
  const birthday = assertValidBirthday(input.birthday);
  const passwordHash = await hashPassword(input.password);

  const [konto] = await deps.db
    .select({ gastSeit: s.account.gastSeit, anonymizedAt: s.account.anonymizedAt })
    .from(s.account)
    .where(eq(s.account.id, accountId));

  if (!konto || konto.anonymizedAt) throw unauthorized('credentialsInvalid');
  // Kein Gast: Hier ist nichts zu sichern, und ein Passwortwechsel gehoert
  // nicht hierher — der laeuft ueber den Reset-Weg mit Mailbestaetigung.
  if (!konto.gastSeit) throw conflict('keinGastkonto');

  try {
    /*
     * `isNull(email)` ist der Riegel gegen zwei gleichzeitige Versuche: Der
     * zweite trifft keine Zeile mehr. Deshalb `returning` und die Pruefung
     * darunter — ohne sie liefe der zweite Versuch lautlos ins Leere und der
     * Client meldete Erfolg, waehrend die zweite Adresse nirgends steht.
     */
    const betroffen = await deps.db
      .update(s.account)
      .set({ email, passwordHash, birthday, gastSeit: null })
      .where(and(eq(s.account.id, accountId), isNull(s.account.email)))
      .returning({ id: s.account.id });
    if (betroffen.length === 0) throw conflict('keinGastkonto');
  } catch (err) {
    if (constraintOf(err) === 'account_email_key') throw conflict('emailTaken');
    throw err;
  }

  await ensureBetaClubMembership(deps.db, accountId);

  // Wie bei der Registrierung: Der Versand darf das Konto nicht mehr
  // umwerfen. Wer keine Mail bekommt, fordert sie neu an — und erfaehrt es,
  // statt auf eine Mail zu warten, die nie hinausging.
  const mailVersandt = await versuche(deps, 'Bestaetigungsmail (Gast gesichert)', email, () =>
    sendVerification(deps, accountId, email),
  );
  return { mailVersandt, bestaetigungNoetig: bestaetigungNoetig(deps) };
}

/** Ist dieses Konto ein Gast? Eine Zeile, aber an vier Stellen gebraucht. */
export async function istGast(db: Db, accountId: string): Promise<boolean> {
  const [row] = await db
    .select({ gastSeit: s.account.gastSeit })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  return row?.gastSeit != null;
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
  // Wer sich abmeldet, will auf diesem Geraet nicht weiter angestupst werden
  // (docs/PUSH.md). Hier und nicht in der Route: Jeder Weg, der eine Sitzung
  // beendet, soll die Tokens mitnehmen.
  await loescheGeraeteDerSitzung(db, sessionId);
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

  // Sperrfrist wie beim Bestaetigungslink. Ohne sie laesst sich jedes bekannte
  // Postfach in Minuten mit Reset-Mails zuschuetten - auf Kosten unseres
  // Versandkontingents und des Rufs der Domain.
  const [kuerzlich] = await deps.db
    .select({ id: s.authToken.id })
    .from(s.authToken)
    .where(
      and(
        eq(s.authToken.accountId, acc.id),
        eq(s.authToken.purpose, 'password_reset'),
        gt(s.authToken.createdAt, new Date(Date.now() - RESEND_COOLDOWN_MS)),
      ),
    )
    .limit(1);
  if (kuerzlich) return;

  // Aeltere offene Links entwerten: Es soll immer nur einer gelten.
  await deps.db
    .update(s.authToken)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(s.authToken.accountId, acc.id),
        eq(s.authToken.purpose, 'password_reset'),
        sql`${s.authToken.usedAt} is null`,
      ),
    );

  const token = newToken();
  const [zeile] = await deps.db
    .insert(s.authToken)
    .values({
      accountId: acc.id,
      purpose: 'password_reset',
      tokenHash: hashToken(token),
      expiresAt: hoursFromNow(RESET_TTL_HOURS),
    })
    .returning({ id: s.authToken.id });

  const link = `${deps.publicUrl}/reset?token=${token}`;
  const versandt = await versuche(deps, 'Passwort-Mail', acc.email!, () => sendeResetMail(deps, acc.email!, link));
  // Wie beim Bestaetigungslink: Ein Token, dessen Mail nie hinausging, loest
  // sonst die Sperrfrist aus und blockiert genau den zweiten Versuch. Beim
  // Log-Mailer bleibt es — dort IST das Log der Zustellweg.
  if (!versandt && deps.mailer.art === 'resend') {
    await deps.db.delete(s.authToken).where(eq(s.authToken.id, zeile!.id));
  }
}

async function sendeResetMail(deps: AuthDeps, email: string, link: string): Promise<void> {
  await deps.mailer.send({
    to: email,
    subject: 'Brauweg: Passwort zuruecksetzen',
    text:
      `Neues Passwort setzen: ${link}\n\n` +
      `Der Link gilt ${RESET_TTL_HOURS} Stunden. Warst du das nicht, ` +
      `ignoriere diese Mail.`,
    html: baueHtml({
      publicUrl: deps.publicUrl,
      ueberschrift: 'Neues Passwort setzen',
      absaetze: ['Du hast ein neues Passwort angefordert. Mit dem Knopf unten setzt du es.'],
      knopfText: 'Passwort ändern',
      knopfLink: link,
      fussnote: `Der Link gilt ${RESET_TTL_HOURS} Stunden. Warst du das nicht, ignoriere diese Mail — dein Passwort bleibt dann unverändert.`,
    }),
  });
}

/**
 * Neues Passwort setzen. Gibt die Konto-Kennung zurueck, damit die Route
 * gleich eine frische Sitzung anlegen kann — wer den Link aus seinem
 * Postfach hat, hat bewiesen, wem die Adresse gehoert.
 */
export async function resetPassword(
  db: Db,
  token: string,
  password: string,
): Promise<string> {
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
  // Der Link kam per Mail an diese Adresse: Damit ist sie so gut bestaetigt
  // wie mit dem Bestaetigungslink. Ohne diese Zeile stuende, wer seinen
  // Bestaetigungslink verloren und stattdessen das Passwort zurueckgesetzt
  // hat, nach dem Reset wieder vor "Bestaetige zuerst deine Adresse".
  await db
    .update(s.account)
    .set({ emailVerifiedAt: new Date() })
    .where(and(eq(s.account.id, row.accountId), isNull(s.account.emailVerifiedAt)));

  // Ein zurueckgesetztes Passwort beendet alle offenen Sitzungen. Sonst bleibt
  // ein Angreifer, der das Passwort erraten hatte, weiter angemeldet.
  await db
    .update(s.session)
    .set({ revokedAt: new Date() })
    .where(and(eq(s.session.accountId, row.accountId), isNull(s.session.revokedAt)));
  return row.accountId;
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
      birthday: null,
      // Profilbild und Figurbemalung sind Personenbezug wie der Name: Bis zum
      // 23.09.2026 blieben sie stehen, und /api/avatars/:id lieferte das Foto
      // eines geloeschten Kontos weiter an jeden aus.
      avatar: null,
      figurBemalung: null,
      anonymizedAt: now,
    })
    .where(eq(s.account.id, accountId));

  // Die Bindungen an Google und Apple gehoeren zum Personenbezug — und ohne
  // diese Zeile fuehrte dieselbe Apple-ID beim naechsten Klick zurueck in
  // das geloeschte Konto.
  await db.delete(s.accountIdentity).where(eq(s.accountIdentity.accountId, accountId));

  // Push-Tokens und -Einstellungen: Ein Geraetetoken ist eine Zustelladresse
  // und gehoert zum Personenbezug. Die Kaskade am Fremdschluessel greift
  // hier nicht, weil die Kontozeile beim Anonymisieren stehen bleibt.
  await loescheGeraeteDesKontos(db, accountId);

  await db
    .update(s.session)
    .set({ revokedAt: now })
    .where(and(eq(s.session.accountId, accountId), isNull(s.session.revokedAt)));
}
