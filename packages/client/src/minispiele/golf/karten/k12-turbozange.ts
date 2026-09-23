import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k12 — Die Turbozange (Sanduhr aus vier Schrägwänden + zwei Schüben)
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
  id: 'k12-turbozange',
  name: 'Die Turbozange',
  schwierigkeit: 2,
  breite: 18,
  hoehe: 26,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 75,
  abschlaege: [
    [4, 23],
    [6, 23.5],
    [12, 23.5],
    [14, 23],
  ],
  loch: [9, 3],
  waende: [
    // Untere Zangenhälfte: zwei schräge Arme laufen auf die Taille zu.
    { ax: 0, ay: 22, bx: 7, by: 13, dicke: 0.8 },
    { ax: 18, ay: 22, bx: 11, by: 13, dicke: 0.8 },
    // Obere Zangenhälfte: dieselbe Taille öffnet sich wieder nach außen —
    // aus dem einzelnen Riegel von vorher wird eine echte Sanduhr.
    { ax: 7, ay: 13, bx: 0, by: 4, dicke: 0.8 },
    { ax: 11, ay: 13, bx: 18, by: 4, dicke: 0.8 },
  ],
  zonen: [
    // Schub in der unteren Hälfte trägt bis an die Taille heran.
    { art: 'beschleuniger', x: 6, y: 17, w: 6, h: 3, rx: 0, ry: -1, staerke: 20 },
    // Zweiter Schub gleich hinter der Taille trägt weiter Richtung Loch.
    { art: 'beschleuniger', x: 6, y: 7, w: 6, h: 3, rx: 0, ry: -1, staerke: 20 },
  ],
  dekor: 'wiese',
};
