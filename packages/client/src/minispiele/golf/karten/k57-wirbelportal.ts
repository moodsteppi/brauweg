import type { Karte } from '../karte';

/**
 * Das erste Portal bringt den Ball in die mittlere Kammer, doch zwischen ihm
 * und dem zweiten Portal liegt ein Strudel. Wer ihn umspielt, landet direkt
 * vor dem Loch; wer nicht, muss links durch die Lücke.
 */
export const bahn: Karte = {
  id: 'k57-wirbelportal',
  name: 'Wirbelportal',
  schwierigkeit: 4,
  breite: 30,
  hoehe: 46,
  par: 4,
  schlagLimit: 10,
  zeitLimitS: 100,
  abschlaege: [
    [5, 43],
    [7, 43],
  ],
  loch: [26, 5],
  waende: [
    { x: 0, y: 25, w: 30, h: 1 },
    { x: 3, y: 12, w: 27, h: 1 },
  ],
  zonen: [
    { art: 'portal', x: 24, y: 34, r: 1.1, ziel: { x: 5, y: 20 }, paar: 0 },
    { art: 'bumper', x: 15, y: 37, r: 1 },
    { art: 'strudel', x: 15, y: 18.5, r: 2, staerke: 30 },
    { art: 'portal', x: 25, y: 18.5, r: 1.1, ziel: { x: 20, y: 6 }, paar: 1 },
    { art: 'sand', x: 8, y: 0, w: 4, h: 12 },
  ],
  dekor: 'nacht',
  beschreibung: 'Das erste Portal bringt den Ball in die mittlere Kammer, doch zwischen ihm und dem zweiten Portal liegt ein Strudel. Wer ihn umspielt, landet direkt vor dem Loch; wer nicht, muss links durch die Lücke.',
  thema: 'Portale',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['portal', 'strudel', 'bumper', 'kammern'],
};
