/**
 * Das Rundenende: Sieg oder Niederlage, die verlorenen Leben, der
 * Zwischenstand.
 *
 * Es steht ueber der Arena, sobald der EIGENE Kampf sein Ende-Ereignis
 * erreicht hat, und bleibt, bis der Server die Phase wechselt — die Dauer der
 * Schaupause bestimmt der Server, nicht dieses Bild (KampfAnzeige.tsx, „Wann
 * es zurueckgeht").
 *
 * Die verlorenen Leben sind `schaden` aus dem Bericht, der Zwischenstand die
 * Leben aus der Sicht. Ein Abbild (Geist) verliert nichts; wer gegen eins
 * verliert, zahlt trotzdem (siehe `ergebniszeile` in KampfAnzeige.tsx).
 */

import type { Seite } from '../KampfAnzeige';
import { tz } from '../text';
import { Herz } from './grafik';
import stil from './neu.module.css';

export interface Standzeile {
  sitz: number;
  name: string;
  leben: number;
  ich: boolean;
  aus: boolean;
}

export function Rundenende({
  sieger,
  seite,
  schaden,
  geist,
  stand,
}: {
  sieger: Seite | null;
  /** Meine Seite in diesem Kampf, null beim Zusehen. */
  seite: Seite | null;
  schaden: number;
  /** Kaempfte ich gegen ein Abbild? Dann verliert die andere Seite nichts. */
  geist: boolean;
  stand: readonly Standzeile[];
}): React.JSX.Element {
  const ausgang = sieger === null ? 'unentschieden' : seite === null ? 'zuschauer' : sieger === seite ? 'sieg' : 'niederlage';
  const zeilen = [...stand].sort((a, b) => Number(a.aus) - Number(b.aus) || b.leben - a.leben);
  return (
    <div className={stil.rundenende} data-ausgang={ausgang} role="status">
      <h2>
        {ausgang === 'sieg'
          ? tz('neu.runde.sieg')
          : ausgang === 'niederlage'
            ? tz('neu.runde.niederlage')
            : ausgang === 'unentschieden'
              ? tz('kampf.unentschieden')
              : tz('neu.runde.vorbei')}
      </h2>
      <p>
        {ausgang === 'niederlage'
          ? tz('kampf.duVerlierst', { n: schaden })
          : ausgang === 'sieg'
            ? geist
              ? tz('kampf.abbildVerliertNichts')
              : tz('neu.runde.gegnerVerliert', { n: schaden })
            : ausgang === 'unentschieden'
              ? tz('kampf.niemandVerliert')
              : ''}
      </p>
      <ol className={stil.zwischenstand} aria-label={tz('neu.runde.zwischenstand')}>
        {zeilen.map((z) => (
          <li key={z.sitz} data-ich={z.ich ? '' : undefined} data-aus={z.aus ? '' : undefined}>
            <span>{z.ich ? tz('leiste.du') : z.name}</span>
            <span>
              <Herz />
              {z.aus ? tz('leiste.raus') : z.leben}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
