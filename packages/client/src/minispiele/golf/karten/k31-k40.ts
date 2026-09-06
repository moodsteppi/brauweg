import type { Karte } from '../karte';

/**
 * Die Meisterbahnen: k31–k36 Stufe 4 (enge Durchgaenge, Wasser auf dem
 * direkten Weg, Beschleuniger, die man nutzen MUSS), k37–k40 Stufe 5 (Ketten
 * aus Portalen, Sprungfeldern und Drehkreuzen). Jede Bahn bleibt trotzdem
 * fair: der Bot der Stufe „genie" muss jede in hoechstens `schlagLimit`
 * Schlaegen loesen — Korridore und Luecken deshalb grosszuegig ueber dem
 * Mindestmass von 1,4 E, Fallen immer neben der Ideallinie, nie darauf.
 */

export const KARTEN_K31_K40: readonly Karte[] = [
  // k31 — Der Zwillingsstrom: Dogleg um eine Riegelwand, Wasser lockt auf dem
  // direkten Weg, wer stur geradeaus zielt statt zur Luecke rechts.
  {
    id: 'k31-zwillingsstrom',
    name: 'Der Zwillingsstrom',
    schwierigkeit: 4,
    breite: 16,
    hoehe: 26,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 75,
    abschlaege: [
      [6, 24],
      [7, 24],
      [8, 24],
      [9, 24],
    ],
    loch: [5, 5],
    waende: [{ x: 0, y: 14, w: 14.2, h: 1 }],
    zonen: [{ art: 'wasser', x: 6, y: 17, w: 4, h: 3.5 }],
    dekor: 'wiese',
  },

  // k32 — Eisrutsche der Meister: ein Eisfeld ohne Reibung vor zwei
  // Flipper-Pilzen, die den Lochzugang eng flankieren.
  {
    id: 'k32-eisrutsche',
    name: 'Eisrutsche der Meister',
    schwierigkeit: 4,
    breite: 16,
    hoehe: 28,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 75,
    abschlaege: [
      [6, 25],
      [7, 25],
      [8, 25],
      [9, 25],
    ],
    loch: [8, 3],
    waende: [
      { x: 0, y: 20, w: 2, h: 5 },
      { x: 14, y: 20, w: 2, h: 5 },
    ],
    zonen: [
      { art: 'eis', x: 3, y: 10, w: 10, h: 9 },
      { art: 'bumper', x: 6, y: 5, r: 1.0 },
      { art: 'bumper', x: 10, y: 5, r: 1.0 },
    ],
    dekor: 'eis',
  },

  // k33 — Seeplatte: eine Wasserflaeche liegt gleich neben der geraden Linie
  // vom Abschlag zum Loch, Sand auf der anderen Seite faengt den Fehlschlag,
  // der ihr zu grossraeumig ausweicht.
  {
    id: 'k33-seeplatte',
    name: 'Seeplatte',
    schwierigkeit: 4,
    breite: 18,
    hoehe: 30,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 80,
    abschlaege: [
      [2, 27],
      [3, 27],
      [4, 27],
      [5, 27],
    ],
    loch: [4, 4],
    waende: [],
    zonen: [
      { art: 'wasser', x: 7, y: 14, w: 4, h: 4 },
      { art: 'sand', x: 11, y: 19, w: 5, h: 6 },
    ],
    dekor: 'wueste',
  },

  // k34 — Der Katapultkorridor: ein langer Schacht, den nur der Beschleuniger
  // in vernuenftig wenigen Schlaegen ueberwindet; ein Strudel lauert daneben,
  // nicht auf der Mittellinie.
  {
    id: 'k34-katapultkorridor',
    name: 'Der Katapultkorridor',
    schwierigkeit: 4,
    breite: 30,
    hoehe: 48,
    par: 6,
    schlagLimit: 11,
    zeitLimitS: 100,
    abschlaege: [
      [13, 45],
      [14, 45],
      [16, 45],
      [17, 45],
    ],
    loch: [15, 3],
    waende: [
      { x: 0, y: 5, w: 10, h: 38 },
      { x: 20, y: 5, w: 10, h: 38 },
    ],
    zonen: [
      { art: 'beschleuniger', x: 10, y: 30, w: 10, h: 6, rx: 0, ry: -1, staerke: 30 },
      { art: 'strudel', x: 12, y: 15, r: 1.8, staerke: 14 },
    ],
    dekor: 'wiese',
  },

  // k35 — Sandsprint: ein dickes Sandfeld liegt auf dem Weg zum Loch, der
  // Beschleuniger davor ist der einzige Weg, es in vernuenftig wenigen
  // Schlaegen zu durchqueren.
  {
    id: 'k35-sandsprint',
    name: 'Sandsprint',
    schwierigkeit: 4,
    breite: 16,
    hoehe: 26,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 75,
    abschlaege: [
      [6, 23],
      [7, 23],
      [8, 23],
      [9, 23],
    ],
    loch: [8, 4],
    waende: [],
    zonen: [
      { art: 'beschleuniger', x: 5, y: 16, w: 6, h: 3, rx: 0, ry: -1, staerke: 32 },
      { art: 'sand', x: 4, y: 8, w: 8, h: 7 },
    ],
    dekor: 'wueste',
  },

  // k36 — Nadeloehr: ein enger Zickzack aus zwei 2-E-Luecken auf
  // entgegengesetzten Seiten, ein Eisstreifen dazwischen straft Ungenauigkeit.
  {
    id: 'k36-nadeloehr',
    name: 'Nadeloehr',
    schwierigkeit: 4,
    breite: 14,
    hoehe: 20,
    par: 3,
    schlagLimit: 8,
    zeitLimitS: 55,
    abschlaege: [
      [5, 18],
      [6, 18],
      [7, 18],
      [8, 18],
    ],
    loch: [3, 3],
    waende: [
      { x: 0, y: 12, w: 12, h: 1 },
      { x: 2, y: 6, w: 12, h: 1 },
    ],
    zonen: [{ art: 'eis', x: 4, y: 8, w: 6, h: 3 }],
    dekor: 'eis',
  },

  // k37 — Portalkarussell: zwei Portalpaare tragen den Ball in zwei Spruengen
  // durch den langen Schacht — die Bot-Wegfindung nutzt beide Kanten von
  // selbst, weil das Entfernungsfeld Portale als Abkuerzung kennt.
  {
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
  },

  // k38 — Sprungfeld-Kaskade: zwei Federplatten ueber die volle
  // Korridorbreite werfen den Ball zweimal nach oben, ein Strudel wartet
  // knapp neben der Mittellinie.
  {
    id: 'k38-sprungfeldkaskade',
    name: 'Sprungfeld-Kaskade',
    schwierigkeit: 5,
    breite: 30,
    hoehe: 50,
    par: 5,
    schlagLimit: 10,
    zeitLimitS: 110,
    abschlaege: [
      [13, 47],
      [14, 47],
      [16, 47],
      [17, 47],
    ],
    loch: [15, 3],
    waende: [
      { x: 0, y: 5, w: 10, h: 40 },
      { x: 20, y: 5, w: 10, h: 40 },
    ],
    zonen: [
      { art: 'sprungfeld', x: 10, y: 30, w: 10, h: 3, rx: 0, ry: -1, weite: 12 },
      { art: 'sprungfeld', x: 10, y: 14, w: 10, h: 3, rx: 0, ry: -1, weite: 12 },
      { art: 'strudel', x: 12, y: 22, r: 1.5, staerke: 12 },
    ],
    dekor: 'wiese',
  },

  // k39 — Drehkreuzgasse: zwei gegenlaeufige Balken queren den Korridor,
  // an den Seiten bleibt immer eine Luecke von 2 E.
  {
    id: 'k39-drehkreuzgasse',
    name: 'Drehkreuzgasse',
    schwierigkeit: 5,
    breite: 28,
    hoehe: 44,
    par: 5,
    schlagLimit: 10,
    zeitLimitS: 100,
    abschlaege: [
      [13, 41],
      [14, 41],
      [16, 41],
      [17, 41],
    ],
    loch: [14, 3],
    waende: [
      { x: 0, y: 5, w: 10, h: 34 },
      { x: 18, y: 5, w: 10, h: 34 },
    ],
    zonen: [
      { art: 'drehkreuz', x: 14, y: 26, laenge: 4, gradJeTakt: 2, phase: 0 },
      { art: 'drehkreuz', x: 14, y: 14, laenge: 4, gradJeTakt: -2, phase: 90 },
    ],
    dekor: 'nacht',
  },

  // k40 — Der Meisterzirkel: ein Drehkreuz vor einem kurzen Portalsprung —
  // die Kroenung aus allen Ketten-Ideen auf kompaktem Raum.
  {
    id: 'k40-meisterzirkel',
    name: 'Der Meisterzirkel',
    schwierigkeit: 5,
    breite: 20,
    hoehe: 32,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 70,
    abschlaege: [
      [9, 29],
      [10, 29],
      [12, 29],
      [13, 29],
    ],
    loch: [10, 2.5],
    waende: [
      { x: 0, y: 4, w: 6, h: 22 },
      { x: 14, y: 4, w: 6, h: 22 },
    ],
    zonen: [
      { art: 'drehkreuz', x: 10, y: 18, laenge: 4, gradJeTakt: 3, phase: 0 },
      { art: 'portal', x: 10, y: 12, r: 1.0, ziel: { x: 10, y: 6 }, paar: 0 },
      { art: 'portal', x: 10, y: 6, r: 1.0, ziel: { x: 10, y: 12 }, paar: 0 },
    ],
    dekor: 'nacht',
  },
];
