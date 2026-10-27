import type { Karte } from '../karte';

/**
 * Ein L aus Eis: den langen Schacht hinauf, dann nimmt ein Schubfeld in der
 * Ecke den Ball mit nach rechts. Der Sand vor dem Loch fängt ab, was die Kurve
 * zu schnell verlässt.
 */
export const bahn: Karte = {
  id: 'k50-turbokurve',
  name: 'Turbokurve',
  schwierigkeit: 3,
  breite: 30,
  hoehe: 40,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 90,
  abschlaege: [
    [4, 37],
    [6, 37],
  ],
  loch: [26, 6],
  waende: [
    { x: 10, y: 13, w: 20, h: 27 },
  ],
  zonen: [
    { art: 'eis', x: 0, y: 1, w: 10, h: 33 },
    { art: 'beschleuniger', x: 1, y: 2, w: 8, h: 9, rx: 1, ry: 0, staerke: 30 },
    { art: 'sand', x: 17, y: 0, w: 3, h: 13 },
  ],
  dekor: 'eis',
  beschreibung: 'Ein L aus Eis: den langen Schacht hinauf, dann nimmt ein Schubfeld in der Ecke den Ball mit nach rechts. Der Sand vor dem Loch fängt ab, was die Kurve zu schnell verlässt.',
  thema: 'Eis',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['eis', 'beschleuniger', 'kurve', 'sand'],
};
