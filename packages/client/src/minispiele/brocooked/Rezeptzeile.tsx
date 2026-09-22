import { STATION_WO, ZUSTAND_NAMEN, ZUTAT_NAMEN, rezept, stuecke } from './rezepte';
import { zustandFarbe } from './farben';
import stil from './Rezeptzeile.module.css';

/**
 * Was ein Gericht verlangt, als Kette kleiner Marken.
 *
 * Vorher stand auf dem Ticket nur der Name. „Burger" sagt aber niemandem,
 * dass er Teig, gebratenes Fleisch und Salat braucht — wer das Spiel zum
 * ersten Mal öffnet, rät. Die Kette steht deshalb an beiden Stellen, an denen
 * man sie braucht: auf dem laufenden Ticket und in der Rezeptkarte des Menüs.
 *
 * **Der Zustand steckt in der Marke, nicht daneben.** Eine Zutat, die
 * geschnitten gehört, trägt einen Schnitt; eine, die gegart gehört, einen
 * Ring. Dazu die Farbe, die sie auch in der Küche hat (`zustandFarbe`) —
 * damit die Marke dasselbe zeigt wie das Ding auf der Theke.
 *
 * Für Vorleseprogramme trägt jede Marke ihren ganzen Namen („Fleisch,
 * gegart"); zu sehen ist nur die Farbe, und Farbe allein ist keine Auskunft.
 */
export function Rezeptzeile({
  rezeptId,
  klein = false,
}: {
  rezeptId: string;
  /** Auf dem Ticket kleiner als in der Rezeptkarte. */
  klein?: boolean;
}): React.JSX.Element {
  const r = rezept(rezeptId);
  return (
    <ul className={`${stil.kette} ${klein ? stil.klein : ''}`}>
      {stuecke(r).map((stueck, i) => {
        const name = `${ZUTAT_NAMEN[stueck.zutat]}, ${ZUSTAND_NAMEN[stueck.zustand]}`;
        return (
          <li
            key={`${stueck.zutat}-${i}`}
            className={stil.marke}
            data-zustand={stueck.zustand}
            style={{ background: zustandFarbe(stueck.zutat, stueck.zustand) }}
            title={name}
            aria-label={name}
          />
        );
      })}
    </ul>
  );
}

/** Eine Zeile der Rezeptkarte: Name, Kette, und wo gegart wird. */
export function Rezeptkarte({ rezeptId }: { rezeptId: string }): React.JSX.Element {
  const r = rezept(rezeptId);
  return (
    <li className={stil.karte}>
      <span className={stil.name}>{r.name}</span>
      <Rezeptzeile rezeptId={rezeptId} />
      <span className={stil.station}>
        {r.station === null ? 'ohne Garen' : STATION_WO[r.station]}
      </span>
    </li>
  );
}
