import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k15 — Der Lange Schlauch (Schlauch mit Schikane + Drehkreuz) — Querformat
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
  id: 'k15-langer-schlauch',
  name: 'Der Lange Schlauch',
  schwierigkeit: 2,
  breite: 32,
  hoehe: 20,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 80,
  abschlaege: [
    [1.3, 3],
    [1.3, 9],
    [1.3, 12],
    [1.3, 18],
  ],
  loch: [28, 10.5],
  waende: [
    // Der Schlauch selbst …
    { x: 2, y: 6, w: 28, h: 1 },
    { x: 2, y: 15, w: 28, h: 1 },
    // … und zwei Schikanen darin: eine von oben, eine von unten, damit der
    // Ball nicht einfach geradeaus durchrollt.
    { x: 9.5, y: 7, w: 1, h: 5 },
    { x: 19.5, y: 10, w: 1, h: 5 },
  ],
  zonen: [
    // Kurze Balken zwischen den Schikanen: Sie sperren die Fahrbahn nie
    // ganz, sondern zwingen nur zu einem kleinen Schlenker.
    { art: 'drehkreuz', x: 14, y: 11, laenge: 3, gradJeTakt: 3, phase: 0 },
    { art: 'drehkreuz', x: 25, y: 11, laenge: 3, gradJeTakt: -4, phase: 45 },
  ],
  dekor: 'nacht',
};
