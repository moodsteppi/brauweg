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
export type Ausgang =
  | 'matt'
  | 'patt'
  | 'fuenfzigZuege'
  | 'wiederholung'
  | 'material'
  | 'zeit'
  | 'aufgabe';

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
  /** Gespielte Zuege in Kurzschrift (SAN), etwa „Nf3", „exd5", „O-O". */
  verlauf: string[];
  /**
   * Schachuhr oder null. `restMs` je Sitz auf dem Stand vor dem laufenden
   * Zug; fuer den Sitz am Zug zaehlt die Uhr von `turnDeadline` herunter.
   */
  uhr: { restMs: number[]; bedenkzeitMs: number; zuschlagMs: number } | null;
  /** Vom Brett genommene Figuren je Farbe, staerkste zuerst. */
  geschlagen: { w: string[]; b: string[] };
  /** Materialvorsprung von Weiss; negativ heisst Schwarz vorn. */
  vorsprung: number;
  /** Ziele fuer einen Vorab-Zug, nur solange man NICHT am Zug ist. */
  vorab: Record<string, string[]>;
  /** Modus 'secretDame', sonst null (normaler Modus). */
  secretDame: SecretDameSicht | null;
}

/** Muss zu `SchachDurchVerdeckte` in packages/game-brochess/src/regeln.ts passen. */
export type SecretDameRegel = 'A' | 'B';

/** Muss zu `GeheimZustand` in packages/game-brochess/src/geheim.ts passen. */
export type GeheimZustand = 'offen' | 'verdeckt' | 'aufgedeckt' | 'geschlagen' | 'erloschen';

/** Eine geheime Dame, soweit der Betrachter sie kennen darf. */
export interface GeheimeDameSicht {
  zustand: GeheimZustand;
  /** Aktuelles Feld, null wenn sie nicht mehr auf dem Brett steht. */
  feld: string | null;
  /** Grundfigur in Kleinbuchstaben ('p', 'n', 'b', 'r', 'q'). */
  grundfigur: string;
}

/** Was mit den geheimen Damen geschah; `halbzug` zaehlt wie `verlauf` ab 1. */
export type GeheimEreignis =
  | { art: 'aufgedeckt'; farbe: Farbe; feld: string; grundfigur: string; halbzug: number }
  | { art: 'verdecktGeschlagen'; farbe: Farbe; feld: string; grundfigur: string; halbzug: number }
  | { art: 'umgewandelt'; farbe: Farbe; feld: string; grundfigur: 'p'; verdeckt: boolean; halbzug: number }
  /** Regel A: Die verdeckte Dame von `farbe` hat den König auf `feld` geschlagen. */
  | { art: 'koenigGeschlagen'; farbe: Farbe; feld: string; halbzug: number };

/** Secret Dame aus der Sicht, siehe `SecretDameSicht` im Modul. */
export interface SecretDameSicht {
  regel: SecretDameRegel;
  /** Laeuft noch die Wahl? Dann stehen Wahl-Aktionen statt Zuegen in `legalActions`. */
  wahlLaeuft: boolean;
  /** Wer schon gewaehlt hat — ob, nicht was. */
  gewaehlt: { w: boolean; b: boolean };
  /** Die eigene geheime Dame; null vor der eigenen Wahl und fuer Zuschauer. */
  meine: GeheimeDameSicht | null;
  /** Geheime Damen, die beide kennen (aufgedeckt oder verdeckt geschlagen). */
  bekannt: { w: GeheimeDameSicht | null; b: GeheimeDameSicht | null };
  ereignisse: GeheimEreignis[];
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

/** Die Wahl der geheimen Dame; steht waehrend der Wahl in `legalActions`. */
export interface BroChessWahl {
  type: 'wahl';
  feld: string;
}

/** Aufgeben — geht jederzeit und steht nicht in `legalActions`. */
export interface BroChessAufgabe {
  type: 'aufgeben';
}
