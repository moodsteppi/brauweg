import { useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';

/**
 * Gastkonto sichern: Mail, Passwort und Geburtstag nachtragen.
 *
 * Die Route `POST /api/auth/gast/sichern` gab es seit dem Gastkonto, einen
 * Weg dorthin im Client nicht — ein Gast konnte sein Konto also nie sichern.
 * Seit dem 23.09.2026 haengt dieses Blatt an der Leiste, die App.tsx Gaesten
 * ueber der Spielauswahl zeigt.
 *
 * Danach geht dieselbe Bestaetigungsmail hinaus wie beim Registrieren; die
 * laufende Sitzung bleibt, damit niemand mitten im Spiel herausfliegt.
 */
export function KontoSichern({
  onClose,
  onGesichert,
}: {
  onClose: () => void;
  /** Konto ist gesichert — die App laedt `me` neu, die Gastleiste verschwindet. */
  onGesichert: () => void;
}): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthday, setBirthday] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [erledigt, setErledigt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sichern = (event: React.FormEvent): void => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    void api
      .gastSichern(email, password, birthday)
      .then((antwort) => {
        // Ehrlich sagen, was mit der Mail ist — "ist unterwegs" nur, wenn
        // der Versanddienst sie wirklich angenommen hat.
        setErledigt(
          antwort.mailVersandt
            ? `Gesichert! Wir haben dir eine E-Mail an ${email} geschickt. Bestätige die Adresse, damit du dich später auch auf anderen Geräten anmelden kannst.`
            : antwort.bestaetigungNoetig
              ? 'Gesichert! Die Bestätigungsmail konnte gerade nicht verschickt werden. Beim Anmelden kannst du einen neuen Link anfordern.'
              : 'Gesichert! Du kannst dich ab jetzt mit Adresse und Passwort anmelden.',
        );
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.'),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div className="doko-sheet" onClick={erledigt ? onGesichert : onClose}>
      <div className="doko-sheet-card kontosichern" onClick={(event) => event.stopPropagation()}>
        <h2>Konto sichern</h2>
        {erledigt ? (
          <>
            <p className="muted">{erledigt}</p>
            <div className="row">
              <button className="primary" type="button" onClick={onGesichert}>
                Weiter
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={sichern}>
            <p className="muted">
              Dein Spielstand bleibt, wie er ist. Mit Adresse und Passwort kommst du auch nach dem
              Abmelden wieder an dieses Konto.
            </p>
            <label>
              E-Mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Passwort
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                required
              />
              <span className="muted">Mindestens zwölf Zeichen.</span>
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
            </label>
            {error && <p className="error">{error}</p>}
            <div className="row">
              <button className="primary" type="submit" disabled={busy}>
                Konto sichern
              </button>
              <button type="button" onClick={onClose}>
                Später
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
