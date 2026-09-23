import { useEffect, useState } from 'react';

import { pushApi, type PushAnlass, type PushEinstellungen } from '../api';
import { inApp } from '../laufzeit';
import { beiPushToken, kannPush } from './bruecke';
import { erlauben } from './dienst';

/** Die drei Anlaesse, wie sie in den Einstellungen heissen. */
const ZEILEN: readonly { anlass: PushAnlass; name: string; hinweis: string }[] = [
  { anlass: 'dran', name: 'Du bist dran', hinweis: 'Wenn der Tisch auf deinen Zug wartet' },
  { anlass: 'start', name: 'Deine Runde startet', hinweis: 'Wenn dein Tisch voll ist' },
  { anlass: 'einladung', name: 'Einladung angenommen', hinweis: 'Wenn jemand über deinen Code kommt' },
];

/**
 * Einstellungen, Abschnitt "Mitteilungen" — nur in der App.
 *
 * Je Anlass ein Schalter. Die Schalter gelten fuer das KONTO (am Server), die
 * Erlaubnis fuer das GERAET (im System): Deshalb steht darunter, ob dieses
 * Telefon ueberhaupt etwas bekommt, und wenn nicht, ein Knopf, der die
 * Systemabfrage nachholt.
 *
 * Nachgeladen (Einstellungen.tsx), und auf der Webseite erscheint gar
 * nichts: Dort gibt es keine Mitteilungen, also auch keine Einstellung dafuer.
 */
export function Mitteilungen(): React.JSX.Element | null {
  const [stand, setStand] = useState<PushEinstellungen | null>(null);
  const [gefragt, setGefragt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!inApp) return;
    let lebt = true;
    const laden = (): void => {
      pushApi
        .einstellungen()
        .then((neu) => lebt && setStand(neu))
        .catch(() => lebt && setStand(null));
    };
    laden();
    // Kommt nach dem Erlauben ein Token, zaehlt das Geraet mit: kurz danach
    // neu laden, damit der Hinweis "bekommt nichts" verschwindet.
    const ab = beiPushToken(() => {
      setTimeout(laden, 800);
    });
    return () => {
      lebt = false;
      ab();
    };
  }, []);

  if (!inApp || !stand) return null;

  const schalte = async (anlass: PushAnlass, an: boolean): Promise<void> => {
    setFehler(null);
    setStand({ ...stand, anlaesse: { ...stand.anlaesse, [anlass]: an } });
    try {
      setStand(await pushApi.setzeEinstellungen({ [anlass]: an }));
    } catch {
      setFehler('Das hat nicht geklappt. Versuch es gleich noch einmal.');
      setStand(stand);
    }
  };

  return (
    <section className="push-mitteilungen" aria-labelledby="push-mitteilungen-titel">
      <h3 id="push-mitteilungen-titel">Mitteilungen</h3>
      {ZEILEN.map(({ anlass, name, hinweis }) => (
        <div key={anlass} className="einstellungen-zeile">
          <label className="einstellungen-text" htmlFor={`push-${anlass}`}>
            <strong>{name}</strong>
            <span className="muted">{hinweis}</span>
          </label>
          <input
            id={`push-${anlass}`}
            type="checkbox"
            role="switch"
            className="mm-schalter"
            checked={stand.anlaesse[anlass]}
            onChange={(ereignis) => void schalte(anlass, ereignis.target.checked)}
          />
        </div>
      ))}
      {stand.geraete === 0 && (
        <p className="einstellungen-fussnote muted">
          {kannPush()
            ? gefragt
              ? 'Kommt nichts an? Dann sind Mitteilungen für Brauweg in den Systemeinstellungen deines Telefons aus.'
              : 'Dieses Telefon bekommt noch keine Mitteilungen.'
            : 'Diese Fassung der App kann noch keine Mitteilungen — das kommt mit dem nächsten Update.'}
        </p>
      )}
      {stand.geraete === 0 && kannPush() && !gefragt && (
        <button
          type="button"
          className="hub-knopf hub-knopf--a push-erlauben"
          onClick={() => {
            erlauben();
            setGefragt(true);
          }}
        >
          Mitteilungen erlauben
        </button>
      )}
      {fehler && (
        <p className="einstellungen-fussnote" role="alert">
          {fehler}
        </p>
      )}
    </section>
  );
}
