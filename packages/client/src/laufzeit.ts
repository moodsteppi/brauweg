/**
 * Wo der Client gerade laeuft.
 *
 * Im Browser liegt alles unter derselben Herkunft: Der Server liefert den
 * gebauten Client selbst aus, `/api` und `/ws` treffen denselben Ursprung,
 * und das Sitzungs-Cookie kommt von allein mit. Daran aendert sich hier
 * nichts — alles unten faellt im Browser auf genau das bisherige Verhalten
 * zurueck.
 *
 * In der iOS-Huelle liegt der Client im App-Paket und wird unter
 * `brauweg://app` ausgeliefert, der Server steht im Netz. Das sind zwei
 * Herkuenfte, und WebKit gibt einer fremden Herkunft weder das Cookie noch
 * dem WebSocket eines mit. Die App traegt ihr Sitzungstoken deshalb selbst:
 * im `Authorization`-Kopf, am WebSocket als Unterprotokoll hinter der Marke
 * `brauweg-token`.
 *
 * Die Huelle legt `window.BRAUWEG_APP` an, bevor die erste Zeile des Clients
 * laeuft. Fehlt es, ist dies ein Browser.
 */

declare global {
  interface Window {
    BRAUWEG_APP?: {
      /** Basisadresse des Servers, z.B. https://www.brauweg-spielen.de */
      apiBase: string;
    };
  }
}

const huelle = typeof window === 'undefined' ? undefined : window.BRAUWEG_APP;

/** Laeuft der Client in der nativen Huelle? */
export const inApp = huelle !== undefined;

/** Vorsatz aller API-Aufrufe. Im Browser leer, also dieselbe Herkunft. */
export const apiBase = (huelle?.apiBase ?? '').replace(/\/+$/, '');

/**
 * Marke, hinter der das Token als Unterprotokoll mitgeht. Muss zu
 * `TOKEN_PROTOKOLL` im Server passen.
 */
const TOKEN_PROTOKOLL = 'brauweg-token';

const TOKEN_SCHLUESSEL = 'brauweg.sitzung';

/**
 * Das Sitzungstoken der App, oder null.
 *
 * Nur in der Huelle. Im Browser gibt es hier bewusst nichts zu holen: Die
 * Sitzung liegt dort im HttpOnly-Cookie, wo kein Skript sie erreicht.
 */
export function sessionToken(): string | null {
  if (!inApp) return null;
  return localStorage.getItem(TOKEN_SCHLUESSEL);
}

export function setSessionToken(token: string | null): void {
  if (!inApp) return;
  if (token) localStorage.setItem(TOKEN_SCHLUESSEL, token);
  else localStorage.removeItem(TOKEN_SCHLUESSEL);
}

/** Adresse des WebSockets. */
export function wsUrl(): string {
  if (!apiBase) {
    const schema = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${schema}://${location.host}/ws`;
  }
  return `${apiBase.replace(/^http/, 'ws')}/ws`;
}

/**
 * Unterprotokolle des Handshakes.
 *
 * Leer im Browser — dort traegt das Cookie die Sitzung, und ein Client, der
 * ein Unterprotokoll anbietet, das der Server nicht bestaetigt, bricht die
 * Verbindung selbst ab.
 */
export function wsProtokolle(): string[] {
  const token = sessionToken();
  return token ? [TOKEN_PROTOKOLL, token] : [];
}
