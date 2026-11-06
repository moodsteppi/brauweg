import { useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { HbBlatt } from './HbBlatt';

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
  neu = false,
}: {
  /**
   * Neues Hub (seit dem 22.10.2026, aus dem Profil): Blatt in Nachtblau &
   * Gold. Die Leiste ueber der Spielauswahl lag dort unter dem Vollbild des
   * Hubs — ein Gast fand den Weg zum Sichern gar nicht.
   */
  neu?: boolean;
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
            ? tf('kontosichern.gesichertMail', { email })
            : antwort.bestaetigungNoetig
              ? t('kontosichern.gesichertOhneMail')
              : t('kontosichern.gesichertFertig'),
        );
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? t(err.messageKey) : t('kontosichern.verbindungFehlgeschlagen')),
      )
      .finally(() => setBusy(false));
  };

  if (neu) {
    return (
      <HbBlatt titel={t('kontosichern.titel')} onClose={erledigt ? onGesichert : onClose}>
        {erledigt ? (
          <div className="hb-formular">
            <p className="hb-klein">{erledigt}</p>
            <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onGesichert}>
              {t('kontosichern.weiter')}
            </button>
          </div>
        ) : (
          <form className="hb-formular" onSubmit={sichern}>
            <p className="hb-klein">
              {t('kontosichern.hinweis')}
            </p>
            <label>
              <span>{t('kontosichern.email')}</span>
              <input className="hb-feld" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              <span>{t('kontosichern.passwort')}</span>
              <input
                className="hb-feld"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                required
              />
              <small>{t('kontosichern.passwortMindestlaenge')}</small>
            </label>
            <label>
              <span>{t('kontosichern.geburtstag')}</span>
              <input
                className="hb-feld"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                required
                max={new Date().toISOString().slice(0, 10)}
              />
            </label>
            {error && <span className="hb-fehler">{error}</span>}
            <button type="submit" className="hb-kn is-gold is-haupt is-breit" disabled={busy}>
              {busy ? t('kontosichern.laeuft') : t('kontosichern.titel')}
            </button>
            <button type="button" className="hb-leise-knopf" onClick={onClose}>
              {t('kontosichern.spaeter')}
            </button>
          </form>
        )}
      </HbBlatt>
    );
  }

  return (
    <div className="doko-sheet" onClick={erledigt ? onGesichert : onClose}>
      <div className="doko-sheet-card kontosichern" onClick={(event) => event.stopPropagation()}>
        <h2>{t('kontosichern.titel')}</h2>
        {erledigt ? (
          <>
            <p className="muted">{erledigt}</p>
            <div className="row">
              <button className="primary" type="button" onClick={onGesichert}>
                {t('kontosichern.weiter')}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={sichern}>
            <p className="muted">
              {t('kontosichern.hinweis')}
            </p>
            <label>
              {t('kontosichern.email')}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              {t('kontosichern.passwort')}
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                required
              />
              <span className="muted">{t('kontosichern.passwortMindestlaenge')}</span>
            </label>
            <label>
              {t('kontosichern.geburtstag')}
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
                {t('kontosichern.titel')}
              </button>
              <button type="button" onClick={onClose}>
                {t('kontosichern.spaeter')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
