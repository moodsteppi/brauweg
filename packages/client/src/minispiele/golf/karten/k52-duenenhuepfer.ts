import type { Karte } from '../karte';

/**
 * Zwei Querwände mit Lücken an wechselnden Seiten, vor beiden ein breites
 * Sprungfeld. Wer springt, spart beide Umwege, landet aber erst einmal im
 * Sandstreifen zwischen den Wänden.
 */
export const bahn: Karte = {
  id: 'k52-duenenhuepfer',
  name: 'Dünenhüpfer',
  schwierigkeit: 3,
  breite: 24,
  hoehe: 50,
  par: 3,
  schlagLimit: 9,
  zeitLimitS: 90,
  abschlaege: [
    [11, 47],
    [13, 47],
  ],
  loch: [12, 5],
  waende: [
    { x: 4, y: 33, w: 20, h: 1 },
    { x: 0, y: 17, w: 20, h: 1 },
  ],
  zonen: [
    { art: 'sprungfeld', x: 5, y: 36, w: 15, h: 2, rx: 0, ry: -1, weite: 9 },
    { art: 'sprungfeld', x: 4, y: 20, w: 15, h: 2, rx: 0, ry: -1, weite: 9 },
    { art: 'sand', x: 0, y: 23, w: 24, h: 3 },
    { art: 'sand', x: 0, y: 8, w: 8, h: 6 },
  ],
  dekor: 'wueste',
  beschreibung: 'Zwei Querwände mit Lücken an wechselnden Seiten, vor beiden ein breites Sprungfeld. Wer springt, spart beide Umwege, landet aber erst einmal im Sandstreifen zwischen den Wänden.',
  thema: 'Sprungfeld',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['sprungfeld', 'sand', 'abkuerzung'],
};
