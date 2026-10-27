import type { Karte } from '../karte';

/**
 * Drei Strudel im Zickzack vor dem Trichter, ein vierter dahinter, dann zwei
 * Drehkreuze: eines im Tor, eines direkt vor dem Loch. Hier zählt nicht die
 * Kraft, sondern der Moment.
 */
export const bahn: Karte = {
  id: 'k58-wirbelsturm',
  name: 'Wirbelsturm',
  schwierigkeit: 5,
  breite: 30,
  hoehe: 56,
  par: 4,
  schlagLimit: 11,
  zeitLimitS: 110,
  abschlaege: [
    [14, 53],
    [16, 53],
  ],
  loch: [15, 4.5],
  waende: [
    { ax: 0.5, ay: 36, bx: 11, by: 27, dicke: 1 },
    { ax: 29.5, ay: 36, bx: 19, by: 27, dicke: 1 },
    { x: 0, y: 12, w: 12, h: 1 },
    { x: 18, y: 12, w: 12, h: 1 },
  ],
  zonen: [
    { art: 'strudel', x: 9, y: 45, r: 1.5, staerke: 25 },
    { art: 'strudel', x: 21, y: 45, r: 1.5, staerke: 25 },
    { art: 'strudel', x: 15, y: 37, r: 1.5, staerke: 25 },
    { art: 'strudel', x: 10, y: 19, r: 2, staerke: 30 },
    { art: 'bumper', x: 20, y: 19, r: 1 },
    { art: 'drehkreuz', x: 15, y: 12.5, laenge: 4, gradJeTakt: 4, phase: 0 },
    { art: 'drehkreuz', x: 15, y: 8.5, laenge: 3, gradJeTakt: -5, phase: 90 },
    { art: 'sand', x: 0, y: 0, w: 8, h: 12 },
    { art: 'sand', x: 22, y: 0, w: 8, h: 12 },
  ],
  dekor: 'wueste',
  beschreibung: 'Drei Strudel im Zickzack vor dem Trichter, ein vierter dahinter, dann zwei Drehkreuze: eines im Tor, eines direkt vor dem Loch. Hier zählt nicht die Kraft, sondern der Moment.',
  thema: 'Strudel',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['strudel', 'drehkreuz', 'bumper', 'sand', 'meister'],
};
