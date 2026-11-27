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

import type { ReactNode } from 'react';

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
  children,
}: {
  sieger: Seite | null;
  /** Meine Seite in diesem Kampf, null beim Zusehen. */
  seite: Seite | null;
  schaden: number;
  /** Kaempfte ich gegen ein Abbild? Dann verliert die andere Seite nichts. */
  geist: boolean;
  stand: readonly Standzeile[];
  /** Darunter: wer noch kaempft, und der Weg zum Zuschauen (Spieltisch.tsx). */
  children?: ReactNode;
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
      {children}
    </div>
  );
}

/**
 * Unter dem Ergebnis: Wer kaempft noch, und der Weg dorthin.
 *
 * Ist der gezeigte Kampf vorbei, laufen die anderen oft noch zwanzig Sekunden
 * — die Schaupause richtet sich nach dem laengsten Kampf der Runde. Robin sah
 * dabei nur sein Ergebnis und hielt es fuer einen ewig langen Ladebildschirm.
 * Deshalb steht hier ausdruecklich „Die anderen kaempfen noch …", ein Knopf
 * „Zuschauen" fuer den ersten laufenden Kampf und eine Zeile je Paar zum
 * Umschalten. Ob ein Paar noch laeuft, ist der Vergleich seiner Dauer aus der
 * Sicht mit der Uhr der Arena — dieselbe Bremse wie `ergebniszeile` in
 * KampfAnzeige.tsx, damit kein Ausgang vor seiner Zeit verraten wird.
 */
export function Zuschauen({
  paarungen,
  gezeigt,
  ich,
  zeitMs,
  nameVon,
  onWahl,
  onEigener,
}: {
  paarungen: readonly { a: number; b: number; geist: boolean; dauerMs: number }[];
  /** Das gerade gezeigte Paar. */
  gezeigt: { a: number; b: number };
  ich: number | null;
  zeitMs: number;
  nameVon: (sitz: number) => string;
  onWahl: (sitz: number) => void;
  /** Zurueck zum eigenen Ergebnis — nur, wenn gerade ein fremdes Paar gezeigt wird. */
  onEigener?: () => void;
}): React.JSX.Element | null {
  const andere = paarungen.filter((p) => p.a !== gezeigt.a || p.b !== gezeigt.b);
  const laufende = andere.filter((p) => p.dauerMs > zeitMs);
  if (andere.length === 0 && !onEigener) return null;
  const name = (sitz: number): string => (sitz === ich ? tz('leiste.du') : nameVon(sitz));
  return (
    <div className={stil.zuschauen}>
      {laufende.length > 0 ? (
        <>
          <p className={stil.zuschauenText}>{tz('neu.zuschauen.laufen')}</p>
          <button type="button" className={stil.hauptknopf} onClick={() => onWahl(laufende[0]!.a)}>
            {tz('neu.zuschauen.knopf')}
          </button>
        </>
      ) : (
        <p className={stil.zuschauenText}>{tz('neu.zuschauen.alleFertig')}</p>
      )}
      {andere.length > 0 && (
        <ul className={stil.paare} aria-label={tz('kampf.weitere')}>
          {andere.map((p) => (
            <li key={`${p.a}-${p.b}`}>
              <button type="button" className={stil.paar} data-laeuft={p.dauerMs > zeitMs ? '' : undefined} onClick={() => onWahl(p.a)}>
                <span>
                  {p.geist
                    ? tz('kampf.gegenAbbild', { a: name(p.a), b: name(p.b) })
                    : tz('kampf.gegen', { a: name(p.a), b: name(p.b) })}
                </span>
                <em>{p.dauerMs > zeitMs ? tz('neu.zuschauen.laeuft') : tz('neu.zuschauen.vorbei')}</em>
              </button>
            </li>
          ))}
        </ul>
      )}
      {onEigener && (
        <button type="button" className={stil.zweitknopf} onClick={onEigener}>
          {tz('neu.zuschauen.zurueck')}
        </button>
      )}
    </div>
  );
}
