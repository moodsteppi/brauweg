import type { Karte } from '../karte';

// k34 — Der Katapultkorridor: ein langer Schacht, den nur der Beschleuniger
// in vernuenftig wenigen Schlaegen ueberwindet; ein Strudel lauert daneben,
// nicht auf der Mittellinie.
export const bahn: Karte = {
  id: 'k34-katapultkorridor',
  name: 'Der Katapultkorridor',
  schwierigkeit: 4,
  breite: 30,
  hoehe: 48,
  par: 6,
  schlagLimit: 11,
  zeitLimitS: 100,
  abschlaege: [
    [13, 45],
    [14, 45],
    [16, 45],
    [17, 45],
  ],
  loch: [15, 3],
  waende: [
    { x: 0, y: 5, w: 10, h: 38 },
    { x: 20, y: 5, w: 10, h: 38 },
  ],
  zonen: [
    { art: 'beschleuniger', x: 10, y: 30, w: 10, h: 6, rx: 0, ry: -1, staerke: 30 },
    { art: 'strudel', x: 12, y: 15, r: 1.8, staerke: 14 },
  ],
  dekor: 'wiese',
};
