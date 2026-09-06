/**
 * Bahnen k11 bis k20 — Stufe 2 (k11-k18) und Stufe 3 (k19-k20).
 *
 * Verdichtungsrunde: Jede Bahn hat jetzt eine erkennbare SILHOUETTE aus
 * mindestens vier Wandstücken (Rahmen zählt nicht) — Kurven, Zangen, eine
 * Insel mit Graben, ein Trichter mit Kammer, ein Schlauch mit Schikanen, eine
 * Bumperkammer, Krallen um eine Portalzange, ein Garten mit Beeten, ein
 * Sprungtrichter mit Kammer, ein Eisdogleg. Zonen sitzen IN der Wandform statt
 * auf freiem Rasen. Über alle zehn Bahnen kommt jede der neun Zonenarten
 * mindestens zweimal vor.
 */
import type { Karte } from '../karte';

export const KARTEN_K11_K20: readonly Karte[] = [
  /* ------------------------------------------------------------------------
   * k11 — Die Sandkurve (echte S-Kurve aus zwei versetzten Riegeln + Haken)
   * --------------------------------------------------------------------- */
  {
    id: 'k11-sandkurve',
    name: 'Die Sandkurve',
    schwierigkeit: 2,
    breite: 14,
    hoehe: 22,
    par: 3,
    schlagLimit: 8,
    zeitLimitS: 60,
    abschlaege: [
      [3, 19.5],
      [5, 19.8],
      [9, 19.8],
      [11, 19.5],
    ],
    loch: [3, 2],
    waende: [
      // Unterer Riegel: Lücke rechts (x8..14).
      { x: 0, y: 15, w: 8, h: 0.8 },
      // Haken am linken Riegelende — schließt eine kleine Nische mit Sand.
      { x: 2, y: 11, w: 0.8, h: 4.8 },
      // Oberer Riegel, GEGEN den unteren versetzt: Lücke links (x0..6). Erst
      // diese Versetzung macht aus dem Riegel eine echte Kurve statt eines
      // einzelnen Balkens.
      { x: 6, y: 7, w: 8, h: 0.8 },
      // Haken am rechten Riegelende — zweite Nische mit Sand.
      { x: 11, y: 3, w: 0.8, h: 4.8 },
    ],
    zonen: [
      // Nische unten links: Wer die erste Lücke zu knapp links nimmt, statt
      // sie rechts zu suchen, versandet hier statt weiterzurollen.
      { art: 'sand', x: 0, y: 11.5, w: 1.8, h: 3.8 },
      // Nische oben rechts: Wer nach der ersten Lücke geradeaus statt nach
      // links weiterrollt, landet hier statt in der zweiten Lücke.
      { art: 'sand', x: 11.9, y: 3.5, w: 2, h: 3.8 },
    ],
    dekor: 'wiese',
  },

  /* ------------------------------------------------------------------------
   * k12 — Die Turbozange (Sanduhr aus vier Schrägwänden + zwei Schüben)
   * --------------------------------------------------------------------- */
  {
    id: 'k12-turbozange',
    name: 'Die Turbozange',
    schwierigkeit: 2,
    breite: 18,
    hoehe: 26,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 75,
    abschlaege: [
      [4, 23],
      [6, 23.5],
      [12, 23.5],
      [14, 23],
    ],
    loch: [9, 3],
    waende: [
      // Untere Zangenhälfte: zwei schräge Arme laufen auf die Taille zu.
      { ax: 0, ay: 22, bx: 7, by: 13, dicke: 0.8 },
      { ax: 18, ay: 22, bx: 11, by: 13, dicke: 0.8 },
      // Obere Zangenhälfte: dieselbe Taille öffnet sich wieder nach außen —
      // aus dem einzelnen Riegel von vorher wird eine echte Sanduhr.
      { ax: 7, ay: 13, bx: 0, by: 4, dicke: 0.8 },
      { ax: 11, ay: 13, bx: 18, by: 4, dicke: 0.8 },
    ],
    zonen: [
      // Schub in der unteren Hälfte trägt bis an die Taille heran.
      { art: 'beschleuniger', x: 6, y: 17, w: 6, h: 3, rx: 0, ry: -1, staerke: 20 },
      // Zweiter Schub gleich hinter der Taille trägt weiter Richtung Loch.
      { art: 'beschleuniger', x: 6, y: 7, w: 6, h: 3, rx: 0, ry: -1, staerke: 20 },
    ],
    dekor: 'wiese',
  },

  /* ------------------------------------------------------------------------
   * k13 — Die Wasserinsel (Insel mit Wassergraben und zwei Brücken)
   * --------------------------------------------------------------------- */
  {
    id: 'k13-wasserinsel',
    name: 'Die Wasserinsel',
    schwierigkeit: 2,
    breite: 22,
    hoehe: 28,
    par: 3,
    schlagLimit: 8,
    zeitLimitS: 75,
    // Sitz 0 startet bewusst auf der Ostseite: Nur so muss der getestete Bot
    // wirklich um die Insel herum, statt sie geradewegs zu ignorieren.
    abschlaege: [
      [16, 25],
      [14, 25.5],
      [8, 25.5],
      [6, 25],
    ],
    // Bewusst über der WESTBRÜCKE, nicht über der Insel: Der direkte Weg
    // führt so nie näher als weit über 1,5 E am Wassergraben vorbei — die
    // Bot-Wegfindung kennt bei Zonen keinen Ballradius-Puffer und hätte sich
    // sonst genau in die Grabenecke verklemmt (dort blieb ein erster Entwurf
    // hängen).
    loch: [3, 3],
    waende: [
      // Die Insel in der Mitte …
      { x: 8, y: 12, w: 6, h: 6 },
      // … mit einem kleinen Erker an der Ostseite, der ihr eine Form gibt.
      { x: 14, y: 13.5, w: 1.5, h: 2 },
      // Zwei kleine Riffe in den Brücken, deutlich abseits der Ideallinie.
      { x: 1, y: 14, w: 1, h: 1 },
      { x: 20, y: 14, w: 1, h: 1 },
    ],
    zonen: [
      // Der Graben liegt vor der Insel, schmaler als sie: Zu den Brücken
      // bleiben gut 2 E Rasen — die Bot-Wegfindung kennt bei Zonen keinen
      // Ballradius-Puffer, und ohne Abstand hätte sie den Weg zu dicht am
      // Wasser entlanggeführt (der Ball blieb dort in einer Ecke hängen).
      { art: 'wasser', x: 9, y: 8, w: 4, h: 2.5 },
      { art: 'wasser', x: 9, y: 19.5, w: 4, h: 2.5 },
    ],
    dekor: 'wiese',
  },

  /* ------------------------------------------------------------------------
   * k14 — Der Eistrichter (Trichter mündet in eine Eiskammer)
   * --------------------------------------------------------------------- */
  {
    id: 'k14-eistrichter',
    name: 'Der Eistrichter',
    schwierigkeit: 2,
    breite: 18,
    hoehe: 28,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 80,
    abschlaege: [
      [6, 26.4],
      [8, 26.6],
      [10, 26.6],
      [12, 26.4],
    ],
    loch: [9, 3],
    waende: [
      // Der Trichter — breiter Mund unten, schmaler Hals oben.
      { ax: 1, ay: 27, bx: 7.5, by: 17, dicke: 0.8 },
      { ax: 17, ay: 27, bx: 10.5, by: 17, dicke: 0.8 },
      // Dahinter öffnet sich eine Kammer, breiter als der Hals — hier liegt
      // das Eis, und der Ball hat auf einmal viel mehr Platz als erwartet.
      { x: 3.5, y: 6, w: 0.8, h: 11 },
      { x: 13.7, y: 6, w: 0.8, h: 11 },
    ],
    zonen: [
      // Zwei Eisbahnen nebeneinander in der Kammer: kaum Reibung, der Ball
      // gleitet viel weiter, als das Auge auf freiem Rasen erwarten lässt.
      { art: 'eis', x: 4.5, y: 7, w: 4, h: 8 },
      { art: 'eis', x: 9, y: 7, w: 4, h: 8 },
    ],
    dekor: 'eis',
  },

  /* ------------------------------------------------------------------------
   * k15 — Der Lange Schlauch (Schlauch mit Schikane + Drehkreuz) — Querformat
   * --------------------------------------------------------------------- */
  {
    id: 'k15-langer-schlauch',
    name: 'Der Lange Schlauch',
    schwierigkeit: 2,
    breite: 32,
    hoehe: 20,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 80,
    abschlaege: [
      [1.3, 3],
      [1.3, 9],
      [1.3, 12],
      [1.3, 18],
    ],
    loch: [28, 10.5],
    waende: [
      // Der Schlauch selbst …
      { x: 2, y: 6, w: 28, h: 1 },
      { x: 2, y: 15, w: 28, h: 1 },
      // … und zwei Schikanen darin: eine von oben, eine von unten, damit der
      // Ball nicht einfach geradeaus durchrollt.
      { x: 9.5, y: 7, w: 1, h: 5 },
      { x: 19.5, y: 10, w: 1, h: 5 },
    ],
    zonen: [
      // Kurze Balken zwischen den Schikanen: Sie sperren die Fahrbahn nie
      // ganz, sondern zwingen nur zu einem kleinen Schlenker.
      { art: 'drehkreuz', x: 14, y: 11, laenge: 3, gradJeTakt: 3, phase: 0 },
      { art: 'drehkreuz', x: 25, y: 11, laenge: 3, gradJeTakt: -4, phase: 45 },
    ],
    dekor: 'nacht',
  },

  /* ------------------------------------------------------------------------
   * k16 — Die Bumperkammer (Kammer aus Wänden mit vier Bumpern)
   * --------------------------------------------------------------------- */
  {
    id: 'k16-bumperkammer',
    name: 'Die Bumperkammer',
    schwierigkeit: 2,
    breite: 15,
    hoehe: 20,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 65,
    abschlaege: [
      [3, 17],
      [5, 17.5],
      [10, 17.5],
      [12, 17],
    ],
    loch: [7.5, 2],
    waende: [
      // Die Kammer: offen zum Abschlag hin, oben fast geschlossen.
      { x: 3, y: 4, w: 0.8, h: 10 },
      { x: 11.2, y: 4, w: 0.8, h: 10 },
      { x: 3, y: 4, w: 3, h: 0.8 },
      { x: 9.2, y: 4, w: 3, h: 0.8 },
    ],
    zonen: [
      // Vier Pilze an den Seitenwänden — die Mittelgasse zum Ausgang bleibt
      // frei, wer an den Rand gerät, wird abgelenkt.
      { art: 'bumper', x: 4.8, y: 11, r: 0.9 },
      { art: 'bumper', x: 10.4, y: 11, r: 0.9 },
      { art: 'bumper', x: 4.8, y: 7, r: 0.8 },
      { art: 'bumper', x: 10.4, y: 7, r: 0.8 },
    ],
    dekor: 'wueste',
  },

  /* ------------------------------------------------------------------------
   * k17 — Die Portalzange (Zangenkrallen; der Umweg außen herum wird lang)
   * --------------------------------------------------------------------- */
  {
    id: 'k17-portalzange',
    name: 'Die Portalzange',
    schwierigkeit: 2,
    breite: 18,
    hoehe: 26,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 80,
    abschlaege: [
      [4, 22],
      [6, 22.5],
      [12, 22.5],
      [14, 22],
    ],
    loch: [9, 3],
    waende: [
      // Zwei Riegel, GEGENEINANDER versetzt: Wer den Portalen nicht traut,
      // muss den ganzen Umweg im Zickzack laufen — lang, aber sicher.
      { x: 0, y: 10, w: 11, h: 1 },
      { x: 7, y: 18, w: 11, h: 1 },
      // Zwei Krallen an den Riegelenden geben der Zange ihre Form.
      { x: 11, y: 6, w: 0.8, h: 4 },
      { x: 6.2, y: 14, w: 0.8, h: 4 },
    ],
    zonen: [
      // Die Abkürzung: aus der Ecke unten rechts direkt fast bis vors Loch.
      { art: 'portal', x: 16.5, y: 23.5, r: 0.9, ziel: { x: 3, y: 5 }, paar: 0 },
      { art: 'portal', x: 3, y: 5, r: 0.9, ziel: { x: 16.5, y: 23.5 }, paar: 0 },
    ],
    dekor: 'nacht',
  },

  /* ------------------------------------------------------------------------
   * k18 — Der Strudelgarten (S-Kurve mit zwei Beeten und Strudeln)
   * --------------------------------------------------------------------- */
  {
    id: 'k18-strudelgarten',
    name: 'Der Strudelgarten',
    schwierigkeit: 2,
    breite: 14,
    hoehe: 20,
    par: 3,
    schlagLimit: 8,
    zeitLimitS: 55,
    abschlaege: [
      [3, 17],
      [5, 17.5],
      [9, 17.5],
      [11, 17],
    ],
    loch: [6, 2],
    waende: [
      // Zwei versetzte Hecken bilden die Kurve …
      { x: 0, y: 14, w: 9, h: 0.8 },
      { x: 5, y: 8, w: 9, h: 0.8 },
      // … zwei Beete mitten im Garten geben ihr Struktur und verstecken je
      // einen Strudel in ihrer Nähe.
      { x: 10, y: 10, w: 2.5, h: 2.5 },
      { x: 1.5, y: 4, w: 2.5, h: 2.5 },
    ],
    zonen: [
      // Direkt neben dem rechten Beet: Wer die erste Lücke zu weit rechts
      // nimmt, wird hier festgehalten statt zur zweiten Lücke zu rollen.
      { art: 'strudel', x: 13, y: 13, r: 1, staerke: 15 },
      // Oben links, abseits vom Weg zum Loch: bestraft nur einen völlig
      // verzogenen Schlag nach der zweiten Lücke.
      { art: 'strudel', x: 2, y: 2.5, r: 1.1, staerke: 15 },
    ],
    dekor: 'wiese',
  },

  /* ------------------------------------------------------------------------
   * k19 — Der Sprungtrichter (Trichter + Kammer, Beschleuniger + Sprungfeld)
   * Stufe 3: der Schub trägt in die Kammer, die Kammerwände engen sie ein,
   * die Sprungfelder an ihren Flanken tragen optional darüber hinweg.
   * --------------------------------------------------------------------- */
  {
    id: 'k19-sprungtrichter',
    name: 'Der Sprungtrichter',
    schwierigkeit: 3,
    breite: 30,
    hoehe: 48,
    par: 4,
    schlagLimit: 9,
    zeitLimitS: 100,
    abschlaege: [
      [5, 46],
      [8, 46.5],
      [22, 46.5],
      [25, 46],
    ],
    loch: [15, 4],
    waende: [
      { ax: 3, ay: 44, bx: 11, by: 28, dicke: 0.8 },
      { ax: 27, ay: 44, bx: 19, by: 28, dicke: 0.8 },
      // Kammer über dem Trichterhals: schmaler als der Feldrand, breiter als
      // der Hals — die Sprungfelder sitzen genau an ihren Flanken.
      { x: 6, y: 16, w: 0.8, h: 12 },
      { x: 23.2, y: 16, w: 0.8, h: 12 },
    ],
    zonen: [
      // Der Schub direkt hinter dem Trichterhals trägt bis weit in die Kammer.
      { art: 'beschleuniger', x: 12, y: 22, w: 6, h: 4, rx: 0, ry: -1, staerke: 22 },
      // Zwei Sprungfelder an den Kammerflanken: eine Abkürzung mit Risiko
      // für alle, die es nicht mittig durch den Trichter schaffen.
      { art: 'sprungfeld', x: 4, y: 14, w: 5, h: 4, rx: 0, ry: -1, weite: 8 },
      { art: 'sprungfeld', x: 21, y: 14, w: 5, h: 4, rx: 0, ry: -1, weite: 8 },
    ],
    dekor: 'wueste',
  },

  /* ------------------------------------------------------------------------
   * k20 — Der Eisstrudel (echtes Dogleg, Eis + Strudel als Falle am Bogen)
   * Stufe 3: zwei versetzte Riegel erzwingen den Bogen, das Eis davor
   * verlängert jeden Fehler, die Strudel bestrafen einen zu weiten Bogen.
   * --------------------------------------------------------------------- */
  {
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
  },
];
