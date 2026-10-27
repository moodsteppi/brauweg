import type { Karte } from '../karte';

/* ------------------------------------------------------------------------
 * k13 — Die Wasserinsel (Insel mit Wassergraben und zwei Brücken)
 * --------------------------------------------------------------------- */
export const bahn: Karte = {
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
};
