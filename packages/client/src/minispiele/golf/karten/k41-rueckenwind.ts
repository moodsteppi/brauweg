import type { Karte } from '../karte';

/**
 * Ein Schubfeld mitten auf der Geraden trägt den Ball weiter, als der Schlag
 * allein reicht — wer zu zaghaft schlägt, bleibt davor liegen. Mit Mut geht
 * das Loch in einem Schlag.
 */
export const bahn: Karte = {
  id: 'k41-rueckenwind',
  name: 'Rückenwind',
  schwierigkeit: 1,
  breite: 16,
  hoehe: 34,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 60,
  abschlaege: [
    [7, 31],
    [9, 31],
  ],
  loch: [8, 4],
  waende: [],
  zonen: [
    { art: 'beschleuniger', x: 5, y: 14, w: 6, h: 6, rx: 0, ry: -1, staerke: 20 },
  ],
  dekor: 'wiese',
  beschreibung: 'Ein Schubfeld mitten auf der Geraden trägt den Ball weiter, als der Schlag allein reicht — wer zu zaghaft schlägt, bleibt davor liegen. Mit Mut geht das Loch in einem Schlag.',
  thema: 'Beschleuniger',
  autor: 'Aufsicht (Nachtlauf 22.09.2026)',
  tags: ['beschleuniger', 'einstieg', 'gerade'],
};
