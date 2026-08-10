/**
 * Regelsatz-Validator fuer Skat.
 *
 * Prueft beim SPEICHERN, nicht zur Laufzeit — sonst entstuende ein Regelsatz,
 * bei dem die Engine mitten in der Partie in einen undefinierten Zustand
 * liefe.
 */

import { type RuleSet } from './ruleset.js';
import { ROTATION } from './party.js';

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
}

export function validateRuleSet(rs: RuleSet): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) =>
    issues.push({ severity: 'error', code, message });
  const warn = (code: string, message: string) =>
    issues.push({ severity: 'warning', code, message });

  if (rs.tableSize !== 3) {
    err('TABLE_SIZE', 'Skat wird zu dritt gespielt.');
  }
  if (rs.rounds <= 0 || rs.rounds % ROTATION !== 0) {
    err('ROUNDS_MULTIPLE', `Rundenzahl muss ein positives Vielfaches von ${ROTATION} sein.`);
  }

  // Bock haengt am Kontra: Ausgeloest wird die Bockrunde durch ein verlorenes
  // Kontra-Spiel. Ohne Kontra kann sie also nie greifen.
  if (rs.bock && !rs.kontraRe) {
    err('BOCK_NEEDS_KONTRA', 'Bockrunden setzen erlaubtes Kontra/Re voraus.');
  }
  // Hirsch ist die dritte Stufe derselben Kette. Ohne Kontra/Re kaeme sie nie.
  if (rs.hirsch && !rs.kontraRe) {
    err('HIRSCH_NEEDS_KONTRA', 'Hirsch setzt erlaubtes Kontra/Re voraus.');
  }
  // Schieberamsch und Jungfrauen sind Ramsch-Varianten. Wird eingepasst statt
  // geramscht, gaebe es sie nie zu sehen.
  if (rs.schieberamsch && !rs.ramsch) {
    err('SCHIEBERAMSCH_NEEDS_RAMSCH', 'Schieberamsch setzt Ramsch voraus.');
  }
  if (rs.jungfrauen && !rs.ramsch) {
    err('JUNGFRAUEN_NEEDS_RAMSCH', 'Jungfrauen setzen Ramsch voraus.');
  }

  if (rs.training) {
    warn('TRAINING', 'Trainingstisch: keine Ranglistenwertung.');
  }

  return issues;
}

export function isValid(rs: RuleSet): boolean {
  return validateRuleSet(rs).every((i) => i.severity !== 'error');
}
