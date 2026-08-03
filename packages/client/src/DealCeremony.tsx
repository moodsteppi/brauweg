/**
 * Misch- und Austeilzeremonie am Filztisch.
 *
 * Rein clientseitig: Der Server hat die Hand schon ausgeteilt. Hier wird kurz
 * gemischt und dann in Wellen (je drei Karten) an die Plaetze gefaechert —
 * wie am echten Tisch. Unter prefers-reduced-motion laeuft nichts.
 */

import { useEffect, useMemo } from 'react';

import { CardBack } from './CardFace';
import type { Deck } from './decks';

export type DealSlot = 'bottom' | 'left' | 'top' | 'right' | 'top-left' | 'top-right';

const SHUFFLE_MS = 850;
const WAVE_MS = 300;
const FINISH_PAD_MS = 220;
const CARDS_PER_WAVE = 3;
const SHUFFLE_BACKS = 9;

export function dealDurationMs(cardsPerSeat: number): number {
  const waves = Math.max(1, Math.ceil(cardsPerSeat / CARDS_PER_WAVE));
  return SHUFFLE_MS + waves * WAVE_MS + FINISH_PAD_MS;
}

export function DealCeremony({
  slots,
  cardsPerSeat,
  deck,
  onDone,
}: {
  /** Mitspieler-Plaetze inkl. eigener Hand (bottom), im Uhrzeigersinn. */
  slots: DealSlot[];
  cardsPerSeat: number;
  deck: Deck;
  onDone: () => void;
}): React.JSX.Element {
  const waves = Math.max(1, Math.ceil(cardsPerSeat / CARDS_PER_WAVE));
  const duration = dealDurationMs(cardsPerSeat);

  const flies = useMemo(() => {
    const out: { key: string; slot: DealSlot; wave: number; inWave: number }[] = [];
    for (let w = 0; w < waves; w++) {
      const remaining = cardsPerSeat - w * CARDS_PER_WAVE;
      const n = Math.min(CARDS_PER_WAVE, remaining);
      for (const slot of slots) {
        for (let i = 0; i < n; i++) {
          out.push({
            key: `${w}-${slot}-${i}`,
            slot,
            wave: w,
            inWave: i,
          });
        }
      }
    }
    return out;
  }, [slots, cardsPerSeat, waves]);

  useEffect(() => {
    const handle = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(handle);
  }, [duration, onDone]);

  return (
    <div className="doko-deal" aria-hidden="true">
      <div className="doko-deal-glow" />
      <p className="doko-deal-label">Wird gemischt…</p>

      <div className="doko-deal-stage">
        {/* Stapel, der sich mischt, bevor die Wellen starten. */}
        {Array.from({ length: SHUFFLE_BACKS }, (_, i) => (
          <div
            key={`mix-${i}`}
            className="doko-deal-mix"
            style={
              {
                '--i': i,
                '--n': SHUFFLE_BACKS,
                '--delay': `${i * 35}ms`,
              } as React.CSSProperties
            }
          >
            <div className="pc pc--back doko-deal-pc">
              <CardBack deck={deck} />
            </div>
          </div>
        ))}

        {/* Austeil-Wellen: drei Karten je Platz, reihum. */}
        {flies.map((fly) => (
          <div
            key={fly.key}
            className={`doko-deal-fly to-${fly.slot}`}
            style={
              {
                '--wave': fly.wave,
                '--in': fly.inWave,
                '--delay': `${SHUFFLE_MS + fly.wave * WAVE_MS + fly.inWave * 40}ms`,
                '--spread': `${(fly.inWave - 1) * 14}px`,
              } as React.CSSProperties
            }
          >
            <div className="pc pc--back doko-deal-pc">
              <CardBack deck={deck} />
            </div>
          </div>
        ))}
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
