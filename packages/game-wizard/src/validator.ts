/**
 * Regelsatz-Validator.
 *
 * Prueft nur Widersprueche, nicht den Geschmack. Eine Hausregel, die nichts
 * bewirkt, ist ein Widerspruch: Wer sie einschaltet, erwartet eine Wirkung und
 * wuerde sonst am Tisch nach dem Fehler suchen.
 */

import { fullRounds } from './cards.js';
import { SEAT_COUNTS, type RuleSet } from './ruleset.js';

export interface RuleIssue {
  readonly code: string;
  readonly severity: 'error' | 'warning';
}

export function validateRuleSet(rs: RuleSet): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const fehler = (code: string): void => void issues.push({ code, severity: 'error' });

  if (!SEAT_COUNTS.includes(rs.tableSize)) fehler('tableSizeUnsupported');

  const max = SEAT_COUNTS.includes(rs.tableSize) ? fullRounds(rs.tableSize) : 20;
  if (!Number.isInteger(rs.rounds) || rs.rounds < 1 || rs.rounds > max) {
    fehler('roundsOutOfRange');
  }

  // Ohne Trumpf gibt es nichts zu waehlen: Beide Wahl-Hausregeln liefen leer.
  if (rs.noTrump && rs.jesterPicksTrump) fehler('noTrumpVsJesterPicks');
  if (rs.noTrump && rs.dealerPicksBlind) fehler('noTrumpVsDealerPicks');

  // Verdeckt angesagt gibt es keinen "letzten Ansager", den man einschraenken
  // koennte - alle sagen an, ohne die Zahlen der anderen zu kennen.
  if (rs.hiddenBids && rs.bidSumForbidden) fehler('hiddenBidsVsBidSum');

  return issues;
}
