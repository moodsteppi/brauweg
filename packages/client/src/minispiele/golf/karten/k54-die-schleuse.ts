import type { Karte } from '../karte';

/**
 * Ein Schubfeld schießt den Ball durch einen engen Kanal, an dessen Ende ein
 * Drehkreuz die Schleuse bildet. Oben versperrt eine Wand den geraden Weg:
 * links ums Ende herum, dann zurück zum Loch.
 */
export const bahn: Karte = {
  id: 'k54-die-schleuse',
  name: 'Die Schleuse',
  schwierigkeit: 4,
  breite: 24,
  hoehe: 52,
  par: 4,
  schlagLimit: 10,
  zeitLimitS: 100,
  abschlaege: [
    [11, 49],
    [13, 49],
  ],
  loch: [19, 5],
  waende: [
    { x: 0, y: 20, w: 9, h: 16 },
    { x: 15, y: 20, w: 9, h: 16 },
    { x: 6, y: 10, w: 18, h: 1 },
  ],
  zonen: [
    { art: 'beschleuniger', x: 9, y: 37, w: 6, h: 6, rx: 0, ry: -1, staerke: 30 },
    { art: 'drehkreuz', x: 12, y: 19, laenge: 5, gradJeTakt: 3, phase: 0 },
    { art: 'bumper', x: 12, y: 13.5, r: 1 },
    { art: 'bumper', x: 19, y: 15, r: 1 },
    { art: 'sand', x: 21.5, y: 1, w: 2.5, h: 8 },
  ],
  dekor: 'wiese',
  beschreibung: 'Ein Schubfeld schießt den Ball durch einen engen Kanal, an dessen Ende ein Drehkreuz die Schleuse bildet. Oben versperrt eine Wand den geraden Weg: links ums Ende herum, dann zurück zum Loch.',
  thema: 'Drehkreuz',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['beschleuniger', 'drehkreuz', 'bumper', 'umweg'],
};
