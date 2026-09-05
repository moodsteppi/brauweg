/**
 * Die Sicht des Mememory-Moduls, wie der Client sie liest.
 *
 * Sie stand bis zum 06.09.2026 in screens/Mememory.tsx. Hier steht sie, weil
 * der Vertrag unter src/vertrag/ sie gegen die echte Modulsicht haelt
 * (packages/game-mememory/src/sicht.ts) — und ein Import aus dem Bildschirm
 * zoege React samt aller Bauteile in einen Test, der nur Typen vergleichen
 * will.
 *
 * Zweitbeschreibung mit Absicht; warum, steht in src/vertrag/README.md.
 */

// Nur der Typ, kein Wert: Stufenregler.tsx ist ein Bauteil, und ein echter
// Import zoege React in den Vertrag.
import type { Stufe } from './Stufenregler';

/** Sicht des Moduls, siehe packages/game-mememory/src/sicht.ts. */
export interface MememorySicht {
  spalten: number;
  zeilen: number;
  /** Die Motive dieser Partie, sortiert — Grundlage des Vorladens. */
  motive: string[];
  /** Motivkennung je Platz, oder null solange die Karte verdeckt liegt. */
  feld: (string | null)[];
  besitzer: (number | null)[];
  offen: number[];
  punkte: Record<number, number>;
  namen: Record<number, string>;
  dran: number;
  pause: 'treffer' | 'daneben' | 'mischen' | null;
  merkzeitMs: number;
  /** Karten, die noch auf dem Nachschubstapel warten. Zu zweit immer 0. */
  vorrat: number;
  /** Wie oft schon gemischt wurde. Steigt, wird das Brett neu verteilt. */
  mischung: number;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
  /**
   * Welcher Sitz von einem Bot welcher Staerke gespielt wird. Fehlt, wenn
   * kein Bot am Tisch sitzt.
   *
   * Sie steht in JEDER Sicht (siehe sicht.ts im Modul) und nicht nur im
   * Gedaechtnis dieses Bildschirms: Wer nach einem Neuladen an seinen Tisch
   * zurueckkommt, soll an der Ecke weiterhin lesen, gegen wen er spielt.
   */
  stufen?: Record<number, Stufe>;
}
