import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k18 — Der Strudelgarten (S-Kurve mit zwei Beeten und Strudeln)
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
  id: 'k18-strudelgarten',
  name: 'Der Strudelgarten',
  schwierigkeit: 2,
  breite: 14,
  hoehe: 20,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 55,
  abschlaege: [
    [3, 17],
    [5, 17.5],
    [9, 17.5],
    [11, 17],
  ],
  loch: [6, 2],
  waende: [
    // Zwei versetzte Hecken bilden die Kurve …
    { x: 0, y: 14, w: 9, h: 0.8 },
    { x: 5, y: 8, w: 9, h: 0.8 },
    // … zwei Beete mitten im Garten geben ihr Struktur und verstecken je
    // einen Strudel in ihrer Nähe.
    { x: 10, y: 10, w: 2.5, h: 2.5 },
    { x: 1.5, y: 4, w: 2.5, h: 2.5 },
  ],
  zonen: [
    // Direkt neben dem rechten Beet: Wer die erste Lücke zu weit rechts
    // nimmt, wird hier festgehalten statt zur zweiten Lücke zu rollen.
    { art: 'strudel', x: 13, y: 13, r: 1, staerke: 15 },
    // Oben links, abseits vom Weg zum Loch: bestraft nur einen völlig
    // verzogenen Schlag nach der zweiten Lücke.
    { art: 'strudel', x: 2, y: 2.5, r: 1.1, staerke: 15 },
  ],
  dekor: 'wiese',
};
