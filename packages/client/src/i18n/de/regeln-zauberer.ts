import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-zauberer": Regelnamen und Regelsatz-Meldungen —
 * Zauberer.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  // Hausregeln des Zauberers.
  'regel.lastSpecialWins': 'Der letzte sticht',
  'regel.bidSumForbidden': 'Es darf nicht aufgehen',
  'regel.zeroBonus': 'Bonus für angesagte Null',
  'regel.hiddenBids': 'Verdeckt ansagen',
  'regel.blindFirstRound': 'Blinde erste Runde',
  'regel.dealerPicksBlind': 'Geber wählt blind',
  'regel.noTrump': 'Trumpffrei',
  'regel.jesterPicksTrump': 'Narr: Geber wählt',

  // Meldungen des Zauberer-Regelsatzes.
  'ruleset.noTrumpVsJesterPicks': 'Ohne Trumpf gibt es nichts zu wählen.',
  'ruleset.noTrumpVsDealerPicks': 'Ohne Trumpf gibt es nichts zu wählen.',
  'ruleset.hiddenBidsVsBidSum': 'Verdeckt angesagt gibt es keinen letzten Ansager.',
} satisfies Woerterbuch;
