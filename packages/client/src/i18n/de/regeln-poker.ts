import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-poker": Regelnamen und Regelsatz-Meldungen —
 * Poker (easypoker).
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  'ruleset.blindZuKlein': 'Der kleine Blind muss mindestens 1 betragen.',
  'ruleset.grosserBlindZuKlein': 'Der große Blind muss über dem kleinen liegen.',
  'ruleset.stapelZuKlein': 'Zu wenig Jetons - es braucht mindestens zehn große Blinds.',
  'ruleset.stapelZuGross': 'So viele Jetons vergibt der Tisch nicht (höchstens 100.000).',
} satisfies Woerterbuch;
