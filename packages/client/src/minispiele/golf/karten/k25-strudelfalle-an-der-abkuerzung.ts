import type { Karte } from '../karte';

/*
 * k25 — Strudelfalle an der Abkürzung. Die schnelle, glatte Linie zum
 * Loch führt über eine Eisfläche — verlockend direkt, aber ein Strudel
 * lauert gleich daneben und zieht jeden, der die Ideallinie verfehlt, aus
 * der Bahn.
 */
export const bahn: Karte = {
  id: 'k25-strudelfalle-an-der-abkuerzung',
  name: 'Strudelfalle an der Abkürzung',
  schwierigkeit: 3,
  breite: 20,
  hoehe: 30,
  par: 2,
  schlagLimit: 7,
  zeitLimitS: 85,
  abschlaege: [
    [10, 26],
    [8, 26],
    [12, 26],
    [9, 24],
    [11, 24],
  ],
  loch: [14, 5],
  waende: [
    // Teiler zwischen Kurzweg (links, durchs Eis) und Sicherheitsweg
    // (rechts, schmal aber hindernisfrei).
    { x: 15, y: 10, w: 0.8, h: 14 },
    // Kappe über dem Kurzweg — verhindert einen zu geraden Schuss durchs Eis.
    { x: 0, y: 9, w: 5, h: 0.8 },
    // Einfädler zum sicheren Weg.
    { x: 17, y: 24, w: 3, h: 0.8 },
    // Kleiner Vorsprung am Abschlag, lenkt den ersten Schlag von der
    // Strudelseite weg.
    { x: 2, y: 24.5, w: 3, h: 0.6 },
  ],
  zonen: [
    { art: 'eis', x: 8, y: 16, w: 6, h: 6 },
    { art: 'strudel', x: 5, y: 19, r: 1.8, staerke: 14 },
    // Falle auf dem direkten Weg in den Kurzweg hinein.
    { art: 'sand', x: 9, y: 20.5, w: 3, h: 2 },
  ],
  dekor: 'nacht',
};
