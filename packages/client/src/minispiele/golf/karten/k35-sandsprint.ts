import type { Karte } from '../karte';

// k35 — Sandsprint: ein dickes Sandfeld liegt auf dem Weg zum Loch, der
// Beschleuniger davor ist der einzige Weg, es in vernuenftig wenigen
// Schlaegen zu durchqueren.
export const bahn: Karte = {
  id: 'k35-sandsprint',
  name: 'Sandsprint',
  schwierigkeit: 4,
  breite: 16,
  hoehe: 26,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 75,
  abschlaege: [
    [6, 23],
    [7, 23],
    [8, 23],
    [9, 23],
  ],
  loch: [8, 4],
  waende: [],
  zonen: [
    { art: 'beschleuniger', x: 5, y: 16, w: 6, h: 3, rx: 0, ry: -1, staerke: 32 },
    { art: 'sand', x: 4, y: 8, w: 8, h: 7 },
  ],
  dekor: 'wueste',
};
