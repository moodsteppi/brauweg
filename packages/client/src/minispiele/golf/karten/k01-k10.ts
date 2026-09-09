/**
 * Bahnen k01–k10: die Einstiegsbahnen.
 *
 * k01–k08 sind Schwierigkeit 1 (ein bis zwei Präzisionsschläge, kaum
 * Hindernisse, große Ziele), k09–k10 Schwierigkeit 2 (eine Zone, die beim
 * unaufmerksamen Spiel etwas kostet). Jede Bahn zeigt GENAU eine Zonenart
 * sanft — als das, was sie in einer echten Minigolfanlage wäre: ein Extra,
 * kein Prüfungsgegenstand. Trotzdem kommt jede der neun Arten hier mindestens
 * zweimal vor (siehe `k01-k10.test.ts`), meist als zwei Exemplare derselben
 * Bahn (zwei Sandbunker, zwei Eisplatten, ...), damit die Idee jeder Karte
 * EINE bleibt.
 *
 * Verdichtungsrunde: Jede Bahn bekommt zwei bis vier Wandstücke, die die
 * FLÄCHE formen (Ecke, Trichter, Insel, Schikane, Bucht, Korridor) — eine
 * Minigolfbahn erkennt man an ihrer Form, nicht am Rechteck. Die Wände
 * flankieren den direkten Weg, sie versperren ihn nicht: breite Durchgänge
 * (≥ 2,5 E), keine Falle auf der Ideallinie. k01 bleibt am schlichtesten
 * (eine abgeschrägte Ecke reicht für den allerersten Putt).
 */
import type { Karte } from '../karte';

export const KARTEN_K01_K10: readonly Karte[] = [
  /**
   * Keine einzige Zone — der reine Vergleich, an dem alle anderen Bahnen sich
   * messen lassen. Eine einzige schräge Wand schrägt die obere rechte Ecke
   * ab (ein kleiner Dogleg-Ansatz), weit weg von der Ideallinie Abschlag→Loch
   * — der erste Putt bleibt einfach, spielt aber nicht auf leerer Wiese.
   */
  {
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
  },

  /**
   * Zwei schräge Wände bilden einen Trichter kurz vor dem Loch — die Mündung
   * ist weit (10 E), die Kehle bleibt mit 4 E immer noch großzügig. Sand
   * steht dort, wo ein Fehlschlag sonst bis an den Rand rollen würde, nicht
   * auf der geraden Linie zum Loch.
   */
  {
    id: 'k02-der-sandkasten',
    name: 'Der Sandkasten',
    schwierigkeit: 1,
    breite: 14,
    hoehe: 20,
    par: 2,
    schlagLimit: 6,
    zeitLimitS: 50,
    abschlaege: [
      [4, 17],
      [6, 17],
      [8, 17],
      [10, 17],
    ],
    loch: [7, 3],
    waende: [
      { ax: 2, ay: 8, bx: 5, by: 5, dicke: 0.6 },
      { ax: 12, ay: 8, bx: 9, by: 5, dicke: 0.6 },
    ],
    zonen: [
      { art: 'sand', x: 1, y: 6, w: 3, h: 9 },
      { art: 'sand', x: 10, y: 6, w: 3, h: 9 },
    ],
    dekor: 'wueste',
  },

  /**
   * Zwei versetzte Wandnasen biegen die Ideallinie leicht S-förmig um die
   * Eisplatte herum, statt sie gerade durchzulassen — eine kleine Kurve über
   * dem rutschigen Untergrund. Wer draufhält wie gewohnt, schießt übers Ziel
   * hinaus; die Bahn verzeiht das mit reichlich Auslauf.
   */
  {
    id: 'k03-die-eisrutsche',
    name: 'Die Eisrutsche',
    schwierigkeit: 1,
    breite: 14,
    hoehe: 22,
    par: 2,
    schlagLimit: 6,
    zeitLimitS: 55,
    abschlaege: [
      [4, 19],
      [6, 19],
      [8, 19],
      [10, 19],
    ],
    loch: [7, 3],
    waende: [
      { ax: 0, ay: 10, bx: 4.5, by: 7, dicke: 0.6 },
      { ax: 14, ay: 13, bx: 9.5, by: 16, dicke: 0.6 },
    ],
    zonen: [
      { art: 'eis', x: 2, y: 8, w: 5, h: 8 },
      { art: 'eis', x: 7, y: 8, w: 5, h: 8 },
    ],
    dekor: 'eis',
  },

  /**
   * Zwei Wandleisten rahmen den Beschleuniger-Schacht wie eine Rutsche: Der
   * Kick nach oben bleibt frei, aber der Weg dorthin ist jetzt ein Korridor,
   * kein offenes Feld. Die Chevrons zeigen die Richtung, bevor der Ball sie
   * spürt.
   */
  {
    id: 'k04-der-kickstart',
    name: 'Der Kickstart',
    schwierigkeit: 1,
    breite: 13,
    hoehe: 20,
    par: 2,
    schlagLimit: 6,
    zeitLimitS: 50,
    abschlaege: [
      [3, 17],
      [5, 17],
      [7, 17],
      [9, 17],
    ],
    loch: [6.5, 3],
    waende: [
      { x: 1.5, y: 5, w: 1, h: 9 },
      { x: 10.5, y: 5, w: 1, h: 9 },
    ],
    zonen: [
      { art: 'beschleuniger', x: 4, y: 10, w: 5, h: 3, rx: 0, ry: -1, staerke: 25 },
      { art: 'beschleuniger', x: 4, y: 6, w: 5, h: 3, rx: 0, ry: -1, staerke: 25 },
    ],
    dekor: 'nacht',
  },

  /**
   * Zwei kurze Wandzungen ragen von den Seiten herein — eine Schikane, die
   * die Ideallinie sanft zwingt, an den Pilzen vorbeizuschauen statt sie zu
   * ignorieren. Wer gerade zielt, sieht die Pilze nur zuschauen; wer daneben
   * trifft, wird von ihnen quer durchs Feld geschossen.
   */
  {
    id: 'k05-der-pilzwald',
    name: 'Der Pilzwald',
    schwierigkeit: 1,
    breite: 16,
    hoehe: 26,
    par: 2,
    schlagLimit: 6,
    zeitLimitS: 55,
    abschlaege: [
      [5, 22],
      [7, 22],
      [9, 22],
      [11, 22],
    ],
    loch: [8, 4],
    waende: [
      { x: 0, y: 16, w: 4, h: 1 },
      { x: 12, y: 8, w: 4, h: 1 },
    ],
    zonen: [
      { art: 'bumper', x: 3, y: 13, r: 1 },
      { art: 'bumper', x: 13, y: 13, r: 1 },
    ],
    dekor: 'wiese',
  },

  /**
   * Eine kleine Insel sitzt genau zwischen den beiden Portalringen: Wer die
   * Abkürzung nimmt, springt über sie hinweg; wer sie ignoriert, findet
   * rechts wie links 5 E Platz, um drumherum zu spielen. Kein Hindernis
   * versperrt den direkten Weg, es gibt ihm nur eine Mitte.
   */
  {
    id: 'k06-zwillingstore',
    name: 'Zwillingstore',
    schwierigkeit: 1,
    breite: 14,
    hoehe: 22,
    par: 2,
    schlagLimit: 7,
    zeitLimitS: 55,
    abschlaege: [
      [4, 19],
      [6, 19],
      [8, 19],
      [10, 19],
    ],
    loch: [7, 3],
    waende: [{ x: 5, y: 9.5, w: 4, h: 2 }],
    zonen: [
      { art: 'portal', x: 7, y: 14, r: 0.8, ziel: { x: 7, y: 7 }, paar: 0 },
      { art: 'portal', x: 7, y: 7, r: 0.8, ziel: { x: 7, y: 14 }, paar: 0 },
    ],
    dekor: 'wiese',
  },

  /**
   * Eine kleine Bucht ist aus der hinteren linken Ecke herausgeschnitten,
   * weit weg von den Abschlägen — die Fläche bekommt eine Kontur, ohne dem
   * Sprung im Weg zu stehen. Die Federplatte wirft den Ball übers Feld
   * Richtung Loch, den letzten Rest legt ein kurzer Anschlag zurück.
   */
  {
    id: 'k07-die-sprungschanze',
    name: 'Die Sprungschanze',
    schwierigkeit: 1,
    breite: 18,
    hoehe: 28,
    par: 2,
    schlagLimit: 7,
    zeitLimitS: 60,
    abschlaege: [
      [6, 25],
      [8, 25],
      [10, 25],
      [12, 25],
    ],
    loch: [9, 4],
    waende: [
      { x: 0, y: 22.5, w: 4, h: 0.6 },
      { x: 3.4, y: 22.5, w: 0.6, h: 5.5 },
    ],
    zonen: [
      { art: 'sprungfeld', x: 5, y: 14, w: 4, h: 3, rx: 0, ry: -1, weite: 10 },
      { art: 'sprungfeld', x: 9, y: 14, w: 4, h: 3, rx: 0, ry: -1, weite: 10 },
    ],
    dekor: 'wueste',
  },

  /**
   * Verkleinert (war 16×34 — für zwei Strudel viel zu lang): Zwei
   * Wandnasen bilden auf halber Höhe eine Taille, die das Feld in Anflug und
   * Landezone gliedert. Der große Strudel sitzt genau dort, wo ein voll
   * getroffener Ball ohnehin zur Ruhe käme, und wirft ihn knapp vor dem Loch
   * wieder aus. Der kleine Strudel liegt abseits am Wegesrand, direkt an der
   * Taille, und zeigt dieselbe Anziehung im Kleinen.
   */
  {
    id: 'k08-der-strudelgarten',
    name: 'Der Strudelgarten',
    schwierigkeit: 1,
    breite: 16,
    hoehe: 28,
    par: 2,
    schlagLimit: 7,
    zeitLimitS: 65,
    abschlaege: [
      [8, 24],
      [6, 24],
      [10, 24],
      [12, 24],
    ],
    loch: [8, 4],
    waende: [
      { x: 0, y: 15.5, w: 4, h: 0.8 },
      { x: 12, y: 15.5, w: 4, h: 0.8 },
    ],
    zonen: [
      { art: 'strudel', x: 8.5, y: 6.7, r: 1.5, staerke: 8, ziel: { x: 8, y: 6 } },
      { art: 'strudel', x: 3, y: 18, r: 0.6, staerke: 3 },
    ],
    dekor: 'wiese',
  },

  /**
   * Schwierigkeit 2: Zwei schräge Wandnasen lassen die beiden Teiche wie ein
   * echtes Ufer mäandern — die Ideallinie webt einmal sanft nach rechts, dann
   * nach links, bleibt aber überall mindestens 2,5 E breit. Erst wer seitlich
   * abweicht, zahlt den Strafschlag und beginnt wieder an der Stelle vor dem
   * Schlag.
   */
  {
    id: 'k09-der-uferweg',
    name: 'Der Uferweg',
    schwierigkeit: 2,
    breite: 14,
    hoehe: 22,
    par: 2,
    schlagLimit: 7,
    zeitLimitS: 55,
    abschlaege: [
      [4, 19],
      [6, 19],
      [8, 19],
      [10, 19],
    ],
    loch: [7, 3],
    waende: [
      { ax: 4, ay: 17, bx: 7, by: 13, dicke: 0.6 },
      { ax: 10, ay: 12, bx: 7, by: 8, dicke: 0.6 },
    ],
    zonen: [
      { art: 'wasser', x: 1, y: 8, w: 3, h: 9 },
      { art: 'wasser', x: 10, y: 8, w: 3, h: 9 },
    ],
    dekor: 'wiese',
  },

  /**
   * Schwierigkeit 2: Vier schräge Wandstücke rahmen die Drehkreuze als
   * Korridor — ein weites Tor vor den Kreuzen, ein Trichter danach, der sich
   * zum Loch hin öffnet. Wer geradeaus zielt, kommt den Kreuzen nie näher als
   * etwa 4 E — sie sind zu sehen und zu hören, aber auf dem Weg zum Loch
   * nicht im Weg.
   */
  {
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
  },
];
