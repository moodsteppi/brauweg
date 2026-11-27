/**
 * Das Kopfband am Tisch: Zurueck, Runde und Phase mit Restzeit, darunter die
 * Mitspieler mit ihren Leben.
 *
 * DIE REIHE KOMMT AUS `leistenplaetze` (platzierung.ts) — derselben Rechnung
 * wie im alten Tafelrunde, nach Sitznummer und nicht nach Leben: Eine Leiste,
 * die sich nach jedem Kampf umsortiert, zwingt zum Suchen.
 *
 * Eine Kachel antippen legt das Brett dieses Mitspielers oben aufs Feld (in
 * der Ruestphase) bzw. zeigt seinen Kampf (im Kampf). Was das heisst,
 * entscheidet der Tisch; hier wird nur gemeldet, wer angetippt wurde.
 */

import { useEffect, useState } from 'react';

import { type Leistenplatz, leistenplaetze } from '../platzierung';
import type { TafelrundeSicht } from '../sicht';
import { tz, tzAnzahl } from '../text';
import { Herz } from './grafik';
import stil from './neu.module.css';
import { Gesicht } from './Suche';

export interface Sitzzeile {
  seat: number;
  displayName: string | null;
  accountId: string | null;
  avatarUrl: string | null;
  isBot: boolean;
  gast?: boolean;
}

/** Wie ein Sitz heisst — an einer Stelle, damit Leiste, Feld und Kampf gleich heissen. */
export function sitzName(zeile: Sitzzeile | undefined, sitz: number): string {
  return zeile?.displayName ?? (zeile?.isBot ? tz('sitz.ki') : tz('sitz.nummer', { n: sitz + 1 }));
}

/**
 * Sekunden bis zu einer Frist, jede Viertelsekunde nachgesehen. Am
 * SCHLUESSEL `frist` (eine Zahl) und nicht an einem Objekt (CLAUDE.md).
 */
export function useRestzeit(frist: number | null): number | null {
  const [rest, setRest] = useState<number | null>(null);
  useEffect(() => {
    if (frist === null) {
      setRest(null);
      return;
    }
    const tick = (): void => setRest(Math.max(0, Math.ceil((frist - Date.now()) / 1000)));
    tick();
    const uhr = window.setInterval(tick, 250);
    return () => window.clearInterval(uhr);
  }, [frist]);
  return rest;
}

export function Kopfband({
  sicht,
  sitze,
  gegnerJetzt,
  gezeigt,
  frist,
  onWahl,
  onZurueck,
  onRegeln,
}: {
  sicht: TafelrundeSicht;
  sitze: readonly Sitzzeile[];
  /** Mein Gegner dieser Runde, wenn er schon feststeht (nur im Kampf). */
  gegnerJetzt: number | null;
  /** Wessen Brett oben liegt bzw. wessen Kampf laeuft. */
  gezeigt: number | null;
  frist: number | null;
  onWahl: (sitz: number) => void;
  onZurueck: () => void;
  onRegeln: () => void;
}): React.JSX.Element {
  const rest = useRestzeit(frist);
  const reihe: Leistenplatz[] = leistenplaetze(sicht.eigenes, sicht.gegner, gegnerJetzt);
  const offen = reihe.filter((p) => p.ausRunde === null).length;
  const bereit = reihe.filter((p) => p.ausRunde === null && p.bereit).length;
  const zeile = (sitz: number): Sitzzeile | undefined => sitze.find((s) => s.seat === sitz);

  return (
    <header className={stil.kopfband}>
      <div className={stil.kopfZeile}>
        <button type="button" className={stil.kopfKnopf} onClick={onZurueck} aria-label={tz('zurueck')}>
          ‹
        </button>
        <div className={stil.phase}>
          <strong>{tz('runde', { n: sicht.runde })}</strong>
          <span>
            {tz(`phase.${sicht.phase}`)}
            {/* Die Ruestphase endet, wenn alle bereit sind — die Zahl sagt,
                wie weit das ist; die Restzeit nur, wenn der Server eine setzt. */}
            {sicht.phase === 'vorbereitung' && ` · ${tz('phase.bereitZaehler', { bereit, offen })}`}
          </span>
        </div>
        {rest !== null && (
          <span className={stil.uhr} role="timer" aria-label={tzAnzahl('phase.restSekunden', rest)} data-knapp={rest <= 5 ? '' : undefined}>
            {rest}
          </span>
        )}
        <button type="button" className={stil.kopfKnopf} onClick={onRegeln} aria-label={tz('regeln.titel')}>
          ?
        </button>
      </div>
      <ol className={stil.mitspieler} aria-label={tz('leiste.titel', { lebend: offen, gesamt: reihe.length })}>
        {reihe.map((p) => {
          const z = zeile(p.sitz);
          const name = p.ich ? tz('leiste.du') : sitzName(z, p.sitz);
          return (
            <li key={p.sitz}>
              <button
                type="button"
                className={stil.spielerKachel}
                data-ich={p.ich ? '' : undefined}
                data-gegner={p.gegnerJetzt ? '' : undefined}
                data-aus={p.ausRunde !== null ? '' : undefined}
                data-gezeigt={gezeigt === p.sitz ? '' : undefined}
                data-bereit={p.bereit && p.ausRunde === null ? '' : undefined}
                aria-label={
                  tz('leiste.kachel', { name, leben: p.leben }) +
                  (p.ausRunde !== null ? tz('leiste.kachelAus') : '') +
                  (p.gegnerJetzt ? tz('leiste.kachelGegner') : '')
                }
                onClick={() => onWahl(p.sitz)}
              >
                <Gesicht name={name} bildUrl={z?.avatarUrl ?? null} klasse={stil.kachelGesicht} />
                <span className={stil.kachelName}>{name}</span>
                <span className={stil.kachelLeben}>
                  <Herz />
                  {p.ausRunde !== null ? tz('leiste.raus') : p.leben}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </header>
  );
}
