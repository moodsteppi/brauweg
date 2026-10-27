import type { Karte } from '../karte';

/**
 * In der einzigen Öffnung der Querwand dreht sich ein Drehkreuz. Wer im
 * falschen Moment schlägt, prallt ab; wer abpasst, bis der Balken längs steht,
 * rollt durch.
 */
export const bahn: Karte = {
  id: 'k45-die-drehtuer',
  name: 'Die Drehtür',
  schwierigkeit: 2,
  breite: 20,
  hoehe: 36,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 75,
  abschlaege: [
    [9, 33],
    [11, 33],
  ],
  loch: [10, 5],
  waende: [
    { x: 0, y: 17, w: 7.5, h: 1 },
    { x: 12.5, y: 17, w: 7.5, h: 1 },
  ],
  zonen: [
    { art: 'drehkreuz', x: 10, y: 17.5, laenge: 4.4, gradJeTakt: 4, phase: 0 },
  ],
  dekor: 'wiese',
  beschreibung: 'In der einzigen Öffnung der Querwand dreht sich ein Drehkreuz. Wer im falschen Moment schlägt, prallt ab; wer abpasst, bis der Balken längs steht, rollt durch.',
  thema: 'Drehkreuz',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['drehkreuz', 'timing'],
};
