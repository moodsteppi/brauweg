import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-cambio": Regelnamen und Regelsatz-Meldungen —
 * Cambio.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  // Hausregeln von Cambio.
  'regel.peekOwn': '7/8: Eigene ansehen',
  'regel.peekOther': '9/10: Fremde ansehen',
  'regel.blindSwap': 'Bube: Blind tauschen',
  'regel.lookAndSwap': 'Dame: Ansehen und tauschen',
  'regel.redKingZero': 'Roter König zählt null',
  'regel.peekTwoAtStart': 'Zwei Karten zu Beginn ansehen',
  'regel.callerMustBeStrictlyLower': 'Gleichstand lässt den Ruf misslingen',
  'regel.failPenalty': 'Strafpunkte bei misslungenem Ruf',

  // Meldungen des Cambio-Regelsatzes.
  'ruleset.noActionCards': 'Ohne Aktionskarten bleibt wenig zu entscheiden.',
  'ruleset.noWayToLearnOwnCards': 'So sieht niemand je seine eigenen Karten.',
  'ruleset.freeCall': 'Ohne Strafe ruft man immer sofort.',
  'ruleset.failPenaltyOutOfRange': 'So viele Strafpunkte gehen nicht.',
} satisfies Woerterbuch;
