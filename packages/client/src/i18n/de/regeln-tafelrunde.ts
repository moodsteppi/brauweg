import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-tafelrunde": Regelnamen und Regelsatz-Meldungen —
 * Tafelrunde.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  // Tafelrunde meldet alle sechs Zahlen des Regelsatzes ueber DIESEN einen
  // Schluessel, deshalb steht hier kein Zahlenbereich: Welches Feld gemeint
  // ist, sagt der Regelsatz-Editor ueber `path`.
  'ruleset.wertAusserhalb': 'Dieser Wert liegt außerhalb des erlaubten Bereichs.',
} satisfies Woerterbuch;
