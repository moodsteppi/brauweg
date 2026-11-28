/**
 * Die Spielarten des Doppelkopfs — fertige Regelsaetze fuer den Einstieg
 * (Robin, 28.11.2026; `GameMeta.spielarten` in game-api).
 *
 * Die erste ist die Vorgabe des Einstiegs: „Standard" sind Robins Regeln,
 * abgelesen aus dem Regelsatz seines zuletzt erstellten Tisches auf staging
 * und WOERTLICH uebernommen. Tischgroesse, Rundenzahl, Name, Kennung und
 * Fassung kommen aus der Vorgabe des Moduls — sie sind Tisch, nicht Regel,
 * und der Adapter setzt Tischgroesse und Runden beim Partiebau ohnehin aus
 * dem Tisch (`createParty`).
 *
 * Jede Spielart geht durch `validateRuleSet` (spielarten.test.ts). Wer hier
 * eine Regel einschaltet, die eine andere voraussetzt (Feigling ohne
 * Ansagen, Bock-Ausloeser Schmeissen ohne Schmeissen), sieht es dort.
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { DEFAULT_RULESET, type RuleSet } from './ruleset.js';

/** Robins Regeln (Standard), Feld fuer Feld wie an seinem Tisch. */
const ROBINS_REGELN: Partial<RuleSet> = {
  deck: 'without9',
  bock: true,
  bockTriggers: ['zeroResult', 'reAndKontra'],
  bockWindowLength: 4,
  bockFactor: 2,
  armut: true,
  armutAnnounceReturnedTrumps: true,
  hochzeit: true,
  hochzeitClarifyTricks: 3,
  stilleHochzeit: true,
  solos: ['suitC', 'suitS', 'suitH', 'suitD', 'queens', 'jacks', 'fleshless'],
  soloLeadsOut: true,
  announcements: true,
  absagen: true,
  feigling: true,
  feiglingSolo: false,
  pflichtsolo: true,
  pflichtansage: true,
  pflichtansageThreshold: 30,
  pflichtansageMoralThreshold: 29,
  pflichtansageFolge: true,
  pflichtansageArmut: true,
  pflichtansageSchweine: true,
  pflichtansageImSolo: false,
  schweinchen: true,
  superSchweine: true,
  secondDulleBeatsFirst: true,
  defusedDullen: false,
  schmeiss5Luschen: true,
  schmeiss7Volle: true,
  schmeissConsequence: 'redeal',
  spFuchsGefangen: true,
  spKarlchen: true,
  spDoppelkopf: true,
  spCharlieGefangen: true,
  spHerzdurchlauf: true,
  spInSolo: true,
  countPoints: false,
  training: false,
};

/**
 * Anfaenger: ohne Ansagen und Absagen — und damit auch ohne alles, was an
 * ihnen haengt (Feigling, Pflichtansage samt Ausloesern, Bock mit dem
 * Ausloeser „Re und Kontra"). Ohne Sonderpunkte, dafuer mit Augenzaehler:
 * Wer das Spiel lernt, soll sehen, wo er steht. Hochzeit und Armut bleiben,
 * Neunen auch — das ist Doppelkopf, keine Vereinfachung.
 */
const ANFAENGER: Partial<RuleSet> = {
  deck: 'with9',
  announcements: false,
  absagen: false,
  feigling: false,
  feiglingSolo: false,
  pflichtansage: false,
  pflichtansageFolge: false,
  pflichtansageArmut: false,
  pflichtansageSchweine: false,
  pflichtansageImSolo: false,
  bock: false,
  pflichtsolo: false,
  spFuchsGefangen: false,
  spKarlchen: false,
  spDoppelkopf: false,
  spCharlieGefangen: false,
  spHerzdurchlauf: false,
  spInSolo: false,
  countPoints: true,
  hochzeit: true,
  armut: true,
};

/** Normal: die Vorgabe des Moduls, nur ohne die drei Sonderpunkte. */
const NORMAL: Partial<RuleSet> = {
  spFuchsGefangen: false,
  spKarlchen: false,
  spDoppelkopf: false,
};

/**
 * Hart: Robins Regeln, dazu Bock fuer alle fuenf Ausloeser, Schmeissen mit
 * Bockrunde, Feigling auch im Solo und Pflichtansage auch im Solo.
 */
const HART: Partial<RuleSet> = {
  ...ROBINS_REGELN,
  bockTriggers: ['zeroResult', 'reAndKontra', 'solo', 'lostRe', 'schmeiss'],
  schmeissConsequence: 'redealAndBock',
  feiglingSolo: true,
  pflichtansageImSolo: true,
};

export const SPIELARTEN: readonly Spielart[] = [
  spielartAus('standard', DEFAULT_RULESET, ROBINS_REGELN),
  spielartAus('anfaenger', DEFAULT_RULESET, ANFAENGER),
  spielartAus('normal', DEFAULT_RULESET, NORMAL),
  spielartAus('hart', DEFAULT_RULESET, HART),
];
