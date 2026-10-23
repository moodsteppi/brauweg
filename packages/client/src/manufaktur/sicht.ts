/**
 * Was der Server zur Kartenmanufaktur schickt. Anders als bei den
 * Spielsichten gibt es hier keine Zweitbeschreibung: Der Stand ist der des
 * gemeinsamen Kerns (@brauweg/manufaktur-kern), und der Client rechnet mit
 * demselben Kern weiter — eine zweite Beschreibung waere genau die zweite
 * Wahrheit, die es nicht geben soll.
 */

import type { ManufakturStand } from '@brauweg/manufaktur-kern';

export type { Aktion as ManufakturAktion, ManufakturStand, Ziel } from '@brauweg/manufaktur-kern';

export interface ManufakturAntwort {
  stand: ManufakturStand;
  /** Server-Zeit (ms) der Antwort. */
  zeit: number;
  /** `produziert`: Warenwert der Pressen in der Zeit — weit ueber `taler` heisst Stau. */
  offline: { sekunden: number; taler: number; produziert?: number } | null;
  muenzen: number;
}
