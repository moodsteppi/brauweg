/**
 * Pruefung eines Google-ID-Tokens.
 *
 * Geprueft wird ueber Googles tokeninfo-Endpunkt statt einer eigenen
 * JWT-Bibliothek: Google prueft dort Signatur und Ablauf selbst, und der
 * Server braucht dafuer keine neue Abhaengigkeit und keinen
 * Schluessel-Zwischenspeicher. Der Preis ist ein Netzaufruf je Anmeldung —
 * bei einer Handlung, die pro Sitzung einmal vorkommt, ist das egal.
 *
 * Was NICHT reicht: dem Client zu glauben. Das Token kommt vom Geraet und
 * koennte fuer eine beliebige andere App ausgestellt sein — deshalb ist die
 * `aud`-Pruefung gegen die eigene Client-ID die eigentliche Sicherung.
 */

import { unauthorized } from '../errors.js';
import type { GoogleProfil } from './service.js';

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

interface TokenInfo {
  readonly aud?: string;
  readonly iss?: string;
  readonly sub?: string;
  readonly email?: string;
  /** tokeninfo liefert Booleans als Zeichenketten. */
  readonly email_verified?: string;
  readonly name?: string;
}

export async function pruefeGoogleToken(
  credential: string,
  clientId: string,
): Promise<GoogleProfil> {
  let info: TokenInfo;
  try {
    const antwort = await fetch(
      `${TOKENINFO_URL}?id_token=${encodeURIComponent(credential)}`,
    );
    if (!antwort.ok) throw new Error(`tokeninfo ${antwort.status}`);
    info = (await antwort.json()) as TokenInfo;
  } catch {
    // Abgelaufen, manipuliert oder Google nicht erreichbar — fuer den
    // Anmeldenden ist das alles dasselbe: nicht angemeldet.
    throw unauthorized('credentialsInvalid');
  }

  if (info.aud !== clientId) throw unauthorized('credentialsInvalid');
  if (info.iss !== 'https://accounts.google.com' && info.iss !== 'accounts.google.com') {
    throw unauthorized('credentialsInvalid');
  }
  if (!info.sub || !info.email) throw unauthorized('credentialsInvalid');

  return {
    sub: info.sub,
    email: info.email,
    emailVerified: info.email_verified === 'true',
    name: info.name?.trim() || null,
  };
}
