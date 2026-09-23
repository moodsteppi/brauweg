import type { Karte } from '../karte';

// k32 — Eisrutsche der Meister: ein Eisfeld ohne Reibung vor zwei
// Flipper-Pilzen, die den Lochzugang eng flankieren.
export const bahn: Karte = {
  id: 'k32-eisrutsche',
  name: 'Eisrutsche der Meister',
  schwierigkeit: 4,
  breite: 16,
  hoehe: 28,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 75,
  abschlaege: [
    [6, 25],
    [7, 25],
    [8, 25],
    [9, 25],
  ],
  loch: [8, 3],
  waende: [
    { x: 0, y: 20, w: 2, h: 5 },
    { x: 14, y: 20, w: 2, h: 5 },
  ],
  zonen: [
    { art: 'eis', x: 3, y: 10, w: 10, h: 9 },
    { art: 'bumper', x: 6, y: 5, r: 1.0 },
    { art: 'bumper', x: 10, y: 5, r: 1.0 },
  ],
  dekor: 'eis',
};
