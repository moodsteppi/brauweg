import type { Karte } from '../karte';

/*
 * k29 — Schmales Sprungtor (Stufe 4). Eine 1,6 E schmale Schleuse ist der
 * EINZIGE Weg nach oben; mittendrin sitzt ein kräftiger Beschleuniger, den
 * jeder Ball zwangsläufig durchquert. Unten im offenen Abschlagfeld lockt
 * zusätzlich ein Sprungfeld als Spielerei zur Seite.
 */
export const bahn: Karte = {
  id: 'k29-schmales-sprungtor',
  name: 'Schmales Sprungtor',
  schwierigkeit: 4,
  breite: 30,
  hoehe: 48,
  par: 3,
  schlagLimit: 9,
  zeitLimitS: 110,
  abschlaege: [
    [15, 44],
    [13, 44],
    [17, 44],
    [14, 42],
    [16, 42],
  ],
  loch: [15, 5],
  waende: [
    { x: 0, y: 14, w: 14.2, h: 16 },
    { x: 15.8, y: 14, w: 14.2, h: 16 },
    // Rückwand weit hinterm Loch, schliesst die Kammer nach oben ab.
    { x: 8, y: 1.5, w: 14, h: 0.7 },
    // Kleiner Ausleger am Schlauchausgang, ausserhalb der Fluchtlinie.
    { x: 10, y: 11, w: 4, h: 0.7 },
  ],
  zonen: [
    { art: 'beschleuniger', x: 14.2, y: 24, w: 1.6, h: 6, rx: 0, ry: -1, staerke: 35 },
    { art: 'sprungfeld', x: 20, y: 40, w: 3, h: 3, rx: -0.7071, ry: -0.7071, weite: 8 },
    // Feinschliff in der Lochkammer, nach dem Schlauch.
    { art: 'sand', x: 12, y: 6.5, w: 6, h: 3 },
    // Deko-Prallkörper im offenen Abschlagfeld, weit vom Schlauch entfernt.
    { art: 'bumper', x: 24, y: 38, r: 1.0 },
  ],
  dekor: 'wiese',
};
