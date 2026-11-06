import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „regeln-poker": Regelsatz-Meldungen von Poker (easypoker). Gegenstück zu `de/regeln-poker.ts`. */
export default {
  'ruleset.blindZuKlein': 'The small blind must be at least 1.',
  'ruleset.grosserBlindZuKlein': 'The big blind must be higher than the small blind.',
  'ruleset.stapelZuKlein': 'Too few chips - you need at least ten big blinds.',
  'ruleset.stapelZuGross': "The table doesn't hand out that many chips (100,000 at most).",
} satisfies Woerterbuch;
