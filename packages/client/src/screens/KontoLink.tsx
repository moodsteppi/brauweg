import { useEffect, useRef, useState } from 'react';

import { ApiError, api, type MailProbe, type MailVersand } from '../api';
import { t } from '../i18n';
import { kontoLinkAufraeumen, type KontoLinkZiel } from '../kontolink';

/**
 * Die Landeseiten der Mail-Links: `/verify`, `/reset` — und die
 * Mail-Diagnose der Aufsicht unter `/aufsicht/mail`.
 *
 * Nachgeladen, nicht im Sofort-Paket: Die allermeisten Besuche kommen nie
 * hierher, und wer kommt, wartet ohnehin einen Moment auf den Server.
 *
 * Die Seite steht VOR der Frage, ob jemand angemeldet ist (siehe App.tsx):
 * Ein Gast, der eben sein Konto gesichert hat, ist noch angemeldet, wenn er
 * den Link aus der Mail oeffnet — bis zum 23.09.2026 sah er dann einfach die
 * Spielauswahl, und die Adresse blieb unbestaetigt.
 */
export function KontoLink({
  ziel,
  angemeldet,
  onFertig,
}: {
  ziel: KontoLinkZiel;
  angemeldet: boolean;
  /** Zurueck in die App; sie laedt `me` neu. */
  onFertig: () => void;
}): React.JSX.Element {
  return (
    <main className="auth kontolink">
      <h1 className="auth-marke">
        <img src="/hub/logo.png" alt="Brauweg" draggable={false} />
      </h1>
      {ziel.art === 'verify' ? (
        <Bestaetigen token={ziel.token} angemeldet={angemeldet} onFertig={onFertig} />
      ) : ziel.art === 'reset' ? (
        <NeuesPasswort token={ziel.token} onFertig={onFertig} />
      ) : (
        <MailDiagnose angemeldet={angemeldet} onFertig={onFertig} />
      )}
    </main>
  );
}

/** Fehlertext aus einer Serverantwort — oder die Verbindung war weg. */
function fehlertext(err: unknown): string {
  return err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.';
}

/** Was nach "Neuen Link anfordern" dasteht. Ehrlich, wenn nichts hinausgeht. */
function unterwegsText(mailVersand: MailVersand | undefined): string {
  return mailVersand === 'log'
    ? 'Der Mailversand ist gerade nicht eingerichtet — es geht keine Mail hinaus. Melde dich bitte bei uns.'
    : 'Falls es ein Konto mit dieser Adresse gibt, ist eine neue E-Mail unterwegs. Sieh auch im Spam nach.';
}

/**
 * Neuen Link anfordern. Steht dort, wo ein Link nicht mehr gilt: abgelaufen,
 * schon benutzt, oder gar kein Token in der Adresse.
 */
function NeuerLink({
  art,
  onZurAnmeldung,
}: {
  art: 'verify' | 'reset';
  onZurAnmeldung: () => void;
}): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const anfordern = (event: React.FormEvent): void => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    void (art === 'verify' ? api.resendVerification(email) : api.passwortVergessen(email))
      .then((antwort) => setNote(unterwegsText(antwort.mailVersand)))
      .catch((err: unknown) => setError(fehlertext(err)))
      .finally(() => setBusy(false));
  };

  return (
    <form className="panel" onSubmit={anfordern}>
      <label>
        E-Mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {note && <p className="muted">{note}</p>}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" type="submit" disabled={busy}>
          Neuen Link anfordern
        </button>
        <button type="button" onClick={onZurAnmeldung}>
          Zur Anmeldung
        </button>
      </div>
    </form>
  );
}

function Bestaetigen({
  token,
  angemeldet,
  onFertig,
}: {
  token: string;
  angemeldet: boolean;
  onFertig: () => void;
}): React.JSX.Element {
  const [stand, setStand] = useState<'laeuft' | 'ok' | 'fehler'>(token ? 'laeuft' : 'fehler');
  const [error, setError] = useState<string | null>(
    token ? null : 'In diesem Link fehlt der Code. Öffne ihn direkt aus der E-Mail.',
  );

  /*
   * Wer den Link oeffnet, hat seine Absicht damit erklaert: sofort
   * bestaetigen, statt ein Formular zu zeigen. Genau einmal — unter
   * StrictMode liefe der Effekt sonst zweimal, und der zweite Aufruf faende
   * das Token schon verbraucht.
   */
  const gelaufen = useRef(false);
  useEffect(() => {
    if (gelaufen.current || !token) return;
    gelaufen.current = true;
    kontoLinkAufraeumen();
    void api
      .verify(token)
      .then(() => setStand('ok'))
      .catch((err: unknown) => {
        setError(fehlertext(err));
        setStand('fehler');
      });
  }, [token]);

  if (stand === 'laeuft') return <p className="muted">Adresse wird bestätigt…</p>;

  if (stand === 'ok') {
    return (
      <div className="panel">
        <h2>Adresse bestätigt</h2>
        <p className="muted">
          {angemeldet
            ? 'Danke! Dein Konto ist gesichert.'
            : 'Danke! Du kannst dich jetzt mit Adresse und Passwort anmelden.'}
        </p>
        <div className="row">
          <button className="primary" type="button" onClick={onFertig}>
            {angemeldet ? 'Weiter zum Spiel' : 'Zur Anmeldung'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <h2>Das hat nicht geklappt</h2>
        <p className="error">{error}</p>
        <p className="muted">Gib deine Adresse ein, dann schicken wir einen neuen Link.</p>
      </div>
      <NeuerLink art="verify" onZurAnmeldung={onFertig} />
    </>
  );
}

function NeuesPasswort({
  token,
  onFertig,
}: {
  token: string;
  onFertig: () => void;
}): React.JSX.Element {
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ungueltig, setUngueltig] = useState(!token);
  const [fertig, setFertig] = useState(false);
  const [busy, setBusy] = useState(false);

  // Das Token liegt jetzt im Zustand; aus der Adresszeile darf es raus.
  useEffect(() => {
    if (token) kontoLinkAufraeumen();
  }, [token]);

  const setzen = (event: React.FormEvent): void => {
    event.preventDefault();
    // Vorab im Client, weil ein Tippfehler im neuen Passwort sonst erst beim
    // naechsten Anmelden auffiele — und dann ginge es wieder von vorn los.
    if (passwort !== wiederholung) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    setBusy(true);
    setError(null);
    void api
      .passwortNeu(token, passwort)
      .then(() => setFertig(true))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === 'tokenInvalid') setUngueltig(true);
        setError(fehlertext(err));
      })
      .finally(() => setBusy(false));
  };

  if (fertig) {
    return (
      <div className="panel">
        <h2>Neues Passwort gesetzt</h2>
        <p className="muted">Du bist angemeldet. Auf anderen Geräten meldest du dich neu an.</p>
        <div className="row">
          <button className="primary" type="button" onClick={onFertig}>
            Weiter zum Spiel
          </button>
        </div>
      </div>
    );
  }

  if (ungueltig) {
    return (
      <>
        <div className="panel">
          <h2>Link gilt nicht mehr</h2>
          <p className="error">
            {error ?? 'In diesem Link fehlt der Code. Öffne ihn direkt aus der E-Mail.'}
          </p>
          <p className="muted">Der Link gilt zwei Stunden und nur einmal. Fordere einfach einen neuen an.</p>
        </div>
        <NeuerLink art="reset" onZurAnmeldung={onFertig} />
      </>
    );
  }

  return (
    <form className="panel" onSubmit={setzen}>
      <h2>Neues Passwort</h2>
      <label>
        Neues Passwort
        <input
          type="password"
          autoComplete="new-password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          minLength={12}
          required
        />
        <span className="muted">Mindestens zwölf Zeichen.</span>
      </label>
      <label>
        Noch einmal
        <input
          type="password"
          autoComplete="new-password"
          value={wiederholung}
          onChange={(e) => setWiederholung(e.target.value)}
          minLength={12}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" type="submit" disabled={busy}>
          Passwort setzen
        </button>
      </div>
    </form>
  );
}

/** Beschriftung der Diagnosefelder, in der Reihenfolge der Anzeige. */
const PROBE_FELDER: readonly [keyof MailProbe, string][] = [
  ['mailer', 'Mailer'],
  ['absenderDomain', 'Absender-Domain'],
  ['domainStatus', 'Domain-Status bei Resend'],
  ['versandt', 'Testmail angenommen'],
  ['fehler', 'Fehler'],
  ['linkBasis', 'Links zeigen auf'],
];

/**
 * Knopf fuer `POST /api/staff/mail-probe`. Nur Testkonten bekommen eine
 * Antwort; alle anderen sehen "Das darf nur die Aufsicht".
 */
function MailDiagnose({
  angemeldet,
  onFertig,
}: {
  angemeldet: boolean;
  onFertig: () => void;
}): React.JSX.Element {
  const [probe, setProbe] = useState<MailProbe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pruefen = (): void => {
    setBusy(true);
    setError(null);
    void api
      .mailProbe()
      .then(setProbe)
      .catch((err: unknown) => setError(fehlertext(err)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="panel kontolink-probe">
      <h2>Mail-Diagnose</h2>
      <p className="muted">
        Fragt bei Resend den Stand der Absender-Domain ab und schickt eine Testmail an die Adresse
        deines Kontos. Schlüssel werden nie angezeigt.
      </p>
      {!angemeldet && <p className="error">Erst mit dem Testkonto anmelden.</p>}
      {error && <p className="error">{error}</p>}
      {probe && (
        <>
          <p className={probe.versandt && probe.domainStatus === 'verified' ? 'muted' : 'error'}>
            {probe.diagnose}
          </p>
          <dl className="kontolink-felder">
            {PROBE_FELDER.map(([feld, name]) => (
              <div key={feld}>
                <dt>{name}</dt>
                <dd>{String(probe[feld] ?? '—')}</dd>
              </div>
            ))}
            {probe.letzterFehler && (
              <div>
                <dt>Letzter Fehlschlag seit Start</dt>
                <dd>
                  {probe.letzterFehler.zeit}: {probe.letzterFehler.status ?? 'kein Netz'}{' '}
                  {probe.letzterFehler.name ?? ''} — {probe.letzterFehler.text} (an{' '}
                  {probe.letzterFehler.empfaengerDomain})
                </dd>
              </div>
            )}
          </dl>
        </>
      )}
      <div className="row">
        <button className="primary" type="button" onClick={pruefen} disabled={busy || !angemeldet}>
          {busy ? 'Prüfe…' : 'Jetzt prüfen'}
        </button>
        <button
          type="button"
          onClick={() => {
            kontoLinkAufraeumen();
            onFertig();
          }}
        >
          Zurück
        </button>
      </div>
    </div>
  );
}
