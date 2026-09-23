import type { Karte } from '../karte';

/**
 * Ein See trennt Abschlag und Loch. Links nimmt ein Schubfeld Anlauf für ein
 * Sprungfeld, das mit vollem Tempo über das ganze Wasser trägt — zu zaghaft,
 * und der Ball landet im See. Der sichere Weg führt rechts am Ufer entlang
 * durch den Sand.
 */
export const bahn: Karte = {
  id: 'k55-der-seesprung',
  name: 'Der Seesprung',
  schwierigkeit: 4,
  breite: 30,
  hoehe: 52,
  par: 5,
  schlagLimit: 10,
  zeitLimitS: 100,
  abschlaege: [
    [15, 49],
    [17, 49],
  ],
  loch: [11, 8],
  waende: [
    { x: 20, y: 27, w: 1, h: 11 },
  ],
  zonen: [
    { art: 'beschleuniger', x: 5, y: 41, w: 8, h: 6, rx: 0, ry: -1, staerke: 35 },
    { art: 'sprungfeld', x: 4, y: 38, w: 10, h: 2, rx: 0, ry: -1, weite: 16 },
    { art: 'wasser', x: 0, y: 27, w: 20, h: 11 },
    { art: 'sand', x: 21, y: 28, w: 9, h: 5 },
    { art: 'sand', x: 4, y: 2, w: 5, h: 10 },
  ],
  dekor: 'wueste',
  beschreibung: 'Ein See trennt Abschlag und Loch. Links nimmt ein Schubfeld Anlauf für ein Sprungfeld, das mit vollem Tempo über das ganze Wasser trägt — zu zaghaft, und der Ball landet im See. Der sichere Weg führt rechts am Ufer entlang durch den Sand.',
  thema: 'Sprungfeld',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['sprungfeld', 'wasser', 'beschleuniger', 'abkuerzung'],
};
