import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../api';
import { t } from '../i18n';
import { spiele } from '../klang';
import { Flamme } from '../lernen/Flamme';
import type { Farbe, Runde, Versuch } from './sicht';
import { TASTEN_REIHEN, buchstabeVon, tastenFarben } from './tasten';
import '../lernen/lernen.css';
import './browort.css';

const LAENGE = 5;

/**
 * Das Raster: sechs Zeilen zu fuenf Feldern. Fertige Zeilen tragen die
 * Farben des Servers; die neueste dreht sich Feld fuer Feld um, damit man
 * die Antwort liest wie beim Aufdecken. Die laufende Zeile zeigt, was getippt
 * ist, und wackelt, wenn der Server das Wort nicht kennt.
 */
export function Raster({
  versuche,
  eingabe,
  max,
  wackelt,
  aufdecken,
}: {
  versuche: readonly Versuch[];
  eingabe: string;
  max: number;
  wackelt: boolean;
  /** Index der Zeile, die gerade aufgedeckt wird (frisch vom Server), sonst null. */
  aufdecken: number | null;
}): React.JSX.Element {
  const zeilen = Array.from({ length: max }, (_, i) => i);
  return (
    <div className="bw-raster" role="grid" aria-label="Versuche">
      {zeilen.map((i) => {
        const versuch = versuche[i];
        const laufend = i === versuche.length && !versuch;
        const buchstaben = versuch ? [...versuch.wort] : laufend ? [...eingabe] : [];
        return (
          <div key={i} className={`bw-zeile${laufend && wackelt ? ' is-wackelt' : ''}`} role="row">
            {Array.from({ length: LAENGE }, (_, j) => {
              const buchstabe = buchstaben[j] ?? '';
              const farbe: Farbe | undefined = versuch?.farben[j];
              const klasse = [
                'bw-feld',
                buchstabe ? 'is-voll' : '',
                farbe ? `is-${farbe}` : '',
                aufdecken === i ? 'is-dreht' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <span
                  key={j}
                  className={klasse}
                  role="gridcell"
                  style={aufdecken === i ? { animationDelay: `${j * 160}ms` } : undefined}
                  aria-label={buchstabe ? `${buchstabe}${farbe ? `, ${FARBNAME[farbe]}` : ''}` : 'leer'}
                >
                  {buchstabe}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const FARBNAME: Record<Farbe, string> = {
  g: 'richtig',
  v: 'im Wort, andere Stelle',
  x: 'nicht im Wort',
};

/** Die Bildschirmtastatur, eingefaerbt nach dem, was die Versuche verraten haben. */
export function Tastatur({
  versuche,
  gesperrt,
  onTaste,
}: {
  versuche: readonly Versuch[];
  gesperrt: boolean;
  onTaste: (taste: string) => void;
}): React.JSX.Element {
  const farben = tastenFarben(versuche);
  return (
    <div className="bw-tastatur" aria-label="Tastatur">
      {TASTEN_REIHEN.map((reihe, i) => (
        <div key={i} className="bw-tastenreihe">
          {reihe.map((taste) => {
            const farbe = farben.get(taste);
            const breit = taste === 'ENTER' || taste === 'LOESCHEN';
            return (
              <button
                key={taste}
                type="button"
                className={`bw-taste${breit ? ' is-breit' : ''}${farbe ? ` is-${farbe}` : ''}`}
                disabled={gesperrt}
                // Beim Aufsetzen des Fingers, nicht erst beim Klick: So reagiert
                // eine echte Tastatur, und iOS verschluckt keinen von zwei
                // schnellen Tipps mehr (Doppeltipp-Erkennung, 23.10.2026). Der
                // Klick bleibt fuer Tastatur und Vorlesehilfe (detail 0).
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  e.preventDefault();
                  onTaste(taste);
                }}
                onClick={(e) => {
                  if (e.detail === 0) onTaste(taste);
                }}
                aria-label={taste === 'ENTER' ? 'Raten' : taste === 'LOESCHEN' ? 'Löschen' : taste}
              >
                {taste === 'ENTER' ? (
                  'Raten'
                ) : taste === 'LOESCHEN' ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 5h11v14H9l-6-7z M13 9l5 6 M18 9l-5 6" />
                  </svg>
                ) : (
                  taste
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Die Eingabe einer Runde: tippen, loeschen, schicken — fuer Browort und
 * Clanwort gleich. `schicke` geht an den Server und liefert die neue Runde;
 * kennt der Server das Wort nicht, wackelt die Zeile, und nichts ist
 * verbraucht.
 */
export function useWortEingabe<T extends Runde>({
  runde,
  schicke,
  onNeu,
  aktiv,
}: {
  runde: T | null;
  schicke: (wort: string) => Promise<T>;
  onNeu: (runde: T) => void;
  /** false: Tippen hat keine Wirkung (Runde fertig, falsche Phase). */
  aktiv: boolean;
}): {
  eingabe: string;
  wackelt: boolean;
  meldung: string | null;
  aufdecken: number | null;
  laeuft: boolean;
  taste: (taste: string) => void;
} {
  const [eingabe, setEingabe] = useState('');
  const [wackelt, setWackelt] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [aufdecken, setAufdecken] = useState<number | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const zustand = useRef({ eingabe, aktiv, laeuft, runde });
  zustand.current = { eingabe, aktiv, laeuft, runde };

  const melde = useCallback((text: string) => {
    setMeldung(text);
    setWackelt(true);
    spiele('fehler');
    window.setTimeout(() => setWackelt(false), 450);
    window.setTimeout(() => setMeldung((m) => (m === text ? null : m)), 1800);
  }, []);

  const taste = useCallback(
    (taste: string): void => {
      const { eingabe: jetzt, aktiv: an, laeuft: unterwegs, runde: r } = zustand.current;
      if (!an || unterwegs || !r) return;
      // Den neuen Stand SOFORT in die Referenz: Zwei schnelle Tipps zwischen
      // zwei Darstellungen lasen sonst beide den alten Stand, und der erste
      // Buchstabe ging verloren (im Simulator gesehen, 23.10.2026).
      const setze = (neu: string): void => {
        zustand.current = { ...zustand.current, eingabe: neu };
        setEingabe(neu);
      };
      if (taste === 'LOESCHEN') {
        setze(jetzt.slice(0, -1));
        return;
      }
      if (taste === 'ENTER') {
        if (jetzt.length < LAENGE) {
          melde('Fünf Buchstaben, bitte.');
          return;
        }
        setLaeuft(true);
        zustand.current = { ...zustand.current, laeuft: true };
        void schicke(jetzt)
          .then((neu) => {
            setze('');
            setAufdecken(neu.versuche.length - 1);
            window.setTimeout(() => setAufdecken(null), 160 * LAENGE + 500);
            spiele(neu.geloest ? 'sieg' : 'karte-legen');
            onNeu(neu);
          })
          .catch((err: unknown) => {
            // Eine abgebrochene Rueckfrage (Clanwort-Wahl) ist keine Stoerung.
            if (err instanceof Error && err.name === 'Abgebrochen') return;
            melde(err instanceof ApiError ? t(err.messageKey) : 'Keine Verbindung - nochmal versuchen.');
          })
          .finally(() => setLaeuft(false));
        return;
      }
      if (jetzt.length < LAENGE) {
        setze(jetzt + taste);
        spiele('tipp', 0.5);
      }
    },
    [melde, onNeu, schicke],
  );

  // Die echte Tastatur (iPad mit Tastatur, Webseite): dieselben Wege.
  useEffect(() => {
    const druck = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') taste('ENTER');
      else if (e.key === 'Backspace') taste('LOESCHEN');
      else {
        const b = buchstabeVon(e.key);
        if (b) taste(b);
      }
    };
    window.addEventListener('keydown', druck);
    return () => window.removeEventListener('keydown', druck);
  }, [taste]);

  return { eingabe, wackelt, meldung, aufdecken, laeuft, taste };
}

/**
 * Die Browort-Flamme: brennt, wenn heute geloest ist, und traegt den
 * Schnitt der Versuche (Emile: „man sieht in der Flamme den average").
 */
export function BrowortFlamme({
  schnitt,
  an,
  groesse = 3,
}: {
  schnitt: number | null;
  an: boolean;
  groesse?: number;
}): React.JSX.Element {
  return (
    <span className="bw-flamme" style={{ width: `${(groesse * 48) / 60}rem`, height: `${groesse}rem` }}>
      <Flamme aus={!an} groesse={groesse} />
      <span className="bw-flamme-zahl" aria-hidden="true">
        {schnitt === null ? '-' : schnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
      </span>
    </span>
  );
}

/** „Ø 3,8 Versuche" für Vorlesehilfen und Unterzeilen. */
export function schnittText(schnitt: number | null): string {
  return schnitt === null ? 'noch kein Schnitt' : `Ø ${schnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Versuche`;
}
