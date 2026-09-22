import type { Karte } from '../karte';

/**
 * Zwei schräge Wände bilden einen Trichter kurz vor dem Loch — die Mündung
 * ist weit (10 E), die Kehle bleibt mit 4 E immer noch großzügig. Sand
 * steht dort, wo ein Fehlschlag sonst bis an den Rand rollen würde, nicht
 * auf der geraden Linie zum Loch.
 */
export const bahn: Karte = {
  id: 'k02-der-sandkasten',
  name: 'Der Sandkasten',
  schwierigkeit: 1,
  breite: 14,
  hoehe: 20,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 50,
  abschlaege: [
    [4, 17],
    [6, 17],
    [8, 17],
    [10, 17],
  ],
  loch: [7, 3],
  waende: [
    { ax: 2, ay: 8, bx: 5, by: 5, dicke: 0.6 },
    { ax: 12, ay: 8, bx: 9, by: 5, dicke: 0.6 },
  ],
  zonen: [
    { art: 'sand', x: 1, y: 6, w: 3, h: 9 },
    { art: 'sand', x: 10, y: 6, w: 3, h: 9 },
  ],
  dekor: 'wueste',
};
