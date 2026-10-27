import type { Karte } from '../karte';

/*
 * k24 — Drehkreuz vorm Loch. Der direkte Weg führt durch eine Sandmulde;
 * seitlich davon dreht sich, gut abgesetzt von der Ziellinie, ein kleines
 * Drehkreuz — Blickfang und Bahnmarke der Kammer, ohne dem geraden Anspiel
 * im Weg zu stehen.
 */
export const bahn: Karte = {
  id: 'k24-drehkreuz-vorm-loch',
  name: 'Drehkreuz vorm Loch',
  schwierigkeit: 3,
  breite: 14,
  hoehe: 20,
  par: 4,
  schlagLimit: 8,
  zeitLimitS: 55,
  abschlaege: [
    [7, 17],
    [5, 17],
    [9, 17],
    [6, 15],
    [8, 15],
  ],
  loch: [7, 4],
  waende: [
    // Zwei gegeneinander versetzte Riegel erzwingen ein Zick-Zack vom
    // Abschlag zur Kammer vorm Loch.
    { x: 0, y: 12, w: 9, h: 0.8 },
    { x: 5, y: 9, w: 9, h: 0.8 },
    // Zwei Pfeiler rahmen die Kammer, weit genug vom Drehkreuz-Radius weg.
    { x: 1.3, y: 5, w: 0.7, h: 3 },
    { x: 12, y: 5, w: 0.7, h: 3 },
  ],
  zonen: [
    { art: 'sand', x: 4, y: 6, w: 6, h: 3 },
    { art: 'drehkreuz', x: 10, y: 5, laenge: 2.4, gradJeTakt: 4, phase: 0 },
    // Im Zick-Zack-Hals: eine Eisplatte macht die zweite Kehre rutschig.
    { art: 'eis', x: 1, y: 9.2, w: 4, h: 2.5 },
  ],
  dekor: 'wueste',
};
