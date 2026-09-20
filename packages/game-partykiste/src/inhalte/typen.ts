/**
 * Formen der Spielinhalte.
 *
 * Inhalte sind DATEN, keine Regeln: Wer eine Frage ergaenzt, aendert keine
 * Zeile Ablauf. Deshalb liegen sie in eigenen Dateien und sind hier nur
 * beschrieben. Jede Kennung (`id`) ist stabil — sie steht in den abgelegten
 * Rundenprotokollen und darf sich nie umbenennen, sonst zeigt eine alte
 * Partie auf nichts.
 */

/** Eine Frage aus dem Allgemeinwissen mit genau vier Antworten. */
export interface QuizFrage {
  readonly id: string;
  readonly frage: string;
  readonly antworten: readonly [string, string, string, string];
  /** Stelle der richtigen Antwort in `antworten`. */
  readonly richtig: 0 | 1 | 2 | 3;
}

/**
 * Ein Wort fuer Imposter.
 *
 * Alle Mitspieler bekommen `wort`, der Imposter nur den `hinweis` — eine
 * grobe Kategorie statt eines Nachbarworts. Der Imposter soll WISSEN, dass
 * er es ist, und trotzdem mitreden koennen: Der Hinweis ist so allgemein,
 * dass er das Wort nicht verraet, aber konkret genug fuer einen
 * glaubwuerdigen Satz in der Runde.
 */
export interface ImposterWort {
  readonly id: string;
  readonly wort: string;
  readonly hinweis: string;
}

/** Eine Person oder Figur fuer "Wer bin ich". */
export interface Identitaet {
  readonly id: string;
  readonly name: string;
}

/** Ein Spruch fuer "Ich hab noch nie" bzw. "Wer wuerde eher". */
export interface Spruch {
  readonly id: string;
  readonly text: string;
}

/** Eine Schaetzfrage mit Zahlantwort. `einheit` nur zur Anzeige. */
export interface SchaetzFrage {
  readonly id: string;
  readonly frage: string;
  readonly antwort: number;
  readonly einheit: string;
}

/** Zwei Moeglichkeiten fuer "Entweder-oder" — die Minderheit trinkt. */
export interface EntwederOder {
  readonly id: string;
  readonly a: string;
  readonly b: string;
}

/** Eine Aufgabe fuer "Wahrheit oder Pflicht". */
export interface Aufgabe {
  readonly id: string;
  readonly art: 'wahrheit' | 'pflicht';
  readonly text: string;
}
