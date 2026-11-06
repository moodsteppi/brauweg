import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „skat" — Gegenstück zu `de/skat.ts`.
 *
 * Die Skat-Fachwörter (Grand, Null, Hand, Schneider, Schwarz, Ouvert, Kontra,
 * Re, Ramsch) bleiben deutsch — so heißen sie auch an englischsprachigen
 * Skattischen. Was sie bedeuten, sagen die `skat.erklaerung.*`-Zeilen.
 * „Augen" sind „card points", „Gabe" ist „deal" (nicht „hand": Hand ist hier
 * ein Fachwort und heißt etwas anderes).
 */
export default {
  'skat.spiel.grand': 'Grand',
  'skat.spiel.saechsisch': 'Saxon Spitze',
  'skat.spiel.saechsischKurz': 'Saxon',
  'skat.spiel.null': 'Null',
  'skat.spiel.ramsch': 'Ramsch',
  'skat.spiel.farbe': 'Suit',
  'skat.patrouille.schwarz': 'Black patrol',
  'skat.patrouille.rot': 'Red patrol',

  'skat.erklaerung.farbe': 'Suit game: the jacks and the chosen suit are trumps.',
  'skat.erklaerung.grand': 'Grand: only the four jacks are trumps.',
  'skat.erklaerung.saechsisch':
    'Like Grand, but the order is reversed: the jack of diamonds is the highest trump, the seven beats the ace. Base value 20.',
  'skat.erklaerung.null': 'Null: no trumps, and you must not take a single trick.',
  'skat.erklaerung.hand': 'Hand: play without picking up the skat — worth one level more.',
  'skat.erklaerung.zusatz':
    'Schneider: opponents under 31 points · Schwarz: opponents take no trick · Ouvert: cards face up.',

  'skat.zurueck': 'Back',
  'skat.gabe': 'Deal {nummer} / {gesamt}',
  'skat.bock': ' · Bock ×{faktor}',
  'skat.pausiert': 'Paused',
  'skat.fortsetzen': 'Resume',
  'skat.pausieren': 'Pause',
  'skat.tischFortsetzen': 'Resume table',
  'skat.tischPausieren': 'Pause table',
  'skat.letzterStich': 'View last trick',
  'skat.regeln': 'View table rules',
  'skat.kleiner': 'Smaller cards',
  'skat.groesser': 'Larger cards',

  'skat.verbinde': 'Connecting to the table…',
  'skat.neueGabe': 'New deal…',
  'skat.bot': 'Bot {nummer}',
  'skat.geber': 'Dealer',
  'skat.spieler': 'Declarer',
  'skat.punkteAugen': '{punkte} points · {augen} card points',
  'skat.keineKarten': 'No cards in hand.',
  'skat.offen': 'Face up:',

  'skat.gereizt': ' · bid to {wert}',
  'skat.reizen': 'Bidding',
  'skat.reizenStand': 'Bidding · at {wert}',
  'skat.kontra': 'Kontra',
  'skat.re': 'Re',
  'skat.hirsch': 'Hirsch',
  'skat.blind': 'Blind ×{faktor}',

  'skat.phase.vorbei': 'Scored',
  'skat.phase.reizenDu': 'Your bid',
  'skat.phase.reizen': 'Bidding in progress',
  'skat.phase.schieben': 'The skat is being passed on',
  'skat.phase.schiebenWeiter': 'Pass two cards on',
  'skat.phase.schiebenWahl': 'Pick up the skat or pass it on blind',
  'skat.phase.skatDu': 'Pick up the skat or play Hand',
  'skat.phase.skat': 'The declarer decides on the skat',
  'skat.phase.drueckenDu': 'Discard two cards',
  'skat.phase.druecken': 'The declarer is discarding',
  'skat.phase.ansageDu': 'Announce your game',
  'skat.phase.ansage': 'The declarer is announcing',
  'skat.phase.stichDu': 'Your turn',
  'skat.phase.stich': "Another player's turn",

  'skat.weiter': 'Continue',
  'skat.skatAufnehmen': 'Pick up skat',
  'skat.blindSchieben': 'Pass on blind (×2)',
  'skat.weiterschieben': 'Pass on',
  'skat.handSpielen': 'Play Hand',
  'skat.druecken': 'Discard',
  'skat.zweiGewaehlt': 'Two cards selected',
  'skat.fehlen.eins': 'Select {n} more card',
  'skat.fehlen.mehr': 'Select {n} more cards',
  'skat.ansagen': 'Announce',

  'skat.reiz.spielNehmen': 'Take the game (18)',
  'skat.reiz.halten': 'Hold {wert}',
  'skat.reiz.sagen': 'Bid {wert}',
  'skat.reiz.weg': 'Pass',
  'skat.reiz.rechner': 'Calculator',
  'skat.reiz.hoeher':
    'Bidding higher means playing Hand, Schneider or Schwarz — or overbidding.',
  'skat.reiz.festerWert': 'fixed value',
  'skat.reiz.mit': 'with {spitzen} · ×{grundwert}',
  'skat.reiz.ohne': 'without {spitzen} · ×{grundwert}',

  'skat.zurufe': 'Shouts',
  'skat.zurufe.shop': 'More shouts are available in the shop.',
  'skat.zurufe.ok': 'Got it',

  'skat.ergebnis.durchmarsch': 'Durchmarsch (all tricks) by {name}.',
  'skat.ergebnis.augenreichster': 'The player with the most card points pays.',
  'skat.ergebnis.jungfrau': 'Jungfrau: {namen} - without a single trick, that doubles it.',
  'skat.ergebnis.blind': 'Passed on blind: ×{faktor}.',
  'skat.ergebnis.gewonnen': '{name} won',
  'skat.ergebnis.verloren': '{name} lost',
  'skat.ergebnis.ueberreizt': ' (overbid)',
  'skat.ergebnis.schwarz': ' · schwarz',
  'skat.ergebnis.schneider': ' · Schneider',
  'skat.ergebnis.patrouillen.eins': ' · {n} patrol',
  'skat.ergebnis.patrouillen.mehr': ' · {n} patrols',
  'skat.ergebnis.augen': '{augen} card points, game value {wert}.',
  'skat.gesamtstand': 'Overall standings',
} satisfies Woerterbuch;
