/**
 * Die Bilder von DreckBro, gezeichnet statt geliefert.
 *
 * Pinguine statt Schweine war der Auftrag. Bis gelieferte Grafik da ist
 * (Bestellung: docs/ASSETS-DRECKBRO.md), zeichnet der Client Pinguin und
 * Kartenmotive als SVG — kein `<img>` auf eine Datei, die es noch nicht gibt
 * (CLAUDE.md). Die drei Dreckstufen muss man auf einen Blick unterscheiden
 * koennen, auch klein am Handy: sauber, ein paar Flecken, ganz im Schlamm.
 */

import type { KartenArt } from './sicht';

const SCHLAMM = '#7a4a22';
const SCHLAMM_HELL = '#9b6633';

/** Ein Pinguin auf einer Eisscholle; `dreck` 0 bis 2, wahlweise im Iglu. */
export function PinguinBild({ dreck, iglu }: { dreck: number; iglu: boolean }): React.JSX.Element {
  const froh = dreck >= 2;
  return (
    <svg viewBox="0 0 100 110" aria-hidden="true" focusable="false">
      {/* Scholle bzw. Schlammpfuetze darunter */}
      <ellipse cx="50" cy="100" rx="40" ry="8" fill={dreck >= 2 ? SCHLAMM : '#dff1ff'} />
      {dreck >= 2 && (
        <>
          <circle cx="16" cy="94" r="3" fill={SCHLAMM_HELL} />
          <circle cx="86" cy="92" r="2.5" fill={SCHLAMM_HELL} />
          <circle cx="80" cy="86" r="1.8" fill={SCHLAMM} />
        </>
      )}
      {/* Fuesse */}
      <ellipse cx="38" cy="98" rx="9" ry="4" fill="#f39c1f" />
      <ellipse cx="62" cy="98" rx="9" ry="4" fill="#f39c1f" />
      {/* Fluegel */}
      <path d="M22 52 Q8 72 18 86 Q26 74 28 58 Z" fill="#1d2747" />
      <path d="M78 52 Q92 72 82 86 Q74 74 72 58 Z" fill="#1d2747" />
      {/* Koerper und Bauch */}
      <ellipse cx="50" cy="62" rx="29" ry="36" fill="#1d2747" />
      <ellipse cx="50" cy="70" rx="20" ry="26" fill="#f7f7f2" />
      <ellipse cx="50" cy="34" rx="22" ry="18" fill="#1d2747" />
      <path d="M33 38 Q50 26 67 38 Q66 52 50 52 Q34 52 33 38 Z" fill="#f7f7f2" />
      {/* Augen: offen, im vollen Schlamm vor Freude zugekniffen */}
      {froh ? (
        <>
          <path d="M38 39 Q42 35 46 39" stroke="#1d2747" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M54 39 Q58 35 62 39" stroke="#1d2747" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="42" cy="39" r="3.4" fill="#1d2747" />
          <circle cx="58" cy="39" r="3.4" fill="#1d2747" />
          <circle cx="43" cy="38" r="1.1" fill="#fff" />
          <circle cx="59" cy="38" r="1.1" fill="#fff" />
        </>
      )}
      {/* Schnabel, im Schlamm weit offen */}
      {froh ? (
        <path d="M43 45 L57 45 L50 53 Z" fill="#f39c1f" />
      ) : (
        <path d="M44 45 L56 45 L50 50 Z" fill="#f39c1f" />
      )}
      {/* Wangen */}
      <circle cx="36" cy="46" r="3" fill="#ff9aa8" opacity="0.6" />
      <circle cx="64" cy="46" r="3" fill="#ff9aa8" opacity="0.6" />

      {dreck >= 1 && (
        <g fill={SCHLAMM}>
          <path d="M40 66 q6 -5 11 1 q4 6 -4 8 q-9 1 -7 -9 Z" />
          <circle cx="60" cy="80" r="4" />
          <circle cx="66" cy="28" r="3" />
          <path d="M24 70 q4 2 2 8 q-4 1 -5 -4 Z" />
        </g>
      )}
      {dreck >= 2 && (
        <g fill={SCHLAMM}>
          <path d="M30 78 Q50 70 70 78 Q72 92 50 96 Q28 92 30 78 Z" />
          <path d="M31 24 q8 -8 16 -4 q-2 8 -10 9 q-7 0 -6 -5 Z" />
          <circle cx="58" cy="60" r="5" />
          <path d="M76 58 q6 8 2 18 q-5 -4 -4 -12 Z" />
          <circle cx="45" cy="58" r="2.5" fill={SCHLAMM_HELL} />
          <path d="M42 96 q1 6 -1 9 q-2 -3 1 -9 Z" />
          <path d="M60 95 q2 5 0 8 q-3 -3 0 -8 Z" />
        </g>
      )}

      {iglu && (
        <g>
          <path
            d="M6 100 Q6 18 50 14 Q94 18 94 100"
            fill="#d8efff"
            fillOpacity="0.38"
            stroke="#eaf7ff"
            strokeWidth="4"
          />
          <g stroke="#b9dcf5" strokeWidth="1.6" fill="none" opacity="0.9">
            <path d="M9 78 Q50 70 91 78" />
            <path d="M14 56 Q50 46 86 56" />
            <path d="M26 34 Q50 26 74 34" />
            <path d="M30 78 L28 56 M70 78 L72 56 M50 72 L50 48 M40 52 L42 30 M60 52 L58 30" />
          </g>
        </g>
      )}
    </svg>
  );
}

/** Motiv einer Karte, quadratisch. */
export function KartenMotiv({ art }: { art: KartenArt }): React.JSX.Element {
  switch (art) {
    case 'pfuetze':
      return (
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <ellipse cx="30" cy="42" rx="24" ry="9" fill={SCHLAMM} />
          <ellipse cx="26" cy="40" rx="10" ry="3" fill={SCHLAMM_HELL} />
          <circle cx="18" cy="24" r="4" fill={SCHLAMM} />
          <circle cx="40" cy="20" r="3" fill={SCHLAMM} />
          <circle cx="30" cy="14" r="2.4" fill={SCHLAMM_HELL} />
          <path d="M30 34 q-4 -10 0 -16 q4 6 0 16 Z" fill={SCHLAMM} />
        </svg>
      );
    case 'schlammrutsche':
      return (
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <path d="M4 14 L56 46 L56 54 L4 54 Z" fill="#e8f4ff" />
          <path d="M4 14 Q30 26 56 46 L56 52 Q28 34 4 22 Z" fill={SCHLAMM} />
          <circle cx="20" cy="30" r="2.5" fill={SCHLAMM_HELL} />
          <circle cx="40" cy="42" r="2" fill={SCHLAMM_HELL} />
          <path d="M50 40 l6 -3 M48 34 l6 -1" stroke={SCHLAMM} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'schneeball':
      return (
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <path d="M6 30 h14 M8 22 h10 M8 38 h10" stroke="#9cc8ee" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="38" cy="30" r="16" fill="#fbfdff" stroke="#9cc8ee" strokeWidth="2" />
          <path d="M30 22 q4 -4 10 -2" stroke="#d6eaf9" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'eisregen':
      return (
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <path d="M14 30 a10 10 0 0 1 6 -18 a12 12 0 0 1 22 2 a9 9 0 0 1 4 16 Z" fill="#c9d7ea" />
          <g fill="#7fc3f5">
            <path d="M18 36 l-3 8 l5 -3 Z" />
            <path d="M30 36 l-3 10 l5 -3 Z" />
            <path d="M42 36 l-3 8 l5 -3 Z" />
            <path d="M24 46 l-2 7 l4 -2 Z" />
            <path d="M37 47 l-2 7 l4 -2 Z" />
          </g>
        </svg>
      );
    case 'iglu':
      return (
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <path d="M6 48 Q6 12 30 12 Q54 12 54 48 Z" fill="#eef8ff" stroke="#9cc8ee" strokeWidth="2" />
          <path d="M22 48 Q22 34 30 34 Q38 34 38 48 Z" fill="#33508a" />
          <g stroke="#b7d7f0" strokeWidth="1.5" fill="none">
            <path d="M8 38 H52 M12 28 H48 M18 19 H42" />
            <path d="M18 38 V28 M42 38 V28 M30 28 V19" />
          </g>
        </svg>
      );
    case 'tauwetter':
      return (
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="24" r="10" fill="#ffc93a" />
          <g stroke="#ffc93a" strokeWidth="3" strokeLinecap="round">
            <path d="M30 6 v5 M30 37 v5 M12 24 h5 M43 24 h5 M17 11 l4 4 M43 11 l-4 4 M17 37 l4 -4 M43 37 l-4 -4" />
          </g>
          <path d="M14 52 Q14 44 22 44 Q26 40 32 44 Q40 44 40 52 Z" fill="#dff1ff" />
          <path d="M24 52 q1 4 0 6 M32 52 q1 3 0 5" stroke="#7fc3f5" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'robbenklau':
      return (
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <ellipse cx="30" cy="40" rx="20" ry="12" fill="#8c97a8" />
          <circle cx="30" cy="26" r="11" fill="#8c97a8" />
          <circle cx="26" cy="24" r="2" fill="#1d2747" />
          <circle cx="34" cy="24" r="2" fill="#1d2747" />
          <ellipse cx="30" cy="30" rx="3" ry="2" fill="#1d2747" />
          <path d="M22 31 h-6 M22 33 l-5 2 M38 31 h6 M38 33 l5 2" stroke="#1d2747" strokeWidth="1" />
          <path d="M8 12 h12 l-3 -3 M52 18 h-12 l3 3" stroke="#f5c02e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
