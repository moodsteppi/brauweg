import type { Karte } from '../karte';

/**
 * Zwei kurze Wandzungen ragen von den Seiten herein — eine Schikane, die
 * die Ideallinie sanft zwingt, an den Pilzen vorbeizuschauen statt sie zu
 * ignorieren. Wer gerade zielt, sieht die Pilze nur zuschauen; wer daneben
 * trifft, wird von ihnen quer durchs Feld geschossen.
 */
export const bahn: Karte = {
  id: 'k05-der-pilzwald',
  name: 'Der Pilzwald',
  schwierigkeit: 1,
  breite: 16,
  hoehe: 26,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 55,
  abschlaege: [
    [5, 22],
    [7, 22],
    [9, 22],
    [11, 22],
  ],
  loch: [8, 4],
  waende: [
    { x: 0, y: 16, w: 4, h: 1 },
    { x: 12, y: 8, w: 4, h: 1 },
  ],
  zonen: [
    { art: 'bumper', x: 3, y: 13, r: 1 },
    { art: 'bumper', x: 13, y: 13, r: 1 },
  ],
  dekor: 'wiese',
};
