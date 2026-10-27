import type { Karte } from '../karte';

// k37 — Portalkarussell: zwei Portalpaare tragen den Ball in zwei Spruengen
// durch den langen Schacht — die Bot-Wegfindung nutzt beide Kanten von
// selbst, weil das Entfernungsfeld Portale als Abkuerzung kennt.
export const bahn: Karte = {
  id: 'k37-portalkarussell',
  name: 'Portalkarussell',
  schwierigkeit: 5,
  breite: 24,
  hoehe: 40,
  par: 4,
  schlagLimit: 10,
  zeitLimitS: 110,
  abschlaege: [
    [9, 37],
    [11, 37],
    [13, 37],
    [15, 37],
  ],
  loch: [12, 4],
  // Idee: Ein Wassergraben trennt die Bahn. Schnell geht es durch das
  // Portal links (landet vor der Drehkreuz-Kammer), sicher und langsam
  // ueber die Sandbruecke rechts. Wer in der Kammer zu hart spielt, rollt
  // zurueck durchs Ausgangsportal — das ist das Karussell.
  waende: [
    // Untere Haelfte: Zange, die den Abschlag nach links (Portal) oder
    // rechts (Bruecke) lenkt
    { x: 8, y: 24, w: 8, h: 1 },
    { ax: 4, ay: 30, bx: 8, by: 25, dicke: 0.8 },
    { ax: 20, ay: 30, bx: 16, by: 25, dicke: 0.8 },
    // Obere Haelfte: Kammer ums Loch mit zwei Toren
    { x: 5, y: 9, w: 5, h: 1 },
    { x: 14, y: 9, w: 5, h: 1 },
    { x: 5, y: 9, w: 1, h: 6 },
    { x: 18, y: 9, w: 1, h: 6 },
    // Riegel zwischen Portalausgang und Bruecke, damit beide Wege
    // getrennt bleiben
    { x: 11, y: 13, w: 2, h: 5 },
  ],
  zonen: [
    // Der Graben — nur die Sandbruecke rechts fuehrt hinueber
    { art: 'wasser', x: 0, y: 19, w: 19, h: 3 },
    { art: 'sand', x: 19, y: 19, w: 5, h: 3 },
    // Portalpaar: unten links hinein, oben links wieder heraus
    { art: 'portal', x: 3, y: 33, r: 1, ziel: { x: 3, y: 15 }, paar: 0 },
    { art: 'portal', x: 3, y: 15, r: 1, ziel: { x: 3, y: 33 }, paar: 0 },
    // Kammer: Drehkreuz vor dem Loch, zwei Bumper als Waechter
    { art: 'drehkreuz', x: 12, y: 12, laenge: 4, gradJeTakt: 3, phase: 0 },
    { art: 'bumper', x: 7, y: 6, r: 0.8 },
    { art: 'bumper', x: 17, y: 6, r: 0.8 },
    // Eis hinter der Bruecke: wer zu stark schlaegt, rutscht an der Kammer vorbei
    { art: 'eis', x: 19, y: 10, w: 5, h: 8 },
  ],
  dekor: 'nacht',
};
