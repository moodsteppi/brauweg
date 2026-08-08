/**
 * RuleSet.
 *
 * Der Kern ist NICHT schaltbar: vier Karten je Sitz, ein Zug ist eine
 * Handlung, Cambio beendet die Runde, wenig ist gut. Ohne diese Regeln ist es
 * nicht mehr dieses Spiel, und ein Regeleditor, mit dem sich der Tisch
 * unspielbar stellen laesst, ist keine Freiheit, sondern eine Falle.
 *
 * Schaltbar sind die vier Aktionskarten, der rote Koenig, der Blick zu Beginn
 * und die Behandlung des Rufers. Das Regelwerk steht in docs/cambio-spec.md.
 *
 * Bewusst NICHT enthalten: Einsatz, Topf, Preise. Regelwerk und Waehrung
 * bleiben getrennt.
 */

export interface RuleSet {
  readonly id: string;
  readonly version: number;
  readonly name: string;

  // --- Aktionskarten ---

  /** 7 und 8: eine eigene Karte ansehen. */
  peekOwn: boolean;
  /** 9 und 10: eine fremde Karte ansehen. */
  peekOther: boolean;
  /** Bube: zwei Karten blind tauschen. */
  blindSwap: boolean;
  /** Dame: eine fremde Karte ansehen, danach wahlweise tauschen. */
  lookAndSwap: boolean;

  // --- Karten ---

  /**
   * Roter Koenig zaehlt 0 statt 13.
   *
   * Aus geschaltet ist das Spiel deutlich flacher: Ohne die beste Karte im
   * Blatt gibt es kaum noch einen Grund, eine unbekannte Karte zu behalten.
   */
  redKingZero: boolean;

  // --- Beginn ---

  /**
   * Zwei eigene Karten zu Beginn ansehen (die beiden aeusseren).
   *
   * Aus heisst: gar keine. Dann ist die erste Runde reines Raten - manche
   * Runden spielen so, weil es die Aktionskarten aufwertet.
   */
  peekTwoAtStart: boolean;

  // --- Cambio-Ruf ---

  /**
   * Strafpunkte, wenn der Ruf misslingt. Sie kommen ZUSAETZLICH zur eigenen
   * Summe - ein misslungener Ruf soll wehtun, sonst ruft man immer.
   */
  failPenalty: number;

  /**
   * Bei Gleichstand misslingt der Ruf.
   *
   * An: Der Rufer muss ECHT niedriger liegen als alle anderen. Aus: Gleichstand
   * genuegt ihm. Beides ist verbreitet; die schaerfere Fassung ist Vorgabe,
   * weil sie den Ruf zur echten Entscheidung macht.
   */
  callerMustBeStrictlyLower: boolean;

  // --- Tisch ---

  tableSize: number; // 2..6
  rounds: number; // Vielfaches der Sitzzahl
}

export const HAND_SIZE = 4;

export const DEFAULT_RULESET: RuleSet = {
  id: 'default',
  version: 1,
  name: 'Standard',

  peekOwn: true,
  peekOther: true,
  blindSwap: true,
  lookAndSwap: true,

  redKingZero: true,

  peekTwoAtStart: true,

  failPenalty: 5,
  callerMustBeStrictlyLower: true,

  tableSize: 4,
  rounds: 4,
};

export const SEAT_COUNTS: readonly number[] = [2, 3, 4, 5, 6];

/**
 * Laenge der Geberrotation: die Sitzzahl.
 *
 * Anders als bei Zauberer geht das hier glatt auf - jede Runde ist gleich
 * aufgebaut, es gibt keine wachsende Handgroesse. Der Geber hat einen echten
 * Nachteil, weil er als Letzter an die Reihe kommt, bevor jemand Cambio rufen
 * kann. Deshalb soll jeder gleich oft geben.
 */
export function rotationSize(seats: number): number {
  return seats;
}

/** Kurze, mittlere und lange Partie - immer ganze Geberrunden. */
export function suggestedRounds(seats: number): number[] {
  return [seats, seats * 2, seats * 3].filter((r) => r <= 20);
}

export function makeRuleSet(patch: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULESET, ...patch };
}
