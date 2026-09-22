import type { Karte } from '../karte';

// k31 — Der Zwillingsstrom: Dogleg um eine Riegelwand, Wasser lockt auf dem
// direkten Weg, wer stur geradeaus zielt statt zur Luecke rechts.
export const bahn: Karte = {
  id: 'k31-zwillingsstrom',
  name: 'Der Zwillingsstrom',
  schwierigkeit: 4,
  breite: 16,
  hoehe: 26,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 75,
  abschlaege: [
    [6, 24],
    [7, 24],
    [8, 24],
    [9, 24],
  ],
  loch: [5, 5],
  waende: [{ x: 0, y: 14, w: 14.2, h: 1 }],
  zonen: [{ art: 'wasser', x: 6, y: 17, w: 4, h: 3.5 }],
  dekor: 'wiese',
};
