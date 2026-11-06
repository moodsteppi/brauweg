import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-brochess": Regelnamen und Regelsatz-Meldungen —
 * BroChess.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  'ruleset.bedenkzeit': 'Die Bedenkzeit muss zwischen 20 Sekunden und 3 Stunden liegen.',
  'ruleset.zuschlag': 'Der Zuschlag braucht eine Bedenkzeit und darf höchstens 60 Sekunden betragen.',
  'ruleset.modus': 'Diese Spielart gibt es bei BroChess nicht.',
  'ruleset.schachDurchVerdeckte': 'Für Secret Dame gibt es nur Regel A oder Regel B.',
} satisfies Woerterbuch;
