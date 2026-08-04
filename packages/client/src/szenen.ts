/**
 * Tischszenerien — der Untergrund, auf dem gespielt wird.
 *
 * Persoenlich wie das Kartenblatt: Jeder am Tisch sieht seine eigene. Sonst
 * muesste einer fuer alle entscheiden, und wer die Karten auf dunklem Grund
 * schlecht sieht, muesste damit leben.
 *
 * Die Kennungen muessen zu src/scenes.ts im Server passen — der prueft sie,
 * kennt aber das Aussehen nicht.
 */

export interface Szene {
  readonly id: string;
  readonly name: string;
  /** Ein Satz zur Einordnung, steht unter dem Namen in der Auswahl. */
  readonly hinweis: string;
}

export const SZENEN: readonly Szene[] = [
  { id: 'stube', name: 'Stube', hinweis: 'Grüner Filz, warmes Licht' },
  { id: 'filz-blau', name: 'Blauer Filz', hinweis: 'Ruhig und kühl' },
  { id: 'filz-rot', name: 'Roter Filz', hinweis: 'Warm, wie im Vereinsheim' },
  { id: 'filz-grau', name: 'Grauer Filz', hinweis: 'Die neutralste Wahl' },
  { id: 'holz-hell', name: 'Holztisch', hinweis: 'Helle Eiche statt Filz' },
  { id: 'winter', name: 'Winter', hinweis: 'Raureif am Fenster' },
  { id: 'sommer', name: 'Sommer', hinweis: 'Unterm Sonnensegel' },
  { id: 'nacht', name: 'Spät', hinweis: 'Nur die Lampen brennen' },
  // Mit dem Zauberer gekommen, aber fuer jedes Spiel waehlbar: Eine Szenerie
  // ist der Untergrund, keine Regel.
  { id: 'zauberturm', name: 'Zauberturm', hinweis: 'Kerzen, Bücher, Nachtfenster' },
  { id: 'sternenwiese', name: 'Sternenwiese', hinweis: 'Draußen, unter Lichterketten' },
];

export const STANDARD_SZENE = 'stube';

/** Bild zu einer Szenerie. Unbekanntes faellt auf die Stube zurueck. */
export function szeneBild(id: string | null | undefined): string {
  const gefunden = SZENEN.some((s) => s.id === id);
  return `/hub/szene-${gefunden ? id : STANDARD_SZENE}.webp`;
}
