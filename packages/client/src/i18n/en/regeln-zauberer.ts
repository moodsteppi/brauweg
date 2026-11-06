import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „regeln-zauberer" — Gegenstück zu
 * `de/regeln-zauberer.ts`. Die Sonderkarten heißen „Mage" und „Fool"
 * (`en/karten-zauberer.ts`), nie „Wizard"/„Jester" — Begründung dort.
 */
export default {
  // Wer zuletzt einen Mage (bzw. lauter Fools) legt, nimmt den Stich.
  'regel.lastSpecialWins': 'Last special card wins',
  'regel.bidSumForbidden': "Bids can't add up",
  'regel.zeroBonus': 'Bonus for a zero bid',
  'regel.hiddenBids': 'Hidden bids',
  'regel.blindFirstRound': 'Blind first round',
  // Der Geber nennt Trumpf, BEVOR er seine Hand ansieht.
  'regel.dealerPicksBlind': 'Dealer picks trump unseen',
  'regel.noTrump': 'No trump',
  'regel.jesterPicksTrump': 'Fool: dealer picks',

  'ruleset.noTrumpVsJesterPicks': 'Without trump there is nothing to pick.',
  'ruleset.noTrumpVsDealerPicks': 'Without trump there is nothing to pick.',
  'ruleset.hiddenBidsVsBidSum': 'With hidden bids there is no last bidder.',
} satisfies Woerterbuch;
