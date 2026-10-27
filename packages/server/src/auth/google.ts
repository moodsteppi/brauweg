/**
 * Pruefung eines Google-ID-Tokens ("Mit Google anmelden", GIS-Knopf).
 *
 * Geprueft wird die Signatur gegen Googles veroeffentlichte Schluessel
 * (idtoken.ts), dazu Aussteller, Zielgruppe, Ablauf und die Nonce. Bis zum
 * 23.09.2026 lief das ueber den tokeninfo-Endpunkt — Google nennt den selbst
 * ein Werkzeug zur Fehlersuche, und er pruefte keine Nonce.
 *
 * Was NICHT reicht: dem Client zu glauben. Das Token kommt vom Geraet und
 * koennte fuer eine beliebige andere App ausgestellt sein — deshalb ist die
 * `aud`-Pruefung gegen die eigene Client-ID die eigentliche Sicherung.
 */

import { unauthorized } from '../errors.js';
import type { AnbieterProfil } from './anbieter.js';
import { IdTokenFehler, pruefeIdToken, schluesselVonAdresse, wahr, type Schluesselquelle } from './idtoken.js';
import type { NonceSpeicher } from './nonce.js';

export const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
/** Google stellt mit und ohne Schema aus — beides steht so in der Doku. */
export const GOOGLE_AUSSTELLER = ['https://accounts.google.com', 'accounts.google.com'] as const;

let standardQuelle: Schluesselquelle | null = null;
/** Ein Zwischenspeicher je Prozess, erst beim ersten Gebrauch angelegt. */
export function googleSchluessel(): Schluesselquelle {
  standardQuelle ??= schluesselVonAdresse(GOOGLE_JWKS);
  return standardQuelle;
}

export async function pruefeGoogleToken(
  credential: string,
  optionen: {
    clientId: string;
    nonces: NonceSpeicher;
    quelle?: Schluesselquelle;
    jetzt?: () => number;
  },
): Promise<AnbieterProfil> {
  let angaben: Record<string, unknown>;
  try {
    angaben = await pruefeIdToken(credential, {
      quelle: optionen.quelle ?? googleSchluessel(),
      aussteller: GOOGLE_AUSSTELLER,
      zielgruppe: optionen.clientId,
      jetzt: optionen.jetzt,
    });
  } catch (fehler) {
    // Abgelaufen, manipuliert, fremde App — fuer den Anmeldenden ist das alles
    // dasselbe: nicht angemeldet. Der Grund steht nur im Fehlerobjekt.
    if (fehler instanceof IdTokenFehler) throw unauthorized('credentialsInvalid');
    throw fehler;
  }
  // Erst NACH der Signatur: Sonst liessen sich mit erfundenen Tokens fremde
  // Nonces verbrennen.
  if (!optionen.nonces.einloesen(angaben.nonce)) throw unauthorized('nonceUngueltig');

  const email = typeof angaben.email === 'string' ? angaben.email : null;
  const vorname = typeof angaben.given_name === 'string' ? angaben.given_name : null;
  const name = typeof angaben.name === 'string' ? angaben.name : null;
  return {
    anbieter: 'google',
    sub: angaben.sub as string,
    email,
    emailVerified: email !== null && wahr(angaben.email_verified),
    // Google vergibt keine Weiterleitungsadressen.
    relay: false,
    name: vorname?.trim() || name?.trim() || null,
  };
}
