import type { Karte } from '../karte';

/**
 * Schwierigkeit 2: Zwei schräge Wandnasen lassen die beiden Teiche wie ein
 * echtes Ufer mäandern — die Ideallinie webt einmal sanft nach rechts, dann
 * nach links, bleibt aber überall mindestens 2,5 E breit. Erst wer seitlich
 * abweicht, zahlt den Strafschlag und beginnt wieder an der Stelle vor dem
 * Schlag.
 */
export const bahn: Karte = {
  id: 'k09-der-uferweg',
  name: 'Der Uferweg',
  schwierigkeit: 2,
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
  waende: [
    { ax: 4, ay: 17, bx: 7, by: 13, dicke: 0.6 },
    { ax: 10, ay: 12, bx: 7, by: 8, dicke: 0.6 },
  ],
  zonen: [
    { art: 'wasser', x: 1, y: 8, w: 3, h: 9 },
    { art: 'wasser', x: 10, y: 8, w: 3, h: 9 },
  ],
  dekor: 'wiese',
};
