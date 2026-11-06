/**
 * Flying Bro: von Weltmetern zu Bildschirmpixeln.
 *
 * Der Boden der Welt liegt immer auf der Graslinie des Hintergrundbilds.
 * Das Bild steht still (es ist eine Kulisse, kein Gelände), deshalb kann die
 * Kamera nur zoomen und seitlich schieben — nie den Boden verlassen; sonst
 * stünden die Giraffen in der Luft über dem gemalten Gras.
 *
 * Bildausschnitt nach der Spezifikation (Bildschirm und Format): das ganze
 * Level (bei 844 × 390 rund 28 px je Meter); im Flug zoomt sie so weit
 * heraus, dass Bro und Bauwerk im Bild sind.
 */

import type { Vek } from './zielen';

/** Seitenverhältnis des Hintergrunds (1536 × 1024) und wo darin das Gras anfängt. */
const HINTERGRUND_SEITEN = 1024 / 1536;
const GRASLINIE = 0.83;

export interface Kamera {
  /** Pixel je Meter. */
  s: number;
  /** Bildschirm-x der Welt-x 0. */
  ox: number;
  /** Bildschirm-y des Bodens. */
  bodenY: number;
  boden: number;
}

/** Wie das Hintergrundbild liegt: Breite füllen, unten bündig — darüber Himmelsfarbe. */
export function hintergrundLage(breite: number, hoehe: number): { x: number; y: number; b: number; h: number } {
  const b = Math.max(breite, hoehe / HINTERGRUND_SEITEN);
  const h = b * HINTERGRUND_SEITEN;
  return { x: (breite - b) / 2, y: hoehe - h, b, h };
}

export function bodenLinie(breite: number, hoehe: number): number {
  const l = hintergrundLage(breite, hoehe);
  return l.y + l.h * GRASLINIE;
}

export interface Rahmen {
  /** Weltbereich, der ganz zu sehen sein soll. */
  links: number;
  rechts: number;
  oben: number;
}

/** Die Kamera, die `rahmen` vollständig zeigt (mit etwas Luft). */
export function kameraFuer(breite: number, hoehe: number, boden: number, rahmen: Rahmen): Kamera {
  const bodenY = bodenLinie(breite, hoehe);
  const weite = Math.max(1, rahmen.rechts - rahmen.links);
  const hoch = Math.max(1, rahmen.oben - boden);
  // Oben bleibt ein Rand frei für die Anzeige (Punkte, Pause).
  const s = Math.min(breite / weite, (bodenY - 44) / hoch);
  const mitte = (rahmen.links + rahmen.rechts) / 2;
  return { s, ox: breite / 2 - mitte * s, bodenY, boden };
}

/** Weich zur Zielkamera — ein harter Sprung im Zoom wirkt wie ein Ruckler. */
export function naeher(a: Kamera, b: Kamera, dt: number, tempo = 4): Kamera {
  const k = 1 - Math.exp(-tempo * dt);
  return { s: a.s + (b.s - a.s) * k, ox: a.ox + (b.ox - a.ox) * k, bodenY: b.bodenY, boden: b.boden };
}

export function aufBild(k: Kamera, p: Vek): Vek {
  return { x: k.ox + p.x * k.s, y: k.bodenY - (p.y - k.boden) * k.s };
}
