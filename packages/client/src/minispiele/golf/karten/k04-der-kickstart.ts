import type { Karte } from '../karte';

/**
 * Zwei Wandleisten rahmen den Beschleuniger-Schacht wie eine Rutsche: Der
 * Kick nach oben bleibt frei, aber der Weg dorthin ist jetzt ein Korridor,
 * kein offenes Feld. Die Chevrons zeigen die Richtung, bevor der Ball sie
 * spürt.
 */
export const bahn: Karte = {
  id: 'k04-der-kickstart',
  name: 'Der Kickstart',
  schwierigkeit: 1,
  breite: 13,
  hoehe: 20,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 50,
  abschlaege: [
    [3, 17],
    [5, 17],
    [7, 17],
    [9, 17],
  ],
  loch: [6.5, 3],
  waende: [
    { x: 1.5, y: 5, w: 1, h: 9 },
    { x: 10.5, y: 5, w: 1, h: 9 },
  ],
  zonen: [
    { art: 'beschleuniger', x: 4, y: 10, w: 5, h: 3, rx: 0, ry: -1, staerke: 25 },
    { art: 'beschleuniger', x: 4, y: 6, w: 5, h: 3, rx: 0, ry: -1, staerke: 25 },
  ],
  dekor: 'nacht',
};
