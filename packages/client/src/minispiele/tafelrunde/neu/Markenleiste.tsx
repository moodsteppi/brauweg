/**
 * Die Markenleiste und ihr Pop-up (Robins Lesehilfe, Umsetzungsplan 3).
 *
 * Eine Marke antippen tut zweierlei: Alle Traeger auf dem Feld bekommen den
 * Farbring der Marke (das macht das Feld, hier wird nur gemeldet, welche
 * Marke), UND ein Pop-up zeigt alle Einheiten der Marke — die vorhandenen
 * hervorgehoben — mit dem Satz je Schwelle.
 *
 * HIER WIRD NICHTS GEZAEHLT. Anzahl, erreichte und naechste Schwelle kommen
 * aus der Sicht (`synergien`), die Saetze je Schwelle aus der Tabelle
 * (`synergieTabelle`, Feld `text`). Welche Einheiten eine Marke tragen, steht
 * an jeder Einheit des Katalogs (`traegerVon` in Synergien.tsx).
 */

import { type Synergie, type Synergiestand, bonusSatz, markenFarbe, traegerVon } from '../Synergien';
import type { Einheit } from '../sicht';
import { einheitName, markeName, markeStufeText, markeWirkung, tz } from '../text';
import { Blatt } from './Blatt';
import { Figur, Kurzname, MarkeZeichen, kostenStufe } from './grafik';
import stil from './neu.module.css';

export function Markenleiste({
  staende,
  tabelle,
  gewaehlt,
  onWahl,
}: {
  staende: readonly Synergiestand[];
  tabelle: readonly Synergie[];
  gewaehlt: string | null;
  onWahl: (marke: string) => void;
}): React.JSX.Element {
  if (staende.length === 0) {
    return <p className={stil.markenleer}>{tz('leiste.keineMarken')}</p>;
  }
  return (
    <ul className={stil.markenleiste} aria-label={tz('leiste.synergien')}>
      {staende.map((s) => {
        const name = markeName(s.marke, tabelle.find((t) => t.marke === s.marke)?.name ?? s.name);
        const ziel = s.naechsteSchwelle ?? s.schwelle ?? s.anzahl;
        return (
          <li key={s.marke}>
            <button
              type="button"
              className={stil.markenchip}
              data-aktiv={s.schwelle !== null ? '' : undefined}
              data-gewaehlt={gewaehlt === s.marke ? '' : undefined}
              style={{ '--marke': markenFarbe(s.marke) } as React.CSSProperties}
              aria-pressed={gewaehlt === s.marke}
              aria-label={`${name} ${s.anzahl}/${ziel}`}
              onClick={() => onWahl(s.marke)}
            >
              <MarkeZeichen marke={s.marke} />
              <span>
                {s.anzahl}
                {s.naechsteSchwelle !== null && <small>/{s.naechsteSchwelle}</small>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Das Pop-up einer Marke: Wirkung, Stufen mit ihrem Satz, alle Traeger.
 *
 * `aufBrett` und `aufBank` sind die Kennungen der eigenen Einheiten — auf dem
 * Brett hervorgehoben (nur sie zaehlen fuer die Marke), auf der Bank leiser
 * markiert (man hat sie, sie zaehlen aber erst auf dem Feld).
 */
export function Markenpopup({
  marke,
  stand,
  synergie,
  katalog,
  aufBrett,
  aufBank,
  onEinheit,
  onSchliessen,
  ebene,
}: {
  marke: string;
  stand: Synergiestand | undefined;
  synergie: Synergie | undefined;
  katalog: Record<string, Einheit>;
  aufBrett: ReadonlySet<string>;
  aufBank: ReadonlySet<string>;
  onEinheit?: (id: string) => void;
  onSchliessen: () => void;
  ebene?: 1 | 2;
}): React.JSX.Element {
  const name = markeName(marke, synergie?.name ?? stand?.name ?? marke);
  const traeger = traegerVon(katalog, marke) as Einheit[];
  return (
    <Blatt
      titel={name}
      ebene={ebene}
      /* Kompakt, damit die Farbringe auf dem Feld darueber zu sehen bleiben —
         Ring und Pop-up sind EINE Antwort auf den Tipp. */
      kompakt
      kopf={
        <span className={stil.popupZeichen} style={{ '--marke': markenFarbe(marke) } as React.CSSProperties}>
          <MarkeZeichen marke={marke} />
        </span>
      }
      onSchliessen={onSchliessen}
    >
      {synergie && <p className={stil.text}>{markeWirkung(marke, synergie.wirkung)}</p>}
      <p className={stil.klein}>{tz('marke.aufDemBrett', { n: stand?.anzahl ?? 0 })}</p>
      {synergie && (
        <ol className={stil.stufen}>
          {synergie.stufen.map((st) => (
            <li
              key={st.schwelle}
              data-erreicht={stand?.schwelle !== null && stand?.schwelle !== undefined && st.schwelle <= stand.schwelle ? '' : undefined}
              data-gilt={stand?.schwelle === st.schwelle ? '' : undefined}
            >
              <b>{st.schwelle}</b>
              <span>{st.text ? markeStufeText(marke, st.schwelle, st.text) : bonusSatz(st.bonus)}</span>
            </li>
          ))}
        </ol>
      )}
      <h3 className={stil.unterTitel}>{tz('marke.traeger')}</h3>
      <ul className={stil.traeger}>
        {traeger.map((e) => (
          <li
            key={e.id}
            data-rahmen={kostenStufe(e.kosten)}
            data-brett={aufBrett.has(e.id) ? '' : undefined}
            data-bank={!aufBrett.has(e.id) && aufBank.has(e.id) ? '' : undefined}
          >
            <button type="button" onClick={onEinheit ? () => onEinheit(e.id) : undefined} disabled={!onEinheit}>
              <span className={stil.traegerBild}>
                <Figur einheit={e} klasse={stil.portraetFigur} />
              </span>
              <Kurzname name={einheitName(e)} klasse={stil.traegerName} />
              {aufBrett.has(e.id) && <em>{tz('neu.marke.aufFeld')}</em>}
              {!aufBrett.has(e.id) && aufBank.has(e.id) && <em>{tz('neu.marke.aufBank')}</em>}
            </button>
          </li>
        ))}
      </ul>
    </Blatt>
  );
}
