import type { Karte } from '../karte';

/**
 * Eine Wand teilt die Bahn, hinüber geht es nur durchs Portal — und das setzt
 * den Ball mitten in einen Strudel. Wohin er dort geschleudert wird,
 * entscheidet über den zweiten Schlag.
 */
export const bahn: Karte = {
  id: 'k46-portal-in-den-strudel',
  name: 'Portal in den Strudel',
  schwierigkeit: 2,
  breite: 24,
  hoehe: 36,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 75,
  abschlaege: [
    [5, 33],
    [7, 33],
  ],
  loch: [18, 5],
  waende: [
    { x: 11, y: 0, w: 2, h: 36 },
  ],
  zonen: [
    { art: 'portal', x: 5, y: 16, r: 1.1, ziel: { x: 18, y: 25.5 }, paar: 0 },
    { art: 'strudel', x: 18, y: 24, r: 2, staerke: 30 },
  ],
  dekor: 'nacht',
  beschreibung: 'Eine Wand teilt die Bahn, hinüber geht es nur durchs Portal — und das setzt den Ball mitten in einen Strudel. Wohin er dort geschleudert wird, entscheidet über den zweiten Schlag.',
  thema: 'Portale',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['portal', 'strudel'],
};
