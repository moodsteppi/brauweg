import type { Karte } from '../karte';

/**
 * Eine kleine Insel sitzt genau zwischen den beiden Portalringen: Wer die
 * Abkürzung nimmt, springt über sie hinweg; wer sie ignoriert, findet
 * rechts wie links 5 E Platz, um drumherum zu spielen. Kein Hindernis
 * versperrt den direkten Weg, es gibt ihm nur eine Mitte.
 */
export const bahn: Karte = {
  id: 'k06-zwillingstore',
  name: 'Zwillingstore',
  schwierigkeit: 1,
  breite: 14,
  hoehe: 22,
  par: 2,
  schlagLimit: 7,
  zeitLimitS: 55,
  abschlaege: [
    [4, 19],
    [6, 19],
    [8, 19],
    [10, 19],
  ],
  loch: [7, 3],
  waende: [{ x: 5, y: 9.5, w: 4, h: 2 }],
  zonen: [
    { art: 'portal', x: 7, y: 14, r: 0.8, ziel: { x: 7, y: 7 }, paar: 0 },
    { art: 'portal', x: 7, y: 7, r: 0.8, ziel: { x: 7, y: 14 }, paar: 0 },
  ],
  dekor: 'wiese',
};
