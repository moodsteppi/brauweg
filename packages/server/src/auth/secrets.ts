/**
 * Passwoerter und Token.
 *
 * Passwoerter mit argon2id, dem heute empfohlenen Verfahren. Token (Sitzung,
 * Bestaetigungslink, Passwort-Zuruecksetzen) sind Zufallswerte; gespeichert
 * wird nur ihr SHA-256-Hash. Ein Datenbankleck liefert damit keine gueltigen
 * Links und keine uebernehmbaren Sitzungen.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

export async function hashPassword(plain: string): Promise<string> {
  return argonHash(plain);
}

/**
 * Vergleichshash fuer den Fall "Konto gibt es nicht".
 *
 * Ohne ihn kehrt die Pruefung sofort zurueck, waehrend ein echtes Konto rund
 * eine Zehntelsekunde Argon2 kostet. Dieser Unterschied ist ueber das Netz
 * messbar und macht die Anmeldung zum Verzeichnis aller registrierten
 * Adressen. Also wird auch dann gerechnet - nur eben gegen einen Hash, der
 * zu keinem Passwort passt.
 */
let blindHash: Promise<string> | null = null;
function blindvergleich(): Promise<string> {
  blindHash ??= hashPassword(randomBytes(32).toString('base64url'));
  return blindHash;
}

export async function verifyPassword(
  stored: string | null,
  plain: string,
): Promise<boolean> {
  // Anonymisierte Konten haben keinen Hash mehr. Sie duerfen sich nicht
  // anmelden, aber der Aufrufer soll weder am Fehlertyp noch an der Dauer
  // erkennen, ob es das Konto gibt.
  const ziel = stored ?? (await blindvergleich());
  try {
    const passt = await argonVerify(ziel, plain);
    return stored === null ? false : passt;
  } catch {
    return false;
  }
}

/** Zufallstoken fuer Cookie oder Link. Base64url, damit es in eine URL passt. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Vergleich in konstanter Zeit, etwa fuer Einladungscodes. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
