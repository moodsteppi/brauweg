import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „cambio": der Cambio-Tisch. Gegenstück zu `de/cambio.ts`. */
export default {
  'cambio.verbinde': 'Connecting to the table…',
  'cambio.neueRunde': 'New round…',
  'cambio.zurueck': 'Back',
  'cambio.runde': 'Round {nr} / {von}',

  'cambio.stapel.verdeckt.eins': 'Draw pile, {n} card',
  'cambio.stapel.verdeckt.mehr': 'Draw pile, {n} cards',
  'cambio.stapel.offen': 'Discard pile',
  'cambio.gezogen': 'Drawn',
  'cambio.platz.verdeckt': 'Face-down slot {nr}',

  'cambio.ruf.offen.eins': '{name} called - one turn left',
  'cambio.ruf.offen.mehr': '{name} called - {n} turns left',
  'cambio.tag.fertig': 'done',

  'cambio.punkte.eins': '{n} point',
  'cambio.punkte.mehr': '{n} points',

  'cambio.phase.aufgedeckt': 'Revealed',
  'cambio.phase.duAmZug': 'Your turn',
  'cambio.phase.andereAmZug': "Another player's turn",
  'cambio.phase.turn': 'Draw, take or call Cambio',
  'cambio.phase.decide': 'Swap or discard',

  'cambio.aktion.peekOwn': 'Look at one of your cards',
  'cambio.aktion.peekOther': "Look at another player's card",
  'cambio.aktion.blindSwap': 'Swap two cards blind',
  'cambio.aktion.lookAndSwap.entscheiden': 'Swap or pass',

  'cambio.knopf.rufen': 'Call Cambio',
  'cambio.knopf.abwerfen': 'Discard',
  'cambio.knopf.nichtTauschen': "Don't swap",
  'cambio.hinweis.turn': 'Tap the pile to draw, or one of your slots for the face-up card',
  'cambio.hinweis.decide': 'or tap one of your slots to swap',

  'cambio.blind.erste': 'Tap the two cards you want to swap',
  'cambio.blind.zweite': 'First card chosen, now tap the second',
  'cambio.blind.zurueck': 'Undo selection',

  'cambio.zurufe.titel': 'Emotes',
  'cambio.zurufe.text': 'More emotes are in the shop.',
  'cambio.allesKlar': 'Got it',

  'cambio.blatt.rufGut': '{name} called Cambio and was ahead: zero points.',
  'cambio.blatt.rufSchlecht': '{name} called Cambio and missed: penalty points.',
  'cambio.blatt.statt': '(instead of {n})',
  'cambio.blatt.gesamt': 'Overall',
  'cambio.blatt.wenigIstGut': 'Low is good. Whoever has the fewest points at the end wins.',
  'cambio.weiter': 'Continue',
} satisfies Woerterbuch;
