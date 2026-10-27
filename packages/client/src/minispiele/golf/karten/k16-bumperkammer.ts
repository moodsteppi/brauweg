import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k16 — Die Bumperkammer (Kammer aus Wänden mit vier Bumpern)
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
  id: 'k16-bumperkammer',
  name: 'Die Bumperkammer',
  schwierigkeit: 2,
  breite: 15,
  hoehe: 20,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 65,
  abschlaege: [
    [3, 17],
    [5, 17.5],
    [10, 17.5],
    [12, 17],
  ],
  loch: [7.5, 2],
  waende: [
    // Die Kammer: offen zum Abschlag hin, oben fast geschlossen.
    { x: 3, y: 4, w: 0.8, h: 10 },
    { x: 11.2, y: 4, w: 0.8, h: 10 },
    { x: 3, y: 4, w: 3, h: 0.8 },
    { x: 9.2, y: 4, w: 3, h: 0.8 },
  ],
  zonen: [
    // Vier Pilze an den Seitenwänden — die Mittelgasse zum Ausgang bleibt
    // frei, wer an den Rand gerät, wird abgelenkt.
    { art: 'bumper', x: 4.8, y: 11, r: 0.9 },
    { art: 'bumper', x: 10.4, y: 11, r: 0.9 },
    { art: 'bumper', x: 4.8, y: 7, r: 0.8 },
    { art: 'bumper', x: 10.4, y: 7, r: 0.8 },
  ],
  dekor: 'wueste',
};
