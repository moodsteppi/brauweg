import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k19 — Der Sprungtrichter (Trichter + Kammer, Beschleuniger + Sprungfeld)
 * Stufe 3: der Schub trägt in die Kammer, die Kammerwände engen sie ein,
 * die Sprungfelder an ihren Flanken tragen optional darüber hinweg.
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
  id: 'k19-sprungtrichter',
  name: 'Der Sprungtrichter',
  schwierigkeit: 3,
  breite: 30,
  hoehe: 48,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 100,
  abschlaege: [
    [5, 46],
    [8, 46.5],
    [22, 46.5],
    [25, 46],
  ],
  loch: [15, 4],
  waende: [
    { ax: 3, ay: 44, bx: 11, by: 28, dicke: 0.8 },
    { ax: 27, ay: 44, bx: 19, by: 28, dicke: 0.8 },
    // Kammer über dem Trichterhals: schmaler als der Feldrand, breiter als
    // der Hals — die Sprungfelder sitzen genau an ihren Flanken.
    { x: 6, y: 16, w: 0.8, h: 12 },
    { x: 23.2, y: 16, w: 0.8, h: 12 },
  ],
  zonen: [
    // Der Schub direkt hinter dem Trichterhals trägt bis weit in die Kammer.
    { art: 'beschleuniger', x: 12, y: 22, w: 6, h: 4, rx: 0, ry: -1, staerke: 22 },
    // Zwei Sprungfelder an den Kammerflanken: eine Abkürzung mit Risiko
    // für alle, die es nicht mittig durch den Trichter schaffen.
    { art: 'sprungfeld', x: 4, y: 14, w: 5, h: 4, rx: 0, ry: -1, weite: 8 },
    { art: 'sprungfeld', x: 21, y: 14, w: 5, h: 4, rx: 0, ry: -1, weite: 8 },
  ],
  dekor: 'wueste',
};
