import type { Karte } from '../karte';

/*
 * k21 — Eisrutsche zum Bumpergarten. Nach einem offenen Anspiel trägt eine
 * lange Eisfläche den Ball fast reibungsfrei nach oben, direkt in eine
 * Passage zwischen zwei dicken Flipperpilzen hindurch. Die Gasse zwischen
 * den Pilzen ist großzügig (5,4 E) — wer die Mitte hält, kommt sicher
 * durch; wer zu viel Schwung aus dem Eis mitnimmt, riskiert einen Kontakt.
 */
export const bahn: Karte = {
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
};
