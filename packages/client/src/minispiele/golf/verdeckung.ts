/**
 * Liegt die Punkteanzeige über etwas, das man gerade sehen muss?
 *
 * Der HUD klebt oben am Bildrand, die Bahn darunter bewegt sich mit der
 * Kamera. Auf einer hohen Bahn, kurz nach dem Abschlag oder wenn das Loch
 * ganz oben liegt, steht der eigene Ball samt Zielpfeil, Flugkurve und Fahne
 * genau hinter den Chips — und dann zielt man blind. Diese Datei beantwortet
 * die eine Frage, die dafür zu klären ist; blass wird die Anzeige im
 * Stylesheet.
 *
 * **Gerechnet wird in BILDPUNKTEN**, nicht in Welteinheiten: Die Anzeige
 * zoomt nicht mit, die Bahn schon. Ein Abstand, der in der Welt gilt, ist
 * beim Ausholen (die Kamera zoomt raus) etwas ganz anderes als beim Putten.
 *
 * **Keine Allokationen.** Die Funktion läuft je Bild, also bis zu 60-mal je
 * Sekunde, über bis zu zwanzig Kurvenstücke. Deshalb nimmt sie die Abbildung
 * achsenweise (`zuBildX`/`zuBildY`) statt als Punktobjekt, und die Kästen
 * kommen fertig gemessen herein.
 */

import { MAX_ZUG } from './physik';
import { FAHNEN_BREITE, FAHNEN_HOEHE, type Zielbild } from './zeichnen';

/** Ein Kasten im Bild, in CSS-Pixeln relativ zur Leinwand. */
export interface Kasten {
  links: number;
  oben: number;
  rechts: number;
  unten: number;
}

/**
 * Welt → Bild, je Achse einzeln.
 *
 * Der `Zeichner` erfüllt das; ein Test braucht dafür keine Leinwand, nur
 * zwei Funktionen. Die Abbildung selbst steht NUR im Zeichner — hier wird
 * sie benutzt, nicht nachgebaut.
 */
export interface Bildabbildung {
  zuBildX(x: number): number;
  zuBildY(y: number): number;
}

/** Was frei bleiben soll. */
export interface Verdeckungsfrage {
  /** Der eigene Ball in Weltkoordinaten; `null`, wenn er nicht auf der Bahn liegt. */
  ball: { x: number; y: number } | null;
  /** Das Loch — mit der Fahne das Ziel, auch wenn gerade niemand zielt. */
  loch: readonly [number, number];
  /** Zielpfeil samt Flugkurve; `null`, wenn gerade nicht gezielt wird. */
  ziel: Zielbild | null;
}

/**
 * Die Prozentzahl am Pfeilende steht im BILDraum und ist rund 50 px breit
 * (`zeichneKraftzahl` malt sie zentriert in 15 px Systemschrift). Sie
 * mitzuzählen ist kein Übereifer: Sie sitzt am äußersten Ende des Pfeils und
 * ist damit das, was am ehesten unter die Chips gerät.
 */
const BESCHRIFTUNG_HALB_PX = 26;

/** Abstand der Prozentzahl vom Pfeilende, in Welteinheiten — wie im Zeichner. */
const BESCHRIFTUNG_ABSTAND = 0.75;

/**
 * Einen gemessenen Kasten aufbauen und um `rand` aufweiten.
 *
 * Der Rand ist der Grund, warum nichts „gerade so" hinter der Kante klebt:
 * Ein Ball, der die Chips um zwei Pixel verfehlt, ist trotzdem nicht zu
 * lesen — der Schlagschatten der Kacheln reicht weiter als ihr Kasten.
 */
export function kastenAus(
  links: number,
  oben: number,
  breite: number,
  hoehe: number,
  rand: number,
): Kasten {
  return {
    links: links - rand,
    oben: oben - rand,
    rechts: links + breite + rand,
    unten: oben + hoehe + rand,
  };
}

/** Liegt der Punkt im Kasten? */
export function punktImKasten(k: Kasten, px: number, py: number): boolean {
  return px >= k.links && px <= k.rechts && py >= k.oben && py <= k.unten;
}

/**
 * Schneidet die Strecke den Kasten (oder liegt sie ganz darin)?
 *
 * Schlitzverfahren statt „liegt ein Endpunkt drin": Der Zielpfeil ist oft
 * lang, und beide Enden können außerhalb liegen, während seine Mitte quer
 * durch die Chips läuft. Genau der Fall ist der ärgerliche.
 */
export function streckeImKasten(
  k: Kasten,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  if (dx === 0) {
    if (x1 < k.links || x1 > k.rechts) return false;
  } else {
    let a = (k.links - x1) / dx;
    let b = (k.rechts - x1) / dx;
    if (a > b) {
      const h = a;
      a = b;
      b = h;
    }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return false;
  }
  if (dy === 0) {
    if (y1 < k.oben || y1 > k.unten) return false;
  } else {
    let a = (k.oben - y1) / dy;
    let b = (k.unten - y1) / dy;
    if (a > b) {
      const h = a;
      a = b;
      b = h;
    }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * Verdeckt einer der Kästen etwas Wichtiges?
 *
 * Mehrere Kästen statt eines umschließenden: Kopfzeile und Chipreihe sind
 * verschieden breit und stehen beide mittig. Ihre Hülle wäre am breiten
 * Schirm ein Balken über die halbe Bühne, und die Anzeige träte zurück,
 * obwohl neben ihr alles frei ist.
 */
export function anzeigeVerdeckt(
  kaesten: readonly Kasten[],
  ab: Bildabbildung,
  frage: Verdeckungsfrage,
): boolean {
  if (kaesten.length === 0) return false;

  // Die Fahne: Stange vom Loch nach oben, Tuch daran. Sie zählt immer, denn
  // sie ist das Ziel — auch dann, wenn der Ball noch am Abschlag liegt.
  const fussX = ab.zuBildX(frage.loch[0]);
  const fussY = ab.zuBildY(frage.loch[1]);
  const spitzeY = ab.zuBildY(frage.loch[1] - FAHNEN_HOEHE);
  const tuchX = ab.zuBildX(frage.loch[0] + FAHNEN_BREITE);
  const ballX = frage.ball === null ? 0 : ab.zuBildX(frage.ball.x);
  const ballY = frage.ball === null ? 0 : ab.zuBildY(frage.ball.y);
  for (let i = 0; i < kaesten.length; i += 1) {
    const k = kaesten[i];
    if (streckeImKasten(k, fussX, fussY, fussX, spitzeY)) return true;
    if (streckeImKasten(k, fussX, spitzeY, tuchX, spitzeY)) return true;
    if (frage.ball !== null && punktImKasten(k, ballX, ballY)) return true;
  }

  const ziel = frage.ziel;
  if (ziel === null) return false;

  // Der Pfeil: vom Ball bis zur Spitze, danach die Prozentzahl als
  // waagerechtes Stück in ihrer eigenen Breite.
  const laenge = ziel.kraft * MAX_ZUG;
  const vonX = ab.zuBildX(ziel.x);
  const vonY = ab.zuBildY(ziel.y);
  const bisX = ab.zuBildX(ziel.x + ziel.rx * laenge);
  const bisY = ab.zuBildY(ziel.y + ziel.ry * laenge);
  const zahlX = ab.zuBildX(ziel.x + ziel.rx * (laenge + BESCHRIFTUNG_ABSTAND));
  const zahlY = ab.zuBildY(ziel.y + ziel.ry * (laenge + BESCHRIFTUNG_ABSTAND));
  for (let i = 0; i < kaesten.length; i += 1) {
    const k = kaesten[i];
    if (streckeImKasten(k, vonX, vonY, bisX, bisY)) return true;
    if (
      streckeImKasten(
        k,
        zahlX - BESCHRIFTUNG_HALB_PX,
        zahlY,
        zahlX + BESCHRIFTUNG_HALB_PX,
        zahlY,
      )
    ) {
      return true;
    }
  }

  // Die Flugkurve, Stück für Stück.
  const bahn = ziel.bahn;
  for (let i = 2; i < bahn.length; i += 2) {
    const ax = ab.zuBildX(bahn[i - 2]);
    const ay = ab.zuBildY(bahn[i - 1]);
    const bx = ab.zuBildX(bahn[i]);
    const by = ab.zuBildY(bahn[i + 1]);
    for (let j = 0; j < kaesten.length; j += 1) {
      if (streckeImKasten(kaesten[j], ax, ay, bx, by)) return true;
    }
  }
  return false;
}
