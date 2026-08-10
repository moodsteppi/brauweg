/**
 * Regelsatz fuer Skat.
 *
 * Die Spielarten (Farbe, Grand, Null, Ouvert, Hand) sind fester Bestandteil
 * des vollen Skat und keine Schalter. Schaltbar sind nur die Tischvarianten —
 * sie erscheinen im datengetriebenen Regel-Editor des Clients automatisch,
 * genau wie die Doppelkopf-Hausregeln.
 */

export interface RuleSet {
  readonly id: string;
  readonly version: number;
  readonly name: string;

  /** Anzahl Geber-Umlaeufe: eine Partie ist `rotations * 3` Spiele. */
  tableSize: 3;
  rounds: number;

  /**
   * Ramsch, wenn alle passen. Aus: Es wird neu gegeben (eingepasst). Wer den
   * Ramsch verliert (die meisten Augen), zahlt; ein Durchmarsch gewinnt.
   */
  ramsch: boolean;

  /** Kontra und Re zulassen: verdoppelt bzw. vervierfacht den Spielwert. */
  kontraRe: boolean;

  /**
   * Bockrunde nach verlorenem Kontra-Spiel: die naechste Runde zaehlt doppelt.
   * Bewusst getrennt schaltbar — nicht jeder Tisch mag Bock.
   */
  bock: boolean;
}

export const DEFAULT_RULESET: RuleSet = {
  id: 'skat-standard',
  version: 1,
  name: 'Standard',
  tableSize: 3,
  rounds: 3,
  ramsch: true,
  kontraRe: true,
  bock: false,
};

export function makeRuleSet(patch: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULESET, ...patch };
}
