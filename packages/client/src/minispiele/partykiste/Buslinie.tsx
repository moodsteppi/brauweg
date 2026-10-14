import { useEffect, useState } from 'react';

/**
 * Die Buslinie über den Karten beim Bus fahren (Emile, 13.10.2026: das
 * erste Bus-Design „macht nicht so richtig Sinn").
 *
 * Sie zeigt die Regel als Strecke: Wer fährt, muss drei Haltestellen
 * schaffen — Farbe, höher/tiefer, innen/außen. Jeder richtige Tipp bringt
 * den Bus eine Station weiter, der erste falsche beendet die Fahrt. Die
 * Haltestellen stehen genau über den drei Karten, die dort aufgedeckt
 * werden.
 *
 * Kein eigener Spielstand: `station` kommt aus der Sicht (`stufe` bzw. das
 * Ergebnis der letzten Fahrt), der Bildschirm rechnet nichts nach.
 */
const HALTE = ['Start', 'Farbe', 'Höher / tiefer', 'Innen / außen'] as const;

export function Buslinie({ station, panne }: { station: number; panne: boolean }): React.JSX.Element {
  // Räder drehen sich nur, während der Bus zur nächsten Station rollt.
  const [faehrt, setFaehrt] = useState(false);
  useEffect(() => {
    if (station === 0) return;
    setFaehrt(true);
    const t = setTimeout(() => setFaehrt(false), 900);
    return () => clearTimeout(t);
  }, [station]);

  const ziel = Math.max(0, Math.min(3, station));
  return (
    <div className="pk-linie" aria-label={`Bus an Station ${ziel} von 3`}>
      <div className="pk-linie-strecke">
        <span className="pk-linie-gefahren" style={{ width: `${(ziel / 3) * 100}%` }} />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="pk-linie-halt"
            data-erreicht={i <= ziel ? '' : undefined}
            data-ziel={i === 3 ? '' : undefined}
            style={{ left: `${(i / 3) * 100}%` }}
          />
        ))}
        <span
          className="pk-linie-bus"
          data-faehrt={faehrt ? '' : undefined}
          data-panne={panne ? '' : undefined}
          style={{ left: `${(ziel / 3) * 100}%` }}
        >
          <svg viewBox="0 0 64 36" aria-hidden="true">
            <rect x="2" y="4" width="58" height="24" rx="6" className="bus-koerper" />
            <rect x="2" y="20" width="58" height="3" className="bus-streifen" />
            <rect x="8" y="8" width="10" height="8" rx="2" className="bus-fenster" />
            <rect x="21" y="8" width="10" height="8" rx="2" className="bus-fenster" />
            <rect x="34" y="8" width="10" height="8" rx="2" className="bus-fenster" />
            <rect x="48" y="8" width="9" height="12" rx="2" className="bus-fenster" />
            <circle cx="58" cy="24" r="1.6" className="bus-licht" />
            <g className="bus-rad" style={{ transformOrigin: '16px 29px' }}>
              <circle cx="16" cy="29" r="5" />
              <rect x="15.2" y="25" width="1.6" height="8" />
            </g>
            <g className="bus-rad" style={{ transformOrigin: '48px 29px' }}>
              <circle cx="48" cy="29" r="5" />
              <rect x="47.2" y="25" width="1.6" height="8" />
            </g>
          </svg>
        </span>
      </div>
      {/* Jede Beschriftung genau unter ihrer Haltestelle; zu lange brechen
          am Leerzeichen um, statt in die Nachbarin zu laufen. */}
      <div className="pk-linie-namen">
        {HALTE.map((name, i) => (
          <span key={name} data-erreicht={i <= ziel ? '' : undefined} style={{ left: `${(i / 3) * 100}%` }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
