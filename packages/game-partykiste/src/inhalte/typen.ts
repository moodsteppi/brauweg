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
 * Ein Wortpaar fuer Imposter.
 *
 * Alle Mitspieler bekommen `wort`, der Imposter das aehnliche `falsch`. Ein
 * aehnliches Wort statt gar keinem ist Absicht: Wer nichts hat, schweigt oder
 * redet ins Blaue und ist in der ersten Runde ueberfuehrt. Wer ein Nachbarwort
 * hat, kann mitreden und merkt selbst erst spaet, dass er der Falsche ist.
 */
export interface ImposterWort {
  readonly id: string;
  readonly wort: string;
  readonly falsch: string;
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
