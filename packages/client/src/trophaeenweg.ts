import type { Weg, WegGrad, WegStufe } from './api';

/**
 * Die Stationen des Trophäenwegs, wie der Bildschirm sie zeichnet.
 *
 * **Was es dort gibt, sagt der Server** (`/api/weg`, Katalog in
 * `server/src/trophaeenweg-katalog.ts`). Bis zum 26.09.2026 stand die
 * Belohnungsliste hier, als reine Anzeige; seit der Server sie auszahlt, wäre
 * eine Abschrift eine zweite Wahrheit, die beim ersten geänderten Gegenstand
 * etwas anderes verspricht, als abgeholt wird. Hier bleibt nur, was der
 * Server nicht weiß und nicht wissen soll: Name und Bild eines Bioms.
 *
 * Schwellen und Namen folgen `BIOME` in Pfad.tsx; `trophaeenweg.test.ts` hält
 * beide Listen und den Katalog des Servers gegeneinander.
 */
export interface StationsOrt {
  readonly name: string;
  readonly ab: number;
  /** Bild unter /hub/, ohne Endung. */
  readonly biom: string;
}

export const STATIONEN: readonly StationsOrt[] = [
  { name: 'Heimat', ab: 0, biom: 'weg-biom-1-heimat' },
  { name: 'Wiesen', ab: 100, biom: 'weg-biom-2-wiesen' },
  { name: 'Strand', ab: 250, biom: 'weg-biom-3-strand' },
  { name: 'Feuerberg', ab: 500, biom: 'weg-biom-4-feuerberg' },
  { name: 'Schneefeld', ab: 750, biom: 'weg-biom-5-schneefeld' },
  { name: 'Sternenhafen', ab: 1000, biom: 'weg-biom-6-sternenhafen' },
];

/** Eine Station mit dem, was der Server für sie meldet. */
export interface Station extends StationsOrt {
  /** Die Truhe der Station; null an der Heimat und solange nichts geladen ist. */
  readonly truhe: { readonly grad: WegGrad; readonly von: number; readonly bis: number } | null;
  readonly gegenstand: string | null;
  /** Die Stufe vom Server, mit Zustand (erreicht, geholt). */
  readonly stufe: WegStufe | null;
}

/**
 * Legt die Antwort des Servers auf die gezeichneten Stationen.
 *
 * Ohne Antwort (noch nicht geladen, Fehler) stehen die Stationen ohne
 * Belohnung da — lieber eine leere Stelle als eine Belohnung, die der Server
 * gar nicht kennt.
 */
export function stationenMit(weg: Weg | null): Station[] {
  return STATIONEN.map((ort) => {
    const stufe = weg?.stufen.find((s) => s.art === 'station' && s.schwelle === ort.ab) ?? null;
    return { ...ort, truhe: stufe?.truhe ?? null, gegenstand: stufe?.gegenstand ?? null, stufe };
  });
}

/** Abholbar: erreicht und noch nicht geholt. */
export function holbar(stufe: WegStufe | null | undefined): boolean {
  return !!stufe && stufe.erreicht && !stufe.geholt;
}
