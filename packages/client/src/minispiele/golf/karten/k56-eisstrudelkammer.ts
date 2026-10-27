import type { Karte } from '../karte';

/**
 * Eine Eisfläche mit drei Strudeln und zwei Pilzen: Auf dem Eis bremst nichts,
 * und jeder Strudel reißt den Ball aus der Bahn. Das Loch liegt hinter einer
 * Wand oben links, hinaus geht es nur rechts über den Sand.
 */
export const bahn: Karte = {
  id: 'k56-eisstrudelkammer',
  name: 'Eisstrudelkammer',
  schwierigkeit: 4,
  breite: 26,
  hoehe: 44,
  par: 4,
  schlagLimit: 10,
  zeitLimitS: 100,
  abschlaege: [
    [12, 41],
    [14, 41],
  ],
  loch: [8, 4],
  waende: [
    { x: 0, y: 9, w: 18, h: 1 },
  ],
  zonen: [
    { art: 'eis', x: 2, y: 10, w: 22, h: 24 },
    { art: 'strudel', x: 8, y: 18, r: 1.5, staerke: 25 },
    { art: 'strudel', x: 18, y: 23, r: 1.5, staerke: 25 },
    { art: 'strudel', x: 11, y: 28, r: 1.5, staerke: 25 },
    { art: 'bumper', x: 6, y: 25, r: 1 },
    { art: 'bumper', x: 19, y: 14, r: 1 },
    { art: 'sand', x: 18, y: 7, w: 8, h: 2 },
  ],
  dekor: 'eis',
  beschreibung: 'Eine Eisfläche mit drei Strudeln und zwei Pilzen: Auf dem Eis bremst nichts, und jeder Strudel reißt den Ball aus der Bahn. Das Loch liegt hinter einer Wand oben links, hinaus geht es nur rechts über den Sand.',
  thema: 'Eis',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['eis', 'strudel', 'bumper', 'umweg'],
};
