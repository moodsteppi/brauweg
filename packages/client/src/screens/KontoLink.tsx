import { useEffect, useRef, useState } from 'react';

import { ApiError, api, type MailProbe, type MailVersand } from '../api';
import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';
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
        <img src="/hub/broweggames-vertikal-dunkel.webp" alt="BroweGGames" draggable={false} />
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
  return err instanceof ApiError ? t(err.messageKey) : t('kontolink.verbindungFehlgeschlagen');
}

/** Was nach "Neuen Link anfordern" dasteht. Ehrlich, wenn nichts hinausgeht. */
function unterwegsText(mailVersand: MailVersand | undefined): string {
  return mailVersand === 'log'
    ? t('kontolink.mailversandAus')
    : t('kontolink.mailUnterwegs');
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
        {t('kontolink.email')}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {note && <p className="muted">{note}</p>}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" type="submit" disabled={busy}>
          {t('kontolink.neuerLink')}
        </button>
        <button type="button" onClick={onZurAnmeldung}>
          {t('kontolink.zurAnmeldung')}
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
    token ? null : t('kontolink.codeFehlt'),
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

  if (stand === 'laeuft') return <p className="muted">{t('kontolink.wirdBestaetigt')}</p>;

  if (stand === 'ok') {
    return (
      <div className="panel">
        <h2>{t('kontolink.bestaetigt')}</h2>
        <p className="muted">
          {angemeldet
            ? t('kontolink.dankeGesichert')
            : t('kontolink.dankeAnmelden')}
        </p>
        <div className="row">
          <button className="primary" type="button" onClick={onFertig}>
            {angemeldet ? t('kontolink.weiterZumSpiel') : t('kontolink.zurAnmeldung')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <h2>{t('kontolink.nichtGeklappt')}</h2>
        <p className="error">{error}</p>
        <p className="muted">{t('kontolink.neuerLinkHinweis')}</p>
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
      setError(t('kontolink.passwortUngleich'));
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
        <h2>{t('kontolink.passwortGesetzt')}</h2>
        <p className="muted">{t('kontolink.angemeldetHinweis')}</p>
        <div className="row">
          <button className="primary" type="button" onClick={onFertig}>
            {t('kontolink.weiterZumSpiel')}
          </button>
        </div>
      </div>
    );
  }

  if (ungueltig) {
    return (
      <>
        <div className="panel">
          <h2>{t('kontolink.linkUngueltig')}</h2>
          <p className="error">
            {error ?? t('kontolink.codeFehlt')}
          </p>
          <p className="muted">{t('kontolink.linkGueltigkeit')}</p>
        </div>
        <NeuerLink art="reset" onZurAnmeldung={onFertig} />
      </>
    );
  }

  return (
    <form className="panel" onSubmit={setzen}>
      <h2>{t('kontolink.neuesPasswort')}</h2>
      <label>
        {t('kontolink.neuesPasswort')}
        <input
          type="password"
          autoComplete="new-password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          minLength={12}
          required
        />
        <span className="muted">{t('kontolink.passwortMindestlaenge')}</span>
      </label>
      <label>
        {t('kontolink.nochEinmal')}
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
          {t('kontolink.passwortSetzen')}
        </button>
      </div>
    </form>
  );
}

/**
 * Die Diagnosefelder, in der Reihenfolge der Anzeige. Die Beschriftung kommt
 * erst beim Zeichnen aus `kontolink.probe.feld.<feld>` — auf Modulebene stünde
 * sie fest in der Sprache, die beim Laden galt.
 */
const PROBE_FELDER: readonly (keyof MailProbe)[] = [
  'mailer',
  'absenderDomain',
  'domainStatus',
  'versandt',
  'fehler',
  'linkBasis',
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
      <h2>{t('kontolink.probe.titel')}</h2>
      <p className="muted">{t('kontolink.probe.text')}</p>
      {!angemeldet && <p className="error">{t('kontolink.probe.erstAnmelden')}</p>}
      {error && <p className="error">{error}</p>}
      {probe && (
        <>
          <p className={probe.versandt && probe.domainStatus === 'verified' ? 'muted' : 'error'}>
            {probe.diagnose}
          </p>
          <dl className="kontolink-felder">
            {PROBE_FELDER.map((feld) => (
              <div key={feld}>
                <dt>{t(`kontolink.probe.feld.${feld}`)}</dt>
                <dd>{String(probe[feld] ?? '-')}</dd>
              </div>
            ))}
            {probe.letzterFehler && (
              <div>
                <dt>{t('kontolink.probe.letzterFehler')}</dt>
                <dd>
                  {tf('kontolink.probe.letzterFehlerZeile', {
                    zeit: probe.letzterFehler.zeit,
                    status: probe.letzterFehler.status ?? t('kontolink.probe.keinNetz'),
                    name: probe.letzterFehler.name ?? '',
                    text: probe.letzterFehler.text,
                    domain: probe.letzterFehler.empfaengerDomain,
                  })}
                </dd>
              </div>
            )}
          </dl>
        </>
      )}
      <div className="row">
        <button className="primary" type="button" onClick={pruefen} disabled={busy || !angemeldet}>
          {busy ? t('kontolink.probe.laeuft') : t('kontolink.probe.pruefen')}
        </button>
        <button
          type="button"
          onClick={() => {
            kontoLinkAufraeumen();
            onFertig();
          }}
        >
          {t('kontolink.zurueck')}
        </button>
      </div>
    </div>
  );
}
