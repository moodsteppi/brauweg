/**
 * Regelsatz von BroChess.
 *
 * Klassisches Schach hat keine Hausregeln, die ein Tisch waehlen koennte —
 * aber eine Zeitkontrolle. Bis zum 22.10.2026 stand hier, die Schachuhr
 * gehoere ausdruecklich nicht dazu, sie sei Plattformzeit. Das stimmt nur
 * halb: MESSEN ist Plattformzeit (das Modul hat keine Uhr, game-api), aber
 * WELCHE Bedenkzeit gilt, wann der Zuschlag kommt und was ein Zeitablauf
 * bedeutet, sind Schachregeln (FIDE 6). Deshalb steht die Zeitkontrolle hier,
 * und die Plattform fragt das Modul ueber `schachuhr` (game-api), statt sie
 * selbst zu deuten.
 *
 * Ohne `bedenkzeitMs` spielt der Tisch wie vorher ohne Schachuhr, nur mit
 * der Zugzeit der Plattform — so laufen alte Tische und Tests unveraendert.
 *
 * Einsatz, Topf, Preise gehoeren nie hierher (game-api, Grundsatz 4).
 */

import type { ConfigProblem } from '@brauweg/game-api';

export interface BroChessRegeln {
  /** Bedenkzeit je Spieler fuer die ganze Partie. Fehlt sie, gibt es keine Schachuhr. */
  readonly bedenkzeitMs?: number;
  /** Zuschlag je Zug (Fischer-Modus), gutgeschrieben nach dem eigenen Zug. */
  readonly zuschlagMs?: number;
}

export const DEFAULT_REGELN: BroChessRegeln = {};

/** Kuerzeste Bedenkzeit: 20 Sekunden wie „20 sec + 1" in der Auswahl. */
export const BEDENKZEIT_MIN_MS = 20_000;
/** Laengste: drei Stunden. Mehr ist kein Schnellschach, sondern ein vergessener Tisch. */
export const BEDENKZEIT_MAX_MS = 3 * 60 * 60_000;
export const ZUSCHLAG_MAX_MS = 60_000;

/** Schach ist ein Duell. */
export const SEAT_COUNTS: readonly number[] = [2];

/** Eine Partie ist eine Runde; es gibt keinen Geber, der reihum wechseln muesste. */
export function rotationSize(): number {
  return 1;
}

export function suggestedRounds(): readonly number[] {
  return [1];
}

function ganzzahlImBereich(wert: unknown, min: number, max: number): boolean {
  return typeof wert === 'number' && Number.isInteger(wert) && wert >= min && wert <= max;
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
  const regeln = config as { bedenkzeitMs?: unknown; zuschlagMs?: unknown };
  if (
    regeln.bedenkzeitMs !== undefined &&
    !ganzzahlImBereich(regeln.bedenkzeitMs, BEDENKZEIT_MIN_MS, BEDENKZEIT_MAX_MS)
  ) {
    probleme.push({ path: 'bedenkzeitMs', messageKey: 'ruleset.bedenkzeit', severity: 'error' });
  }
  if (regeln.zuschlagMs !== undefined) {
    // Ein Zuschlag ohne Bedenkzeit waere eine Uhr ohne Zifferblatt.
    if (regeln.bedenkzeitMs === undefined || !ganzzahlImBereich(regeln.zuschlagMs, 0, ZUSCHLAG_MAX_MS)) {
      probleme.push({ path: 'zuschlagMs', messageKey: 'ruleset.zuschlag', severity: 'error' });
    }
  }
  return probleme;
}

/** Die Uhr dieses Regelsatzes, oder null fuer einen Tisch ohne Schachuhr. */
export function zeitkontrolle(
  regeln: BroChessRegeln,
): { readonly bedenkzeitMs: number; readonly zuschlagMs: number } | null {
  if (regeln.bedenkzeitMs === undefined) return null;
  return { bedenkzeitMs: regeln.bedenkzeitMs, zuschlagMs: regeln.zuschlagMs ?? 0 };
}
