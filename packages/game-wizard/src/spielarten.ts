/**
 * Die Spielarten von Zauberer — fertige Regelsaetze fuer den Einstieg
 * (Robin, 28.11.2026; `GameMeta.spielarten` in game-api). Die erste ist die
 * Vorgabe.
 *
 * „Profi" war mit zwei Hausregeln bestellt: Gebotssumme verboten UND
 * verdeckte Gebote. Beides zusammen weist `validateRuleSet` ab
 * (`hiddenBidsVsBidSum`): Verdeckt angesagt gibt es keinen letzten Ansager,
 * dem man eine Zahl verbieten koennte. Geblieben ist die Gebotssumme — die
 * Regel, die man gemeinhin mit „Profi" meint. Ob die verdeckten Gebote eine
 * eigene Spielart werden, ist offen.
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { DEFAULT_RULESET } from './ruleset.js';

export const SPIELARTEN: readonly Spielart[] = [
  // Normal: keine Hausregeln.
  spielartAus('normal', DEFAULT_RULESET),
  spielartAus('profi', DEFAULT_RULESET, { bidSumForbidden: true }),
  // Chaos: letzte Sonderkarte gewinnt, Narr bestimmt Trumpf, blinde erste Runde.
  spielartAus('chaos', DEFAULT_RULESET, {
    lastSpecialWins: true,
    jesterPicksTrump: true,
    blindFirstRound: true,
  }),
];
