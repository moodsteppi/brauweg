import type { Karte } from '../karte';

// k38 — Sprungfeld-Kaskade: zwei Federplatten ueber die volle
// Korridorbreite werfen den Ball zweimal nach oben, ein Strudel wartet
// knapp neben der Mittellinie.
export const bahn: Karte = {
  id: 'k38-sprungfeldkaskade',
  name: 'Sprungfeld-Kaskade',
  schwierigkeit: 5,
  breite: 30,
  hoehe: 50,
  par: 5,
  schlagLimit: 10,
  zeitLimitS: 110,
  abschlaege: [
    [13, 47],
    [14, 47],
    [16, 47],
    [17, 47],
  ],
  loch: [15, 3],
  waende: [
    { x: 0, y: 5, w: 10, h: 40 },
    { x: 20, y: 5, w: 10, h: 40 },
  ],
  zonen: [
    { art: 'sprungfeld', x: 10, y: 30, w: 10, h: 3, rx: 0, ry: -1, weite: 12 },
    { art: 'sprungfeld', x: 10, y: 14, w: 10, h: 3, rx: 0, ry: -1, weite: 12 },
    { art: 'strudel', x: 12, y: 22, r: 1.5, staerke: 12 },
  ],
  dekor: 'wiese',
};
