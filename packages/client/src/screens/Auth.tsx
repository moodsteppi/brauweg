import { useEffect, useRef, useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';

type Mode = 'login' | 'register' | 'verify' | 'reset';

/**
 * Google Identity Services — das Skript kommt von accounts.google.com und
 * haengt sein Objekt an window. Nur die zwei benutzten Aufrufe sind getippt.
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (antwort: { credential: string }) => void;
          }): void;
          renderButton(
            ziel: HTMLElement,
            optionen: {
              theme?: string;
              size?: string;
              text?: string;
              width?: number;
              locale?: string;
            },
          ): void;
        };
      };
    };
  }
}

const GSI_SKRIPT = 'https://accounts.google.com/gsi/client';

/**
 * Laedt das GIS-Skript genau einmal. Erst wenn der Server eine Client-ID
 * nennt — ohne Google-Anmeldung laedt die Seite nichts von Google.
 */
function ladeGsiSkript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const vorhanden = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SKRIPT}"]`);
    if (vorhanden) {
      vorhanden.addEventListener('load', () => resolve());
      vorhanden.addEventListener('error', () => reject(new Error('gsi')));
      return;
    }
    const skript = document.createElement('script');
    skript.src = GSI_SKRIPT;
    skript.async = true;
    skript.onload = () => resolve();
    skript.onerror = () => reject(new Error('gsi'));
    document.head.appendChild(skript);
  });
}

/**
 * Holt das Token aus dem, was jemand einfuegt.
 *
 * Die meisten kopieren den ganzen Link aus der Mail, nicht die Zeichenkette
 * dahinter. Beides muss gehen, sonst scheitert die Bestaetigung an etwas,
 * das wie ein Bedienfehler aussieht, aber keiner ist.
 */
function extractToken(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]token=([^&\s]+)/);
  return match ? decodeURIComponent(match[1]!) : trimmed;
}

export function Auth({ onSignedIn }: { onSignedIn: () => void }): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [token, setToken] = useState(
    () => new URLSearchParams(location.search).get('token') ?? '',
  );
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Fehlerschluessel des Servers, um gezielt einen Ausweg anzubieten. */
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const googleZiel = useRef<HTMLDivElement | null>(null);

  /**
   * Google-Knopf, wenn der Server eine Client-ID nennt.
   *
   * Der Knopf wird von der Google-Bibliothek in das leere div gezeichnet —
   * ein selbstgebauter Knopf verstiesse gegen deren Markenrichtlinien und
   * muesste den Einwilligungsdialog trotzdem ueber dieselbe Bibliothek
   * oeffnen. Scheitert irgendetwas (kein Netz zu Google, Werbeblocker),
   * bleibt das div leer und die Passwort-Anmeldung steht unveraendert da.
   */
  useEffect(() => {
    let lebt = true;
    void (async () => {
      try {
        const { clientId } = await api.googleConfig();
        if (!clientId || !lebt) return;
        await ladeGsiSkript();
        if (!lebt || !googleZiel.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            void run(async () => {
              await api.googleLogin(credential);
              onSignedIn();
            });
          },
        });
        window.google.accounts.id.renderButton(googleZiel.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 280,
          locale: 'de',
        });
      } catch {
        /* Ohne Google-Knopf geht die Anmeldung normal weiter. */
      }
    })();
    return () => {
      lebt = false;
    };
    // Genau einmal beim Laden; run/onSignedIn sind stabil genug dafuer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    setErrorCode(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t(err.messageKey));
        setErrorCode(err.code);
      } else {
        setError('Verbindung fehlgeschlagen.');
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = (): void =>
    void run(async () => {
      await api.resendVerification(email);
      setNote(
        'Falls es die Adresse gibt und sie noch nicht bestätigt ist, ist eine neue E-Mail unterwegs.',
      );
    });

  /**
   * Wer den Link aus der Mail oeffnet, hat seine Absicht damit schon erklaert.
   * Also wird sofort bestaetigt, statt ein Formular zu zeigen, in das er das
   * Token noch einmal von Hand eintragen soll.
   */
  const autoRan = useRef(false);
  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get('token');
    if (!fromUrl || autoRan.current) return;
    autoRan.current = true;

    void run(async () => {
      try {
        await api.verify(fromUrl);
        setNote('Adresse bestätigt. Du kannst dich jetzt anmelden.');
        setMode('login');
      } catch (err) {
        // Abgelaufen oder schon benutzt: Formular zeigen, damit ein neuer
        // Link angefordert werden kann.
        setMode('verify');
        throw err;
      } finally {
        // Das Token gehoert nicht in den Verlauf und nicht in ein Lesezeichen.
        history.replaceState(null, '', location.pathname);
      }
    });
    // Genau einmal beim Laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    void run(async () => {
      if (mode === 'login') {
        await api.login(email, password);
        onSignedIn();
        return;
      }
      if (mode === 'register') {
        await api.register({ email, password, displayName, birthday });
        setNote(
          'Wir haben dir eine E-Mail geschickt. Bestätige die Adresse, dann kannst du dich anmelden.',
        );
        setMode('verify');
        return;
      }
      if (mode === 'verify') {
        await api.verify(extractToken(token));
        setNote('Adresse bestätigt. Du kannst dich jetzt anmelden.');
        setMode('login');
        return;
      }
      await api.login(email, password);
      onSignedIn();
    });
  };

  return (
    <main className="auth">
      {/* Der Schriftzug ist gemalt und liegt schon vor - eine <h1> mit
          Systemschrift daneben waere der Bruch, den man hier zuerst sieht.
          Die Ueberschrift bleibt als unsichtbarer Text fuer Vorlesegeraete. */}
      <h1 className="auth-marke">
        <img src="/hub/logo.png" alt="Brauweg" draggable={false} />
      </h1>
      <p className="auth-spruch">Spielt nach euren Regeln.</p>

      <form className="panel" onSubmit={submit}>
        {mode === 'register' && (
          <>
            <label>
              Anzeigename
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                minLength={2}
                required
              />
            </label>
            <label>
              Geburtstag
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                required
                max={new Date().toISOString().slice(0, 10)}
              />
              <span className="muted">Mindestens 16 Jahre. Für Countdown und Belohnung.</span>
            </label>
          </>
        )}

        {mode === 'verify' ? (
          <>
            <label>
              Bestätigungslink oder Code aus der E-Mail
              <input value={token} onChange={(e) => setToken(e.target.value)} required />
              <span className="muted">Der ganze Link geht auch.</span>
            </label>
            {/* Mails landen im Spam, werden geloescht, und der Link laeuft nach
                48 Stunden ab. Ohne diesen Knopf braeuchte es dafuer den
                Betreiber. */}
            <button type="button" onClick={resend} disabled={busy || !email}>
              Neuen Link anfordern
            </button>
          </>
        ) : (
          <>
            <label>
              E-Mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Passwort
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'register' ? 12 : 1}
                required
              />
              {mode === 'register' && (
                <span className="muted">Mindestens zwölf Zeichen.</span>
              )}
            </label>
          </>
        )}

        {note && <p className="muted">{note}</p>}
        {error && <p className="error">{error}</p>}

        {/*
          Der Ausweg gehoert genau dorthin, wo man haengenbleibt.
          "Adresse schon vergeben" trifft, wer sich erneut registriert, weil er
          seinen Link verloren hat. "Bestaetige zuerst deine Adresse" trifft
          denselben Fall beim Anmelden. In beiden Faellen ist ein neuer Link
          die Antwort - ihn hinter der Registrierung zu verstecken, hiesse den
          Betreiber zu brauchen.
        */}
        {(errorCode === 'emailTaken' || errorCode === 'emailNotVerified') && (
          <div style={{ marginBottom: '0.75rem' }}>
            <button type="button" onClick={resend} disabled={busy || !email}>
              Neuen Bestätigungslink anfordern
            </button>
          </div>
        )}

        <div className="row">
          <button className="primary" type="submit" disabled={busy}>
            {mode === 'register' ? 'Konto anlegen' : mode === 'verify' ? 'Bestätigen' : 'Anmelden'}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNote(null);
              setMode(mode === 'register' ? 'login' : 'register');
            }}
          >
            {mode === 'register' ? 'Ich habe schon ein Konto' : 'Konto anlegen'}
          </button>
        </div>
        {/* Bleibt unsichtbar leer, solange der Server keine Client-ID nennt
            oder Google nicht erreichbar ist. */}
        {mode !== 'verify' && (
          <div className="auth-google" ref={googleZiel} aria-label="Mit Google anmelden" />
        )}
      </form>

      {/* Impressum und Datenschutz muessen erreichbar sein, ohne dass man ein
          Konto hat - sonst haette gerade der sie nicht, der vor der
          Registrierung wissen will, wem er seine Adresse gibt. */}
      <Rechtliches />
    </main>
  );
}

/**
 * Rechtliche Adressen.
 *
 * Bewusst echte Dateien statt eines Blattes in der App: App Store Connect
 * verlangt eine aufrufbare Datenschutz-Adresse, und ein Impressum, das man
 * nur im angemeldeten Zustand findet, erfuellt die Pflicht nicht.
 */
export function Rechtliches(): React.JSX.Element {
  return (
    <p className="rechtliches">
      <a href="/rechtliches/impressum.html" target="_blank" rel="noreferrer">
        Impressum
      </a>
      <span aria-hidden="true"> · </span>
      <a href="/rechtliches/datenschutz.html" target="_blank" rel="noreferrer">
        Datenschutz
      </a>
    </p>
  );
}
