import type { Karte } from '../karte';

/**
 * Zwei Strudel stehen versetzt in der Mitte der Allee, links und rechts bremst
 * Sand. Wer mittig durchspielt, wird zweimal angezogen; wer ausweicht, landet
 * im Sand.
 */
export const bahn: Karte = {
  id: 'k48-kreiselallee',
  name: 'Kreiselallee',
  schwierigkeit: 2,
  breite: 18,
  hoehe: 40,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 75,
  abschlaege: [
    [8, 37],
    [10, 37],
  ],
  loch: [9, 5],
  waende: [],
  zonen: [
    { art: 'strudel', x: 7.5, y: 15, r: 1.5, staerke: 25 },
    { art: 'strudel', x: 10.5, y: 26, r: 1.5, staerke: 25 },
    { art: 'sand', x: 0, y: 0, w: 3, h: 40 },
    { art: 'sand', x: 15, y: 0, w: 3, h: 40 },
  ],
  dekor: 'wueste',
  beschreibung: 'Zwei Strudel stehen versetzt in der Mitte der Allee, links und rechts bremst Sand. Wer mittig durchspielt, wird zweimal angezogen; wer ausweicht, landet im Sand.',
  thema: 'Strudel',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['strudel', 'sand', 'lang'],
};
