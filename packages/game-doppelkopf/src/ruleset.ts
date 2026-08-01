/**
 * RuleSet.
 *
 * Eigenstaendiges, versioniertes Objekt. Eine Partie haelt eine feste Version
 * fest; spaetere Aenderungen duerfen abgeschlossene Partien nicht veraendern.
 *
 * Bewusst NICHT enthalten: Einsatz, Topf, Mindest-Sterne, Mindest-Treue.
 * Das ist Waehrung und Matchmaking, nicht Regelwerk.
 */

import type { DeckVariant } from './cards.js';

export type SoloKind =
  | 'suitC'
  | 'suitS'
  | 'suitH'
  | 'suitD'
  | 'queens'
  | 'jacks'
  | 'fleshless';

export type SchmeissConsequence = 'redeal' | 'redealAndBock';

export type BockTrigger =
  | 'zeroResult' // Rundenergebnis 0 (Gleichstand)
  | 'reAndKontra' // Re und Kontra wurden beide angesagt
  | 'solo'
  | 'lostRe'
  | 'schmeiss';

export interface RuleSet {
  readonly id: string;
  readonly version: number;
  readonly name: string;

  // --- Blatt ---
  deck: DeckVariant;

  // --- Trumpf und Grundvarianten ---
  secondDulleBeatsFirst: boolean;
  defusedDullen: boolean; // Definition noch offen, siehe Spec Abschnitt 12
  schweinchen: boolean;
  superSchweine: boolean;

  // --- Sonderpunkte ---
  spFuchsGefangen: boolean;
  spKarlchen: boolean;
  spDoppelkopf: boolean;
  spCharlieGefangen: boolean;
  spHerzdurchlauf: boolean;
  /** Gelten Sonderpunkte auch im Solo? (Spec-Punkt 4, Default konservativ) */
  spInSolo: boolean;

  // --- Vorbehalte ---
  solos: SoloKind[];
  soloLeadsOut: boolean; // "Solo kommt raus" fuer Lustsolo
  hochzeit: boolean;
  hochzeitClarifyTricks: number; // Klaerung innerhalb der ersten N Stiche
  stilleHochzeit: boolean;
  armut: boolean;
  /** Anzahl zurueckgegebener Truempfe wird oeffentlich angesagt. */
  armutAnnounceReturnedTrumps: boolean;

  // --- Schmeissen ---
  schmeiss5Luschen: boolean;
  schmeiss7Volle: boolean;
  schmeissConsequence: SchmeissConsequence;

  // --- Ansagen ---
  announcements: boolean;
  absagen: boolean;

  // --- Pflichtansage ---
  pflichtansage: boolean;
  pflichtansageThreshold: number; // 30
  pflichtansageMoralThreshold: number; // 29

  // --- Bockrunden ---
  bock: boolean;
  bockTriggers: BockTrigger[];
  bockWindowLength: number; // 4
  bockFactor: number; // 2

  // --- Pflichtsolo ---
  pflichtsolo: boolean;

  // --- Tisch ---
  tableSize: 3 | 4 | 5;
  rounds: number; // Vielfaches von tableSize

  // --- Modus ---
  training: boolean;
}

export const DEFAULT_RULESET: RuleSet = {
  id: 'default',
  version: 1,
  name: 'Standard',

  deck: 'with9',

  secondDulleBeatsFirst: false,
  defusedDullen: false,
  schweinchen: false,
  superSchweine: false,

  spFuchsGefangen: true,
  spKarlchen: true,
  spDoppelkopf: true,
  spCharlieGefangen: false,
  spHerzdurchlauf: false,
  spInSolo: false,

  solos: ['suitC', 'suitS', 'suitH', 'suitD', 'queens', 'jacks', 'fleshless'],
  soloLeadsOut: true,
  hochzeit: true,
  hochzeitClarifyTricks: 3,
  stilleHochzeit: true,
  armut: true,
  armutAnnounceReturnedTrumps: false,

  schmeiss5Luschen: false,
  schmeiss7Volle: false,
  schmeissConsequence: 'redeal',

  announcements: true,
  absagen: true,

  pflichtansage: false,
  pflichtansageThreshold: 30,
  pflichtansageMoralThreshold: 29,

  bock: false,
  bockTriggers: ['zeroResult', 'reAndKontra'],
  bockWindowLength: 4,
  bockFactor: 2,

  pflichtsolo: true,

  tableSize: 4,
  rounds: 8,

  training: false,
};

/**
 * Anzahl der Sitze in der Geberrotation.
 *
 * Am 3er-Tisch spielt ein Bot dauerhaft mit, es sind also vier Sitze im Spiel.
 * Eine volle Geberrunde dauert dort vier Runden, nicht drei.
 */
export function rotationSize(tableSize: 3 | 4 | 5): 4 | 5 {
  return tableSize === 5 ? 5 : 4;
}

export function makeRuleSet(patch: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULESET, ...patch };
}
