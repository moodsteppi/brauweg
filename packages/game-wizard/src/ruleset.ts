/**
 * RuleSet.
 *
 * Der Kern des Spiels ist NICHT schaltbar: Bedienpflicht, Zauberer sticht,
 * Narr verliert, Trumpf per aufgedeckter Karte, 20 + 10 je Stich / -10 je
 * Abweichung. Ohne diese Regeln ist es nicht mehr dieses Spiel, und ein
 * Regeleditor, mit dem sich der Tisch unspielbar stellen laesst, ist kein
 * Vorteil, sondern eine Falle.
 *
 * Schaltbar sind sieben Hausregeln, alle mit Vorgabe aus - so wie Schmeissen
 * beim Doppelkopf.
 *
 * Bewusst NICHT enthalten: Einsatz, Topf, Preise. Regelwerk und Waehrung
 * bleiben getrennt.
 */

import { fullRounds } from './cards.js';

export interface RuleSet {
  readonly id: string;
  readonly version: number;
  readonly name: string;

  // --- Ansagen ---

  /**
   * Der letzte Ansager (der Geber) darf die Summe aller Ansagen nicht auf die
   * Stichzahl bringen. Es liegt damit immer mindestens einer daneben.
   */
  bidSumForbidden: boolean;

  /**
   * Wer 0 ansagt und haelt, bekommt 10 x Rundennummer statt der festen 20.
   * Macht die spaeten Runden mit grossen Haenden interessanter, in denen eine
   * gehaltene Null die schwerere Leistung ist.
   */
  zeroBonus: boolean;

  /**
   * Verdeckt ansagen. Angesagt wird weiter reihum - anders liesse sich der
   * Zugtimer der Plattform nicht anwenden, die immer genau einen Sitz am Zug
   * kennt -, aber keine Ansage wird sichtbar, bevor alle angesagt haben.
   * Wirkung wie am Tisch: Niemand rechnet gegen die Zahlen der anderen.
   */
  hiddenBids: boolean;

  /**
   * Blinde erste Runde: Jeder haelt seine einzige Karte an die Stirn. Man
   * sieht die Karten aller anderen, nur die eigene nicht.
   */
  blindFirstRound: boolean;

  // --- Trumpf ---

  /**
   * Bei aufgedecktem Zauberer nennt der Geber die Trumpffarbe, BEVOR er seine
   * eigene Hand ansieht. Nimmt dem Geberplatz seinen groessten Vorteil.
   */
  dealerPicksBlind: boolean;

  /** Der ganze Tisch spielt ohne Trumpf. Zauberer und Narren bleiben. */
  noTrump: boolean;

  /**
   * Auch bei aufgedecktem Narren nennt der Geber eine Trumpffarbe, statt die
   * Runde ohne Trumpf zu spielen.
   */
  jesterPicksTrump: boolean;

  // --- Tisch ---

  tableSize: number; // 3..6
  rounds: number; // 1..60/tableSize
}

export const DEFAULT_RULESET: RuleSet = {
  id: 'default',
  version: 1,
  name: 'Standard',

  bidSumForbidden: false,
  zeroBonus: false,
  hiddenBids: false,
  blindFirstRound: false,

  dealerPicksBlind: false,
  noTrump: false,
  jesterPicksTrump: false,

  tableSize: 4,
  rounds: 15,
};

export const SEAT_COUNTS: readonly number[] = [3, 4, 5, 6];

/**
 * Laenge der Geberrotation. Bewusst 1, und der Grund gehoert dokumentiert:
 *
 * Die Plattform verlangt, dass die Rundenzahl ein Vielfaches der Rotation ist,
 * damit jeder gleich oft gibt. Hier geht das nie auf - 20 durch 3, 15 durch 4,
 * 12 durch 5, 10 durch 6 laesst jedes Mal einen Rest. Eines von beidem muss
 * weichen.
 *
 * Es weicht die Gleichverteilung, weil sie hier weniger wiegt: Beim
 * Doppelkopf ist der Geber-Nachteil in jeder Runde derselbe und summiert sich
 * sauber auf. Hier aendert sich mit jeder Runde die Handgroesse, der
 * Geberplatz ist in Runde 1 etwas anderes wert als in Runde 15 - eine "faire
 * Geberrunde" gibt es gar nicht. Die feste Spiellaenge dagegen gehoert zum
 * Spiel: 60 Karten, restlos verteilt.
 *
 * Wem der Positionsvorteil des Gebers zu gross ist, schaltet hiddenBids ein.
 */
export function rotationSize(): number {
  return 1;
}

/** Volle, halbe und kurze Partie. Erste Zahl ist die Vorgabe. */
export function suggestedRounds(seats: number): number[] {
  const voll = fullRounds(seats);
  const halb = Math.max(1, Math.round(voll / 2));
  const kurz = Math.max(1, Math.round(voll / 4));
  return [...new Set([voll, halb, kurz])];
}

export function makeRuleSet(patch: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULESET, ...patch };
}
