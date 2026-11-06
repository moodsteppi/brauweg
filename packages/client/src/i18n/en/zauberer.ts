import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „zauberer" — Gegenstück zu `de/zauberer.ts`.
 *
 * Das Spiel heißt auf Englisch NICHT „Wizard" (eingetragene Marke, siehe
 * `game.wizard` in `de/spiele.ts`), die Sonderkarten deshalb „Mage" und
 * „Fool" (`en/karten-zauberer.ts`). Wo ein Text die Karte nennt, steht
 * derselbe Name.
 */
export default {
  'zauberer.laden': 'Loading table…',
  'zauberer.verbinde': 'Connecting…',
  'zauberer.zurueck': 'Back',
  'zauberer.verlassen': 'Leave table',
  'zauberer.runde': 'Round {nr} / {gesamt}',
  'zauberer.pausiert': 'Paused',
  'zauberer.zuschauer': 'Spectator',
  'zauberer.fortsetzenKnopf': 'Resume table',
  'zauberer.pausierenKnopf': 'Pause table',
  'zauberer.tafelKnopf': 'View score sheet',
  'zauberer.letzterKnopf': 'View last trick',
  'zauberer.regelnKnopf': 'View table rules',
  'zauberer.kleiner': 'Smaller cards',
  'zauberer.groesser': 'Larger cards',

  'zauberer.zwischenRunden': 'Between rounds',
  'zauberer.karten.eins': '{n} card',
  'zauberer.karten.mehr': '{n} cards',
  'zauberer.keinTrumpf': 'no trump',
  'zauberer.ohneTrumpf': 'no trump',
  'zauberer.trumpf': 'Trump',
  'zauberer.trumpfFarbe': 'Trump: {farbe}',
  'zauberer.summeAuf': '{summe} bid for {n}',
  'zauberer.deineKarten': 'Your cards',
  'zauberer.nichtAngesagt': 'No bid yet',
  'zauberer.gebot': 'Bid {n}',
  'zauberer.stiche.eins': '{n} trick',
  'zauberer.stiche.mehr': '{n} tricks',
  'zauberer.fehlt': '{n} to go',
  'zauberer.genau': 'spot on',
  'zauberer.zuViel': '{n} too many',
  'zauberer.du': 'You',
  'zauberer.aufspiel': 'Lead',

  'zauberer.letzterStichAn': 'Last trick to {name}',
  'zauberer.keineKarten': 'No cards in hand.',
  'zauberer.blindHinweis': "You can't see your own card, only everyone else's.",
  'zauberer.blindLegen': 'Play your face-down card',
  'zauberer.geber': 'Dealer',
  'zauberer.ausgestiegen': 'left',
  'zauberer.botUebernimmt': 'Bot playing',

  'zauberer.zuruf.titel': "You don't have this emote yet",
  'zauberer.zuruf.text':
    'Get it for coins in the shop under "Emotes". You can then use it at every table.',
  'zauberer.weiterSpielen': 'Keep playing',

  'zauberer.pause.titel': 'Table paused',
  'zauberer.pause.text':
    'The turn timer is stopped. Anyone at the table can resume - ideal for clan tables spread over several evenings.',
  'zauberer.fortsetzen': 'Resume',

  'zauberer.ansage.titel': 'How many tricks will you take?',
  'zauberer.ansage.verdeckt':
    "Hidden bids: you'll see the other numbers once everyone has bid.",
  'zauberer.ansage.zuerst.eins': '{n} trick to play for. You bid first.',
  'zauberer.ansage.zuerst.mehr': '{n} tricks to play for. You bid first.',
  'zauberer.ansage.bisher': 'Bids so far: {liste}',
  'zauberer.ansage.summe': ', total {summe} of {n}',
  'zauberer.ansage.gesperrt': 'The bids would add up exactly',
  'zauberer.ansage.sendet': 'Bidding…',
  'zauberer.ansage.waehlen': 'Pick a number',
  'zauberer.ansage.knopf': 'Bid {n}',

  'zauberer.trumpfwahl.titel': 'You choose trump',
  'zauberer.trumpfwahl.text': 'A Mage was turned up, so you pick the suit.',

  'zauberer.abgerechnet': 'Round {nr} scored',
  'zauberer.spalte.spieler': 'Player',
  'zauberer.spalte.gebot': 'Bid',
  'zauberer.spalte.stiche': 'Tricks',
  'zauberer.spalte.punkte': 'Points',
  'zauberer.spalte.gesamt': 'Total',
  'zauberer.spalte.runde': 'Rd.',
  'zauberer.weiter': 'Continue',
  'zauberer.tafel.titel': 'Score sheet',
  'zauberer.tafel.leer': 'No rounds scored yet.',
  'zauberer.schliessen': 'Close',
} satisfies Woerterbuch;
