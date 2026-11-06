import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „eiland" — Gegenstück zu `de/eiland.ts`. */
export default {
  // Menü und Suche
  'eiland.fehler.suche': 'The search failed. Try again?',
  'eiland.fehler.sucheBeendet': 'The search has ended. Try again?',
  'eiland.fehler.tisch': 'The table could not be opened. Try again?',
  'eiland.spielerGerade.eins': '{n} player in Eiland right now',
  'eiland.spielerGerade.mehr': '{n} players in Eiland right now',
  'eiland.suche.titel': 'Finding an opponent',
  'eiland.suche.unter': 'Eiland · Online match',
  'eiland.suche.abbrechen': 'Cancel search',
  'eiland.suche.allein': "No one else yet – if it stays that way, you'll play against the AI.",
  'eiland.suche.gefunden.eins': '{n} player found',
  'eiland.suche.gefunden.mehr': '{n} players found',
  'eiland.abbrechen': 'Cancel',
  'eiland.menue.unter': '2 players · you move at the same time',
  'eiland.zurueckZurSpielseite': 'Back to the game page',
  'eiland.menue.suchen': 'Find online match…',
  'eiland.menue.text':
    'Claim land, collect ornaments and beat the other player to it. You both move at the same time – and whoever wants the same field has to fight for it.',
  'eiland.ki.titel': 'Against the AI',
  'eiland.ki.hinweis': 'Choose the game mode here.',
  'eiland.ki.spielen': 'Play against the AI',
  'eiland.spielart': 'Game mode',
  'eiland.spielart.klar': 'Open map',
  'eiland.spielart.nebel': 'In the fog',
  'eiland.spielart.klar.text': 'The whole island lies open – for both of you.',
  'eiland.spielart.nebel.text': 'You see your territory and three fields beyond it.',
  'eiland.anleitung': 'How to play',
  'eiland.anleitung.titel': 'How to play Eiland',
  'eiland.anleitung.unter': 'Rules, ornaments, two game modes',

  // Tisch wird aufgebaut
  'eiland.aufbau.titel': 'Setting up the table',
  'eiland.aufbau.besetzt': '{besetzt} of {plaetze} seats taken',
  'eiland.aufbau.verbindung': 'Connecting…',

  // Karte
  'eiland.zurueck': 'Back',
  'eiland.runde.nebel': 'Fog · Round',
  'eiland.runde.offen': 'Open · Round',
  'eiland.einsatz.aria.eins': 'One field at stake',
  'eiland.einsatz.aria.mehr': '{n} fields at stake',
  'eiland.einsatz.text.eins': '{n} field at stake',
  'eiland.einsatz.text.mehr': '{n} fields at stake',
  'eiland.zugSteht': 'Your move is in.',
  'eiland.wartetAufGegner': 'Waiting for your opponent…',
  'eiland.offen.eins': 'One field left',
  'eiland.offen.mehr': '{n} fields left',
  'eiland.wirdGesendet': 'Sending…',
  'eiland.passen': 'Pass',
  'eiland.abgeben': 'Submit',
  'eiland.zuruecksetzen': 'Reset',

  // Felder für Vorlesegeräte
  'eiland.feld.unbekannt': 'Unknown field',
  'eiland.feld.wasser': 'Water',
  'eiland.feld.berg': 'Mountain',
  'eiland.feld.wiese': 'Meadow',
  'eiland.feld.frei': 'free',
  'eiland.feld.eigen': 'your territory',
  'eiland.feld.fremd': "opponent's territory",
  'eiland.feld.stadt': 'town',
  'eiland.feld.brunnen': 'well',
  'eiland.feld.bauStadt': 'with collected town',
  'eiland.feld.bauBrunnen': 'with collected well',

  // Spielerstand und Abschluss
  'eiland.du': 'You',
  'eiland.ki': 'AI',
  'eiland.gegner': 'Opponent',
  'eiland.jeRunde': '{n}/round',
  'eiland.unentschieden': 'Draw',
  'eiland.gewonnen': 'You won!',
  'eiland.verloren': 'You lost',
  'eiland.ergebnis': '{meine} to {seine} fields',

  // Regelblatt
  'eiland.regel.titel': 'Rules',
  'eiland.regel.start': 'Each player starts with one field in their corner of the island.',
  'eiland.regel.runde':
    'Each round you take one free meadow field bordering your territory – plus one more field for every ornament you have collected.',
  'eiland.regel.grenze':
    "Water and mountains belong to no one. You can't take your opponent's territory: that's where your border is.",
  'eiland.regel.gleichzeitig':
    "You both choose <b>at the same time</b>, without seeing the other's choice. If both want the same field, there's a fight for it – the odds are fifty-fifty. Whoever loses gets no further at that spot; fields behind it stay free.",
  'eiland.regel.einsatz':
    "Fields you <b>don't place</b> in a round are your stake: one of them flies onto each contested field. If only one of you has one, they win the field for sure; if both do, it's a coin toss again. Contested fields are resolved in random order until the stakes run out – the rest stays fifty-fifty.",
  'eiland.regel.ende': 'The game ends when no one can go anywhere anymore.',
  'eiland.regel.ornamente.titel': 'Ornaments',
  'eiland.regel.ornamente':
    'Towns and wells are scattered across the island. Whoever takes the field one stands on takes one more field per round from then on. There are always four on the map – for each one collected, a new one appears.',
  'eiland.regel.spielarten.titel': 'Two game modes',
  'eiland.regel.spielarten':
    "<b>In the fog</b> you see your territory and three fields beyond it; everything else lies grey – for your opponent too. On the <b>open map</b> you both see the whole island. What's on the other player's slip stays secret either way.",
  'eiland.regel.ziel.titel': 'Goal',
  'eiland.regel.ziel': 'Whoever holds the most fields at the end wins.',
} satisfies Woerterbuch;
