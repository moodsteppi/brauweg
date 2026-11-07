import type { Woerterbuch } from '../woerterbuch';

/** English texts, area "regeln-brochess" — same keys as `de/regeln-brochess.ts`. */
export default {
  'ruleset.bedenkzeit': 'The thinking time must be between 20 seconds and 3 hours.',
  'ruleset.zuschlag': 'The increment needs a thinking time and may be at most 60 seconds.',
  'ruleset.modus': 'This game mode does not exist in BroChess.',
  'ruleset.schachDurchVerdeckte': 'Secret Queen only has Rule A or Rule B.',
} satisfies Woerterbuch;
