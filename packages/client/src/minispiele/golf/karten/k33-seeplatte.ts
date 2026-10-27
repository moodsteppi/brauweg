import type { Karte } from '../karte';

// k33 — Seeplatte: eine Wasserflaeche liegt gleich neben der geraden Linie
// vom Abschlag zum Loch, Sand auf der anderen Seite faengt den Fehlschlag,
// der ihr zu grossraeumig ausweicht.
export const bahn: Karte = {
  id: 'k33-seeplatte',
  name: 'Seeplatte',
  schwierigkeit: 4,
  breite: 18,
  hoehe: 30,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 80,
  abschlaege: [
    [2, 27],
    [3, 27],
    [4, 27],
    [5, 27],
  ],
  loch: [4, 4],
  waende: [],
  zonen: [
    { art: 'wasser', x: 7, y: 14, w: 4, h: 4 },
    { art: 'sand', x: 11, y: 19, w: 5, h: 6 },
  ],
  dekor: 'wueste',
};
