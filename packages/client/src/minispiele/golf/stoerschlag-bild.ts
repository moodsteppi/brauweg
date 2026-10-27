/**
 * Wie die Störschläge (stoerschlag.ts) aussehen — für den Zeichner.
 *
 * Eine eigene Datei, damit zeichnen.ts nur Einhängezeilen bekommt. Alles hier
 * ist Deko: Es liest den Zustand, ändert ihn nie, und darf deshalb auch
 * `Math.sin` benutzen (die Simulation nicht).
 */

import type { Partiezustand } from './physik';
import type { Powerupart } from './powerup';
import { BOMBE_R, type Stoerart } from './stoerschlag';

/** Leuchtfarbe der Störfelder — ergänzt `PU_FARBE` in zeichnen.ts. */
export const STOER_FARBE: Readonly<Record<Stoerart, string>> = {
  bombe: '#ff8a4c',
  klebefeld: '#d8a657',
  tausch: '#9be58f',
};

/** Die Zielmarke beim Auslösen: Umkreis der Wirkung an der Zielstelle. */
export interface Stoerziel {
  x: number;
  y: number;
  r: number;
  art: Stoerart;
}

/**
 * Das Zeichen eines Störschlags, in Einheitskoordinaten (±1), wie
 * `malPowerupZeichen` in zeichnen.ts es für die anderen Arten tut. Liefert
 * `false` für eine Art, die keine Störung ist — dann malt der Zeichner selbst.
 * Der Pfad ist schon begonnen (`beginPath`), Farbe und Linie gesetzt.
 */
export function malStoerZeichen(ctx: CanvasRenderingContext2D, art: Powerupart): boolean {
  if (art === 'bombe') {
    // Kugel mit Zündschnur
    ctx.arc(-0.1, 0.15, 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.3, -0.35);
    ctx.quadraticCurveTo(0.55, -0.9, 0.9, -0.75);
    ctx.stroke();
    return true;
  }
  if (art === 'klebefeld') {
    // Klecks mit drei Tropfen
    ctx.arc(0, -0.15, 0.55, Math.PI, 0);
    ctx.lineTo(0.55, 0.25);
    ctx.lineTo(0.35, 0.85);
    ctx.lineTo(0.15, 0.3);
    ctx.lineTo(-0.1, 0.7);
    ctx.lineTo(-0.3, 0.3);
    ctx.lineTo(-0.55, 0.6);
    ctx.lineTo(-0.55, -0.15);
    ctx.closePath();
    ctx.fill();
    return true;
  }
  if (art === 'tausch') {
    // Zwei Pfeile gegeneinander
    ctx.moveTo(-0.8, -0.35);
    ctx.lineTo(0.7, -0.35);
    ctx.moveTo(0.4, -0.65);
    ctx.lineTo(0.75, -0.35);
    ctx.lineTo(0.4, -0.05);
    ctx.moveTo(0.8, 0.4);
    ctx.lineTo(-0.7, 0.4);
    ctx.moveTo(-0.4, 0.1);
    ctx.lineTo(-0.75, 0.4);
    ctx.lineTo(-0.4, 0.7);
    ctx.stroke();
    return true;
  }
  return false;
}

/**
 * Klebefleck und wartende Bombe im laufenden Loch — unter den Bällen.
 * `ruhig` (prefers-reduced-motion): kein Pulsieren.
 */
export function zeichneStoerungen(
  ctx: CanvasRenderingContext2D,
  z: Partiezustand,
  uhrMs: number,
  ruhig: boolean,
): void {
  const klebe = z.aktuell.klebe;
  if (klebe != null && z.takt < klebe.bis) {
    // Zum Ende hin blasser: Man sieht, dass er gleich weg ist.
    const rest = (klebe.bis - z.takt) / 160;
    ctx.globalAlpha = 0.35 + 0.45 * (rest > 1 ? 1 : rest);
    ctx.fillStyle = '#8a6a3a';
    ctx.beginPath();
    ctx.arc(klebe.x, klebe.y, klebe.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = STOER_FARBE.klebefeld;
    ctx.lineWidth = 0.08;
    ctx.setLineDash([0.3, 0.2]);
    ctx.beginPath();
    ctx.arc(klebe.x, klebe.y, klebe.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const bombe = z.aktuell.bombe;
  if (bombe != null) {
    const puls = ruhig ? 0.5 : 0.5 + 0.5 * Math.sin(uhrMs / 40);
    ctx.strokeStyle = STOER_FARBE.bombe;
    ctx.lineWidth = 0.1;
    ctx.globalAlpha = 0.5 + 0.4 * puls;
    ctx.beginPath();
    ctx.arc(bombe.x, bombe.y, BOMBE_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(bombe.x, bombe.y, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Die Zielmarke beim Auslösen — am Ende des Zielpfeils. */
export function zeichneStoerZiel(ctx: CanvasRenderingContext2D, ziel: Stoerziel): void {
  ctx.strokeStyle = STOER_FARBE[ziel.art];
  ctx.lineWidth = 0.1;
  ctx.setLineDash([0.35, 0.25]);
  ctx.beginPath();
  ctx.arc(ziel.x, ziel.y, ziel.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ziel.x - 0.35, ziel.y);
  ctx.lineTo(ziel.x + 0.35, ziel.y);
  ctx.moveTo(ziel.x, ziel.y - 0.35);
  ctx.lineTo(ziel.x, ziel.y + 0.35);
  ctx.stroke();
}
