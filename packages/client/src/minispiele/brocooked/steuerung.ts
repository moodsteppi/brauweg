/**
 * Die Steuerung eines Kochs: aus Tasten und Daumen werden Eingaben.
 *
 * Ohne DOM — der Bildschirm reicht nur hinein, was gerade gedrückt ist, und
 * bekommt heraus, was gesendet werden muss. Der Grund ist derselbe wie bei
 * `netz.ts`: Flankenerkennung („war eben noch nicht gedrückt") sieht man am
 * Bildschirm nicht, und ein verschlucktes Loslassen lässt einen Koch für den
 * Rest der Runde schneiden.
 */

import { STEHT, gleich, type Richtung } from './eingabe';

export interface Knopfstand {
  readonly richtung: Richtung;
  readonly greifen: boolean;
  readonly werken: boolean;
  readonly spurt: boolean;
}

export const RUHE: Knopfstand = { richtung: STEHT, greifen: false, werken: false, spurt: false };

export type Sendung =
  | { art: 'richtung'; dx: number; dy: number }
  | { art: 'greifen' }
  | { art: 'werken'; an: boolean }
  | { art: 'spurt' };

/**
 * Was sich gegenüber dem letzten Stand geändert hat — und nur das.
 *
 * Jede Eingabe geht über die Leitung und in die Eingabeliste der Partie. Wer
 * 60-mal je Sekunde „Richtung rechts" schickt, füllt sie in einer Minute mit
 * 3600 Einträgen, die alle dasselbe sagen; das Rückspulen wird dann teuer und
 * der Server schleppt die Liste in jedem Schnappschuss mit.
 */
export function aenderungen(vorher: Knopfstand, jetzt: Knopfstand): Sendung[] {
  const raus: Sendung[] = [];
  if (!gleich(vorher.richtung, jetzt.richtung)) {
    raus.push({ art: 'richtung', dx: jetzt.richtung.dx, dy: jetzt.richtung.dy });
  }
  // Greifen ist ein Augenblick: nur die steigende Flanke zählt.
  if (jetzt.greifen && !vorher.greifen) raus.push({ art: 'greifen' });
  if (jetzt.werken !== vorher.werken) raus.push({ art: 'werken', an: jetzt.werken });
  if (jetzt.spurt && !vorher.spurt) raus.push({ art: 'spurt' });
  return raus;
}

/** Alles loslassen — beim Verlassen des Bildschirms oder wenn das Fenster den Fokus verliert. */
export function losgelassen(vorher: Knopfstand): Sendung[] {
  return aenderungen(vorher, RUHE);
}
