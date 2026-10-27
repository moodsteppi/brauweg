import type { Karte } from '../karte';

/**
 * Alle neun Zonenarten auf einer Schlange über vier Etagen: Schub und Pilz,
 * Eis mit Teich, Portal und Strudel, Sprungfeld und Drehkreuz, zuletzt Sand am
 * Loch. Jede Etage hat einen sicheren und einen schnellen Weg.
 */
export const bahn: Karte = {
  id: 'k60-neunerlei',
  name: 'Neunerlei',
  schwierigkeit: 5,
  breite: 34,
  hoehe: 60,
  par: 6,
  schlagLimit: 12,
  zeitLimitS: 120,
  abschlaege: [
    [4, 56],
    [6, 56],
  ],
  loch: [10, 6],
  waende: [
    { x: 0, y: 45, w: 26, h: 1 },
    { x: 8, y: 30, w: 26, h: 1 },
    { x: 0, y: 15, w: 26, h: 1 },
  ],
  zonen: [
    { art: 'beschleuniger', x: 12, y: 50, w: 10, h: 6, rx: 1, ry: 0, staerke: 25 },
    { art: 'bumper', x: 25, y: 52, r: 1 },
    { art: 'eis', x: 8, y: 33, w: 22, h: 10 },
    { art: 'wasser', x: 18, y: 38, r: 2.5 },
    { art: 'portal', x: 4, y: 27, r: 1.1, ziel: { x: 29, y: 20 }, paar: 0 },
    { art: 'strudel', x: 16, y: 23, r: 1.5, staerke: 25 },
    { art: 'sprungfeld', x: 8, y: 18, w: 8, h: 2, rx: 0, ry: -1, weite: 9 },
    { art: 'drehkreuz', x: 30, y: 15.5, laenge: 4, gradJeTakt: 3, phase: 90 },
    { art: 'sand', x: 16, y: 2, w: 4, h: 10 },
  ],
  dekor: 'wiese',
  beschreibung: 'Alle neun Zonenarten auf einer Schlange über vier Etagen: Schub und Pilz, Eis mit Teich, Portal und Strudel, Sprungfeld und Drehkreuz, zuletzt Sand am Loch. Jede Etage hat einen sicheren und einen schnellen Weg.',
  thema: 'Alle Zonen',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['alle-zonen', 'lang', 'meister'],
};
