import type { Karte } from '../karte';

/*
 * k26 — Sprung über die Wasserzunge. Eine Zunge aus Wasser reckt sich von
 * links in die Bahn; der sichere Weg führt rechts daran vorbei zum Loch.
 * Wer es eilig hat, nimmt unten links das Sprungfeld und hüpft über die
 * Zunge hinweg direkt in Richtung Loch.
 */
export const bahn: Karte = {
  id: 'k26-sprung-ueber-die-wasserzunge',
  name: 'Sprung über die Wasserzunge',
  schwierigkeit: 3,
  breite: 30,
  hoehe: 46,
  par: 3,
  schlagLimit: 9,
  zeitLimitS: 100,
  abschlaege: [
    [24, 42],
    [26, 42],
    [22, 42],
    [24, 40],
    [26, 40],
  ],
  loch: [16, 5],
  waende: [
    // Spange am Ostufer der Wasserzunge: gibt dem sicheren Weg rechts einen
    // eigenen Kanal, statt ihn im offenen Feld zu verlieren.
    { x: 16.5, y: 14, w: 0.8, h: 20 },
    // Kappe oben, Lücke links — zwingt den Kanal in eine leichte Kurve
    // Richtung Loch statt gerade durch.
    { x: 8, y: 13.5, w: 8.5, h: 0.8 },
    // Ausleger unten am Kanal, lenkt den Abschlag von rechts herein.
    { x: 17.3, y: 33, w: 4, h: 0.8 },
    // Riegel vorm Loch, verengt die letzte Annäherung.
    { x: 12, y: 8, w: 5, h: 0.8 },
  ],
  zonen: [
    { art: 'wasser', x: 0, y: 20, w: 16, h: 8 },
    { art: 'sprungfeld', x: 3, y: 29, w: 3, h: 2.5, rx: 0, ry: -1, weite: 12 },
    // Falle im sicheren Kanal, weit genug vom Wasser entfernt.
    { art: 'sand', x: 19, y: 16, w: 5, h: 4 },
  ],
  dekor: 'wiese',
};
