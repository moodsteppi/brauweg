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

import { api } from '../api';

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
}: {
  stufe: number;
  imLevel: number;
  fuerLevel: number;
  onClick?: () => void;
}): React.JSX.Element {
  const anteil = Math.min(100, Math.round((imLevel / Math.max(1, fuerLevel)) * 100));
  const fehlt = Math.max(0, fuerLevel - imLevel);

  const inhalt = (
    <>
      <span className="stufe-kopf">
        <strong>Stufe {stufe}</strong>
        <span className="muted">
          noch {fehlt} XP bis Stufe {stufe + 1}
        </span>
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
      aria-label={`Stufe ${stufe}, noch ${fehlt} Punkte bis Stufe ${stufe + 1}. Leiter ansehen.`}
    >
      {inhalt}
    </button>
  );
}

export function Stufenleiter({ onClose }: { onClose: () => void }): React.JSX.Element {
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
    const el = rolle.current?.querySelector('.stufe-zeile.is-hier');
    el?.scrollIntoView({ block: 'center' });
  }, [daten]);

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose]);

  return (
    <div className="pfad-voll">
      <header className="pfad-voll-kopf">
        <button className="hub-zurueck" onClick={onClose} type="button">
          ← Zurück
        </button>
        {daten && (
          <span className="pfad-voll-stand">Stufe {daten.stufe} · {daten.xp} XP</span>
        )}
      </header>

      <div className="pfad-voll-rolle stufe-rolle" ref={rolle}>
        {fehler && <p className="error">Die Stufen ließen sich nicht laden.</p>}
        {!daten && !fehler && <p className="muted">Wird geladen…</p>}

        {daten && (
          <>
            <Stufenbalken
              stufe={daten.stufe}
              imLevel={daten.imLevel}
              fuerLevel={daten.fuerLevel}
            />

            <p className="stufe-hinweis muted">
              Jede gelegte Karte gibt einen Punkt. Wer am Ende Trophäen gewinnt, bekommt das
              Doppelte. Die Stufen werden nach oben hin bewusst träger.
            </p>

            <ol className="stufe-liste">
              {daten.leiter.map((s) => (
                <li
                  key={s.stufe}
                  className={`stufe-zeile${s.erreicht ? ' is-an' : ''}${s.aktuell ? ' is-hier' : ''}`}
                >
                  <span className="stufe-marke">{s.stufe}</span>
                  <span className="stufe-text">
                    <strong>Stufe {s.stufe}</strong>
                    <span className="muted">
                      ab {s.ab} XP · kostet {s.kosten}
                    </span>
                  </span>
                  {s.aktuell && <span className="stufe-hier">du bist hier</span>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
