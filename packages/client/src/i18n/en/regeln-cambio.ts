import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „regeln-cambio": Hausregeln und Regelsatz-Meldungen von Cambio. Gegenstück zu `de/regeln-cambio.ts`. */
export default {
  'regel.peekOwn': '7/8: Peek at your own',
  'regel.peekOther': "9/10: Peek at someone else's",
  'regel.blindSwap': 'Jack: Blind swap',
  'regel.lookAndSwap': 'Queen: Look and swap',
  'regel.redKingZero': 'Red king counts zero',
  'regel.peekTwoAtStart': 'Peek at two cards at the start',
  'regel.callerMustBeStrictlyLower': 'A tie makes the call fail',
  'regel.failPenalty': 'Penalty points for a failed call',

  'ruleset.noActionCards': "Without action cards there's little left to decide.",
  'ruleset.noWayToLearnOwnCards': 'This way nobody ever gets to see their own cards.',
  'ruleset.freeCall': "Without a penalty you'd always call right away.",
  'ruleset.failPenaltyOutOfRange': "That many penalty points aren't possible.",
} satisfies Woerterbuch;
