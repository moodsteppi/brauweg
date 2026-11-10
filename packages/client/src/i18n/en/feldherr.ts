import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „feldherr" — Gegenstück zu `de/feldherr.ts`. */
export default {
  'feldherr.stufe.leicht': 'Easy',
  'feldherr.stufe.normal': 'Normal',
  'feldherr.stufe.schwer': 'Hard',

  'feldherr.blatt.preis': 'Cost',
  'feldherr.blatt.leben': 'Health',
  'feldherr.blatt.schaden': 'Damage',
  'feldherr.blatt.reichweite': 'Range',
  'feldherr.blatt.schlag': 'Attack',
  'feldherr.blatt.schritt': 'Step',
  'feldherr.blatt.ertrag': 'Yield',
  'feldherr.blatt.laufzeit': 'Duration',
  'feldherr.blatt.stufe': 'Level',
  'feldherr.blatt.jePartie': '{n} per game',
  'feldherr.blatt.verschmelzen':
    'From level 2 on, it only comes from merging two identical cards – only level 1 can be bought.',
  'feldherr.blatt.zusammenspiel': 'Synergies',
  'feldherr.blatt.label': 'Stats: {name}',

  'feldherr.hand.hp': '{n} HP',
  'feldherr.hand.dmg': '{n} DMG',
  'feldherr.hand.rw': 'RNG {n}',

  'feldherr.fehler.erstellen': 'The table could not be created.',
  'feldherr.fehler.beitritt': 'Joining failed – the table may already be full.',

  'feldherr.warten.titel': 'Table',
  'feldherr.warten.unter': 'Feldherr · Real time · 2 players',
  'feldherr.zurueck': 'Back',
  'feldherr.zurueckPfeil': '‹ Back',
  'feldherr.warten.unerreichbar': 'The table cannot be reached.',
  'feldherr.warten.text': 'Waiting for the second commander…',
  'feldherr.warten.sitze': 'Seats',
  'feldherr.warten.sitz': 'Seat {n}',
  'feldherr.warten.frei': 'open',

  'feldherr.hinweis.verworfen': "Your move didn't go through – the table wasn't ready. Place it again.",
  'feldherr.hinweis.heilt': 'Restoring sync … the game fast-forwards briefly.',
  'feldherr.hinweis.stockt':
    "Waiting for your opponent … the game resumes once their device reports back.",
  'feldherr.ende.strittig':
    'The game is disputed: the devices reported different states. Nobody wins.',
  'feldherr.ende.aufgegeben': 'Your opponent resigned. You win.',
  'feldherr.ende.beendet': 'The game is over.',
  'feldherr.ende.zurueck': 'Back to selection',

  'feldherr.einstieg.unter': 'Real time · 2 players',
  'feldherr.einstieg.erstellen': 'Create table',
  'feldherr.einstieg.text':
    "Two commanders, one board, one center line. Whoever tears down the enemy's headquarters wins.",
  'feldherr.einstieg.online': 'Play online',
  'feldherr.einstieg.unbekannt': 'Unknown',
  'feldherr.einstieg.besetzt.eins': '{belegt} of {n} seat taken',
  'feldherr.einstieg.besetzt.mehr': '{belegt} of {n} seats taken',
  'feldherr.einstieg.beitreten': 'Join',
  'feldherr.einstieg.suche': 'Looking for tables …',
  'feldherr.einstieg.leer': 'Nobody is waiting right now. Create the first table.',
  'feldherr.einstieg.held': 'Who do you play?',
  'feldherr.einstieg.naechster': 'Next character',
  'feldherr.einstieg.bald': 'Soon',
  'feldherr.einstieg.einheiten': 'Units',
  'feldherr.einstieg.halten': 'Press and hold a card for all stats and synergies.',
  'feldherr.einstieg.ki': 'Against the AI',
  'feldherr.einstieg.staerke': 'AI strength',
  'feldherr.einstieg.uebung': 'Start practice game',

  'feldherr.muenze.titel': 'Coin toss',
  'feldherr.muenze.fliegt': 'The coin is in the air …',
  'feldherr.muenze.zahl': 'Tails',
  'feldherr.muenze.kopf': 'Heads',
  'feldherr.muenze.duWaehlst': 'You choose',
  'feldherr.muenze.gegnerWaehlt': 'Your opponent chooses',
  'feldherr.muenze.spielerWaehlt': 'Player {n} chooses',
  'feldherr.muenze.duZuerst': 'You place first',
  'feldherr.muenze.gegnerZuerst': 'Your opponent places first',
  'feldherr.muenze.spielerZuerst': 'Player {n} places first',
} satisfies Woerterbuch;
