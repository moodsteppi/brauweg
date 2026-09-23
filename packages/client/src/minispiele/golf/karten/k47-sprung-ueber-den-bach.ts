import type { Karte } from '../karte';

/**
 * Ein Bach quert die Bahn, nur ganz rechts führt ein Sandsteg hinüber. Direkt
 * davor wirft ein Sprungfeld den Ball über das Wasser — mit genug Tempo landet
 * er fast am Loch.
 */
export const bahn: Karte = {
  id: 'k47-sprung-ueber-den-bach',
  name: 'Sprung über den Bach',
  schwierigkeit: 2,
  breite: 20,
  hoehe: 40,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 75,
  abschlaege: [
    [8, 37],
    [10, 37],
  ],
  loch: [8, 6],
  waende: [],
  zonen: [
    { art: 'wasser', x: 0, y: 18, w: 15, h: 4 },
    { art: 'sand', x: 15, y: 18, w: 5, h: 4 },
    { art: 'sprungfeld', x: 10, y: 23, w: 5, h: 2, rx: 0, ry: -1, weite: 10 },
  ],
  dekor: 'nacht',
  beschreibung: 'Ein Bach quert die Bahn, nur ganz rechts führt ein Sandsteg hinüber. Direkt davor wirft ein Sprungfeld den Ball über das Wasser — mit genug Tempo landet er fast am Loch.',
  thema: 'Sprungfeld',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['sprungfeld', 'wasser', 'sand', 'abkuerzung'],
};
