import type { Karte } from '../karte';

/*
 * k28 — Kreiselkammer. Ein enger Vorraum vorm Loch beherbergt zwei
 * Wächter: links ein Strudel, rechts ein rotierendes Drehkreuz, beide weit
 * genug von der Ziellinie entfernt, um sie nur zu säumen, nicht zu
 * versperren.
 */
export const bahn: Karte = {
  id: 'k28-kreiselkammer',
  name: 'Kreiselkammer',
  schwierigkeit: 3,
  breite: 14,
  hoehe: 22,
  par: 2,
  schlagLimit: 7,
  zeitLimitS: 55,
  abschlaege: [
    [7, 19],
    [5, 19],
    [9, 19],
    [6, 17],
    [8, 17],
  ],
  loch: [7, 4],
  waende: [
    // Nadelöhr zwischen Abschlag und Kreiselkammer.
    { x: 0, y: 12, w: 5, h: 0.8 },
    { x: 9, y: 12, w: 5, h: 0.8 },
    // Zwei Wände rahmen die Kammer, weit genug von Strudel und Drehkreuz.
    { x: 0.6, y: 6, w: 0.7, h: 3.5 },
    { x: 12.3, y: 5, w: 0.7, h: 3.3 },
  ],
  zonen: [
    { art: 'strudel', x: 3, y: 8, r: 1.4, staerke: 12 },
    { art: 'drehkreuz', x: 11, y: 10, laenge: 2, gradJeTakt: 5, phase: 0 },
    // Sandbett in der Kammermitte, zwischen beiden Wächtern hindurch.
    { art: 'sand', x: 5, y: 6.5, w: 3, h: 2.5 },
  ],
  dekor: 'nacht',
};
