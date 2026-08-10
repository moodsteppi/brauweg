/**
 * Regelsatz fuer Skat.
 *
 * Die Spielarten des vollen Skat (Farbe, Grand, Null, Ouvert, Hand) sind
 * fester Bestandteil und keine Schalter. Schaltbar sind nur die
 * Tischvarianten — sie erscheinen im datengetriebenen Regel-Editor des
 * Clients automatisch, genau wie die Doppelkopf-Hausregeln. Deshalb ist jede
 * Variante ein boolesches Feld und keine verschachtelte Struktur: Der Editor
 * zeigt alles, was `typeof value === 'boolean'` ist.
 */

export interface RuleSet {
  readonly id: string;
  readonly version: number;
  readonly name: string;

  /** Anzahl Geber-Umlaeufe: eine Partie ist `rotations * 3` Spiele. */
  tableSize: 3;
  rounds: number;

  // --- Spielwert ---

  /**
   * Spitzen zaehlen nur an den vier Buben, nicht an der Trumpffarbe. Damit
   * liegt „mit/ohne" hoechstens bei vier statt bei elf — die Reizwerte bleiben
   * klein, und niemand reizt sich an einer langen Trumpffarbe hoch.
   */
  nurBubenSpitzen: boolean;

  /**
   * Patrouillen: Wer beide Buben einer Couleur haelt (Kreuz+Pik = schwarze,
   * Herz+Karo = rote Patrouille), darf sie bei der Ansage nennen und bekommt
   * je Patrouille eine Spielstufe. Angesagt wird nur, was man wirklich hat;
   * die Engine prueft es an der Hand.
   */
  patrouillen: boolean;

  /**
   * Saechsische Spitze als zusaetzliche Spielart: wie Grand nur mit Buben als
   * Trumpf, aber die ganze Ordnung steht auf dem Kopf — Karo-Bube ist der
   * hoechste, Kreuz-Bube der niedrigste; unter den Farbkarten ist die Sieben
   * die hoechste und das Ass die niedrigste. Grundwert 20.
   */
  saechsischeSpitze: boolean;

  /**
   * Ein verlorenes Handspiel zaehlt nur einfach statt doppelt. Wer ohne Skat
   * spielt, geht das groessere Risiko — an vielen Tischen soll ihn das nicht
   * auch noch doppelt treffen.
   */
  handNichtBestraft: boolean;

  // --- Ansagen ---

  /** Kontra und Re zulassen: verdoppelt bzw. vervierfacht den Spielwert. */
  kontraRe: boolean;

  /**
   * Hirsch als dritte Stufe der Kette: Kontra ×2, Re ×4, Hirsch ×8. Die
   * Gegenpartei sagt ihn auf ein Re. Ohne Kontra/Re gibt es ihn nicht.
   */
  hirsch: boolean;

  // --- Wenn alle passen ---

  /**
   * Ramsch, wenn alle passen. Aus: Es wird neu gegeben (eingepasst). Wer den
   * Ramsch verliert (die meisten Augen), zahlt; ein Durchmarsch gewinnt.
   */
  ramsch: boolean;

  /**
   * Schieberamsch: Vor dem Ramsch wandert der Skat einmal um den Tisch. Jeder
   * nimmt die zwei Karten auf und schiebt zwei weiter — oder schiebt blind,
   * was den Ramsch verdoppelt. Setzt Ramsch voraus.
   */
  schieberamsch: boolean;

  /**
   * Jungfrau im Ramsch: Wer keinen einzigen Stich macht, verdoppelt den
   * Verlust des Augenreichsten. Setzt Ramsch voraus.
   */
  jungfrauen: boolean;

  // --- Tisch ---

  /**
   * Bockrunde nach verlorenem Kontra-Spiel: die naechste Runde zaehlt doppelt.
   * Bewusst getrennt schaltbar — nicht jeder Tisch mag Bock.
   */
  bock: boolean;

  /**
   * Trainingstisch: keine Ranglistenwertung. Der Server liest das Feld selbst
   * (`countsForRanking`), die Engine rechnet weiter wie sonst auch.
   */
  training: boolean;
}

export const DEFAULT_RULESET: RuleSet = {
  id: 'skat-standard',
  version: 1,
  name: 'Standard',
  tableSize: 3,
  rounds: 3,
  nurBubenSpitzen: false,
  patrouillen: false,
  saechsischeSpitze: false,
  handNichtBestraft: false,
  kontraRe: true,
  hirsch: false,
  ramsch: true,
  schieberamsch: false,
  jungfrauen: false,
  bock: false,
  training: false,
};

export function makeRuleSet(patch: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULESET, ...patch };
}
