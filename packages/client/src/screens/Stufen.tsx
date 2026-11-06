/**
 * Stufenleiter.
 *
 * Wie der Trophäenpfad, nur senkrecht als Liste: Man tippt seine Stufe an
 * und sieht, wo man steht und was die nächsten kosten.
 *
 * Die Kurve kommt vom Server (`/api/me/levels`) und wird hier nicht
 * nachgerechnet. Sie steht in `level.ts` an genau einer Stelle; würde der
 * Client sie zweitmalig kennen, wirkte eine Nachjustierung erst nach dem
 * nächsten App-Update — und bis dahin zeigte die App etwas anderes an, als
 * die Gutschrift tut.
 */

import { useEffect, useRef, useState } from 'react';
import { Ladekreis } from '../Ladekreis';

import { api } from '../api';
import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { Schliessen } from './HbBlatt';

interface Stufe {
  stufe: number;
  ab: number;
  kosten: number;
  erreicht: boolean;
  aktuell: boolean;
}

interface Leiter {
  stufe: number;
  xp: number;
  imLevel: number;
  fuerLevel: number;
  leiter: Stufe[];
}

/**
 * Der Balken für den Fortschritt in der laufenden Stufe.
 *
 * Bewusst der Anteil IN der Stufe und nicht am Gesamtstand: Letzterer
 * stünde ab Stufe zehn dauerhaft fast am Anschlag und sagte nichts mehr.
 */
export function Stufenbalken({
  stufe,
  imLevel,
  fuerLevel,
  onClick,
  neu = false,
}: {
  stufe: number;
  imLevel: number;
  fuerLevel: number;
  onClick?: () => void;
  /** Neues Hub: dunkle Karte mit Goldbalken statt Holzleiste. */
  neu?: boolean;
}): React.JSX.Element {
  const anteil = Math.min(100, Math.round((imLevel / Math.max(1, fuerLevel)) * 100));
  const fehlt = Math.max(0, fuerLevel - imLevel);
  const aria = tf('stufen.aria', { stufe, fehlt, naechste: stufe + 1 });

  if (neu) {
    const neuInhalt = (
      <>
        <span className="hb-stufenbalken-kopf">
          <strong>{tf('stufen.stufe', { stufe })}</strong>
          <small>{tf('stufen.fehlt', { fehlt, naechste: stufe + 1 })}</small>
        </span>
        <span className="hb-balken" aria-hidden="true">
          <span style={{ width: `${anteil}%` }} />
        </span>
        <small className="hb-stufenbalken-zahl">
          {imLevel} / {fuerLevel} XP
        </small>
        {onClick && (
          <span className="hb-pf" aria-hidden="true">
            ›
          </span>
        )}
      </>
    );
    if (!onClick) return <div className="hb-karte hb-stufenbalken">{neuInhalt}</div>;
    return (
      <button
        type="button"
        className="hb-karte hb-stufenbalken is-knopf"
        onClick={onClick}
        aria-label={aria}
      >
        {neuInhalt}
      </button>
    );
  }

  const inhalt = (
    <>
      <span className="stufe-kopf">
        <strong>{tf('stufen.stufe', { stufe })}</strong>
        <span className="muted">{tf('stufen.fehlt', { fehlt, naechste: stufe + 1 })}</span>
      </span>
      <span className="stufe-balken" aria-hidden="true">
        <span style={{ width: `${anteil}%` }} />
      </span>
      <span className="stufe-zahl muted">
        {imLevel} / {fuerLevel} XP
      </span>
    </>
  );

  if (!onClick) return <div className="stufe-block">{inhalt}</div>;
  return (
    <button
      className="stufe-block stufe-block--knopf"
      onClick={onClick}
      aria-label={aria}
    >
      {inhalt}
    </button>
  );
}

export function Stufenleiter({
  onClose,
  neu = false,
}: {
  onClose: () => void;
  /** Neues Hub: Vollbild in Nachtblau & Gold, dieselbe Leiter vom Server. */
  neu?: boolean;
}): React.JSX.Element {
  const [daten, setDaten] = useState<Leiter | null>(null);
  const [fehler, setFehler] = useState(false);
  const rolle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api
      .levels()
      .then((d) => setDaten(d as Leiter))
      .catch(() => setFehler(true));
  }, []);

  // Nach dem Laden zur eigenen Stufe rollen, nicht an den Anfang der Liste.
  useEffect(() => {
    if (!daten) return;
    const el = rolle.current?.querySelector('.stufe-zeile.is-hier, .hb-stufe-zeile.is-hier');
    // `?.` am Aufruf: jsdom kennt scrollIntoView nicht.
    el?.scrollIntoView?.({ block: 'center' });
  }, [daten]);

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose]);

  if (neu) {
    return (
      <div className="hb-voll hb-stufenleiter" role="dialog" aria-modal="true" aria-label={t('stufen.leiter')}>
        <header className="hb-voll-kopf">
          <Schliessen onClick={onClose} />
          <div className="hb-voll-titel">
            <h1>{t('stufen.titel')}</h1>
            <span>{daten ? tf('stufen.stand', { stufe: daten.stufe, xp: daten.xp.toLocaleString('de-DE') }) : t('stufen.laden')}</span>
          </div>
        </header>
        <div className="hb-voll-rolle" ref={rolle}>
          {fehler && <p className="hb-fehler">{t('stufen.fehler')}</p>}
          {daten && (
            <>
              <Stufenbalken neu stufe={daten.stufe} imLevel={daten.imLevel} fuerLevel={daten.fuerLevel} />
              <p className="hb-klein hb-ohne-rand">{t('stufen.hinweis')}</p>
              <ol className="hb-liste">
                {daten.leiter.map((s) => (
                  <li
                    key={s.stufe}
                    className={`hb-stufe-zeile${s.erreicht ? ' is-an' : ''}${s.aktuell ? ' is-hier' : ''}`}
                  >
                    <span className="hb-stufe-marke">{s.stufe}</span>
                    <span className="hb-mg-name">
                      <strong>{tf('stufen.stufe', { stufe: s.stufe })}</strong>
                      <small className="is-leise">
                        {tf('stufen.zeile', { ab: s.ab.toLocaleString('de-DE'), kosten: s.kosten.toLocaleString('de-DE') })}
                      </small>
                    </span>
                    {s.aktuell && <span className="hb-stufe-hier">{t('stufen.hier')}</span>}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pfad-voll">
      <header className="pfad-voll-kopf">
        <button className="hub-zurueck" onClick={onClose} type="button">
          {t('stufen.zurueck')}
        </button>
        {daten && (
          <span className="pfad-voll-stand">{tf('stufen.stand', { stufe: daten.stufe, xp: daten.xp })}</span>
        )}
      </header>

      <div className="pfad-voll-rolle stufe-rolle" ref={rolle}>
        {fehler && <p className="error">{t('stufen.fehler')}</p>}
        {!daten && !fehler && <Ladekreis />}

        {daten && (
          <>
            <Stufenbalken
              stufe={daten.stufe}
              imLevel={daten.imLevel}
              fuerLevel={daten.fuerLevel}
            />

            <p className="stufe-hinweis muted">{t('stufen.hinweis')}</p>

            <ol className="stufe-liste">
              {daten.leiter.map((s) => (
                <li
                  key={s.stufe}
                  className={`stufe-zeile${s.erreicht ? ' is-an' : ''}${s.aktuell ? ' is-hier' : ''}`}
                >
                  <span className="stufe-marke">{s.stufe}</span>
                  <span className="stufe-text">
                    <strong>{tf('stufen.stufe', { stufe: s.stufe })}</strong>
                    <span className="muted">{tf('stufen.zeile', { ab: s.ab, kosten: s.kosten })}</span>
                  </span>
                  {s.aktuell && <span className="stufe-hier">{t('stufen.hier')}</span>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
