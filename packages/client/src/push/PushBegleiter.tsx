import { useEffect, useState } from 'react';

import '../screens/hub-neu.css';
import '../screens/spiel-einstieg.css';
import { TISCH_EREIGNIS, erlauben, melde, merkeGefragt, sollFragen } from './dienst';

/**
 * Push in der App, unsichtbar bis zur einen Frage.
 *
 * Eingehaengt in App.tsx, und nur dort, nur in der App (`inApp`) und nur
 * nachgeladen — auf der Webseite kommt diese Datei nie ueber die Leitung.
 *
 * Zwei Aufgaben:
 *   1. Jedes Token, das die Huelle meldet, geht an den Server (`melde`).
 *   2. Beim ersten Tisch einmal freundlich fragen, ob wir Bescheid sagen
 *      duerfen — und erst nach dem "Ja" die Systemabfrage ausloesen. Die
 *      Systemabfrage gibt es je Telefon nur einmal; wer dort ablehnt, kommt
 *      nur noch ueber die Systemeinstellungen zurueck. Die eigene Frage davor
 *      kostet nichts und faengt das "Noch nicht" ab.
 */
export function PushBegleiter({ kontoId }: { kontoId: string }): React.JSX.Element | null {
  const [frage, setFrage] = useState(false);

  useEffect(() => melde(kontoId), [kontoId]);

  useEffect(() => {
    const amTisch = (): void => {
      if (sollFragen()) setFrage(true);
    };
    window.addEventListener(TISCH_EREIGNIS, amTisch);
    return () => window.removeEventListener(TISCH_EREIGNIS, amTisch);
  }, []);

  if (!frage) return null;

  const nein = (): void => {
    merkeGefragt('nein');
    setFrage(false);
  };
  const ja = (): void => {
    erlauben();
    setFrage(false);
  };

  /*
   * Die Frage im Nachtblau-&-Gold-Stil des Hubs. Sie
   * kommt am Tisch, also ausserhalb der Hub-Wurzel — die eigene Ebene
   * `.spe.spe-schicht` bringt Farben und Knoepfe des Hubs mit, ohne den
   * Tisch darunter zu verdecken.
   */
  return (
    <div className="spe spe-schicht" role="presentation">
      <div className="spe-frage" role="dialog" aria-modal="true" aria-labelledby="push-frage-titel">
        <h2 id="push-frage-titel" className="hb-titel">
          Sollen wir dir Bescheid sagen?
        </h2>
        <p>
          Wenn du dran bist oder deine Runde startet, schicken wir dir eine kurze Mitteilung —
          auch wenn die App gerade zu ist.
        </p>
        <p className="hb-klein">Was genau, stellst du jederzeit in den Einstellungen ein.</p>
        <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={ja}>
          Ja, gern
        </button>
        <button type="button" className="hb-leise-knopf" onClick={nein}>
          Lieber nicht
        </button>
      </div>
    </div>
  );
}
