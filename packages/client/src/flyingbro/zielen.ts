/**
 * Flying Bro: Zielen als reine Rechnung — vom Fingerweg zur Abschuss-
 * geschwindigkeit und zur Flugbahnvorschau. Ohne Physik und ohne DOM, damit
 * es sich prüfen lässt (zielen.test.ts).
 *
 * Die Zahlen (Zugweg, Höchsttempo, Vorschaudauer, Dämpfung) kommen aus dem
 * Kern; hier steht nur, wie aus Bildschirmpixeln Meter werden.
 */

import { type Bro, SPIELABLAUF, abschussTempo } from '@brauweg/flyingbro-kern';

export interface Vek {
  x: number;
  y: number;
}

/** Schwerkraft der Welt in m/s² (y nach oben). Dieselbe Zahl geht an rapier. */
export const SCHWERKRAFT = -10;

/** Feste Schrittweite der Physik — die Vorschau rechnet mit denselben Schritten. */
export const SCHRITT_S = 1 / 60;

/**
 * Wie viele Bildschirmpixel Fingerweg der volle Zugweg (2,4 m) ist.
 *
 * Bewusst NICHT der Weltmaßstab: Bei 28 px je Meter (ganzes Level auf einem
 * Handy quer) wären 2,4 m nur 67 px — ein voller Schuss läge dann in einem
 * Daumenzucken, und die Genauigkeit fehlte. Ein Drittel der kurzen Seite
 * (130 px bei 390 px Höhe), gedeckelt, damit es auf dem großen Bildschirm
 * kein Armausstrecken wird.
 */
export function vollerZugPx(breite: number, hoehe: number): number {
  return Math.min(220, Math.max(100, Math.min(breite, hoehe) / 3));
}

export interface Zug {
  /** Zugweg in Weltmetern, gedeckelt auf `zugwegMax`. */
  zugweg: number;
  /** Einheitsvektor in Schussrichtung (Welt, y nach oben) — entgegen dem Zug. */
  richtung: Vek;
  /** Wohin der Bro im Band rutscht, relativ zum Abschusspunkt (Welt). */
  versatz: Vek;
}

/**
 * Aus dem Fingerweg (Bildschirm, y nach UNTEN) einen Zug machen. Gezogen wird
 * irgendwo auf der linken Hälfte, nicht nur am Bro (Spezifikation, Zielen):
 * Es zählt die Verschiebung seit dem Aufsetzen, nicht der Ort.
 */
export function zugAus(dxPx: number, dyPx: number, vollPx: number): Zug | null {
  const laenge = Math.hypot(dxPx, dyPx);
  if (!(laenge > 0) || !(vollPx > 0)) return null;
  const anteil = Math.min(laenge / vollPx, 1);
  const zugweg = anteil * SPIELABLAUF.zugwegMax;
  // Bildschirm y nach unten, Welt y nach oben: dy dreht das Vorzeichen.
  const zx = dxPx / laenge;
  const zy = -dyPx / laenge;
  return {
    zugweg,
    richtung: { x: -zx, y: -zy },
    // Der Bro folgt dem Finger, sichtbar aber nur bis zur halben Zuglänge —
    // sonst hängt er bei vollem Zug weit hinter der Schleuder in der Luft.
    versatz: { x: zx * zugweg * 0.5, y: zy * zugweg * 0.5 },
  };
}

/** Abschussgeschwindigkeit (Welt, m/s); `null`: zu kurz gezogen, kein Schuss. */
export function abschuss(bro: Bro, zug: Zug | null): Vek | null {
  if (!zug) return null;
  const tempo = abschussTempo(bro, zug.zugweg);
  if (tempo === null) return null;
  return { x: zug.richtung.x * tempo, y: zug.richtung.y * tempo };
}

/**
 * Die Flugbahn der ersten `dauerS` Sekunden als Punkte, mit denselben
 * Schritten wie die Physik: erst Schwerkraft, dann Dämpfung, dann Lage —
 * so integriert rapier. Eine geschlossene Wurfparabel läge sichtbar neben
 * der echten Bahn, weil der Bro gedämpft fliegt (Spezifikation, Ruhe).
 */
export function vorschau(start: Vek, v: Vek, dauerS: number, jedeN = 4): Vek[] {
  const punkte: Vek[] = [];
  let x = start.x;
  let y = start.y;
  let vx = v.x;
  let vy = v.y;
  const daempfung = 1 / (1 + SCHRITT_S * SPIELABLAUF.broLinearDaempfung);
  const schritte = Math.round(dauerS / SCHRITT_S);
  for (let i = 1; i <= schritte; i++) {
    vy += SCHWERKRAFT * SCHRITT_S;
    vx *= daempfung;
    vy *= daempfung;
    x += vx * SCHRITT_S;
    y += vy * SCHRITT_S;
    if (y < 0) break;
    if (i % jedeN === 0) punkte.push({ x, y });
  }
  return punkte;
}
