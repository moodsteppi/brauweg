import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „regeln-brocooked" — Gegenstück zu `de/regeln-brocooked.ts`. */
export default {
  // Meldungen des BroCooked-Regelsatzes.
  'brocooked.regelnUnbekannt': 'The rule set is missing or damaged.',
  'brocooked.kuechenLeer': 'At least one kitchen must be included.',
  'brocooked.kuecheUngueltig': 'This kitchen does not exist.',
  'brocooked.rundeTakteUngueltig': 'A shift lasts between 10 seconds and 10 minutes.',
  'brocooked.sitzzahl': 'One to four cooks work in the kitchen.',
  'brocooked.runden': 'Between one and six shifts per game.',
} satisfies Woerterbuch;
