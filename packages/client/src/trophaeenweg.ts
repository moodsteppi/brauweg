/**
 * Die Stationen des Trophäenwegs und was es dort gibt.
 *
 * Beschlossen von Robin am 26.09.2026, **noch nicht gebaut**: Der Server kennt
 * die Belohnungen noch nicht, abholen geht also noch nicht. Die Liste steht
 * hier, damit die Seite sie zeigen kann; sobald der Server sie liefert, kommt
 * sie von dort und diese Datei fällt weg (eine Wahrheit, nicht zwei).
 *
 * Schwellen und Namen folgen `BIOME` in Pfad.tsx.
 */
export interface Station {
  readonly name: string;
  readonly ab: number;
  /** Bild unter /hub/, ohne Endung. */
  readonly biom: string;
  readonly truhe: { readonly grad: 'bronze' | 'silber' | 'gold' | 'diamant'; readonly name: string } | null;
  readonly gegenstand: string | null;
}

export const STATIONEN: readonly Station[] = [
  { name: 'Heimat', ab: 0, biom: 'weg-biom-1-heimat', truhe: null, gegenstand: null },
  { name: 'Wiesen', ab: 100, biom: 'weg-biom-2-wiesen', truhe: { grad: 'bronze', name: 'Bronzetruhe' }, gegenstand: 'Pinguin-Kopf „Strohhut“' },
  { name: 'Strand', ab: 250, biom: 'weg-biom-3-strand', truhe: { grad: 'silber', name: 'Silbertruhe' }, gegenstand: 'Kartenrücken „Sommerwiese“' },
  { name: 'Feuerberg', ab: 500, biom: 'weg-biom-4-feuerberg', truhe: { grad: 'gold', name: 'Goldtruhe' }, gegenstand: 'Tisch „Kaminzimmer“' },
  { name: 'Schneefeld', ab: 750, biom: 'weg-biom-5-schneefeld', truhe: { grad: 'gold', name: 'Goldtruhe' }, gegenstand: 'Kartenblatt „Winterhof“' },
  { name: 'Sternenhafen', ab: 1000, biom: 'weg-biom-6-sternenhafen', truhe: { grad: 'diamant', name: 'Diamanttruhe' }, gegenstand: 'Pinguin-Aura „Sternenkranz“' },
];

/** Münzen je Checkpoint zwischen den Stationen (alle 100 bis 1.000). */
export const CHECKPOINT_MUENZEN = 25;

/** Die Checkpoints bis 1.000, die keine Station sind: 200, 300, 400, 600, … */
export function zwischenCheckpoints(): number[] {
  const stationen = new Set(STATIONEN.map((s) => s.ab));
  const liste: number[] = [];
  for (let t = 100; t < 1000; t += 100) if (!stationen.has(t)) liste.push(t);
  return liste;
}
