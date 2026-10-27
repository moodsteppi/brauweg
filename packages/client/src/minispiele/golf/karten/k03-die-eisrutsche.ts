import type { Karte } from '../karte';

/**
 * Zwei versetzte Wandnasen biegen die Ideallinie leicht S-förmig um die
 * Eisplatte herum, statt sie gerade durchzulassen — eine kleine Kurve über
 * dem rutschigen Untergrund. Wer draufhält wie gewohnt, schießt übers Ziel
 * hinaus; die Bahn verzeiht das mit reichlich Auslauf.
 */
export const bahn: Karte = {
  id: 'k03-die-eisrutsche',
  name: 'Die Eisrutsche',
  schwierigkeit: 1,
  breite: 14,
  hoehe: 22,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 55,
  abschlaege: [
    [4, 19],
    [6, 19],
    [8, 19],
    [10, 19],
  ],
  loch: [7, 3],
  waende: [
    { ax: 0, ay: 10, bx: 4.5, by: 7, dicke: 0.6 },
    { ax: 14, ay: 13, bx: 9.5, by: 16, dicke: 0.6 },
  ],
  zonen: [
    { art: 'eis', x: 2, y: 8, w: 5, h: 8 },
    { art: 'eis', x: 7, y: 8, w: 5, h: 8 },
  ],
  dekor: 'eis',
};
