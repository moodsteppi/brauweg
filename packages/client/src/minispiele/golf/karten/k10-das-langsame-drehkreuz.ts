import type { Karte } from '../karte';

/**
 * Schwierigkeit 2: Vier schräge Wandstücke rahmen die Drehkreuze als
 * Korridor — ein weites Tor vor den Kreuzen, ein Trichter danach, der sich
 * zum Loch hin öffnet. Wer geradeaus zielt, kommt den Kreuzen nie näher als
 * etwa 4 E — sie sind zu sehen und zu hören, aber auf dem Weg zum Loch
 * nicht im Weg.
 */
export const bahn: Karte = {
  id: 'k10-das-langsame-drehkreuz',
  name: 'Das langsame Drehkreuz',
  schwierigkeit: 2,
  breite: 30,
  hoehe: 46,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 90,
  abschlaege: [
    [10, 42],
    [14, 42],
    [18, 42],
    [22, 42],
  ],
  loch: [15, 5],
  waende: [
    { ax: 6, ay: 33, bx: 12, by: 29, dicke: 0.8 },
    { ax: 24, ay: 29, bx: 18, by: 33, dicke: 0.8 },
    { ax: 13, ay: 17, bx: 9, by: 13, dicke: 0.8 },
    { ax: 17, ay: 17, bx: 21, by: 13, dicke: 0.8 },
  ],
  zonen: [
    { art: 'drehkreuz', x: 5, y: 24, laenge: 4, gradJeTakt: 1, phase: 0 },
    { art: 'drehkreuz', x: 25, y: 24, laenge: 4, gradJeTakt: -1, phase: 90 },
  ],
  dekor: 'nacht',
};
