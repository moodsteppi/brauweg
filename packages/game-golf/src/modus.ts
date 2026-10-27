/**
 * Golf — die Spielart eines Tisches: klassisch oder Fun.
 *
 * Robin hat am 22.09.2026 entschieden: Neben dem fairen klassischen Golf gibt
 * es einen Fun-Modus als eigene Regeloption — mit Wind, Wetter und einem
 * Roulette je Loch, Power-ups und Störschlägen. Das Modul weiß davon nur den
 * Namen: Welcher Modifikator an welchem Loch gilt und was er physikalisch
 * tut, rechnet der Client rein aus Saat und Lochindex
 * (`packages/client/src/minispiele/golf/modifikator.ts`), so wie er auch die
 * Bälle rechnet. Der Server rechnet keine Physik — auch keine lustige.
 *
 * Eine eigene Datei neben der Bahnauswahl (bahnwahl.ts), weil beide am
 * Regelsatz hängen, aber nichts miteinander zu tun haben: Ein Kurs lässt
 * sich klassisch und im Fun-Modus spielen.
 */

import type { ConfigProblem } from '@brauweg/game-api';

export type GolfModus = 'klassisch' | 'fun';

/** Alle Spielarten; die erste ist die Vorgabe. */
export const MODI: readonly GolfModus[] = ['klassisch', 'fun'];

/**
 * Die Spielart eines Regelsatzes. Fehlt das Feld — jeder Tisch und jeder
 * Schnappschuss von vor dem 22.09.2026 —, ist es klassisch.
 */
export function modusVon(regeln: unknown): GolfModus {
  if (typeof regeln !== 'object' || regeln === null) return 'klassisch';
  return (regeln as { modus?: unknown }).modus === 'fun' ? 'fun' : 'klassisch';
}

/**
 * Prüft `modus` im Regelsatz — wirft nie, auch nicht bei Unsinn
 * (`plattform-invarianten.test.ts` bewirft `validateConfig` damit).
 */
export function pruefeModus(config: unknown): ConfigProblem[] {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return [];
  const modus = (config as { modus?: unknown }).modus;
  if (modus === undefined) return [];
  if (typeof modus === 'string' && (MODI as readonly string[]).includes(modus)) return [];
  return [{ path: 'config.modus', messageKey: 'ruleset.golf.modusUnbekannt', severity: 'error' }];
}

/*
 * Ob eine Partie fuer die Bestleistung je Bahn zaehlt, entscheidet
 * `zaehltFuerBestleistung` in bestleistung.ts — mit `modusVon` von hier:
 * im Fun-Modus nie.
 */
