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

const SHUFFLE_MS = 900;
const GATHER_MS = 420;
const DEAL_MS = 700;
const FINISH_PAD_MS = 180;
const SHUFFLE_BACKS = 10;
/** Pro Platz ein kleiner Faecher beim Austeilen (kein Karten-fuer-Karte). */
const FAN_PER_SEAT = 3;

export function dealDurationMs(): number {
  return GATHER_MS + SHUFFLE_MS + DEAL_MS + FINISH_PAD_MS;
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
  onDone,
}: {
  slots: DealSlot[];
  /** 48 mit Neunen, 40 ohne. */
  deckSize: number;
  deck: Deck;
  onDone: () => void;
}): React.JSX.Element {
  const duration = dealDurationMs();

  useEffect(() => {
    const handle = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(handle);
  }, [duration, onDone]);

  return (
    <div className="doko-deal" aria-hidden="true">
      <div className="doko-deal-glow" />
      <p className="doko-deal-label">
        <span className="doko-deal-label-mix">Sammeln · Mischen · {deckSize} Karten</span>
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
        {Array.from({ length: SHUFFLE_BACKS }, (_, i) => (
          <div
            key={`mix-${i}`}
            className="doko-deal-mix"
            style={
              {
                '--i': i,
                '--n': SHUFFLE_BACKS,
                '--delay': `${GATHER_MS + i * 28}ms`,
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
          Array.from({ length: FAN_PER_SEAT }, (_, i) => (
            <div
              key={`fly-${slot}-${i}`}
              className={`doko-deal-fly to-${slot}`}
              style={
                {
                  '--delay': `${GATHER_MS + SHUFFLE_MS + i * 45}ms`,
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
