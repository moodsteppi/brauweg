import type { Karte } from '../karte';

/**
 * Keine einzige Zone — der reine Vergleich, an dem alle anderen Bahnen sich
 * messen lassen. Eine einzige schräge Wand schrägt die obere rechte Ecke
 * ab (ein kleiner Dogleg-Ansatz), weit weg von der Ideallinie Abschlag→Loch
 * — der erste Putt bleibt einfach, spielt aber nicht auf leerer Wiese.
 */
export const bahn: Karte = {
  id: 'k01-der-erste-schlag',
  name: 'Der erste Schlag',
  schwierigkeit: 1,
  breite: 12,
  hoehe: 18,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 45,
  abschlaege: [
    [3, 15],
    [5, 15],
    [7, 15],
    [9, 15],
  ],
  loch: [6, 3],
  waende: [{ ax: 12, ay: 7, bx: 7, by: 0, dicke: 0.8 }],
  zonen: [],
  dekor: 'wiese',
};
