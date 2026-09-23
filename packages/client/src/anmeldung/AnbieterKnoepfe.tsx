import { useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { inApp } from '../laufzeit';
import { ladeAnbieterConfig, ladeApple, ladeGoogle, type Anbieter, type AnbieterConfig } from './anbieter';

/**
 * Die Knoepfe "Mit Apple anmelden" und "Mit Google anmelden".
 *
 * Einmal gebaut, zweimal benutzt: auf dem Auth-Bildschirm zum Anmelden, in den
 * Einstellungen zum Verknuepfen (fuer einen Gast zugleich das Sichern). Was
 * sich unterscheidet, ist nur, wohin das gepruefte Token geht.
 *
 * Ein Knopf erscheint nur, wenn der Server fuer seinen Anbieter eine Client-ID
 * nennt. Scheitert das Nachladen (kein Netz zum Anbieter, Werbeblocker), bleibt
 * er weg bzw. gesperrt — die Passwort-Anmeldung daneben steht unveraendert.
 *
 * **In der iOS-Huelle gibt es beide nicht.** Google lehnt eingebettete
 * WebViews ab ("disallowed_useragent"), und Apples Web-Popup kommt dort nicht
 * zuverlaessig zum oeffnenden Fenster zurueck. Wer das in der App will, braucht
 * die nativen Wege — und dann gilt App-Store-Regel 4.8: Wer Google anbietet,
 * muss Apple mit anbieten.
 *
 * **Markenrichtlinien:** Googles Knopf zeichnet Googles Bibliothek selbst —
 * ein nachgebauter muesste Logo, Abstaende und Schrift genau treffen und den
 * Dialog trotzdem ueber dieselbe Bibliothek oeffnen. Apples Knopf ist nach
 * den Human Interface Guidelines gebaut: schwarz, weisses Apple-Logo links,
 * "Mit Apple anmelden", gleich hoch und gleich breit wie Googles Knopf, damit
 * keiner der beiden als Nebenweg aussieht.
 */

/** Eine frische Nonce alle zehn Minuten — der Server laesst sie fuenfzehn gelten. */
const NONCE_ERNEUERN_MS = 10 * 60_000;
/** Breite beider Knoepfe; Googles Bibliothek nimmt sie in Pixeln. */
const BREITE = 280;

export interface AnbieterErgebnis {
  anbieter: Anbieter;
  /** Nur beim Anmelden: ein neues Konto ist entstanden. */
  neu?: boolean;
  /** Nur beim Verknuepfen: aus dem Gast wurde ein richtiges Konto. */
  gesichert?: boolean;
}

export function AnbieterKnoepfe({
  zweck,
  nur,
  gesperrt = false,
  onErfolg,
  onFehler,
}: {
  zweck: 'anmelden' | 'verknuepfen';
  /** Nur diese Anbieter zeigen — in den Einstellungen die noch nicht verknuepften. */
  nur?: readonly Anbieter[];
  gesperrt?: boolean;
  onErfolg: (ergebnis: AnbieterErgebnis) => void;
  /** Ein Fehler des Servers oder der Verbindung. Abbrechen im Popup ist keiner. */
  onFehler: (fehler: unknown) => void;
}): React.JSX.Element | null {
  const [config, setConfig] = useState<AnbieterConfig | null>(null);
  const [appleBereit, setAppleBereit] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const googleZiel = useRef<HTMLDivElement | null>(null);

  // Die Rueckrufe aendern sich mit jedem Rendern des Elternteils. Die
  // Anbieter-Bibliotheken halten aber die Funktion fest, die sie beim
  // Einrichten bekommen haben — also ueber einen Verweis immer die aktuelle.
  const rueckruf = useRef({ onErfolg, onFehler });
  rueckruf.current = { onErfolg, onFehler };

  const zeigeGoogle = Boolean(config?.google) && (!nur || nur.includes('google'));
  const zeigeApple = Boolean(config?.apple) && (!nur || nur.includes('apple'));

  useEffect(() => {
    if (inApp) return;
    let lebt = true;
    void ladeAnbieterConfig().then((c) => {
      if (lebt) setConfig(c);
    });
    return () => {
      lebt = false;
    };
  }, []);

  // --- Google ---------------------------------------------------------------
  useEffect(() => {
    const clientId = config?.google?.clientId;
    if (!clientId || !zeigeGoogle) return;
    let lebt = true;

    /**
     * Einrichten mit frischer Nonce und den Knopf neu zeichnen. GIS kennt nur
     * EINE Einrichtung je Seite — ein zweites `initialize` ersetzt die erste,
     * und der Knopf muss danach neu gezeichnet werden, sonst traegt er noch
     * die verbrauchte Nonce.
     */
    const einrichten = async (): Promise<void> => {
      try {
        const [gis, { nonce }] = await Promise.all([ladeGoogle(), api.anbieterNonce()]);
        if (!lebt || !googleZiel.current) return;
        gis.accounts.id.initialize({
          client_id: clientId,
          nonce,
          ux_mode: 'popup',
          auto_select: false,
          callback: ({ credential }) => {
            void (async () => {
              setLaeuft(true);
              try {
                if (zweck === 'anmelden') {
                  const antwort = await api.googleLogin(credential);
                  rueckruf.current.onErfolg({ anbieter: 'google', neu: antwort.neu });
                } else {
                  const antwort = await api.verknuepfeGoogle(credential);
                  rueckruf.current.onErfolg({ anbieter: 'google', gesichert: antwort.gesichert });
                }
              } catch (fehler) {
                rueckruf.current.onFehler(fehler);
              } finally {
                if (lebt) setLaeuft(false);
                // Die Nonce ist verbraucht, so oder so.
                if (lebt) void einrichten();
              }
            })();
          },
        });
        googleZiel.current.replaceChildren();
        gis.accounts.id.renderButton(googleZiel.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          logo_alignment: 'left',
          text: zweck === 'anmelden' ? 'signin_with' : 'continue_with',
          width: BREITE,
          locale: 'de',
        });
      } catch {
        /* Ohne Google-Knopf geht die Anmeldung normal weiter. */
      }
    };

    void einrichten();
    const erneuern = window.setInterval(() => void einrichten(), NONCE_ERNEUERN_MS);
    return () => {
      lebt = false;
      window.clearInterval(erneuern);
    };
  }, [config?.google?.clientId, zeigeGoogle, zweck]);

  // --- Apple ----------------------------------------------------------------
  const appleEinrichten = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    const apple = config?.apple;
    if (!apple || !zeigeApple) return;
    let lebt = true;

    const einrichten = async (): Promise<void> => {
      setAppleBereit(false);
      try {
        const [sdk, { nonce }] = await Promise.all([ladeApple(), api.anbieterNonce()]);
        if (!lebt) return;
        sdk.auth.init({
          clientId: apple.clientId,
          scope: 'name email',
          redirectURI: apple.redirectUri,
          nonce,
          usePopup: true,
        });
        setAppleBereit(true);
      } catch {
        /* Knopf bleibt gesperrt; die Passwort-Anmeldung geht weiter. */
      }
    };
    appleEinrichten.current = einrichten;

    void einrichten();
    const erneuern = window.setInterval(() => void einrichten(), NONCE_ERNEUERN_MS);
    return () => {
      lebt = false;
      appleEinrichten.current = null;
      window.clearInterval(erneuern);
    };
  }, [config?.apple?.clientId, config?.apple?.redirectUri, zeigeApple]);

  const mitApple = (): void => {
    const sdk = window.AppleID;
    if (!sdk || !appleBereit) return;
    // `signIn()` SOFORT im Klick aufrufen, vor jedem await — sonst blockiert
    // der Browser das Popup (siehe anbieter.ts).
    const dialog = sdk.auth.signIn();
    setLaeuft(true);
    void (async () => {
      try {
        const antwort = await dialog.catch((fehler: { error?: string }) => {
          // Fenster zugemacht oder abgebrochen: kein Fehler, nur kein Ergebnis.
          if (fehler?.error === 'popup_closed_by_user' || fehler?.error === 'user_cancelled_authorize') {
            return null;
          }
          throw fehler;
        });
        if (!antwort) return;
        const idToken = antwort.authorization.id_token;
        if (zweck === 'anmelden') {
          const ergebnis = await api.appleLogin(idToken, antwort.user?.name?.firstName);
          rueckruf.current.onErfolg({ anbieter: 'apple', neu: ergebnis.neu });
        } else {
          const ergebnis = await api.verknuepfeApple(idToken);
          rueckruf.current.onErfolg({ anbieter: 'apple', gesichert: ergebnis.gesichert });
        }
      } catch (fehler) {
        rueckruf.current.onFehler(fehler);
      } finally {
        setLaeuft(false);
        // Auch ein abgebrochener Dialog kann die Nonce schon verbraucht haben.
        void appleEinrichten.current?.();
      }
    })();
  };

  if (!zeigeGoogle && !zeigeApple) return null;

  return (
    <div className="anbieter-knoepfe">
      {zeigeApple && (
        <button
          type="button"
          className="anbieter-apple"
          style={{ width: BREITE }}
          onClick={mitApple}
          disabled={!appleBereit || laeuft || gesperrt}
        >
          <svg className="anbieter-apple-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={APPLE_LOGO} fill="currentColor" />
          </svg>
          <span>{zweck === 'anmelden' ? 'Mit Apple anmelden' : 'Weiter mit Apple'}</span>
        </button>
      )}
      {zeigeGoogle && (
        <div
          className="anbieter-google"
          ref={googleZiel}
          data-anbieter="google"
          aria-label={zweck === 'anmelden' ? 'Mit Google anmelden' : 'Weiter mit Google'}
          aria-disabled={laeuft || gesperrt}
        />
      )}
    </div>
  );
}

/**
 * Die Apple-Glyphe als Pfad (dieselbe Form, die Simple Icons fuehrt, im
 * Rahmen 24 x 24). Inline statt als Datei: Ein Logo, das nachlaedt, fehlt beim
 * ersten Zeichnen, und ein Knopf ohne Logo verstoesst gegen die Richtlinien.
 * Die Farbe kommt aus `currentColor` — auf dem schwarzen Knopf bleibt es weiss,
 * ohne zweite Fassung. Wer die Vektordatei aus Apples Vorlagen
 * (developer.apple.com/design/resources, "Sign in with Apple") einsetzen will,
 * tauscht nur diese Zeichenkette und den viewBox-Rahmen oben.
 */
const APPLE_LOGO =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
