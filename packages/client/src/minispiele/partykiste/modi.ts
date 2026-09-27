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

/** Die Namen der Inhaltsstufen, Stelle = Stufe — dieselben Woerter wie die Kacheln (wahl.ts). */
const INHALT_NAME = ['', 'harmlos', 'pikant', 'derb'] as const;

/**
 * Der Chip „Inhalte …" in der Regelzeile (seit dem 27.09.2026) — oder null,
 * wenn der Regelsatz die Stufe nicht traegt (Tisch von vor dem 22.09.2026).
 *
 * Er nennt, was WIRKT, und wie es gemeint ist: „pikant" heisst seit dem
 * 27.09.2026 nur Pikantes, „gemischt" alle Stufen; ein Tisch von davor spielt
 * noch mit der Obergrenze und heisst deshalb „bis derb". In der Eskalation
 * steht die Stufe der Runde, im Wartesaal nur, dass sie steigt.
 */
export function inhaltsChip(regeln: PartyRegelsatz): string | null {
  if (regeln.modus === 'eskalation') {
    return regeln.eskalation ? `Inhalte ${INHALT_NAME[regeln.eskalation.inhaltsHaerte]}` : 'Inhalte steigen';
  }
  const stufe = regeln.inhaltsHaerte;
  if (stufe === undefined) return null;
  switch (regeln.inhaltsMischung ?? 'bis') {
    case 'gemischt':
      return stufe >= 3 ? 'Inhalte gemischt' : stufe === 2 ? 'Inhalte gemischt, ohne derb' : 'Inhalte harmlos';
    case 'genau':
      return `Inhalte ${INHALT_NAME[stufe]}`;
    case 'bis':
      return stufe === 1 ? 'Inhalte harmlos' : `Inhalte bis ${INHALT_NAME[stufe]}`;
  }
}

/**
 * Der Satz unter der Regelzeile, wenn ein Gast „derb" weggekappt hat — beim
 * Turnier wie bei der Eskalation (dort `eskalationsHinweis`). Sonst null.
 */
export function inhaltsHinweis(regeln: PartyRegelsatz): string | null {
  const gewollt = regeln.inhaltsHaerteGewollt;
  if (regeln.modus === 'eskalation' || !gewollt || regeln.inhaltsHaerte === undefined) return null;
  return gewollt > regeln.inhaltsHaerte ? 'Ein Gast spielt mit — „derb“ gibt es erst ohne Gast.' : null;
}
