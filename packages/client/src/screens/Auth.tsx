import { useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';

type Mode = 'login' | 'register' | 'verify' | 'reset';

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
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

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
        await api.verify(token);
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
          <label>
            Bestätigungscode aus der E-Mail
            <input value={token} onChange={(e) => setToken(e.target.value)} required />
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
