import type { Karte } from '../karte';

/**
 * Ein Schubfeld am Anfang der Eisfläche beschleunigt den Ball, und auf dem Eis
 * bremst ihn fast nichts mehr — erst der Sandstreifen vor dem Loch. Der Pilz
 * in der Mitte lenkt ab, wer genau auf der Mittellinie rutscht.
 */
export const bahn: Karte = {
  id: 'k44-turbo-auf-dem-eis',
  name: 'Turbo auf dem Eis',
  schwierigkeit: 2,
  breite: 20,
  hoehe: 44,
  par: 2,
  schlagLimit: 7,
  zeitLimitS: 70,
  abschlaege: [
    [9, 41],
    [11, 41],
  ],
  loch: [10, 5],
  waende: [],
  zonen: [
    { art: 'eis', x: 2, y: 13, w: 16, h: 22 },
    { art: 'beschleuniger', x: 7, y: 28, w: 6, h: 4, rx: 0, ry: -1, staerke: 25 },
    { art: 'bumper', x: 10, y: 19, r: 1 },
    { art: 'sand', x: 2, y: 9, w: 16, h: 2 },
  ],
  dekor: 'eis',
  beschreibung: 'Ein Schubfeld am Anfang der Eisfläche beschleunigt den Ball, und auf dem Eis bremst ihn fast nichts mehr — erst der Sandstreifen vor dem Loch. Der Pilz in der Mitte lenkt ab, wer genau auf der Mittellinie rutscht.',
  thema: 'Eis',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['eis', 'beschleuniger', 'bumper', 'sand'],
};
