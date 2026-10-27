/**
 * „Mit Apple anmelden" in der iOS-App: die Absprache mit der Huelle.
 *
 * Im Web oeffnet Apples JS-SDK ein Popup (anbieter.ts). Im WKWebView kommt
 * das nicht zuverlaessig zurueck, und Apple verlangt in Apps ohnehin den
 * Systemdialog — den oeffnet die Huelle (apps/ios/Brauweg/AppleAnmeldung.swift).
 * Was danach kommt, ist derselbe Weg wie im Web: Das ID-Token geht an
 * `/api/auth/apple`, der Server prueft es (aud = Bundle-ID statt Services ID).
 *
 * **Huelle → Client, im Vorspann:** `window.BRAUWEG_APP.apple === true`.
 * Aeltere Builds ohne den nativen Dialog lassen es weg — dann gibt es in der
 * App keinen Apple-Knopf, wie bisher.
 *
 * **Client → Huelle:** `window.BrauwegNativ.appleAnmelden(nonce)` mit der
 * Nonce des Servers (`POST /api/auth/nonce`), ungehasht.
 *
 * **Huelle → Client:** ein Ereignis, `detail` ist entweder
 * `{ idToken, vorname }` oder `{ fehler: 'abgebrochen' | 'fehlgeschlagen' }`
 * (Huelle.appleSkript). Wer hier etwas aendert, aendert es dort mit.
 */

// `BrauwegNativ.appleAnmelden` ist mit den anderen Handgriffen der Huelle
// in push/bruecke.ts getippt — TypeScript erlaubt das Feld nur einmal. Kein
// Import von dort: Diese Datei liegt im Sofort-Paket des Auth-Bildschirms.

export const APPLE_EREIGNIS = 'brauweg:apple-anmeldung';

export interface AppleNativToken {
  readonly idToken: string;
  /** Nur beim allerersten Anmelden — danach nie wieder (server/src/auth/apple.ts). */
  readonly vorname: string | null;
}

export type AppleNativAntwort = AppleNativToken | 'abgebrochen' | 'fehlgeschlagen';

/** Prueft, was die Huelle meldet — sie ist eine Grenze wie das Netz. */
export function leseAppleAntwort(wert: unknown): AppleNativAntwort {
  if (typeof wert !== 'object' || wert === null) return 'fehlgeschlagen';
  const { idToken, vorname, fehler } = wert as { idToken?: unknown; vorname?: unknown; fehler?: unknown };
  if (fehler === 'abgebrochen') return 'abgebrochen';
  if (typeof idToken !== 'string' || idToken.length === 0 || idToken.length > 8192) return 'fehlgeschlagen';
  const name = typeof vorname === 'string' ? vorname.trim().slice(0, 60) : '';
  return { idToken, vorname: name || null };
}

/** Kann diese Huelle den Systemdialog oeffnen? */
export function kannAppleNativ(ziel: Window = window): boolean {
  return ziel.BRAUWEG_APP?.apple === true && typeof ziel.BrauwegNativ?.appleAnmelden === 'function';
}

/**
 * Oeffnet den Systemdialog und wartet auf die Antwort.
 *
 * `null`: abgebrochen — kein Fehler, nur kein Ergebnis. Ein echter Fehlschlag
 * wirft, damit er dort angezeigt wird, wo jede andere Anmeldemeldung steht.
 * Bewusst ohne Zeitlimit: Der Dialog darf offen bleiben, solange die Person
 * ueberlegt, und die Huelle antwortet in jedem Fall (auch beim Wegwischen).
 */
export function appleNativAnmelden(nonce: string, ziel: Window = window): Promise<AppleNativToken | null> {
  return new Promise((resolve, reject) => {
    const hoeren = (ereignis: Event): void => {
      ziel.removeEventListener(APPLE_EREIGNIS, hoeren);
      const antwort = leseAppleAntwort((ereignis as CustomEvent<unknown>).detail);
      if (antwort === 'abgebrochen') resolve(null);
      else if (antwort === 'fehlgeschlagen') reject(new Error('appleNativFehlgeschlagen'));
      else resolve(antwort);
    };
    ziel.addEventListener(APPLE_EREIGNIS, hoeren);
    try {
      ziel.BrauwegNativ!.appleAnmelden!(nonce);
    } catch (fehler) {
      ziel.removeEventListener(APPLE_EREIGNIS, hoeren);
      reject(fehler instanceof Error ? fehler : new Error(String(fehler)));
    }
  });
}
