import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k17 — Die Portalzange (Zangenkrallen; der Umweg außen herum wird lang)
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
  id: 'k17-portalzange',
  name: 'Die Portalzange',
  schwierigkeit: 2,
  breite: 18,
  hoehe: 26,
  par: 4,
  schlagLimit: 9,
  zeitLimitS: 80,
  abschlaege: [
    [4, 22],
    [6, 22.5],
    [12, 22.5],
    [14, 22],
  ],
  loch: [9, 3],
  waende: [
    // Zwei Riegel, GEGENEINANDER versetzt: Wer den Portalen nicht traut,
    // muss den ganzen Umweg im Zickzack laufen — lang, aber sicher.
    { x: 0, y: 10, w: 11, h: 1 },
    { x: 7, y: 18, w: 11, h: 1 },
    // Zwei Krallen an den Riegelenden geben der Zange ihre Form.
    { x: 11, y: 6, w: 0.8, h: 4 },
    { x: 6.2, y: 14, w: 0.8, h: 4 },
  ],
  zonen: [
    // Die Abkürzung: aus der Ecke unten rechts direkt fast bis vors Loch.
    { art: 'portal', x: 16.5, y: 23.5, r: 0.9, ziel: { x: 3, y: 5 }, paar: 0 },
    { art: 'portal', x: 3, y: 5, r: 0.9, ziel: { x: 16.5, y: 23.5 }, paar: 0 },
  ],
  dekor: 'nacht',
};
