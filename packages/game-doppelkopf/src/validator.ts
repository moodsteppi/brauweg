/**
 * Regelsatz-Validator.
 *
 * Prueft beim SPEICHERN, nicht zur Laufzeit. Andernfalls entstehen Regelsaetze,
 * bei denen die Engine mitten in der Partie in einen undefinierten Zustand
 * laeuft.
 */

import { type RuleSet, rotationSize } from './ruleset.js';

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

  // --- Tisch und Rundenzahl ---
  if (![3, 4, 5].includes(rs.tableSize)) {
    err('TABLE_SIZE', 'Tischgroesse muss 3, 4 oder 5 sein.');
  }
  // Massgeblich ist die Geberrotation, nicht die Tischgroesse. Am 3er-Tisch
  // sitzt ein Bot mit, dort sind es also vier Sitze.
  const rot = rotationSize(rs.tableSize);
  if (rs.rounds <= 0 || rs.rounds % rot !== 0) {
    err(
      'ROUNDS_MULTIPLE',
      `Rundenzahl muss ein positives Vielfaches der Geberrotation (${rot}) sein.`,
    );
  }

  // --- Varianten-Abhaengigkeiten ---
  if (rs.superSchweine && !rs.schweinchen) {
    err('SUPERSCHWEIN_NEEDS_SCHWEINCHEN', 'Superschweine setzen Schweinchen voraus.');
  }

  // --- Ansagen ---
  if (rs.absagen && !rs.announcements) {
    err('ABSAGEN_NEED_ANNOUNCEMENTS', 'Absagen setzen aktivierte Ansagen voraus.');
  }
  if (rs.pflichtansage && !rs.announcements) {
    err('PFLICHTANSAGE_NEEDS_ANNOUNCEMENTS', 'Pflichtansage setzt aktivierte Ansagen voraus.');
  }
  if (
    rs.pflichtansage &&
    rs.pflichtansageMoralThreshold >= rs.pflichtansageThreshold
  ) {
    err(
      'PFLICHTANSAGE_THRESHOLDS',
      'Die moralische Schwelle muss unter der Pflichtschwelle liegen.',
    );
  }
  if ((rs.feigling || rs.feiglingSolo) && !rs.announcements) {
    err('FEIGLING_NEEDS_ANNOUNCEMENTS', 'Feigling setzt aktivierte Ansagen voraus.');
  }

  /*
   * Die drei zusaetzlichen Ausloeser brauchen zweierlei: die Pflichtansage
   * selbst und die Regel, an der sie haengen. Ein Ausloeser fuer eine Hochzeit,
   * die es am Tisch nicht gibt, ist kein strengeres Regelwerk, sondern ein
   * Haken, der nie greift — und damit eine Falle beim Tischbau.
   */
  if (rs.pflichtansageFolge && !rs.pflichtansage) {
    err('PFLICHT_FOLGE_NEEDS_PFLICHT', 'Die Folgeansage setzt die Pflichtansage voraus.');
  }
  if (rs.pflichtansageHochzeit && !rs.pflichtansage) {
    err('PFLICHT_HOCHZEIT_NEEDS_PFLICHT', 'Der Hochzeit-Ausloeser setzt die Pflichtansage voraus.');
  }
  if (rs.pflichtansageHochzeit && !rs.hochzeit) {
    err('PFLICHT_HOCHZEIT_NEEDS_HOCHZEIT', 'Der Hochzeit-Ausloeser setzt erlaubte Hochzeiten voraus.');
  }
  if (rs.pflichtansageArmut && !rs.pflichtansage) {
    err('PFLICHT_ARMUT_NEEDS_PFLICHT', 'Der Armut-Ausloeser setzt die Pflichtansage voraus.');
  }
  if (rs.pflichtansageArmut && !rs.armut) {
    err('PFLICHT_ARMUT_NEEDS_ARMUT', 'Der Armut-Ausloeser setzt erlaubte Armut voraus.');
  }
  if (rs.pflichtansageSchweine && !rs.pflichtansage) {
    err('PFLICHT_SCHWEINE_NEEDS_PFLICHT', 'Der Schweine-Ausloeser setzt die Pflichtansage voraus.');
  }
  if (rs.pflichtansageSchweine && !rs.schweinchen) {
    err('PFLICHT_SCHWEINE_NEEDS_SCHWEINCHEN', 'Der Schweine-Ausloeser setzt aktivierte Schweinchen voraus.');
  }

  // --- Solo und Pflichtsolo ---
  if (rs.pflichtsolo && rs.solos.length === 0) {
    err('PFLICHTSOLO_NEEDS_SOLO', 'Pflichtsolo setzt mindestens ein aktiviertes Solospiel voraus.');
  }
  if (rs.pflichtsolo && rs.rounds < rot) {
    err(
      'PFLICHTSOLO_ROUNDS',
      'Bei aktiviertem Pflichtsolo muss mindestens eine volle Geberrunde gespielt werden.',
    );
  }

  // --- Bockrunden ---
  if (rs.bock) {
    if (rs.bockTriggers.length === 0) {
      err('BOCK_NO_TRIGGER', 'Bockrunden sind aktiviert, aber kein Ausloeser gewaehlt.');
    }
    if (rs.bockTriggers.includes('reAndKontra') && !rs.announcements) {
      err('BOCK_TRIGGER_ANNOUNCEMENTS', 'Der Ausloeser "Re und Kontra" setzt Ansagen voraus.');
    }
    if (rs.bockTriggers.includes('lostRe') && !rs.announcements) {
      err('BOCK_TRIGGER_LOST_RE', 'Der Ausloeser "verlorenes Re" setzt Ansagen voraus.');
    }
    if (rs.bockTriggers.includes('solo') && rs.solos.length === 0) {
      err('BOCK_TRIGGER_SOLO', 'Der Ausloeser "Solo" setzt aktivierte Solospiele voraus.');
    }
    if (
      rs.bockTriggers.includes('schmeiss') &&
      !(rs.schmeiss5Luschen || rs.schmeiss7Volle)
    ) {
      err('BOCK_TRIGGER_SCHMEISS', 'Der Ausloeser "Schmeissen" setzt aktiviertes Schmeissen voraus.');
    }
    if (rs.bockWindowLength <= 0) {
      err('BOCK_WINDOW', 'Die Laenge eines Bock-Fensters muss positiv sein.');
    }
    if (rs.bockFactor < 2) {
      err('BOCK_FACTOR', 'Der Bock-Multiplikator muss mindestens 2 betragen.');
    }
  }

  // --- Schmeissen ---
  const schmeissActive = rs.schmeiss5Luschen || rs.schmeiss7Volle;
  if (rs.schmeissConsequence === 'redealAndBock' && !rs.bock) {
    err(
      'SCHMEISS_NEEDS_BOCK',
      'Die Schmeiss-Konsequenz "Bockrunde ausloesen" setzt aktivierte Bockrunden voraus.',
    );
  }
  if (!schmeissActive && rs.schmeissConsequence === 'redealAndBock') {
    warn('SCHMEISS_UNUSED', 'Schmeiss-Konsequenz konfiguriert, aber Schmeissen ist deaktiviert.');
  }

  // --- Hochzeit ---
  if (rs.hochzeit && (rs.hochzeitClarifyTricks < 1 || rs.hochzeitClarifyTricks > 3)) {
    err('HOCHZEIT_CLARIFY', 'Die Klaerungsfrist der Hochzeit muss zwischen 1 und 3 Stichen liegen.');
  }
  if (rs.stilleHochzeit && !rs.hochzeit) {
    err('STILLE_HOCHZEIT', 'Stille Hochzeit setzt aktivierte Hochzeit voraus.');
  }

  // --- Armut ---
  if (rs.armutAnnounceReturnedTrumps && !rs.armut) {
    err('ARMUT_ANNOUNCE', 'Die Ansage der Rueckgabe-Truempfe setzt aktivierte Armut voraus.');
  }

  // --- Hinweise ---
  if (rs.spHerzdurchlauf && rs.deck === 'without9') {
    warn(
      'HERZDURCHLAUF_SHARP',
      'Bei Scharfem Doko existieren nur vier Herz-Fehlkarten. Ein Herzdurchlauf ist hoechstens einmal pro Runde moeglich.',
    );
  }
  if (rs.schweinchen && rs.solos.length > 0) {
    warn(
      'SCHWEINCHEN_SOLO',
      'Schweinchen greifen nur in Spielen, in denen Karo Trumpf ist (Normalspiel, Karo-Solo).',
    );
  }
  if (rs.training) {
    warn('TRAINING', 'Trainingsmodus: keine Trophaeen, keine Ranglistenwertung.');
  }
  if (rs.tableSize === 3) {
    warn('TABLE_3', '3er-Tische spielen mit Bot und zaehlen nicht fuer die globale Rangliste.');
  }

  return issues;
}

export function isValid(rs: RuleSet): boolean {
  return validateRuleSet(rs).every((i) => i.severity !== 'error');
}
