/**
 * Die Spielmodi am Bildschirm: die Lager-Namen und was die Regelzeile ueber
 * den Modus sagt.
 *
 * Namen und Erklaerungen der Modi und Pakete fuers Menue stehen in `wahl.ts`
 * (`MODI`, `PAKET_NAME`, #210) — hier werden sie benutzt, nicht ein zweites
 * Mal geschrieben. Und hier steht KEINE Regel: Welche Stufe gerade gilt,
 * welche Minispiele ein Paket spielt und wer in welchem Lager sitzt, kommt
 * aus der Sicht bzw. dem Regelsatz des Tisches.
 */

import type { PartyRegelsatz } from './sicht';
import { PAKET_NAME } from './wahl';

/** Die beiden Lager. Buchstaben statt Farben: Die Kiste hat keine Teamfarben, und Rot/Grün sieht nicht jeder. */
export const LAGER_KURZ = ['A', 'B'] as const;

/** Das Kuerzel eines Lagers, fuer die Tabelle je Person. */
export function lagerKurz(lager: number): string {
  return LAGER_KURZ[lager] ?? String(lager + 1);
}

export function lagerName(lager: number): string {
  return `Lager ${lagerKurz(lager)}`;
}

/**
 * Was die Regelzeile ueber den Modus sagt — oder null, wenn sie nichts sagen
 * muss. Ein Turnier bekommt keinen Chip: So sieht jeder Tisch von vor dem
 * 22.09.2026 aus, und ein Chip "Turnier" an jedem Tisch waere Rauschen.
 *
 * Die Eskalation nennt die Stufe, wenn sie sie kennt (in der Sicht), sonst
 * nur den Modus (im Wartesaal, vor der ersten Runde).
 */
export function modusChip(regeln: PartyRegelsatz): string | null {
  const modus = regeln.modus ?? 'turnier';
  switch (modus) {
    case 'turnier':
      return null;
    case 'eskalation':
      return regeln.eskalation ? `Eskalation · Stufe ${regeln.eskalation.stufe} von 3` : 'Eskalation';
    case 'themenabend':
      return regeln.paket ? `Themenabend: ${PAKET_NAME[regeln.paket] ?? regeln.paket}` : 'Themenabend';
    case 'team':
      return 'Team-Abend';
  }
}

/**
 * Der Satz unter der Regelzeile, wenn die Eskalation wegen eines Gasts nicht
 * derb wird — sonst null. Der Tisch soll wissen, warum die letzte Runde
 * zahmer ist, als "Eskalation" verspricht.
 */
export function eskalationsHinweis(regeln: PartyRegelsatz): string | null {
  return regeln.eskalation?.gekappt ? 'Ein Gast spielt mit — „derb“ gibt es erst ohne Gast.' : null;
}
