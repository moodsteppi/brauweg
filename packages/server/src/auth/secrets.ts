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

export async function verifyPassword(
  stored: string | null,
  plain: string,
): Promise<boolean> {
  // Anonymisierte Konten haben keinen Hash mehr. Sie duerfen sich nicht
  // anmelden, aber der Aufrufer soll nicht am Fehlertyp erkennen, ob es das
  // Konto gibt.
  if (!stored) return false;
  try {
    return await argonVerify(stored, plain);
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
