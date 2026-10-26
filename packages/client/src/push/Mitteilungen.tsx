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
  { anlass: 'anfrage', name: 'Beitrittsanfragen', hinweis: 'Wenn jemand an deinen privaten Tisch möchte' },
  { anlass: 'serie', name: 'Lernserie', hinweis: 'Abends, wenn du heute noch keine Lektion gemacht hast' },
  { anlass: 'browort', name: 'Browort', hinweis: 'Abends, wenn das Wort von heute noch offen ist' },
  { anlass: 'clanwort', name: 'Clanwort', hinweis: 'Wenn du ausgelost bist, das Clanwort zu wählen' },
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
export function Mitteilungen({
  neu = false,
}: {
  /** Neues Hub: Zeilen und Schalter in Nachtblau & Gold. */
  neu?: boolean;
} = {}): React.JSX.Element | null {
  const [stand, setStand] = useState<PushEinstellungen | null>(null);
  const [gefragt, setGefragt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Im eigenen Blatt „Benachrichtigungen" wäre ein stilles Nichts ein leeres
  // Blatt — dort steht deshalb, dass das Laden nicht ging.
  const [ladeFehler, setLadeFehler] = useState(false);
  const [versuch, setVersuch] = useState(0);

  useEffect(() => {
    if (!inApp) return;
    let lebt = true;
    const laden = (): void => {
      pushApi
        .einstellungen()
        .then((ergebnis) => {
          if (!lebt) return;
          setStand(ergebnis);
          setLadeFehler(false);
        })
        .catch(() => {
          if (!lebt) return;
          setStand(null);
          setLadeFehler(true);
        });
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
  }, [versuch]);

  if (!inApp) return null;
  if (!stand) {
    if (!neu) return null;
    return ladeFehler ? (
      <div className="hb-fehler">
        Die Einstellungen ließen sich nicht laden.{' '}
        <button type="button" className="hb-link" onClick={() => setVersuch((v) => v + 1)}>
          Nochmal
        </button>
      </div>
    ) : (
      <p className="hb-klein">Einen Moment…</p>
    );
  }

  /*
    Nur die Anlässe, die der Server kennt. Ein älterer Server (die App kam am
    22.10.2026 vor dem Server-Release in TestFlight) liefert `serie` nicht:
    Der Schalter stand dann ohne Wert da, und jeder Tipp darauf scheiterte mit
    „Das hat nicht geklappt", weil der Server den Anlass ablehnt.
  */
  const zeilen = ZEILEN.filter(({ anlass }) => typeof stand.anlaesse[anlass] === 'boolean');

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

  const hinweisGeraet =
    stand.geraete === 0
      ? kannPush()
        ? gefragt
          ? 'Kommt nichts an? Dann sind Mitteilungen für Brauweg in den Systemeinstellungen deines Telefons aus.'
          : 'Dieses Telefon bekommt noch keine Mitteilungen.'
        : 'Diese Fassung der App kann noch keine Mitteilungen - das kommt mit dem nächsten Update.'
      : null;

  if (neu) {
    return (
      <section className="hb-blk" aria-labelledby="push-mitteilungen-titel">
        <h2 className="hb-ab" id="push-mitteilungen-titel">
          Mitteilungen
        </h2>
        <div className="hb-karte hb-einst-karte">
          {zeilen.map(({ anlass, name, hinweis }) => (
            <label key={anlass} className="hb-schalter" htmlFor={`push-${anlass}`}>
              <span className="hb-schalter-text">
                <strong>{name}</strong>
                <small>{hinweis}</small>
              </span>
              <input
                id={`push-${anlass}`}
                type="checkbox"
                role="switch"
                checked={stand.anlaesse[anlass]}
                onChange={(ereignis) => void schalte(anlass, ereignis.target.checked)}
              />
              <i aria-hidden="true" />
            </label>
          ))}
        </div>
        {hinweisGeraet && <p className="hb-klein hb-ohne-rand">{hinweisGeraet}</p>}
        {stand.geraete === 0 && kannPush() && !gefragt && (
          <button
            type="button"
            className="hb-kn is-gold is-breit"
            onClick={() => {
              erlauben();
              setGefragt(true);
            }}
          >
            Mitteilungen erlauben
          </button>
        )}
        {fehler && (
          <span className="hb-fehler" role="alert">
            {fehler}
          </span>
        )}
      </section>
    );
  }

  return (
    <section className="push-mitteilungen" aria-labelledby="push-mitteilungen-titel">
      <h3 id="push-mitteilungen-titel">Mitteilungen</h3>
      {zeilen.map(({ anlass, name, hinweis }) => (
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
      {hinweisGeraet && <p className="einstellungen-fussnote muted">{hinweisGeraet}</p>}
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
