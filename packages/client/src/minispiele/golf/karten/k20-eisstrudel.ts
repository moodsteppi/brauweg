import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k20 — Der Eisstrudel (echtes Dogleg, Eis + Strudel als Falle am Bogen)
 * Stufe 3: zwei versetzte Riegel erzwingen den Bogen, das Eis davor
 * verlängert jeden Fehler, die Strudel bestrafen einen zu weiten Bogen.
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
  id: 'k20-eisstrudel',
  name: 'Der Eisstrudel',
  schwierigkeit: 3,
  breite: 32,
  hoehe: 44,
  par: 5,
  schlagLimit: 10,
  zeitLimitS: 110,
  abschlaege: [
    [5, 41],
    [8, 41.5],
    [12, 41.5],
    [15, 41],
  ],
  loch: [8, 4],
  waende: [
    // Unterer Riegel: Lücke rechts (x20..32).
    { x: 0, y: 20, w: 20, h: 1 },
    // Oberer Riegel, GEGEN den unteren versetzt: Lücke links (x0..12) —
    // erst das erzwingt den echten Bogen von rechts nach links.
    { x: 12, y: 10, w: 20, h: 1 },
    // Zwei Krallen an den Lückenkanten geben dem Dogleg seine Form.
    { x: 19.2, y: 14, w: 0.8, h: 6 },
    { x: 12, y: 11, w: 0.8, h: 5 },
  ],
  zonen: [
    { art: 'eis', x: 2, y: 30, w: 14, h: 6 },
    { art: 'eis', x: 21, y: 16, w: 9, h: 6 },
    // Groß und abseits der Ideallinie: wer nach der ersten Lücke zu weit
    // rechts bleibt statt den Bogen nach links zu Ende zu spielen, wird
    // hier festgehalten.
    { art: 'strudel', x: 24, y: 6, r: 3, staerke: 12 },
    // Klein, unten rechts — bestraft nur einen völlig verzogenen Abschlag.
    { art: 'strudel', x: 28, y: 38, r: 1.2, staerke: 10 },
  ],
  dekor: 'eis',
};
