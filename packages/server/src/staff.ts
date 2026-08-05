/**
 * Testkonten setzen.
 *
 * Die Liste steht in der Umgebungsvariablen `STAFF_EMAILS` (Adressen mit
 * Komma getrennt) und wird bei jedem Start angewandt. Sie ist die einzige
 * Wahrheit: Wer daraufsteht, ist Testkonto, wer heruntergenommen wird,
 * verliert es beim naechsten Start wieder.
 *
 * Bewusst kein Endpunkt und keine Oberflaeche dafuer. Ein Weg, sich aus der
 * laufenden Anwendung heraus Rechte zu geben, ist der lohnendste
 * Angriffspunkt einer App - und gebraucht wird er nicht: Auf staging steht
 * die Variable am Dienst, in der Produktion enthaelt sie hoechstens das
 * Demokonto fuer die App-Store-Pruefung.
 */

import { eq, inArray, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';

/** Zerlegt die Umgebungsvariable. Leere Eintraege und Gross-/Kleinschreibung
    werden dabei geglaettet, damit ein Tippfehler nicht still wirkungslos ist. */
export function parseStaffEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((teil) => teil.trim().toLowerCase())
        .filter((teil) => teil.length > 0),
    ),
  ];
}

export interface StaffResult {
  /** Konten, die jetzt Testkonto sind. */
  readonly gesetzt: string[];
  /** Konten, denen das Merkmal genommen wurde. */
  readonly entzogen: string[];
  /** Adressen aus der Liste, zu denen es (noch) kein Konto gibt. */
  readonly unbekannt: string[];
  /**
   * Adressen mit Konto, aber ohne bestaetigte E-Mail. Sie bekommen das
   * Merkmal NICHT - sonst genuegte es, sich mit einer Adresse aus der Liste
   * zu registrieren, um beim naechsten Start alle Rechte zu haben. Wer die
   * Adresse wirklich besitzt, kommt an den Bestaetigungslink und danach an
   * das Merkmal.
   */
  readonly unbestaetigt: string[];
}

/**
 * Gleicht die Testkonten mit der Liste ab.
 *
 * Idempotent: Zweimal aufgerufen aendert sich beim zweiten Mal nichts.
 */
export async function applyStaffEmails(
  db: Db,
  emails: readonly string[],
): Promise<StaffResult> {
  // Ohne Liste wird nichts gesetzt - aber vorhandene Testkonten verlieren das
  // Merkmal. Sonst bliebe ein einmal gesetztes Konto fuer immer eines, auch
  // wenn niemand mehr weiss, warum.
  const treffer =
    emails.length === 0
      ? []
      : await db
          .select({
            id: s.account.id,
            email: s.account.email,
            verifiziert: s.account.emailVerifiedAt,
          })
          .from(s.account)
          .where(inArray(sql`lower(${s.account.email})`, emails));

  // Nur bestaetigte Adressen. Ohne diese Bedingung genuegte es, sich mit einer
  // Adresse aus der Liste zu registrieren, um beim naechsten Start alle Rechte
  // zu haben - ohne je Zugriff auf das Postfach gehabt zu haben.
  const berechtigt = treffer.filter((zeile) => zeile.verifiziert !== null);

  const ids = berechtigt.map((zeile) => zeile.id);
  const gefunden = new Set(berechtigt.map((zeile) => (zeile.email ?? '').toLowerCase()));
  const offen = treffer
    .filter((zeile) => zeile.verifiziert === null)
    .map((zeile) => (zeile.email ?? '?').toLowerCase());

  const entzogen = await db
    .update(s.account)
    .set({ isStaff: false })
    .where(
      ids.length === 0
        ? eq(s.account.isStaff, true)
        : sql`${s.account.isStaff} = true and ${s.account.id} not in ${ids}`,
    )
    .returning({ email: s.account.email });

  if (ids.length > 0) {
    await db.update(s.account).set({ isStaff: true }).where(inArray(s.account.id, ids));
  }

  return {
    gesetzt: [...gefunden],
    entzogen: entzogen.map((zeile) => zeile.email ?? '?'),
    // Kein Konto ist etwas anderes als ein unbestaetigtes Konto: Im ersten
    // Fall muss sich jemand noch registrieren, im zweiten nur auf den Link im
    // Postfach tippen. Wer beides gleich meldet, sucht an der falschen Stelle.
    unbekannt: emails.filter(
      (adresse) => !gefunden.has(adresse) && !offen.includes(adresse),
    ),
    unbestaetigt: offen,
  };
}
