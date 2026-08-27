/**
 * "Online-Match" — gegen wie viele?
 *
 * Ein eigener Schritt zwischen Knopf und Suche, und der Grund ist die
 * Warteschlange: Wer zu viert spielen will, kann nicht an einem Tisch fuer
 * zwei landen. Jede Gegnerzahl ist deshalb ein eigener Topf, und man sucht
 * ausschliesslich in dem, den man gewaehlt hat.
 *
 * **Die Zahl neben jeder Zeile ist keine Zierde.** Sie sagt, wie viele
 * Tische in diesem Topf gerade offen sind. Ohne sie waehlt man zu viert und
 * wartet, ohne je zu erfahren, dass dort niemand ist — auf einer Plattform
 * mit einer Handvoll Leuten ist genau das der Normalfall.
 */

import { useEffect, useState } from 'react';

import { api } from '../../api';

/** Wie viele Gegner man haben will. Sitze am Tisch sind einer mehr. */
export type Gegnerzahl = 1 | 2 | 3;

const WAHL: readonly { zahl: Gegnerzahl; name: string; satz: string }[] = [
  { zahl: 1, name: 'Einer gegen einen', satz: 'Zwölf Paare, das schnellste Duell.' },
  { zahl: 2, name: 'Zu dritt', satz: 'Sechzehn Paare — vier kommen später vom Stapel dazu.' },
  { zahl: 3, name: 'Zu viert', satz: 'Zwanzig Paare, zweimal wird zwischendurch neu gemischt.' },
];

export function OnlineMatch({
  laeuft,
  fehler,
  onSuchen,
  onBack,
}: {
  laeuft: boolean;
  fehler: string | null;
  onSuchen: (gegner: Gegnerzahl) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [gewaehlt, setGewaehlt] = useState<Gegnerzahl>(1);
  /** Offene Tische je Sitzzahl. Ein Abruf, im Client aufgeteilt. */
  const [offen, setOffen] = useState<Record<number, number>>({});

  useEffect(() => {
    let lebt = true;
    const hole = (): void => {
      void api
        .tables('mememory')
        .then((zeilen) => {
          if (!lebt) return;
          const zaehler: Record<number, number> = {};
          for (const zeile of zeilen) {
            if (zeile.occupied >= zeile.seats) continue;
            zaehler[zeile.seats] = (zaehler[zeile.seats] ?? 0) + 1;
          }
          setOffen(zaehler);
        })
        .catch(() => {
          /* Die Zahl ist Beiwerk. Ohne sie waehlt man eben blind. */
        });
    };
    hole();
    const takt = window.setInterval(hole, 4000);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, []);

  return (
    <main className="mm-menue">
      <button className="mm-zurueck" type="button" onClick={onBack} disabled={laeuft}>
        ← Zurück
      </button>

      <div className="mm-menue-mitte">
        <h1 className="mm-titel mm-titel-klein">Online-Match</h1>
        <p className="mm-untertitel">Gegen wie viele willst du spielen?</p>

        <div className="mm-zahlwahl">
          {WAHL.map((eintrag) => {
            const wartend = offen[eintrag.zahl + 1] ?? 0;
            return (
              <button
                key={eintrag.zahl}
                type="button"
                className="mm-zahl"
                data-an={eintrag.zahl === gewaehlt ? '' : undefined}
                aria-pressed={eintrag.zahl === gewaehlt}
                onClick={() => setGewaehlt(eintrag.zahl)}
                disabled={laeuft}
              >
                <span className="mm-zahl-name">{eintrag.name}</span>
                {/* Ein offener Tisch heisst: Dort sitzt schon jemand und
                    wartet. Null heisst nicht "geht nicht", sondern "du machst
                    den ersten auf" — deshalb steht da ein Strich und keine
                    Warnung. */}
                <span className="mm-zahl-warten">{wartend > 0 ? `${wartend} offen` : '–'}</span>
              </button>
            );
          })}
        </div>

        <p className="mm-stufensatz">
          {WAHL.find((eintrag) => eintrag.zahl === gewaehlt)?.satz}
        </p>

        <button
          className="mm-suchen"
          type="button"
          onClick={() => onSuchen(gewaehlt)}
          disabled={laeuft}
        >
          <span>{laeuft ? 'Suche läuft…' : 'Suchen'}</span>
        </button>

        {fehler && <p className="mm-fehler">{fehler}</p>}
      </div>
    </main>
  );
}
