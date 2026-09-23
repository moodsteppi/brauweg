import type { Karte } from '../karte';

/**
 * Eine kleine Bucht ist aus der hinteren linken Ecke herausgeschnitten,
 * weit weg von den Abschlägen — die Fläche bekommt eine Kontur, ohne dem
 * Sprung im Weg zu stehen. Die Federplatte wirft den Ball übers Feld
 * Richtung Loch, den letzten Rest legt ein kurzer Anschlag zurück.
 */
export const bahn: Karte = {
  id: 'k07-die-sprungschanze',
  name: 'Die Sprungschanze',
  schwierigkeit: 1,
  breite: 18,
  hoehe: 28,
  par: 2,
  schlagLimit: 7,
  zeitLimitS: 60,
  abschlaege: [
    [6, 25],
    [8, 25],
    [10, 25],
    [12, 25],
  ],
  loch: [9, 4],
  waende: [
    { x: 0, y: 22.5, w: 4, h: 0.6 },
    { x: 3.4, y: 22.5, w: 0.6, h: 5.5 },
  ],
  zonen: [
    { art: 'sprungfeld', x: 5, y: 14, w: 4, h: 3, rx: 0, ry: -1, weite: 10 },
    { art: 'sprungfeld', x: 9, y: 14, w: 4, h: 3, rx: 0, ry: -1, weite: 10 },
  ],
  dekor: 'wueste',
};
