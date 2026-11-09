import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „regeln-farbduell" — Gegenstück zu `de/regeln-farbduell.ts`. */
export default {
  'ruleset.farbzahlAusserhalb': 'Between 4 and 8 colors.',
  'ruleset.zuWenigFarben': "That few colors aren't enough for this board.",
  'ruleset.barrierenzahlAusserhalb': 'Between 0 and 20 walls per player.',
} satisfies Woerterbuch;
