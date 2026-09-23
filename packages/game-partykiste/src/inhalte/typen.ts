/**
 * Formen der Spielinhalte.
 *
 * Inhalte sind DATEN, keine Regeln: Wer eine Frage ergaenzt, aendert keine
 * Zeile Ablauf. Deshalb liegen sie in eigenen Dateien und sind hier nur
 * beschrieben. Jede Kennung (`id`) ist stabil — sie steht in den abgelegten
 * Rundenprotokollen und darf sich nie umbenennen, sonst zeigt eine alte
 * Partie auf nichts.
 *
 * Seit dem 22.09.2026 tragen Inhalte METADATEN (Haerte, Paket, Sitzzahl,
 * Schwierigkeit). Alle sind optional, und das ist keine Bequemlichkeit: 918
 * Eintraege waren an dem Tag schon da, und jeder von ihnen muss ohne
 * Aenderung gueltig bleiben. Fehlt ein Feld, gilt die Vorgabe — harmlos, in
 * jedem Paket spielbar, ab vier Sitzen.
 */

// ---------------------------------------------------------------------------
// Metadaten
// ---------------------------------------------------------------------------

/**
 * Textschaerfe eines Inhalts: 1 harmlos, 2 pikant, 3 derb.
 *
 * Drei Stufen und keine Skala, weil am Tisch niemand zwischen "6" und "7"
 * unterscheidet. Ein Inhalt ohne Angabe ist harmlos — die Vorgabe ist die
 * sichere Seite, nicht die haeufigste.
 */
export type Haerte = 1 | 2 | 3;

/** Schwierigkeit bei Quiz und Schaetzen: 1 leicht, 2 mittel, 3 schwer. */
export type Schwierigkeit = 1 | 2 | 3;

/**
 * Die Themenpakete. Ein Paket ist eine ZIELGRUPPE, kein Motto: Wer "arbeit"
 * waehlt, sitzt mit Kollegen da und will nichts, was fuer den JGA gedacht
 * war. Inhalte ohne Paket sind Allgemeingut und spielen ueberall mit (siehe
 * `filter.ts`).
 *
 * Neue Pakete kommen hinten dazu; die Kennungen stehen in abgelegten
 * Regelsaetzen und aendern sich nie.
 */
export const PAKETE = ['wg-abend', 'jga', 'weihnachten', 'studenten', 'arbeit'] as const;
export type Paket = (typeof PAKETE)[number];

export function istPaket(x: unknown): x is Paket {
  return typeof x === 'string' && (PAKETE as readonly string[]).includes(x);
}

/** Was jeder Inhalt traegt — Kennung plus die Metadaten fuer den Filter. */
export interface Inhalt {
  readonly id: string;
  /** Textschaerfe. Fehlt = 1 (harmlos). */
  readonly haerte?: Haerte;
  /** Themenpakete, zu denen der Inhalt gehoert. Fehlt = Allgemeingut. */
  readonly paket?: readonly Paket[];
  /** Ab wie vielen Sitzen der Inhalt Sinn ergibt. Fehlt = immer. */
  readonly minSitze?: number;
}

// ---------------------------------------------------------------------------
// Die Inhaltsformen
// ---------------------------------------------------------------------------

/** Eine Frage aus dem Allgemeinwissen mit genau vier Antworten. */
export interface QuizFrage extends Inhalt {
  readonly frage: string;
  readonly antworten: readonly [string, string, string, string];
  /** Stelle der richtigen Antwort in `antworten`. */
  readonly richtig: 0 | 1 | 2 | 3;
  /** Schwierigkeit — noch ohne Regel, die danach filtert; steht fuer die Pflege bereit. */
  readonly stufe?: Schwierigkeit;
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
export interface ImposterWort extends Inhalt {
  readonly wort: string;
  readonly hinweis: string;
}

/** Eine Person oder Figur fuer "Wer bin ich". */
export interface Identitaet extends Inhalt {
  readonly name: string;
}

/** Ein Spruch fuer "Ich hab noch nie" bzw. "Wer wuerde eher". */
export interface Spruch extends Inhalt {
  readonly text: string;
}

/** Eine Schaetzfrage mit Zahlantwort. `einheit` nur zur Anzeige. */
export interface SchaetzFrage extends Inhalt {
  readonly frage: string;
  readonly antwort: number;
  readonly einheit: string;
  /** Schwierigkeit — siehe QuizFrage. */
  readonly stufe?: Schwierigkeit;
}

/** Zwei Moeglichkeiten fuer "Entweder-oder" — die Minderheit trinkt. */
export interface EntwederOder extends Inhalt {
  readonly a: string;
  readonly b: string;
}

/** Eine Aufgabe fuer "Wahrheit oder Pflicht". */
export interface Aufgabe extends Inhalt {
  readonly art: 'wahrheit' | 'pflicht';
  readonly text: string;
}
