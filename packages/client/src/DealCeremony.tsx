/**
 * Misch- und Austeilzeremonie am Filztisch.
 *
 * Einmal pro vollem Geben (48 Karten mit Neunen, 40 ohne) — nicht nach
 * einzelnen Kartenwechseln. Der Server hat die Haende schon, hier nur Show.
 * Unter prefers-reduced-motion laeuft nichts.
 */

import { useEffect } from 'react';

import { CardBack } from './CardFace';
import type { Deck } from './decks';
import type { Slot } from './tisch';

/**
 * Dieselben Plaetze wie am Tisch. Eigener Name, weil die Zeremonie nur die
 * Flugrichtung braucht - aber derselbe Typ, damit ein neuer Sitzplan nicht an
 * zwei Stellen gepflegt werden muss.
 */
export type DealSlot = Slot;

/** Volle Doppelkopf-Decks: mit Neunen 48, ohne (Scharfer Doko) 40. */
export const VOLLE_DECKS = new Set([40, 48]);

/**
 * Zwei Taktungen: die volle beim Doppelkopf (einmal je Partie ein Blatt), die
 * kurze beim Zauberer, wo jede Runde neu gegeben wird — dort soll das Mischen
 * nicht bei jeder der bis zu zwanzig Runden zaeh werden. Die CSS-Dauern
 * stehen unter `.doko-deal--kurz` passend kuerzer.
 */
const VOLL = { gather: 420, shuffle: 900, deal: 700, pad: 180, backs: 10, fan: 3 };
const KURZ = { gather: 300, shuffle: 440, deal: 480, pad: 120, backs: 6, fan: 2 };

export function dealDurationMs(kurz = false): number {
  const z = kurz ? KURZ : VOLL;
  return z.gather + z.shuffle + z.deal + z.pad;
}

/**
 * true, wenn gerade ein volles Blatt auf dem Tisch liegt und die Runde
 * noch in der Vorbehaltsphase ist — also genau nach dem Geben.
 */
export function isVollesGeben(
  phase: string | undefined,
  handCounts: Record<number, number> | undefined,
  trickLength: number,
): { ok: boolean; deckSize: number } {
  if (phase !== 'vorbehalt' || !handCounts || trickLength > 0) {
    return { ok: false, deckSize: 0 };
  }
  const deckSize = Object.values(handCounts).reduce((sum, n) => sum + n, 0);
  return { ok: VOLLE_DECKS.has(deckSize), deckSize };
}

export function DealCeremony({
  slots,
  deckSize,
  deck,
  kurz = false,
  onDone,
}: {
  slots: DealSlot[];
  /** Doppelkopf: das ganze Blatt (48/40). Zauberer: die Handgroesse der Runde. */
  deckSize: number;
  deck: Deck;
  /** Kurze Taktung fuer Spiele, die jede Runde neu geben. */
  kurz?: boolean;
  onDone: () => void;
}): React.JSX.Element {
  const z = kurz ? KURZ : VOLL;
  const duration = dealDurationMs(kurz);

  useEffect(() => {
    const handle = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(handle);
  }, [duration, onDone]);

  return (
    <div className={`doko-deal${kurz ? ' doko-deal--kurz' : ''}`} aria-hidden="true">
      <div className="doko-deal-glow" />
      <p className="doko-deal-label">
        <span className="doko-deal-label-mix">
          Sammeln · Mischen · {deckSize} {deckSize === 1 ? 'Karte' : 'Karten'}
        </span>
        <span className="doko-deal-label-deal">Austeilen…</span>
      </p>

      <div className="doko-deal-stage">
        {/* Vorrunden-Stapel laufen zur Mitte und werden zum Mischstapel. */}
        {slots.map((slot) => (
          <div key={`g-${slot}`} className={`doko-deal-gather at-${slot}`}>
            <i />
            <i />
            <i />
          </div>
        ))}

        {/* Ein Stapel = das ganze Blatt, einmal durchmischen. */}
        {Array.from({ length: z.backs }, (_, i) => (
          <div
            key={`mix-${i}`}
            className="doko-deal-mix"
            style={
              {
                '--i': i,
                '--n': z.backs,
                '--delay': `${z.gather + i * (kurz ? 22 : 28)}ms`,
              } as React.CSSProperties
            }
          >
            <div className="pc pc--back doko-deal-pc">
              <CardBack deck={deck} />
            </div>
          </div>
        ))}

        {/* Ein Austeil-Schub: je Platz ein kleiner Faecher, alle zugleich. */}
        {slots.flatMap((slot) =>
          Array.from({ length: z.fan }, (_, i) => (
            <div
              key={`fly-${slot}-${i}`}
              className={`doko-deal-fly to-${slot}`}
              style={
                {
                  '--delay': `${z.gather + z.shuffle + i * (kurz ? 34 : 45)}ms`,
                  '--spread': `${(i - 1) * 16}px`,
                } as React.CSSProperties
              }
            >
              <div className="pc pc--back doko-deal-pc">
                <CardBack deck={deck} />
              </div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}

/** true, wenn der Nutzer weniger Bewegung will. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
