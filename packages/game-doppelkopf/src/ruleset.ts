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
  /**
   * Feigling: Wer hoch gewinnt, ohne es angesagt zu haben, verliert stattdessen.
   *
   * Verlangt wird nach Augen der Verliererpartei: ab 60 nichts, 30 bis 59
   * mindestens Re/Kontra, 1 bis 29 mindestens Keine 90, schwarz mindestens
   * Keine 60. Wird das verfehlt, wechselt der Sieg zur Gegenpartei — die
   * Sonderpunkte bleiben bei dem, der sie erspielt hat.
   *
   * Sinn der Regel: Sie bestraft das Sitzenlassen einer sicheren Hand. Ohne sie
   * ist Schweigen bei guten Karten die risikoloseste Wahl.
   *
   * `feigling` gilt NUR im Normalspiel. Fuers Solo gibt es den eigenen Schalter
   * `feiglingSolo` — dort will man das Drehen oft anders (oder gar nicht)
   * haben als am gewoehnlichen Tisch, weil ein Solist allein gegen drei
   * ohnehin hoch ansagen muss.
   */
  feigling: boolean;
  /** Feigling, aber nur in Solo-Spielen. Getrennt schaltbar von `feigling`. */
  feiglingSolo: boolean;

  // --- Zaehlhilfe ---
  /**
   * Erspielte Augen waehrend der Runde anzeigen. Eine Gedaechtnishilfe, kein
   * Geheimniswissen - alle Stiche liegen ohnehin offen auf dem Tisch. Als
   * Tischregel, damit alle am Tisch dieselbe Hilfe haben oder keiner.
   */
  countPoints: boolean;

  // --- Pflichtansage ---
  pflichtansage: boolean;
  pflichtansageThreshold: number; // 30
  pflichtansageMoralThreshold: number; // 29
  /**
   * Die Folgeansage: Kam am Bezugsstich eine Ansage zustande, wird auch der
   * Stich DANACH geprueft.
   *
   * Eigener Schalter, nicht Teil von `pflichtansage`: Eine einzelne Pflicht ist
   * eine Regel, eine Kette ist eine andere. Wer nur den fetten ersten Stich
   * bestrafen will, soll nicht ungefragt eine Runde bekommen, in der Re, Keine
   * 90 und Keine 60 hintereinander erzwungen werden.
   */
  pflichtansageFolge: boolean;
  /**
   * Weitere Ausloeser. Jeder hebt die Pflicht um genau eine Stufe — gerechnet
   * als naechste offene Stufe der Partei, nicht als feste Zahl.
   *
   * Sie haengen am TATSAECHLICH GESPIELTEN Spieltyp, nicht an der Ansage: Sagt
   * jemand Armut an und es kommt eine Armut zustande, greift der Ausloeser.
   *
   * (Einen Hochzeit-Ausloeser gab es hier einmal, er ist bewusst entfernt: Eine
   * Hochzeit wird als Normalspiel zu Ende gespielt, eine eigene Pflichtansage
   * dafuer ergibt keinen Sinn.)
   */
  pflichtansageArmut: boolean;
  /** Verpflichtet ist, wer die Schweine haelt — nicht, wer sie spielt. */
  pflichtansageSchweine: boolean;
  /**
   * Gilt die Pflichtansage auch im Solo? Vorgabe: nein.
   *
   * Im Solo spielt einer allein gegen drei; eine erzwungene Ansage (erst recht
   * die Folgekette) trifft ihn besonders hart und faellt oft mit der Vorfuehrung
   * zusammen. Deshalb greift die Pflichtansage im Solo nur, wenn das hier
   * ausdruecklich angeschaltet ist — fuer Bezugs- UND Folgestich.
   */
  pflichtansageImSolo: boolean;

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
  feigling: false,
  feiglingSolo: false,

  countPoints: false,

  pflichtansage: false,
  pflichtansageThreshold: 30,
  pflichtansageMoralThreshold: 29,
  pflichtansageFolge: false,
  pflichtansageArmut: false,
  pflichtansageSchweine: false,
  pflichtansageImSolo: false,

  bock: false,
  bockTriggers: ['zeroResult', 'reAndKontra'],
  bockWindowLength: 4,
  bockFactor: 2,

  pflichtsolo: false,

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
