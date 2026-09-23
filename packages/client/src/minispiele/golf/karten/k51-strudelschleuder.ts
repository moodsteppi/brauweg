import type { Karte } from '../karte';

/**
 * Vor der einzigen Lücke in der Querwand wartet ein starker Strudel. Wer ihn
 * streift, wird abgelenkt — mal durch die Lücke, mal zurück in die untere
 * Hälfte.
 */
export const bahn: Karte = {
  id: 'k51-strudelschleuder',
  name: 'Strudelschleuder',
  schwierigkeit: 3,
  breite: 24,
  hoehe: 40,
  par: 3,
  schlagLimit: 9,
  zeitLimitS: 90,
  abschlaege: [
    [11, 37],
    [13, 37],
  ],
  loch: [12, 5],
  waende: [
    { x: 0, y: 20, w: 19, h: 1 },
  ],
  zonen: [
    { art: 'strudel', x: 17, y: 25.5, r: 2, staerke: 30 },
  ],
  dekor: 'nacht',
  beschreibung: 'Vor der einzigen Lücke in der Querwand wartet ein starker Strudel. Wer ihn streift, wird abgelenkt — mal durch die Lücke, mal zurück in die untere Hälfte.',
  thema: 'Strudel',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['strudel', 'engstelle'],
};
