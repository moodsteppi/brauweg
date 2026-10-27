import type { Karte } from '../karte';

/*
 * k30 — Nadelöhr der Portale (Stufe 4). Eine Mauer über die volle Breite
 * versperrt die Mitte der Bahn vollständig — der einzige Weg hindurch ist
 * das Portalpaar. Davor und dahinter je eine 1,6 E schmale Schleuse: enge
 * Durchgänge auf beiden Seiten des Sprungs.
 */
export const bahn: Karte = {
  id: 'k30-nadeloehr-der-portale',
  name: 'Nadelöhr der Portale',
  schwierigkeit: 4,
  breite: 32,
  hoehe: 48,
  par: 3,
  schlagLimit: 9,
  zeitLimitS: 115,
  abschlaege: [
    [16, 44],
    [14, 44],
    [18, 44],
    [15, 42],
    [17, 42],
  ],
  loch: [16, 4],
  waende: [
    { x: 0, y: 26, w: 15.2, h: 14 },
    { x: 16.8, y: 26, w: 15.2, h: 14 },
    { x: 0, y: 20, w: 32, h: 2 },
    { x: 0, y: 8, w: 15.2, h: 6 },
    { x: 16.8, y: 8, w: 15.2, h: 6 },
  ],
  zonen: [
    { art: 'portal', x: 16, y: 24, r: 0.6, ziel: { x: 16, y: 15 }, paar: 0 },
    { art: 'portal', x: 16, y: 15, r: 0.6, ziel: { x: 16, y: 24 }, paar: 0 },
    // Zwei Deko-Elemente im offenen Mittelfeld zwischen den Schleusen,
    // weit ab von beiden engen Durchgaengen und der Ziellinie.
    { art: 'sand', x: 22, y: 16, w: 4, h: 3 },
    { art: 'bumper', x: 6, y: 17, r: 1.0 },
  ],
  dekor: 'nacht',
};
