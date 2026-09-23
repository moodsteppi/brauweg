import { useEffect, useRef, useState } from 'react';

import { AnbieterKnoepfe } from '../anmeldung/AnbieterKnoepfe';
import { ApiError, api } from '../api';
import { t } from '../i18n';
import { inApp } from '../laufzeit';

type Mode = 'login' | 'register' | 'verify' | 'reset' | 'gast';

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
      const antwort = await api.resendVerification(email);
      setNote(
        antwort.mailVersand === 'log'
          ? 'Der Mailversand ist gerade nicht eingerichtet — es geht keine Mail hinaus. Melde dich bitte bei uns.'
          : 'Falls es die Adresse gibt und sie noch nicht bestätigt ist, ist eine neue E-Mail unterwegs.',
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
      if (mode === 'gast') {
        // Kein Passwort, keine Bestaetigung noetig - der Name allein reicht,
        // um sofort am Tisch zu sitzen.
        await api.gastLogin(displayName);
        onSignedIn();
        return;
      }
      if (mode === 'login') {
        await api.login(email, password);
        onSignedIn();
        return;
      }
      if (mode === 'register') {
        const antwort = await api.register({ email, password, displayName, birthday });
        // Kein Versanddienst: Der Server verlangt dann keine Bestaetigung und
        // meldet gleich an. Auf eine Mail zu warten, die nie kommt, waere die
        // Sackgasse, in der Robin am 23.09.2026 stand.
        if (antwort.angemeldet) {
          onSignedIn();
          return;
        }
        // "Ist unterwegs" nur, wenn der Versanddienst die Mail angenommen hat.
        setNote(
          antwort.mailVersandt
            ? 'Wir haben dir eine E-Mail geschickt. Bestätige die Adresse, dann kannst du dich anmelden. Sieh auch im Spam nach.'
            : 'Dein Konto ist angelegt, aber die Bestätigungsmail ging nicht hinaus. Fordere unten einen neuen Link an.',
        );
        setMode('verify');
        return;
      }
      if (mode === 'reset') {
        const antwort = await api.passwortVergessen(email);
        // Dieselbe Antwort fuer jede Adresse — sonst waere das Formular ein
        // Verzeichnis registrierter Konten.
        setNote(
          antwort.mailVersand === 'log'
            ? 'Der Mailversand ist gerade nicht eingerichtet — es geht keine Mail hinaus. Melde dich bitte bei uns.'
            : 'Falls es ein Konto mit dieser Adresse gibt, ist ein Link zum neuen Passwort unterwegs. Er gilt zwei Stunden.',
        );
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
        ) : mode === 'gast' ? (
          <label>
            Anzeigename
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={2}
              maxLength={30}
              required
            />
            {/* Ein Satz, keine Warnliste: Wer ohne Konto spielt, hat es eilig,
                nicht Lust auf einen Absatz Kleingedrucktes. */}
            <span className="muted">
              Ohne Mail und Passwort kommst du nach dem Abmelden nicht wieder an dieses
              Konto, und Runden mit Gästen zählen nicht für die Rangliste.
            </span>
          </label>
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
            {mode !== 'reset' && (
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
            )}
            {mode === 'reset' && (
              <span className="muted">Wir schicken dir einen Link, mit dem du ein neues Passwort setzt.</span>
            )}
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
            {mode === 'register'
              ? 'Konto anlegen'
              : mode === 'verify'
                ? 'Bestätigen'
                : mode === 'gast'
                  ? 'Spielen'
                  : mode === 'reset'
                    ? 'Link schicken'
                    : 'Anmelden'}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNote(null);
              // Vom Gast aus fuehrt der Rueckweg zur Anmeldung, nicht zur
              // Registrierung - wer schon ein Konto hat, will es benutzen,
              // nicht ein zweites anlegen.
              setMode(
                mode === 'register' || mode === 'gast' || mode === 'reset' ? 'login' : 'register',
              );
            }}
          >
            {mode === 'register'
              ? 'Ich habe schon ein Konto'
              : mode === 'gast'
                ? 'Doch lieber anmelden'
                : mode === 'reset'
                  ? 'Zurück zur Anmeldung'
                  : 'Konto anlegen'}
          </button>
        </div>
        {/* Direkt unter dem Anmelden-Knopf: Dort merkt man, dass das Passwort
            nicht mehr stimmt. */}
        {mode === 'login' && (
          <button
            type="button"
            className="auth-vergessen"
            onClick={() => {
              setError(null);
              setNote(null);
              setMode('reset');
            }}
          >
            Passwort vergessen?
          </button>
        )}
        {/* Der dritte Weg steht als eigener Schritt neben Anmelden/Registrieren
            - erst waehlen, wie, dann erst das Formular dazu ausfuellen. */}
        {(mode === 'login' || mode === 'register') && (
          <button
            type="button"
            className="auth-gast-taste"
            onClick={() => {
              setError(null);
              setNote(null);
              setMode('gast');
            }}
          >
            Ohne Konto spielen
          </button>
        )}
        {/* Apple und Google — jeder Knopf nur, wenn der Server fuer seinen
            Anbieter eine Client-ID nennt, und erst dann laedt die Seite
            ueberhaupt etwas von dort. Im Gast-Formular nicht: Ein Gast, der
            sich mit Apple anmeldet, hat ein Konto und ist keiner mehr — das
            Sichern eines laufenden Gastkontos steht in den Einstellungen. */}
        {mode !== 'verify' && mode !== 'gast' && (
          <AnbieterKnoepfe
            zweck="anmelden"
            gesperrt={busy}
            onErfolg={() => onSignedIn()}
            // Ueber `run`, damit die Meldung am selben Platz und in derselben
            // Form erscheint wie jede andere Anmeldemeldung.
            onFehler={(fehler) => void run(() => Promise.reject(fehler))}
          />
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
  /*
   * In der App im selben Fenster: Ein WebView oeffnet `target="_blank"` nur,
   * wenn die Huelle dafuer ein neues Fenster anlegt — sonst tut der Tipp gar
   * nichts, und genau diese Links sieht der Pruefer bei Apple als Erstes. Die
   * Seiten liegen im App-Paket und fuehren mit „Zurück zu Brauweg" zurueck.
   */
  const neuesFenster = inApp ? {} : { target: '_blank', rel: 'noreferrer' };
  return (
    <p className="rechtliches">
      <a href="/rechtliches/impressum.html" {...neuesFenster}>
        Impressum
      </a>
      <span aria-hidden="true"> · </span>
      <a href="/rechtliches/datenschutz.html" {...neuesFenster}>
        Datenschutz
      </a>
    </p>
  );
}
