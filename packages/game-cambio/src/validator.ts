/**
 * Regelsatz-Pruefung.
 *
 * Faengt Kombinationen ab, mit denen der Tisch unspielbar oder sinnlos waere.
 * Fehler verhindern den Tisch, Warnungen nicht.
 */

import { SEAT_COUNTS, type RuleSet, rotationSize } from './ruleset.js';

export interface Issue {
  readonly code: string;
  readonly severity: 'error' | 'warning';
}

export function validateRuleSet(rs: RuleSet): Issue[] {
  const issues: Issue[] = [];

  if (!SEAT_COUNTS.includes(rs.tableSize)) {
    issues.push({ code: 'tableSizeUnsupported', severity: 'error' });
  }

  if (rs.rounds < 1 || rs.rounds > 20) {
    issues.push({ code: 'roundsOutOfRange', severity: 'error' });
  } else if (rs.rounds % rotationSize(rs.tableSize) !== 0) {
    // Sonst gibt nicht jeder gleich oft - und der Geber hat hier einen echten
    // Nachteil, weil er als Letzter vor einem moeglichen Ruf drankommt.
    issues.push({ code: 'roundsNotMultipleOfRotation', severity: 'error' });
  }

  if (rs.failPenalty < 0 || rs.failPenalty > 25) {
    issues.push({ code: 'failPenaltyOutOfRange', severity: 'error' });
  }

  // Ohne jede Aktionskarte bleibt Ziehen und Tauschen. Spielbar, aber duenn -
  // deshalb eine Warnung und kein Fehler.
  if (!rs.peekOwn && !rs.peekOther && !rs.blindSwap && !rs.lookAndSwap) {
    issues.push({ code: 'noActionCards', severity: 'warning' });
  }

  // Kein Startblick UND kein Weg, eigene Karten anzusehen: Man spielt die
  // ganze Runde blind. Das ist reines Gluecksspiel, kein Gedaechtnisspiel.
  if (!rs.peekTwoAtStart && !rs.peekOwn) {
    issues.push({ code: 'noWayToLearnOwnCards', severity: 'warning' });
  }

  // Eine Strafe von null macht den Ruf kostenlos: Man ruft dann immer sofort,
  // weil ein misslungener Ruf nicht schlechter ist als gar keiner.
  if (rs.failPenalty === 0) {
    issues.push({ code: 'freeCall', severity: 'warning' });
  }

  return issues;
}
