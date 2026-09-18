import { describe, expect, it } from 'vitest';

import {
  anzeigeVerdeckt,
  kastenAus,
  punktImKasten,
  streckeImKasten,
  type Bildabbildung,
  type Kasten,
} from './verdeckung';
import { FAHNEN_HOEHE, type Zielbild } from './zeichnen';

/*
 * Die Frage, ob die Punkteanzeige gerade etwas verdeckt.
 *
 * Sie steht hier und nicht im Bildschirm, weil sie sonst niemand prüft: Am
 * Gerät sieht man nur das Ergebnis (blass oder nicht) und nie den Grund, und
 * ein Fehler zeigt sich als „manchmal blinkt es" — die Sorte Fehler, die man
 * lange sucht.
 */

/** Maßstab der Proben: 30 Bildpunkte je Welteinheit, Ursprung oben links. */
const PX_JE_EINHEIT = 30;

function abbildung(skala = PX_JE_EINHEIT): Bildabbildung {
  return { zuBildX: (x) => x * skala, zuBildY: (y) => y * skala };
}

/** Bildpunkte in Welteinheiten — die Proben denken in Pixeln, geprüft wird Welt. */
function welt(px: number): number {
  return px / PX_JE_EINHEIT;
}

/** Die Chipreihe, wie sie am Handy oben steht — ohne Rand gemessen. */
const CHIPS: Kasten = kastenAus(100, 40, 200, 60, 0);

/** Ein Loch weit außerhalb jedes Kastens — für Proben, in denen es nicht zählt. */
const FERNES_LOCH: readonly [number, number] = [900, 900];

function zielbild(teil: Partial<Zielbild> = {}): Zielbild {
  return { x: 0, y: 0, rx: 1, ry: 0, kraft: 0.5, bahn: [], ...teil };
}

describe('kastenAus', () => {
  it('weitet den gemessenen Kasten um den Rand auf', () => {
    expect(kastenAus(10, 20, 100, 40, 5)).toEqual({
      links: 5,
      oben: 15,
      rechts: 115,
      unten: 65,
    });
  });
});

describe('streckeImKasten', () => {
  it('findet eine Strecke, deren beide Enden draußen liegen', () => {
    // Genau der ärgerliche Fall: ein langer Zielpfeil quer durch die Chips,
    // dessen Anfang unter und dessen Spitze über der Anzeige liegt.
    expect(streckeImKasten(CHIPS, 200, 200, 200, -50)).toBe(true);
  });

  it('lässt eine Strecke daneben in Ruhe', () => {
    expect(streckeImKasten(CHIPS, 50, 200, 50, -50)).toBe(false);
  });

  it('erkennt eine Strecke, die ganz im Kasten liegt', () => {
    expect(streckeImKasten(CHIPS, 150, 60, 180, 80)).toBe(true);
  });

  it('behandelt eine Strecke der Länge null wie einen Punkt', () => {
    expect(streckeImKasten(CHIPS, 150, 60, 150, 60)).toBe(true);
    expect(streckeImKasten(CHIPS, 10, 10, 10, 10)).toBe(false);
  });

  it('zieht eine Strecke, die vor dem Kasten endet, nicht heran', () => {
    // Verlängert ginge sie mitten durch — sie hört bei 150 auf, also darunter.
    expect(streckeImKasten(CHIPS, 200, 200, 200, 150)).toBe(false);
  });

  it('nimmt eine Strecke schräg durch die Ecke mit', () => {
    expect(streckeImKasten(CHIPS, 60, 0, 140, 80)).toBe(true);
  });
});

describe('punktImKasten', () => {
  it('zählt die Kante mit', () => {
    expect(punktImKasten(CHIPS, 100, 40)).toBe(true);
    expect(punktImKasten(CHIPS, 99.9, 40)).toBe(false);
  });
});

describe('anzeigeVerdeckt', () => {
  it('sagt ohne gemessene Kästen nichts — vor der ersten Messung', () => {
    const frage = { ball: { x: welt(150), y: welt(60) }, loch: FERNES_LOCH, ziel: null };
    expect(anzeigeVerdeckt([], abbildung(), frage)).toBe(false);
  });

  it('meldet den eigenen Ball unter der Anzeige', () => {
    const frage = { ball: { x: welt(150), y: welt(60) }, loch: FERNES_LOCH, ziel: null };
    expect(anzeigeVerdeckt([CHIPS], abbildung(), frage)).toBe(true);
  });

  it('lässt den Ball daneben in Ruhe', () => {
    const frage = { ball: { x: welt(20), y: welt(60) }, loch: FERNES_LOCH, ziel: null };
    expect(anzeigeVerdeckt([CHIPS], abbildung(), frage)).toBe(false);
  });

  it('zählt einen fehlenden Ball nicht mit (eingelocht oder im Wasser)', () => {
    const frage = { ball: null, loch: FERNES_LOCH, ziel: null };
    expect(anzeigeVerdeckt([CHIPS], abbildung(), frage)).toBe(false);
  });

  it('meldet die Fahne, wenn nur ihre Stange in die Anzeige ragt', () => {
    /*
     * Das Loch steht knapp UNTER der Chipreihe, die Stange reicht hinein. So
     * sieht es aus, wenn die Bahn nach oben hinausläuft — und genau dann
     * verdeckt die Anzeige das Ziel, obwohl das Loch selbst frei liegt.
     */
    // Der Lochfuß steht bei 130 px, die Stange reicht 2,5 Einheiten (75 px)
    // hinauf und endet damit bei 55 px — mitten in der Chipreihe (40..100).
    expect(welt(130) - FAHNEN_HOEHE).toBeCloseTo(welt(55));
    const loch: readonly [number, number] = [welt(150), welt(130)];
    expect(anzeigeVerdeckt([CHIPS], abbildung(), { ball: null, loch, ziel: null })).toBe(true);
  });

  it('lässt eine Fahne weit unterhalb in Ruhe', () => {
    const loch: readonly [number, number] = [welt(150), welt(400)];
    expect(anzeigeVerdeckt([CHIPS], abbildung(), { ball: null, loch, ziel: null })).toBe(false);
  });

  it('meldet den Zielpfeil, der durch die Anzeige zeigt', () => {
    // Ball unter der Reihe, Pfeil mit voller Kraft senkrecht nach oben.
    const ball = { x: welt(200), y: welt(150) };
    const frage = {
      ball,
      loch: FERNES_LOCH,
      ziel: zielbild({ ...ball, rx: 0, ry: -1, kraft: 1 }),
    };
    expect(anzeigeVerdeckt([CHIPS], abbildung(), frage)).toBe(true);
  });

  it('lässt einen kurzen Pfeil in Ruhe, der die Anzeige nicht erreicht', () => {
    const ball = { x: welt(200), y: welt(300) };
    const frage = {
      ball,
      loch: FERNES_LOCH,
      ziel: zielbild({ ...ball, rx: 0, ry: -1, kraft: 0.2 }),
    };
    expect(anzeigeVerdeckt([CHIPS], abbildung(), frage)).toBe(false);
  });

  it('meldet die Flugkurve, auch wenn Ball und Pfeil frei stehen', () => {
    /*
     * Der Bandenschuss: Der Pfeil zeigt nach rechts, weg von der Anzeige;
     * die vorausgerechnete Bahn läuft aber hinter ihr durch. Wer nur Ball
     * und Pfeil prüft, sieht das nicht.
     */
    const ball = { x: welt(200), y: welt(300) };
    const frage = {
      ball,
      loch: FERNES_LOCH,
      ziel: zielbild({
        ...ball,
        rx: 1,
        ry: 0,
        kraft: 0.1,
        bahn: [welt(400), welt(300), welt(300), welt(150), welt(150), welt(60)],
      }),
    };
    expect(anzeigeVerdeckt([CHIPS], abbildung(), frage)).toBe(true);
  });

  it('prüft jeden Kasten einzeln statt ihrer Hülle', () => {
    /*
     * Kopfzeile und Chipreihe stehen mittig und sind verschieden breit.
     * Zwischen ihnen ist frei — eine umschließende Hülle erklärte am breiten
     * Schirm die halbe Bühne für belegt.
     */
    const kopf = kastenAus(50, 0, 300, 30, 0);
    const luecke = { ball: { x: welt(60), y: welt(35) }, loch: FERNES_LOCH, ziel: null };
    expect(anzeigeVerdeckt([kopf, CHIPS], abbildung(), luecke)).toBe(false);
    const treffer = { ball: { x: welt(60), y: welt(15) }, loch: FERNES_LOCH, ziel: null };
    expect(anzeigeVerdeckt([kopf, CHIPS], abbildung(), treffer)).toBe(true);
  });

  it('rechnet in Bildpunkten, nicht in Welteinheiten', () => {
    /*
     * Derselbe Ball an derselben Weltstelle, nur die Kamera zoomt. Beim
     * Ausholen zoomt sie heraus, und was eben noch unter den Chips lag,
     * liegt danach daneben — eine Rechnung in Welteinheiten sähe das nicht.
     */
    const frage = { ball: { x: welt(150), y: welt(60) }, loch: FERNES_LOCH, ziel: null };
    expect(anzeigeVerdeckt([CHIPS], abbildung(PX_JE_EINHEIT), frage)).toBe(true);
    expect(anzeigeVerdeckt([CHIPS], abbildung(PX_JE_EINHEIT / 5), frage)).toBe(false);
  });
});
