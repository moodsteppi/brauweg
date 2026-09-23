import type { Karte } from '../karte';

/**
 * Ein kleiner, kräftiger Strudel liegt genau auf der Linie zum Loch und dreht
 * jeden Ball ab, der ihn streift. Links oder rechts vorbei — aber nicht in den
 * Sand am Rand.
 */
export const bahn: Karte = {
  id: 'k42-die-strudelpfuetze',
  name: 'Die Strudelpfütze',
  schwierigkeit: 1,
  breite: 18,
  hoehe: 32,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 60,
  abschlaege: [
    [8, 29],
    [10, 29],
  ],
  loch: [9, 4],
  waende: [],
  zonen: [
    { art: 'strudel', x: 9, y: 17, r: 1.5, staerke: 25 },
    { art: 'sand', x: 0, y: 8, w: 3, h: 16 },
    { art: 'sand', x: 15, y: 8, w: 3, h: 16 },
  ],
  dekor: 'wueste',
  beschreibung: 'Ein kleiner, kräftiger Strudel liegt genau auf der Linie zum Loch und dreht jeden Ball ab, der ihn streift. Links oder rechts vorbei — aber nicht in den Sand am Rand.',
  thema: 'Strudel',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['strudel', 'sand', 'einstieg'],
};
