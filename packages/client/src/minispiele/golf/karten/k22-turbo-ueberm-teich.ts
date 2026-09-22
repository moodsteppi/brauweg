import type { Karte } from '../karte';

/*
 * k22 — Turbo überm Teich. Ein schmaler Landdamm führt zwischen zwei
 * Teichhälften hindurch; ein kräftiger Beschleuniger direkt im Damm trägt
 * den Ball den ganzen Weg nach oben, ohne dass er ins Wasser muss. Wer den
 * Damm verlässt, fällt ins Wasser — der Damm selbst ist immer breit genug
 * (7 E), um ihn sicher zu treffen.
 */
export const bahn: Karte = {
  id: 'k22-turbo-ueberm-teich',
  name: 'Turbo überm Teich',
  schwierigkeit: 3,
  breite: 20,
  hoehe: 30,
  par: 2,
  schlagLimit: 7,
  zeitLimitS: 75,
  abschlaege: [
    [10, 26],
    [8, 26],
    [12, 26],
    [9, 25.5],
    [11, 25.5],
  ],
  loch: [10, 4],
  waende: [
    // Dammkanten: machen aus dem offenen Zwischenraum einen echten,
    // sichtbaren Steg zwischen den beiden Teichhälften.
    { x: 6.5, y: 9.5, w: 0.5, h: 11 },
    { x: 13.0, y: 9.5, w: 0.5, h: 11 },
    // Riegel vorm Grün, Lücke rechts — der Steg mündet nicht gerade,
    // sondern über eine kleine Kurve ins Grün.
    { x: 4, y: 6, w: 7, h: 0.8 },
    // Rückwand der Grünkammer, beidseitig offen.
    { x: 4, y: 1.6, w: 12, h: 0.7 },
  ],
  zonen: [
    { art: 'wasser', x: 0, y: 10, w: 6.5, h: 10 },
    { art: 'wasser', x: 13.5, y: 10, w: 6.5, h: 10 },
    { art: 'beschleuniger', x: 8, y: 20, w: 4, h: 4, rx: 0, ry: -1, staerke: 30 },
  ],
  dekor: 'wiese',
};
