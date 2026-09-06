/**
 * Der Kartenkatalog: 40 Bahnen in vier Bereichen, nach Nummer sortiert.
 *
 * Die Reihenfolge ist Teil des Determinismus: `waehleKarten` in physik.ts
 * zieht INDIZES aus der Saat, und jedes Gerät muss unter demselben Index
 * dieselbe Bahn finden. Deshalb sind die Bereiche fest verkettet und nie
 * nach Name oder Schwierigkeit umsortiert — sortiert wird erst die Auswahl
 * einer Partie, nicht der Katalog.
 */
import type { Karte } from '../karte';
import { KARTEN_K01_K10 } from './k01-k10';
import { KARTEN_K11_K20 } from './k11-k20';
import { KARTEN_K21_K30 } from './k21-k30';
import { KARTEN_K31_K40 } from './k31-k40';

export const KARTEN: readonly Karte[] = [
  ...KARTEN_K01_K10,
  ...KARTEN_K11_K20,
  ...KARTEN_K21_K30,
  ...KARTEN_K31_K40,
];

/** Bahn zu einer Kennung, für Anzeige und Tests. */
export function karteMitId(id: string): Karte | undefined {
  return KARTEN.find((karte) => karte.id === id);
}
