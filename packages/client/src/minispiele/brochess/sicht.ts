/**
 * Die Sicht des BroChess-Moduls, wie der Client sie liest.
 *
 * Steht hier und nicht im Bildschirm, weil der Vertrag unter src/vertrag/
 * sie gegen die echte Modulsicht haelt (packages/game-brochess/src/sicht.ts)
 * — ein Import aus einer .tsx zoege React in einen Test, der nur Typen
 * vergleichen will.
 *
 * Zweitbeschreibung mit Absicht; warum, steht in src/vertrag/README.md.
 */

export type Farbe = 'w' | 'b';

/** Muss zu `Umwandlung` in packages/game-brochess/src/brett.ts passen. */
export type Umwandlung = 'q' | 'r' | 'b' | 'n';

/** Muss zu `Ausgang` in packages/game-brochess/src/partie.ts passen. */
export type Ausgang = 'matt' | 'patt' | 'fuenfzigZuege' | 'wiederholung' | 'material';

/** Sicht des Moduls, siehe packages/game-brochess/src/sicht.ts. */
export interface BroChessSicht {
  zuschauer: boolean;
  /** Fuer den Ersatzbot des Servers; der Bildschirm liest `brett`. */
  fen: string;
  /** 64 Felder, a1 zuerst, Figuren in FEN-Schreibweise, '' ist leer. */
  brett: string[];
  amZug: Farbe;
  meineFarbe: Farbe | null;
  weissSitz: number;
  schach: boolean;
  letzterZug: { von: string; nach: string } | null;
  ende: { ausgang: Ausgang; sieger: number | null } | null;
}

/**
 * Ein Zug, wie er in `legalActions` steht und an den Server geht. Der
 * Bildschirm baut ihn nie selbst zusammen, sondern waehlt ihn aus dieser
 * Liste aus — so kann er keinen Zug schicken, den der Server nicht anbietet.
 */
export interface BroChessZug {
  type: 'zug';
  von: string;
  nach: string;
  umwandlung?: Umwandlung;
}
