import type { Karte } from '../karte';

// k39 — Drehkreuzgasse: zwei gegenlaeufige Balken queren den Korridor,
// an den Seiten bleibt immer eine Luecke von 2 E.
export const bahn: Karte = {
  id: 'k39-drehkreuzgasse',
  name: 'Drehkreuzgasse',
  schwierigkeit: 5,
  breite: 28,
  hoehe: 44,
  par: 5,
  schlagLimit: 10,
  zeitLimitS: 100,
  abschlaege: [
    [13, 41],
    [14, 41],
    [16, 41],
    [17, 41],
  ],
  loch: [14, 3],
  waende: [
    { x: 0, y: 5, w: 10, h: 34 },
    { x: 18, y: 5, w: 10, h: 34 },
  ],
  zonen: [
    { art: 'drehkreuz', x: 14, y: 26, laenge: 4, gradJeTakt: 2, phase: 0 },
    { art: 'drehkreuz', x: 14, y: 14, laenge: 4, gradJeTakt: -2, phase: 90 },
  ],
  dekor: 'nacht',
};
