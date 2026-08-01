import { useEffect, useRef, useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';

type Mode = 'login' | 'register' | 'verify' | 'reset';

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
  const [inviteCode, setInviteCode] = useState('');
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
        await api.register({ email, password, displayName, inviteCode });
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
    <main>
      <h1>Brauweg</h1>
      <p className="muted">Spielt nach euren Regeln.</p>

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
              Einladungscode
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
              />
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
      </form>
    </main>
  );
}
