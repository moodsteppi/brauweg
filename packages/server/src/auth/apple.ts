/**
 * Pruefung eines Apple-ID-Tokens ("Mit Apple anmelden" im Web).
 *
 * Der Client holt das Token ueber Apples JS-SDK im Popup-Modus
 * (`usePopup: true`); zurueck kommen `authorization.id_token` und
 * `authorization.code`. Hier wird NUR das ID-Token geprueft.
 *
 * Warum der Code nicht eingeloest wird: Die Einloesung bei
 * `appleid.apple.com/auth/token` braucht ein client_secret — ein JWT, das mit
 * einem privaten Schluessel aus dem Apple-Entwicklerkonto signiert und
 * spaetestens alle sechs Monate erneuert werden muss. Sie liefert ein
 * Refresh-Token und ein Access-Token; beides braucht nur, wer spaeter im
 * Namen der Person bei Apple nachfragen will. Das tun wir nicht: Die
 * Anmeldung braucht genau das, was im ID-Token steht (`sub`, `email`), und
 * dessen Echtheit belegt Apples Signatur allein. Ein Schluessel, den es nicht
 * gibt, kann nicht auslaufen und nicht durchsickern.
 *
 * Eine Folge, die man kennen muss: Ohne Refresh-Token koennen wir ein
 * Apple-Konto nicht bei Apple "abmelden" (Token-Widerruf). Trennt jemand
 * Apple hier in den Einstellungen, bleibt Brauweg in seiner Apple-ID-Liste
 * stehen, bis er es dort selbst entfernt.
 */

import { unauthorized } from '../errors.js';
import type { AnbieterProfil } from './anbieter.js';
import { IdTokenFehler, pruefeIdToken, schluesselVonAdresse, wahr, type Schluesselquelle } from './idtoken.js';
import type { NonceSpeicher } from './nonce.js';

export const APPLE_JWKS = 'https://appleid.apple.com/auth/keys';
export const APPLE_AUSSTELLER = ['https://appleid.apple.com'] as const;
/** Domain der Weiterleitungsadressen bei "E-Mail-Adresse verbergen". */
export const APPLE_RELAY_DOMAIN = 'privaterelay.appleid.com';

let standardQuelle: Schluesselquelle | null = null;
export function appleSchluessel(): Schluesselquelle {
  standardQuelle ??= schluesselVonAdresse(APPLE_JWKS);
  return standardQuelle;
}

export function istRelayAdresse(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${APPLE_RELAY_DOMAIN}`);
}

export async function pruefeAppleToken(
  idToken: string,
  optionen: {
    /** Die Services ID — bei Apple im Web ist sie die `aud`. */
    clientId: string;
    nonces: NonceSpeicher;
    /**
     * Vorname aus dem Antwortobjekt des SDK. Apple liefert den Namen NUR beim
     * allerersten Anmelden und nie im Token — wer ihn da nicht nimmt,
     * bekommt ihn nie wieder. Er ist unsigniert und wird deshalb ausschliesslich
     * als Vorschlag fuer den Anzeigenamen eines NEUEN Kontos benutzt.
     */
    vorname?: string | null;
    quelle?: Schluesselquelle;
    jetzt?: () => number;
  },
): Promise<AnbieterProfil> {
  let angaben: Record<string, unknown>;
  try {
    angaben = await pruefeIdToken(idToken, {
      quelle: optionen.quelle ?? appleSchluessel(),
      aussteller: APPLE_AUSSTELLER,
      zielgruppe: optionen.clientId,
      jetzt: optionen.jetzt,
    });
  } catch (fehler) {
    if (fehler instanceof IdTokenFehler) throw unauthorized('credentialsInvalid');
    throw fehler;
  }
  if (!optionen.nonces.einloesen(angaben.nonce)) throw unauthorized('nonceUngueltig');

  const email = typeof angaben.email === 'string' ? angaben.email : null;
  const relay = email !== null && (wahr(angaben.is_private_email) || istRelayAdresse(email));
  return {
    anbieter: 'apple',
    sub: angaben.sub as string,
    email,
    // Apple bestaetigt jede Adresse, die es herausgibt — auch die
    // Weiterleitungsadresse, die ja zustellbar ist. Das Feld wird trotzdem
    // gelesen statt angenommen.
    emailVerified: email !== null && wahr(angaben.email_verified),
    relay,
    name: optionen.vorname?.trim() || null,
  };
}
