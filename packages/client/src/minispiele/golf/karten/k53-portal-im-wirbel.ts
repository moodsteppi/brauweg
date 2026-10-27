import type { Karte } from '../karte';

/**
 * Drei Kammern, verbunden nur durch Portale. Das erste setzt den Ball in einen
 * Strudel, aus dem man sich zum zweiten Portal herausspielen muss; das bringt
 * ihn in die Kammer mit dem Loch.
 */
export const bahn: Karte = {
  id: 'k53-portal-im-wirbel',
  name: 'Portal im Wirbel',
  schwierigkeit: 3,
  breite: 30,
  hoehe: 40,
  par: 4,
  schlagLimit: 10,
  zeitLimitS: 100,
  abschlaege: [
    [4, 37],
    [6, 37],
  ],
  loch: [25.5, 16],
  waende: [
    { x: 9, y: 0, w: 1, h: 40 },
    { x: 20, y: 0, w: 1, h: 40 },
  ],
  zonen: [
    { art: 'portal', x: 4.5, y: 16, r: 1.1, ziel: { x: 15, y: 31 }, paar: 0 },
    { art: 'strudel', x: 15, y: 30, r: 2, staerke: 30 },
    { art: 'portal', x: 15, y: 12, r: 1.1, ziel: { x: 25.5, y: 33 }, paar: 1 },
    { art: 'bumper', x: 23, y: 24, r: 1 },
  ],
  dekor: 'nacht',
  beschreibung: 'Drei Kammern, verbunden nur durch Portale. Das erste setzt den Ball in einen Strudel, aus dem man sich zum zweiten Portal herausspielen muss; das bringt ihn in die Kammer mit dem Loch.',
  thema: 'Portale',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['portal', 'strudel', 'bumper', 'kammern'],
};
