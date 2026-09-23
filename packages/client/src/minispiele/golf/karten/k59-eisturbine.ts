import type { Karte } from '../karte';

/**
 * Einmal ums Hufeisen: das Eis hinauf, zwei Schubfelder nehmen den Ball um die
 * Ecken mit, und rechts wirft ein Sprungfeld ihn über den Tümpel — daneben
 * führt nur ein schmaler Sandsteg vorbei.
 */
export const bahn: Karte = {
  id: 'k59-eisturbine',
  name: 'Eisturbine',
  schwierigkeit: 5,
  breite: 32,
  hoehe: 56,
  par: 5,
  schlagLimit: 11,
  zeitLimitS: 110,
  abschlaege: [
    [3, 52],
    [5, 52],
  ],
  loch: [28, 48],
  waende: [
    { x: 8, y: 10, w: 16, h: 46 },
  ],
  zonen: [
    { art: 'eis', x: 0, y: 0, w: 8, h: 50 },
    { art: 'beschleuniger', x: 1, y: 1, w: 7, h: 8, rx: 1, ry: 0, staerke: 30 },
    { art: 'beschleuniger', x: 25, y: 1, w: 6, h: 8, rx: 0, ry: 1, staerke: 30 },
    { art: 'sprungfeld', x: 24, y: 16, w: 8, h: 2, rx: 0, ry: 1, weite: 9 },
    { art: 'wasser', x: 24, y: 19, w: 6, h: 5 },
    { art: 'sand', x: 30, y: 19, w: 2, h: 5 },
    { art: 'bumper', x: 28, y: 36, r: 1 },
  ],
  dekor: 'eis',
  beschreibung: 'Einmal ums Hufeisen: das Eis hinauf, zwei Schubfelder nehmen den Ball um die Ecken mit, und rechts wirft ein Sprungfeld ihn über den Tümpel — daneben führt nur ein schmaler Sandsteg vorbei.',
  thema: 'Eis',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['eis', 'beschleuniger', 'sprungfeld', 'wasser', 'meister'],
};
