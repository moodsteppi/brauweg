import type { Woerterbuch } from '../woerterbuch';

/** English texts, area "regeln-mememory" — same keys as `de/regeln-mememory.ts`. */
export default {
  'ruleset.ungeradeKartenzahl': 'The board needs an even number of cards - otherwise one card has no pair.',
  'ruleset.merkzeitAusserhalb': 'The memorising time is between 0.3 and 5 seconds.',
  'ruleset.zuWenigMotive': 'There are not enough motifs for this board.',
  'ruleset.zusatzUngueltig': 'The list of custom motifs cannot be read.',
  'ruleset.botStufeUngueltig': 'This strength does not exist.',
} satisfies Woerterbuch;
