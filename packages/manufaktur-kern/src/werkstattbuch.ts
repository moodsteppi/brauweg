/**
 * Das Werkstattbuch (Phase 3, 24.10.2026): dauerhafte Verbesserungen, bezahlt
 * mit Siegeln. Siegel gibt es fuer jede Renovierung und jeden Umzug — nie
 * fuer Hub-Muenzen, damit die beiden Wirtschaften getrennt bleiben.
 *
 * Das Buch wird nie zurueckgesetzt. Jede Wirkung steht hier als Funktion des
 * Stands; die Formeln fragen sie ab, statt selbst Stufen zu zaehlen.
 *
 * Preise: Alle Eintraege zusammen kosten 154 Siegel — so viel, wie fuenf
 * Orte mit je vier Renovierungen (3 + 5 + 8 + 12) und vier Umzuege (je 5)
 * einbringen. Wer alles renoviert hat, hat das Buch voll.
 */

import { OFFLINE_MS } from './formeln.js';
import type { ManufakturStand, Rang } from './stand.js';

export type Eintrag = 'nachtschicht' | 'ruf' | 'erfahrene' | 'pausen' | 'feilschen' | 'bewerber' | 'bautrupps' | 'lager';

/** Preis in Siegeln je Stufe — die Laenge ist die Zahl der Stufen. */
export const BUCH: Record<Eintrag, readonly number[]> = {
  nachtschicht: [3, 6, 10],
  ruf: [2, 4, 6, 9, 13],
  erfahrene: [4, 7, 11],
  pausen: [4, 7, 11],
  feilschen: [3, 6, 10],
  bewerber: [6, 12],
  bautrupps: [4, 8],
  lager: [8],
};

export const EINTRAEGE = Object.keys(BUCH) as Eintrag[];

/** Siegel fuer die Renovierungsstufen 1 … 4 und fuer jeden Umzug. */
export const SIEGEL_RENOVIERUNG = [3, 5, 8, 12] as const;
export const SIEGEL_UMZUG = 5;

export function buchStufe(stand: ManufakturStand, e: Eintrag): number {
  return stand.werkstattbuch[e] ?? 0;
}

/** Was die naechste Stufe kostet; null, wenn der Eintrag voll ist. */
export function buchPreis(stand: ManufakturStand, e: Eintrag): number | null {
  return BUCH[e][buchStufe(stand, e)] ?? null;
}

/**
 * Laengere Nachtschicht: Offline-Deckel. Der Auftrag nannte 2 → 8 h; der
 * Grund-Deckel ist aber seit dem 23.10.2026 1 h zum halben Tempo (sonst zog
 * ein Gelegenheitsspieler einen Tag frueher um). Also 1 h → 2 / 3 / 4 h.
 */
export function offlineMs(stand: ManufakturStand): number {
  return OFFLINE_MS * (1 + buchStufe(stand, 'nachtschicht'));
}

/** Guter Ruf: +10 % Kartenwert je Stufe. */
export function kartenwertBonus(stand: ManufakturStand): number {
  return 1 + 0.1 * buchStufe(stand, 'ruf');
}

/** Erfahrene Meister: +15 % Wirkdauer je Stufe. */
export function wirkFaktor(stand: ManufakturStand): number {
  return 1 + 0.15 * buchStufe(stand, 'erfahrene');
}

/** Kurze Pausen: −10 % Abklingzeit je Stufe. */
export function pausenFaktor(stand: ManufakturStand): number {
  return 1 - 0.1 * buchStufe(stand, 'pausen');
}

/** Feilschen: −5 % auf jeden Ausbau je Stufe. */
export function feilschenFaktor(stand: ManufakturStand): number {
  return 1 - 0.05 * buchStufe(stand, 'feilschen');
}

/**
 * Chancen beim zufaelligen Einstellen, je Stufe von „Gute Bewerber" (0 … 2).
 * Nur die Simulation ueberschreibt sie fuer ihre Belastungsprobe.
 */
export const RANG_CHANCEN: Record<Rang, number>[] = [
  { jung: 0.7, meister: 0.25, ober: 0.05 },
  { jung: 0.6, meister: 0.32, ober: 0.08 },
  { jung: 0.5, meister: 0.38, ober: 0.12 },
];

export function rangChance(stand: ManufakturStand): Record<Rang, number> {
  return RANG_CHANCEN[buchStufe(stand, 'bewerber')]!;
}

/** Flinke Bautrupps: −25 % Bauzeit je Stufe (Barrieren, Phase 4). */
export function bauFaktor(stand: ManufakturStand): number {
  return 1 - 0.25 * buchStufe(stand, 'bautrupps');
}

/** Grosses Lager: zwei Plaetze mehr im Pool jeder Station. */
export function poolGroesse(stand: ManufakturStand): number {
  return 5 + 2 * buchStufe(stand, 'lager');
}
