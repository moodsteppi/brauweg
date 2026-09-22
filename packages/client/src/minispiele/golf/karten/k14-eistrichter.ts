import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k14 — Der Eistrichter (Trichter mündet in eine Eiskammer)
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
  id: 'k14-eistrichter',
  name: 'Der Eistrichter',
  schwierigkeit: 2,
  breite: 18,
  hoehe: 28,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 80,
  abschlaege: [
    [6, 26.4],
    [8, 26.6],
    [10, 26.6],
    [12, 26.4],
  ],
  loch: [9, 3],
  waende: [
    // Der Trichter — breiter Mund unten, schmaler Hals oben.
    { ax: 1, ay: 27, bx: 7.5, by: 17, dicke: 0.8 },
    { ax: 17, ay: 27, bx: 10.5, by: 17, dicke: 0.8 },
    // Dahinter öffnet sich eine Kammer, breiter als der Hals — hier liegt
    // das Eis, und der Ball hat auf einmal viel mehr Platz als erwartet.
    { x: 3.5, y: 6, w: 0.8, h: 11 },
    { x: 13.7, y: 6, w: 0.8, h: 11 },
  ],
  zonen: [
    // Zwei Eisbahnen nebeneinander in der Kammer: kaum Reibung, der Ball
    // gleitet viel weiter, als das Auge auf freiem Rasen erwarten lässt.
    { art: 'eis', x: 4.5, y: 7, w: 4, h: 8 },
    { art: 'eis', x: 9, y: 7, w: 4, h: 8 },
  ],
  dekor: 'eis',
};
