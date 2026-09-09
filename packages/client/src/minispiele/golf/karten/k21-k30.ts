/**
 * Bahnen k21–k30: Stufe 3 (zwei Elemente, die zusammenspielen) und Stufe 4
 * (k29/k30, enge Durchgänge).
 *
 * Jede Bahn kombiniert bewusst zwei Zonenarten, die sich gegenseitig
 * bedingen — Eis, das den Ball schnell in einen Bumper-Garten trägt; ein
 * Beschleuniger, der über einen wasserumspülten Damm schiebt; ein Portal,
 * das eine sonst abgeriegelte Sandkammer erschließt; und so weiter. Wo Wasser
 * oder eine Mauer den direkten Weg sperrt, gibt es immer einen (längeren,
 * sicheren) Weg drumherum — die Wegfindung (`bot.ts`/`karten-pruefen.ts`)
 * kennt nur Wände und Wasser als Hindernis, Sprungfelder und Beschleuniger
 * sind für sie unsichtbare Abkürzungen, die menschliche Spieler nutzen
 * können, der Bot aber nicht braucht.
 */

import type { Karte } from '../karte';

export const KARTEN_K21_K30: readonly Karte[] = [
  /*
   * k21 — Eisrutsche zum Bumpergarten. Nach einem offenen Anspiel trägt eine
   * lange Eisfläche den Ball fast reibungsfrei nach oben, direkt in eine
   * Passage zwischen zwei dicken Flipperpilzen hindurch. Die Gasse zwischen
   * den Pilzen ist großzügig (5,4 E) — wer die Mitte hält, kommt sicher
   * durch; wer zu viel Schwung aus dem Eis mitnimmt, riskiert einen Kontakt.
   */
  {
    id: 'k21-eisrutsche-zum-bumpergarten',
    name: 'Eisrutsche zum Bumpergarten',
    schwierigkeit: 3,
    breite: 18,
    hoehe: 28,
    par: 2,
    schlagLimit: 7,
    zeitLimitS: 80,
    abschlaege: [
      [9, 25],
      [5, 25],
      [13, 25],
      [7, 23],
      [11, 23],
    ],
    loch: [9, 4],
    waende: [
      // Trichter: verengt den offenen Abschlag auf die Breite der Eisbahn —
      // die Ränder daneben bleiben als längerer, hindernisfreier Umweg offen.
      { ax: 2, ay: 21, bx: 6, by: 14, dicke: 0.8 },
      { ax: 16, ay: 21, bx: 12, by: 14, dicke: 0.8 },
      // Zwei Pfeiler flankieren den Bumpergarten und rahmen ihn als eigene
      // Kammer, ohne die 10 E breite Gasse zwischen den Pilzen zu verengen.
      { x: 2.5, y: 5.5, w: 1.5, h: 3 },
      { x: 14, y: 5.5, w: 1.5, h: 3 },
    ],
    zonen: [
      { art: 'eis', x: 6, y: 9, w: 6, h: 5 },
      { art: 'bumper', x: 6, y: 7, r: 1.0 },
      { art: 'bumper', x: 12, y: 7, r: 1.0 },
      // Falle im Trichtermund: nur ein zu mittiger erster Schlag rollt hinein.
      { art: 'sand', x: 8, y: 19, w: 2, h: 1.5 },
    ],
    dekor: 'eis',
  },

  /*
   * k22 — Turbo überm Teich. Ein schmaler Landdamm führt zwischen zwei
   * Teichhälften hindurch; ein kräftiger Beschleuniger direkt im Damm trägt
   * den Ball den ganzen Weg nach oben, ohne dass er ins Wasser muss. Wer den
   * Damm verlässt, fällt ins Wasser — der Damm selbst ist immer breit genug
   * (7 E), um ihn sicher zu treffen.
   */
  {
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
  },

  /*
   * k23 — Portal in die Sandkammer. Die Sandkammer mit dem Loch ist
   * ringsum mit einer Mauer versiegelt — der einzige Zugang ist das Portal
   * am Fuß der Kammer. Wer hindurchspringt, landet mitten im Sand vor dem
   * Loch und muss den letzten Schlag durch die Reibung hindurch dosieren.
   */
  {
    id: 'k23-portal-in-die-sandkammer',
    name: 'Portal in die Sandkammer',
    schwierigkeit: 3,
    breite: 18,
    hoehe: 26,
    par: 3,
    schlagLimit: 8,
    zeitLimitS: 80,
    abschlaege: [
      [9, 24],
      [6, 24],
      [12, 24],
      [7.5, 22],
      [10.5, 22],
    ],
    loch: [9, 4.8],
    waende: [
      { x: 3, y: 2.5, w: 12, h: 0.6 },
      { x: 3, y: 12.9, w: 12, h: 0.6 },
      { x: 3, y: 3.1, w: 0.6, h: 9.8 },
      { x: 14.4, y: 3.1, w: 0.6, h: 9.8 },
      // Trichter vor dem Portal: verengt den offenen Abschlag auf die
      // Portalbreite, die Ränder daneben bleiben als Umweg begehbar.
      { ax: 1.5, ay: 24, bx: 5.5, by: 20.5, dicke: 0.8 },
      { ax: 16.5, ay: 24, bx: 12.5, by: 20.5, dicke: 0.8 },
    ],
    zonen: [
      { art: 'sand', x: 4, y: 8, w: 10, h: 4.5 },
      { art: 'portal', x: 9, y: 20, r: 0.6, ziel: { x: 9, y: 10 }, paar: 0 },
      { art: 'portal', x: 9, y: 10, r: 0.6, ziel: { x: 9, y: 20 }, paar: 0 },
    ],
    dekor: 'wueste',
  },

  /*
   * k24 — Drehkreuz vorm Loch. Der direkte Weg führt durch eine Sandmulde;
   * seitlich davon dreht sich, gut abgesetzt von der Ziellinie, ein kleines
   * Drehkreuz — Blickfang und Bahnmarke der Kammer, ohne dem geraden Anspiel
   * im Weg zu stehen.
   */
  {
    id: 'k24-drehkreuz-vorm-loch',
    name: 'Drehkreuz vorm Loch',
    schwierigkeit: 3,
    breite: 14,
    hoehe: 20,
    par: 4,
    schlagLimit: 8,
    zeitLimitS: 55,
    abschlaege: [
      [7, 17],
      [5, 17],
      [9, 17],
      [6, 15],
      [8, 15],
    ],
    loch: [7, 4],
    waende: [
      // Zwei gegeneinander versetzte Riegel erzwingen ein Zick-Zack vom
      // Abschlag zur Kammer vorm Loch.
      { x: 0, y: 12, w: 9, h: 0.8 },
      { x: 5, y: 9, w: 9, h: 0.8 },
      // Zwei Pfeiler rahmen die Kammer, weit genug vom Drehkreuz-Radius weg.
      { x: 1.3, y: 5, w: 0.7, h: 3 },
      { x: 12, y: 5, w: 0.7, h: 3 },
    ],
    zonen: [
      { art: 'sand', x: 4, y: 6, w: 6, h: 3 },
      { art: 'drehkreuz', x: 10, y: 5, laenge: 2.4, gradJeTakt: 4, phase: 0 },
      // Im Zick-Zack-Hals: eine Eisplatte macht die zweite Kehre rutschig.
      { art: 'eis', x: 1, y: 9.2, w: 4, h: 2.5 },
    ],
    dekor: 'wueste',
  },

  /*
   * k25 — Strudelfalle an der Abkürzung. Die schnelle, glatte Linie zum
   * Loch führt über eine Eisfläche — verlockend direkt, aber ein Strudel
   * lauert gleich daneben und zieht jeden, der die Ideallinie verfehlt, aus
   * der Bahn.
   */
  {
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
  },

  /*
   * k26 — Sprung über die Wasserzunge. Eine Zunge aus Wasser reckt sich von
   * links in die Bahn; der sichere Weg führt rechts daran vorbei zum Loch.
   * Wer es eilig hat, nimmt unten links das Sprungfeld und hüpft über die
   * Zunge hinweg direkt in Richtung Loch.
   */
  {
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
  },

  /*
   * k27 — Doppelpilz im Eis. Zwei große Flipperpilze flankieren die
   * spiegelglatte Auffahrt zum Loch — die Gasse zwischen ihnen ist breit
   * genug für einen sauberen Durchlauf, aber das Eis lässt jeden zu harten
   * Schlag gefährlich nah an sie heranrutschen.
   */
  {
    id: 'k27-doppelpilz-im-eis',
    name: 'Doppelpilz im Eis',
    schwierigkeit: 3,
    breite: 18,
    hoehe: 28,
    par: 2,
    schlagLimit: 7,
    zeitLimitS: 80,
    abschlaege: [
      [9, 25],
      [6, 25],
      [12, 25],
      [7, 23],
      [11, 23],
    ],
    loch: [9, 4],
    waende: [
      // Trichter aus dem offenen Abschlag auf die Eisbahn hinauf.
      { ax: 2, ay: 22, bx: 7, by: 16, dicke: 0.8 },
      { ax: 16, ay: 22, bx: 11, by: 16, dicke: 0.8 },
      // Zwei Pfeiler rahmen die Lochkammer, klar abgesetzt von beiden Pilzen.
      { x: 3, y: 4.5, w: 1.4, h: 2.5 },
      { x: 13, y: 4.5, w: 1.4, h: 2.5 },
    ],
    zonen: [
      { art: 'eis', x: 2, y: 6, w: 14, h: 12 },
      { art: 'bumper', x: 5, y: 9, r: 1.3 },
      { art: 'bumper', x: 13, y: 9, r: 1.3 },
      // Falle im Trichtermund.
      { art: 'sand', x: 8, y: 20, w: 2.5, h: 1.8 },
    ],
    dekor: 'eis',
  },

  /*
   * k28 — Kreiselkammer. Ein enger Vorraum vorm Loch beherbergt zwei
   * Wächter: links ein Strudel, rechts ein rotierendes Drehkreuz, beide weit
   * genug von der Ziellinie entfernt, um sie nur zu säumen, nicht zu
   * versperren.
   */
  {
    id: 'k28-kreiselkammer',
    name: 'Kreiselkammer',
    schwierigkeit: 3,
    breite: 14,
    hoehe: 22,
    par: 2,
    schlagLimit: 7,
    zeitLimitS: 55,
    abschlaege: [
      [7, 19],
      [5, 19],
      [9, 19],
      [6, 17],
      [8, 17],
    ],
    loch: [7, 4],
    waende: [
      // Nadelöhr zwischen Abschlag und Kreiselkammer.
      { x: 0, y: 12, w: 5, h: 0.8 },
      { x: 9, y: 12, w: 5, h: 0.8 },
      // Zwei Wände rahmen die Kammer, weit genug von Strudel und Drehkreuz.
      { x: 0.6, y: 6, w: 0.7, h: 3.5 },
      { x: 12.3, y: 5, w: 0.7, h: 3.3 },
    ],
    zonen: [
      { art: 'strudel', x: 3, y: 8, r: 1.4, staerke: 12 },
      { art: 'drehkreuz', x: 11, y: 10, laenge: 2, gradJeTakt: 5, phase: 0 },
      // Sandbett in der Kammermitte, zwischen beiden Wächtern hindurch.
      { art: 'sand', x: 5, y: 6.5, w: 3, h: 2.5 },
    ],
    dekor: 'nacht',
  },

  /*
   * k29 — Schmales Sprungtor (Stufe 4). Eine 1,6 E schmale Schleuse ist der
   * EINZIGE Weg nach oben; mittendrin sitzt ein kräftiger Beschleuniger, den
   * jeder Ball zwangsläufig durchquert. Unten im offenen Abschlagfeld lockt
   * zusätzlich ein Sprungfeld als Spielerei zur Seite.
   */
  {
    id: 'k29-schmales-sprungtor',
    name: 'Schmales Sprungtor',
    schwierigkeit: 4,
    breite: 30,
    hoehe: 48,
    par: 3,
    schlagLimit: 9,
    zeitLimitS: 110,
    abschlaege: [
      [15, 44],
      [13, 44],
      [17, 44],
      [14, 42],
      [16, 42],
    ],
    loch: [15, 5],
    waende: [
      { x: 0, y: 14, w: 14.2, h: 16 },
      { x: 15.8, y: 14, w: 14.2, h: 16 },
      // Rückwand weit hinterm Loch, schliesst die Kammer nach oben ab.
      { x: 8, y: 1.5, w: 14, h: 0.7 },
      // Kleiner Ausleger am Schlauchausgang, ausserhalb der Fluchtlinie.
      { x: 10, y: 11, w: 4, h: 0.7 },
    ],
    zonen: [
      { art: 'beschleuniger', x: 14.2, y: 24, w: 1.6, h: 6, rx: 0, ry: -1, staerke: 35 },
      { art: 'sprungfeld', x: 20, y: 40, w: 3, h: 3, rx: -0.7071, ry: -0.7071, weite: 8 },
      // Feinschliff in der Lochkammer, nach dem Schlauch.
      { art: 'sand', x: 12, y: 6.5, w: 6, h: 3 },
      // Deko-Prallkörper im offenen Abschlagfeld, weit vom Schlauch entfernt.
      { art: 'bumper', x: 24, y: 38, r: 1.0 },
    ],
    dekor: 'wiese',
  },

  /*
   * k30 — Nadelöhr der Portale (Stufe 4). Eine Mauer über die volle Breite
   * versperrt die Mitte der Bahn vollständig — der einzige Weg hindurch ist
   * das Portalpaar. Davor und dahinter je eine 1,6 E schmale Schleuse: enge
   * Durchgänge auf beiden Seiten des Sprungs.
   */
  {
    id: 'k30-nadeloehr-der-portale',
    name: 'Nadelöhr der Portale',
    schwierigkeit: 4,
    breite: 32,
    hoehe: 48,
    par: 3,
    schlagLimit: 9,
    zeitLimitS: 115,
    abschlaege: [
      [16, 44],
      [14, 44],
      [18, 44],
      [15, 42],
      [17, 42],
    ],
    loch: [16, 4],
    waende: [
      { x: 0, y: 26, w: 15.2, h: 14 },
      { x: 16.8, y: 26, w: 15.2, h: 14 },
      { x: 0, y: 20, w: 32, h: 2 },
      { x: 0, y: 8, w: 15.2, h: 6 },
      { x: 16.8, y: 8, w: 15.2, h: 6 },
    ],
    zonen: [
      { art: 'portal', x: 16, y: 24, r: 0.6, ziel: { x: 16, y: 15 }, paar: 0 },
      { art: 'portal', x: 16, y: 15, r: 0.6, ziel: { x: 16, y: 24 }, paar: 0 },
      // Zwei Deko-Elemente im offenen Mittelfeld zwischen den Schleusen,
      // weit ab von beiden engen Durchgaengen und der Ziellinie.
      { art: 'sand', x: 22, y: 16, w: 4, h: 3 },
      { art: 'bumper', x: 6, y: 17, r: 1.0 },
    ],
    dekor: 'nacht',
  },
];
