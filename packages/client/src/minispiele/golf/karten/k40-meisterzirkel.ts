import type { Karte } from '../karte';

// k40 — Der Meisterzirkel: ein Drehkreuz vor einem kurzen Portalsprung —
// die Kroenung aus allen Ketten-Ideen auf kompaktem Raum.
export const bahn: Karte = {
  id: 'k40-meisterzirkel',
  name: 'Der Meisterzirkel',
  schwierigkeit: 5,
  breite: 20,
  hoehe: 32,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 70,
  abschlaege: [
    [9, 29],
    [10, 29],
    [12, 29],
    [13, 29],
  ],
  loch: [10, 2.5],
  waende: [
    { x: 0, y: 4, w: 6, h: 22 },
    { x: 14, y: 4, w: 6, h: 22 },
  ],
  zonen: [
    { art: 'drehkreuz', x: 10, y: 18, laenge: 4, gradJeTakt: 3, phase: 0 },
    { art: 'portal', x: 10, y: 12, r: 1.0, ziel: { x: 10, y: 6 }, paar: 0 },
    { art: 'portal', x: 10, y: 6, r: 1.0, ziel: { x: 10, y: 12 }, paar: 0 },
  ],
  dekor: 'nacht',
};
