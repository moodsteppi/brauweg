/**
 * Die Skripte von Google und Apple — nachgeladen, nie im Paket.
 *
 * Der Auth-Bildschirm liegt im Sofort-Paket (App.pakete.test.ts), also darf
 * hier nichts stehen, was ein Besucher ohne Anbieter-Anmeldung mitladen
 * muesste. Beide Bibliotheken kommen deshalb erst, wenn der Server fuer den
 * jeweiligen Anbieter eine Client-ID nennt — ohne Einrichtung laedt die Seite
 * nichts von Google und nichts von Apple.
 *
 * Nachgeladen wird beim OEFFNEN des Auth-Bildschirms, nicht erst beim Klick:
 * Apples `signIn()` oeffnet ein Popup, und ein Popup, das erst nach einem
 * Netzabruf aufgeht, zaehlt fuer den Browser nicht mehr als Folge des Klicks —
 * er blockiert es. Googles Knopf zeichnet die Bibliothek selbst, sie muss also
 * da sein, bevor es ueberhaupt etwas zu klicken gibt.
 */

import { api } from '../api';

export type Anbieter = 'google' | 'apple';

/** Google Identity Services — nur die benutzten Aufrufe sind getippt. */
export interface GoogleGis {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (antwort: { credential: string }) => void;
        nonce?: string;
        ux_mode?: 'popup' | 'redirect';
        auto_select?: boolean;
        itp_support?: boolean;
      }): void;
      renderButton(
        ziel: HTMLElement,
        optionen: {
          type?: 'standard' | 'icon';
          theme?: 'outline' | 'filled_blue' | 'filled_black';
          size?: 'large' | 'medium' | 'small';
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
          shape?: 'rectangular' | 'pill' | 'circle' | 'square';
          logo_alignment?: 'left' | 'center';
          width?: number;
          locale?: string;
        },
      ): void;
    };
  };
}

/** Apples JS-SDK (Sign in with Apple) — nur die benutzten Aufrufe. */
export interface AppleSdk {
  auth: {
    init(config: {
      clientId: string;
      scope: string;
      redirectURI: string;
      state?: string;
      nonce?: string;
      usePopup: boolean;
    }): void;
    signIn(): Promise<{
      authorization: { id_token: string; code: string; state?: string };
      /** Nur beim allerersten Anmelden — danach nie wieder. */
      user?: { email?: string; name?: { firstName?: string; lastName?: string } };
    }>;
  };
}

declare global {
  interface Window {
    google?: GoogleGis;
    AppleID?: AppleSdk;
  }
}

export const GSI_SKRIPT = 'https://accounts.google.com/gsi/client';
/**
 * Deutsche Fassung des SDK. Der Pfad steht so in der Inhaltsrichtlinie des
 * Servers (app.ts, script-src) — wer ihn aendert, aendert beide.
 */
export const APPLE_SKRIPT =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/de_DE/appleid.auth.js';

const geladen = new Map<string, Promise<void>>();

/** Laedt ein Skript genau einmal; ein Fehlschlag darf beim naechsten Mal neu versuchen. */
function ladeSkript(adresse: string, fertig: () => boolean): Promise<void> {
  if (fertig()) return Promise.resolve();
  const laufend = geladen.get(adresse);
  if (laufend) return laufend;
  const versprechen = new Promise<void>((resolve, reject) => {
    const skript = document.createElement('script');
    skript.src = adresse;
    skript.async = true;
    skript.onload = () => (fertig() ? resolve() : reject(new Error(`${adresse} ohne Inhalt`)));
    skript.onerror = () => {
      geladen.delete(adresse);
      skript.remove();
      reject(new Error(`${adresse} nicht erreichbar`));
    };
    document.head.appendChild(skript);
  });
  geladen.set(adresse, versprechen);
  return versprechen;
}

export function ladeGoogle(): Promise<GoogleGis> {
  return ladeSkript(GSI_SKRIPT, () => Boolean(window.google?.accounts?.id)).then(
    () => window.google!,
  );
}

export function ladeApple(): Promise<AppleSdk> {
  return ladeSkript(APPLE_SKRIPT, () => Boolean(window.AppleID?.auth)).then(
    () => window.AppleID!,
  );
}

export interface AnbieterConfig {
  google: { clientId: string } | null;
  apple: { clientId: string; redirectUri: string } | null;
}

let config: Promise<AnbieterConfig> | null = null;

/**
 * Was diese Ausgabe anbietet — einmal je Seitenaufruf gefragt. Faellt die
 * Frage aus, gilt "nichts": Die Passwort-Anmeldung steht dann unveraendert da,
 * und beim naechsten Aufruf wird neu gefragt.
 */
export function ladeAnbieterConfig(): Promise<AnbieterConfig> {
  config ??= Promise.all([
    api.googleConfig().catch(() => ({ clientId: null })),
    api.appleConfig().catch(() => ({ clientId: null, redirectUri: null })),
  ]).then(([g, a]) => {
    const ergebnis: AnbieterConfig = {
      google: g.clientId ? { clientId: g.clientId } : null,
      apple: a.clientId && a.redirectUri ? { clientId: a.clientId, redirectUri: a.redirectUri } : null,
    };
    if (!ergebnis.google && !ergebnis.apple) config = null;
    return ergebnis;
  });
  return config;
}

/** Nur fuer Tests: den Zwischenspeicher vergessen. */
export function vergissAnbieterConfig(): void {
  config = null;
}
