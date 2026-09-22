import type { Karte } from '../karte';

/*
 * k27 — Doppelpilz im Eis. Zwei große Flipperpilze flankieren die
 * spiegelglatte Auffahrt zum Loch — die Gasse zwischen ihnen ist breit
 * genug für einen sauberen Durchlauf, aber das Eis lässt jeden zu harten
 * Schlag gefährlich nah an sie heranrutschen.
 */
export const bahn: Karte = {
  id: 'k27-doppelpilz-im-eis',
  name: 'Doppelpilz im Eis',
  schwierigkeit: 3,
  breite: 18,
  hoehe: 28,
  par: 2,
  schlagLimit: 7,
  zeitLimitS: 80,
  abschlaege: [
    [9, 25],
    [6, 25],
    [12, 25],
    [7, 23],
    [11, 23],
  ],
  loch: [9, 4],
  waende: [
    // Trichter aus dem offenen Abschlag auf die Eisbahn hinauf.
    { ax: 2, ay: 22, bx: 7, by: 16, dicke: 0.8 },
    { ax: 16, ay: 22, bx: 11, by: 16, dicke: 0.8 },
    // Zwei Pfeiler rahmen die Lochkammer, klar abgesetzt von beiden Pilzen.
    { x: 3, y: 4.5, w: 1.4, h: 2.5 },
    { x: 13, y: 4.5, w: 1.4, h: 2.5 },
  ],
  zonen: [
    { art: 'eis', x: 2, y: 6, w: 14, h: 12 },
    { art: 'bumper', x: 5, y: 9, r: 1.3 },
    { art: 'bumper', x: 13, y: 9, r: 1.3 },
    // Falle im Trichtermund.
    { art: 'sand', x: 8, y: 20, w: 2.5, h: 1.8 },
  ],
  dekor: 'eis',
};
