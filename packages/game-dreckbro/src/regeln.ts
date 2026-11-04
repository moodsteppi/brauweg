/**
 * Regelsatz von DreckBro.
 *
 * Leer wie bei BroChess: Es gibt (noch) keine Hausregel, die ein Tisch
 * waehlen koennte. Ein leeres Objekt statt gar keines, weil die Plattform
 * einen Regelsatz je Tisch speichert und `validateConfig` ihn als Objekt
 * erwartet — wer spaeter eine Einstellung braucht (etwa vier Pinguine je
 * Spieler), traegt sie hier ein, ohne dass Server oder Datenbank es merken.
 */

import type { ConfigProblem } from '@brauweg/game-api';

export type DreckBroRegeln = Readonly<Record<string, never>>;

export const DEFAULT_REGELN: DreckBroRegeln = {};

/** Zwei bis fuenf: Mit sechs reicht das Blatt fuer die Haende, aber jeder wartet zu lange. */
export const SEAT_COUNTS: readonly number[] = [2, 3, 4, 5];

/** Pinguine je Spieler. */
export const PINGUINE = 3;

/** Karten auf der Hand. */
export const HANDKARTEN = 3;

/** Hoechste Dreckstufe: 0 blitzblank, 1 fleckig, 2 DreckBro. */
export const VOLL = 2;

/**
 * Notbremse: Nach so vielen Zuegen endet die Partie, und es gewinnt, wer
 * die meisten Dreckstufen hat. Ohne sie koennten sich Bots, die einander
 * immer wieder abwaschen, beliebig lange im Kreis drehen — ein Tisch, der
 * nie fertig wird, blockiert seine Sitze.
 */
export const ZUG_GRENZE = 400;

export function rotationSize(): number {
  return 1;
}

export function suggestedRounds(): readonly number[] {
  return [1];
}

export function pruefeRegeln(config: unknown, seats: number, rounds: number): ConfigProblem[] {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return [{ path: 'config', messageKey: 'ruleset.notAnObject', severity: 'error' }];
  }
  const probleme: ConfigProblem[] = [];
  if (!SEAT_COUNTS.includes(seats)) {
    probleme.push({ path: 'seats', messageKey: 'ruleset.tableSizeUnsupported', severity: 'error' });
  }
  // Eine Partie je Tisch, wie bei BroChess: Mehrere hintereinander braeuchten
  // einen Zwischenstand, den es nicht gibt.
  if (rounds !== 1) {
    probleme.push({ path: 'rounds', messageKey: 'ruleset.roundsOutOfRange', severity: 'error' });
  }
  return probleme;
}
