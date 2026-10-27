import type { Karte } from '../karte';

/**
 * Zwei Querwände mit je einer Drehtür, die untere links, die obere rechts, und
 * beide drehen gegeneinander. Jede Tür will ihren eigenen Moment.
 */
export const bahn: Karte = {
  id: 'k49-zwei-drehtueren',
  name: 'Zwei Drehtüren',
  schwierigkeit: 3,
  breite: 22,
  hoehe: 46,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 90,
  abschlaege: [
    [10, 43],
    [12, 43],
  ],
  loch: [11, 5],
  waende: [
    { x: 0, y: 30, w: 4.5, h: 1 },
    { x: 10.5, y: 30, w: 11.5, h: 1 },
    { x: 0, y: 14, w: 11.5, h: 1 },
    { x: 17.5, y: 14, w: 4.5, h: 1 },
  ],
  zonen: [
    { art: 'drehkreuz', x: 7.5, y: 30.5, laenge: 3.6, gradJeTakt: 3, phase: 0 },
    { art: 'drehkreuz', x: 14.5, y: 14.5, laenge: 3.6, gradJeTakt: -3, phase: 45 },
  ],
  dekor: 'wiese',
  beschreibung: 'Zwei Querwände mit je einer Drehtür, die untere links, die obere rechts, und beide drehen gegeneinander. Jede Tür will ihren eigenen Moment.',
  thema: 'Drehkreuz',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['drehkreuz', 'timing', 'lang'],
};
