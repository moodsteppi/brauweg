/**
 * Regelsatz von BroChess.
 *
 * Leer, und das ist kein Platzhalter: Klassisches Schach hat keine
 * Hausregeln, die ein Tisch waehlen koennte. Die Schachuhr gehoert
 * ausdruecklich nicht dazu (sie waere Plattformzeit, keine Regel), und
 * Einsatz, Topf, Preise gehoeren nie hierher (game-api, Grundsatz 4).
 *
 * Ein leeres Objekt statt gar keines, weil die Plattform einen Regelsatz je
 * Tisch speichert und `validateConfig` ihn als Objekt erwartet — wer spaeter
 * doch eine Einstellung braucht (etwa Chess960), traegt sie hier ein, ohne
 * dass Server oder Datenbank etwas davon merken.
 */

import type { ConfigProblem } from '@brauweg/game-api';

export type BroChessRegeln = Readonly<Record<string, never>>;

export const DEFAULT_REGELN: BroChessRegeln = {};

/** Schach ist ein Duell. */
export const SEAT_COUNTS: readonly number[] = [2];

/** Eine Partie ist eine Runde; es gibt keinen Geber, der reihum wechseln muesste. */
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
  /*
   * Genau eine Partie je Tisch. Mehrere hintereinander waeren ein Match, und
   * dafuer fehlt alles, was ein Match ausmacht (Farbwechsel, Zwischenstand) —
   * lieber abweisen als eine zweite Partie still verschlucken.
   */
  if (rounds !== 1) {
    probleme.push({ path: 'rounds', messageKey: 'ruleset.roundsOutOfRange', severity: 'error' });
  }
  return probleme;
}
