/**
 * Einstellungen von Mememory — heute die Lautstaerke, morgen mehr.
 *
 * Ein eigenes Fenster und kein Schalter im Menue: Der Auftrag nennt "sowas
 * wie Lautstaerke", also ist es eine Liste, die waechst. Ein Zahnrad, das
 * genau einen Regler oeffnet, ist trotzdem richtig — das Zahnrad ist die
 * Stelle, an der man nachsieht, und es soll sie schon geben, bevor der zweite
 * Punkt dazukommt.
 *
 * **Kein getrennter An-Aus-Schalter.** Null ist aus. Zwei Bedienelemente fuer
 * dieselbe Frage ("hoere ich etwas?") sind eine Falle: Ein Regler auf
 * siebzig, aus dem nichts kommt, weil daneben noch ein Schalter steht, sieht
 * nach kaputt aus.
 *
 * Der Zug am Regler ist zugleich die Nutzergeste, die der AudioContext
 * braucht — das erledigt `setzeLautstaerke` (siehe klaenge.ts).
 */

import { useState } from 'react';

import { Kreuz } from '../../zeichen';
import { lautstaerke, setzeLautstaerke, spieleKlang, tonAn } from './klaenge';

export function Einstellungsfenster({ onFertig }: { onFertig: () => void }): React.JSX.Element {
  /**
   * Der Regler ist neu; wer den Ton nie eingeschaltet hat, soll hier die Null
   * sehen und nicht die Vorgabe. Sonst stuende dort "70", waehrend nichts zu
   * hoeren ist — genau der Widerspruch, den dieses Fenster aufloesen soll.
   */
  const [stand, setStand] = useState(() => (tonAn() ? lautstaerke() : 0));

  const ziehe = (wert: number): void => {
    setStand(wert);
    setzeLautstaerke(wert);
  };

  return (
    <div
      className="mm-kasten-schicht"
      role="dialog"
      aria-modal="true"
      aria-label="Einstellungen"
    >
      <div className="mm-kasten-blatt mm-blatt-schmal">
        <div className="mm-kasten-kopf">
          <h2>Einstellungen</h2>
          <button type="button" className="mm-kasten-zu" onClick={onFertig} aria-label="Schließen">
            <Kreuz />
          </button>
        </div>

        <div className="mm-kasten-inhalt">
          <label className="mm-regler">
            <span className="mm-regler-kopf">
              <b>Lautstärke</b>
              <em>{stand === 0 ? 'aus' : `${stand}`}</em>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={stand}
              onChange={(e) => ziehe(Number(e.target.value))}
              /*
               * Beim Loslassen ein Ton zur Probe, nicht bei jedem Schritt:
               * Waehrend des Ziehens kaeme alle paar Millisekunden einer, und
               * das ist kein Regler mehr, sondern ein Geraeusch.
               */
              onPointerUp={() => stand > 0 && spieleKlang('dreh')}
              onKeyUp={() => stand > 0 && spieleKlang('dreh')}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
