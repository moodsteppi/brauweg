/**
 * Ein Blatt von unten — Einheitenblatt, Markenpopup, Regeln, Einladen-Ersatz.
 *
 * Eigenes Bauteil statt `HbBlatt`: Das haengt sich an die Wurzel `.hb` des
 * Hubs, und die gibt es am Spieltisch nicht. Das Verhalten ist dasselbe, damit
 * es sich gleich anfuehlt: Hintergrund antippen, Escape oder der Knopf oben
 * rechts schliessen; Escape nur das OBERSTE Blatt (`escapeAus`), sonst schloesse
 * ein Druck das Markenpopup und das Einheitenblatt darunter zugleich.
 */

import { type ReactNode, useEffect } from 'react';

import { tz } from '../text';
import stil from './neu.module.css';

export function Blatt({
  titel,
  kopf,
  children,
  fuss,
  onSchliessen,
  escapeAus,
  ebene = 1,
  kompakt,
  gross,
  nebenTitel,
}: {
  titel: string;
  /** Was ueber dem Titel steht (Bild, Zeichen). */
  kopf?: ReactNode;
  children: ReactNode;
  /** Knoepfe, unten festgeheftet in Daumenreichweite. */
  fuss?: ReactNode;
  onSchliessen: () => void;
  /** Liegt ein Blatt darueber, gehoert ihm die Escape-Taste. */
  escapeAus?: boolean;
  /** Zweites Blatt ueber dem ersten (Marke ueber Einheit). */
  ebene?: 1 | 2;
  /**
   * Nur die untere Haelfte und ein heller Hintergrund: fuer das Markenpopup,
   * unter dem die Farbringe auf dem Feld sichtbar bleiben sollen.
   */
  kompakt?: boolean;
  /**
   * Fast Vollbild, Kopf NEBEN dem Titel statt darueber, Knoepfe nebeneinander
   * — fuer das Einheitenblatt. Robin am iPhone (28.11.2026): Man musste
   * scrollen, um Faehigkeit, Marken und Werte zu sehen, „checkt keiner". Auf
   * 375 x 667 passt so alles ohne Rollen.
   */
  gross?: boolean;
  /** Bei `gross`: was rechts neben dem Kopf unter dem Titel steht. */
  nebenTitel?: ReactNode;
}): React.JSX.Element {
  useEffect(() => {
    if (escapeAus) return;
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [escapeAus, onSchliessen]);

  return (
    <div
      className={stil.blattGrund}
      data-ebene={ebene}
      data-kompakt={kompakt ? '' : undefined}
      data-gross={gross ? '' : undefined}
      onClick={onSchliessen}
    >
      <section
        className={stil.blatt}
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        onClick={(e) => e.stopPropagation()}
      >
        <i className={stil.blattGriff} aria-hidden="true" />
        <button type="button" className={stil.blattZu} onClick={onSchliessen} aria-label={tz('schliessen')}>
          ✕
        </button>
        {gross ? (
          <div className={stil.blattKopfReihe}>
            {kopf}
            <div className={stil.blattKopfText}>
              <h2 className={stil.blattTitel}>{titel}</h2>
              {nebenTitel}
            </div>
          </div>
        ) : (
          <>
            {kopf}
            <h2 className={stil.blattTitel}>{titel}</h2>
          </>
        )}
        <div className={stil.blattInhalt}>{children}</div>
        {fuss && <div className={stil.blattFuss}>{fuss}</div>}
      </section>
    </div>
  );
}
