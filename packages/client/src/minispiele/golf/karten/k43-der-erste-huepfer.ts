import type { Karte } from '../karte';

/**
 * Eine Wand sperrt die Bahn fast ganz, davor wirft ein Sprungfeld den Ball
 * darüber. Der sichere Weg führt rechts durch die Lücke, der kurze über die
 * Wand.
 */
export const bahn: Karte = {
  id: 'k43-der-erste-huepfer',
  name: 'Der erste Hüpfer',
  schwierigkeit: 1,
  breite: 16,
  hoehe: 32,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 60,
  abschlaege: [
    [7, 29],
    [9, 29],
  ],
  loch: [7, 6],
  waende: [
    { x: 0, y: 16, w: 12, h: 1 },
  ],
  zonen: [
    { art: 'sprungfeld', x: 4, y: 20, w: 6, h: 2, rx: 0, ry: -1, weite: 8 },
  ],
  dekor: 'eis',
  beschreibung: 'Eine Wand sperrt die Bahn fast ganz, davor wirft ein Sprungfeld den Ball darüber. Der sichere Weg führt rechts durch die Lücke, der kurze über die Wand.',
  thema: 'Sprungfeld',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['sprungfeld', 'einstieg', 'abkuerzung'],
};
