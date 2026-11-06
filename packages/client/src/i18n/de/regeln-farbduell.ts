import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-farbduell": Regelnamen und Regelsatz-Meldungen —
 * Farbduell (game-filler).
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  'ruleset.farbzahlAusserhalb': 'Zwischen 4 und 8 Farben.',
  'ruleset.zuWenigFarben': 'So wenige Farben reichen für dieses Feld nicht.',
  'ruleset.barrierenzahlAusserhalb': 'Zwischen 0 und 20 Mauern je Spieler.',
} satisfies Woerterbuch;
