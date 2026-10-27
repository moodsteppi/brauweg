import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k11 — Die Sandkurve (echte S-Kurve aus zwei versetzten Riegeln + Haken)
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
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
};
