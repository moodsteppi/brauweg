import type { Karte } from '../karte';

/*
 * k23 — Portal in die Sandkammer. Die Sandkammer mit dem Loch ist
 * ringsum mit einer Mauer versiegelt — der einzige Zugang ist das Portal
 * am Fuß der Kammer. Wer hindurchspringt, landet mitten im Sand vor dem
 * Loch und muss den letzten Schlag durch die Reibung hindurch dosieren.
 */
export const bahn: Karte = {
  id: 'k23-portal-in-die-sandkammer',
  name: 'Portal in die Sandkammer',
  schwierigkeit: 3,
  breite: 18,
  hoehe: 26,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 80,
  abschlaege: [
    [9, 24],
    [6, 24],
    [12, 24],
    [7.5, 22],
    [10.5, 22],
  ],
  loch: [9, 4.8],
  waende: [
    { x: 3, y: 2.5, w: 12, h: 0.6 },
    { x: 3, y: 12.9, w: 12, h: 0.6 },
    { x: 3, y: 3.1, w: 0.6, h: 9.8 },
    { x: 14.4, y: 3.1, w: 0.6, h: 9.8 },
    // Trichter vor dem Portal: verengt den offenen Abschlag auf die
    // Portalbreite, die Ränder daneben bleiben als Umweg begehbar.
    { ax: 1.5, ay: 24, bx: 5.5, by: 20.5, dicke: 0.8 },
    { ax: 16.5, ay: 24, bx: 12.5, by: 20.5, dicke: 0.8 },
  ],
  zonen: [
    { art: 'sand', x: 4, y: 8, w: 10, h: 4.5 },
    { art: 'portal', x: 9, y: 20, r: 0.6, ziel: { x: 9, y: 10 }, paar: 0 },
    { art: 'portal', x: 9, y: 10, r: 0.6, ziel: { x: 9, y: 20 }, paar: 0 },
  ],
  dekor: 'wueste',
};
