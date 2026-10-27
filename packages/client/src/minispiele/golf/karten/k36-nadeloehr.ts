import type { Karte } from '../karte';

// k36 — Nadeloehr: ein enger Zickzack aus zwei 2-E-Luecken auf
// entgegengesetzten Seiten, ein Eisstreifen dazwischen straft Ungenauigkeit.
export const bahn: Karte = {
  id: 'k36-nadeloehr',
  name: 'Nadeloehr',
  schwierigkeit: 4,
  breite: 14,
  hoehe: 20,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 55,
  abschlaege: [
    [5, 18],
    [6, 18],
    [7, 18],
    [8, 18],
  ],
  loch: [3, 3],
  waende: [
    { x: 0, y: 12, w: 12, h: 1 },
    { x: 2, y: 6, w: 12, h: 1 },
  ],
  zonen: [{ art: 'eis', x: 4, y: 8, w: 6, h: 3 }],
  dekor: 'eis',
};
