import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „filler" — Gegenstück zu `de/filler.ts`. */
export default {
  // Die vier Spielarten: Name auf der Kachel, Satz darunter.
  'filler.spielart.nebel': 'Fog',
  'filler.spielart.nebel.text': 'You only see your territory and its edge.',
  'filler.spielart.klar': 'Normal',
  'filler.spielart.klar.text': 'The whole board is open – just like the original.',
  'filler.spielart.build': 'Build',
  'filler.spielart.build.text':
    'Open board plus ten walls per player – one per turn, and you still get to color afterwards.',
  'filler.spielart.extreme': 'Extreme',
  'filler.spielart.extreme.text':
    'Build on a large board (12 × 11): seven colors, eight stars and twenty walls, up to two per turn.',
  'filler.spielart.wischen': '← swipe to switch →',

  // Menü und Suche
  'filler.fehler.suche': 'The search failed. Try again?',
  'filler.fehler.sucheBeendet': 'The search has ended. Try again?',
  'filler.fehler.tisch': 'The table could not be opened. Try again?',
  'filler.spielerGerade.eins': '{n} player in {spiel} right now',
  'filler.spielerGerade.mehr': '{n} players in {spiel} right now',
  'filler.suche.titel': 'Finding an opponent',
  'filler.suche.abbrechen': 'Cancel search',
  'filler.suche.allein': "No one else yet – if it stays that way, you'll play against a bot.",
  'filler.suche.gefunden.eins': '{n} player found',
  'filler.suche.gefunden.mehr': '{n} players found',
  'filler.abbrechen': 'Cancel',
  'filler.menue.unter': '2 players · {spielart}',
  'filler.zurueckZurSpielseite': 'Back to the game page',
  'filler.menue.suchen': 'Find online match…',
  'filler.menue.bot': 'Play against a bot',
  'filler.menue.text': 'Recolor your territory and swallow everything that borders it.',
  'filler.menue.spielart': 'Variant',
  'filler.menue.anleitung': 'How to play',
  'filler.menue.soSpieltMan': 'How to play {spiel}',
  'filler.menue.anleitungUnter': 'Rules and the four variants',
  'filler.aufbau.titel': 'Setting up the table',
  'filler.aufbau.besetzt': '{besetzt} of {sitze} seats taken',
  'filler.aufbau.verbindung': 'Connecting…',

  // Brett
  'filler.zurueck': 'Back',
  'filler.aufgeben': 'Resign',
  'filler.aufgeben.frage': 'Resign?',
  'filler.aufgeben.text': 'You will lose the game.',
  'filler.mauer': 'Wall',
  'filler.mauer.pause': 'Pause',
  'filler.mauer.zwischen': 'Wall between square {a} and {b}',
  'filler.mauer.gesperrt.eins': 'Walls locked for {n} more turn',
  'filler.mauer.gesperrt.mehr': 'Walls locked for {n} more turns',
  'filler.mauer.pauseVorlesen': 'Wall pause after the double wall, {rest} walls left',
  'filler.mauer.bauenDoppel': 'Build a wall, {rest} left, {zug} more this turn',
  'filler.mauer.bauen': 'Build a wall, {rest} left',
  'filler.farbe': 'Color {n}',
  'filler.hinweis.pause': 'After the double wall: color only',
  'filler.hinweis.zweiteMauer': 'Pick a second wall or a color',
  'filler.hinweis.nochEineMauer': 'One more wall or a color',
  'filler.hinweis.kante': 'Tap an edge',
  'filler.hinweis.farbe': 'Pick a color',
  'filler.warten.bot': "Bot's turn",
  'filler.warten.mensch': 'Waiting for the other player',
  'filler.warten.vorlesen': ', please wait',
  'filler.spieler.du': 'You',
  'filler.spieler.ki': 'AI',
  'filler.spieler.gegner': 'Opponent',

  // Abschluss
  'filler.ende.unentschieden': 'Draw',
  'filler.ende.gewonnen': 'You won!',
  'filler.ende.verloren': 'You lost',
  'filler.ende.selbstAufgegeben': 'Resigned · ',
  'filler.ende.gegnerAufgegeben': 'Opponent resigned · ',
  'filler.ende.felder': '{meine} to {seine} squares',
  'filler.ende.punkte': '{meine} to {seine} points',

  // Anleitung
  'filler.regel.titel': 'Rules',
  'filler.regel.eckfeld': 'Each player starts with one corner square.',
  'filler.regel.faerben':
    'Taking turns, you recolor your territory in one of six colors (seven in Extreme) and take every adjacent square of that color with it.',
  'filler.regel.gegnerfarbe': "You can't pick your opponent's color.",
  'filler.regel.ende': 'The game ends when no square is left free.',
  'filler.regel.spielarten': 'The four variants',
  'filler.regel.klar': '<b>Normal</b> is the original: the whole board is open.',
  'filler.regel.nebel':
    '<b>Fog</b> only shows you your own territory and the squares directly next to it. Everything else stays grey – for your opponent too. Where an uncovered square touches their territory, there is a white edge.',
  'filler.regel.build':
    "<b>Build</b> is played on an open board, but gives each player ten walls. A wall stands between two squares and blocks both sides – you too. You may place one per turn and then color as usual; only coloring ends your turn. The first three turns of the game are wall-free – the lock on the button counts them down; building is allowed from the second player's second turn. And you can't wall in a square: an edge that would leave a free square unreachable for everyone can't be built on – every square stays up for grabs until the end. You can't lock in your opponent either.",
  'filler.regel.extreme':
    "<b>Extreme</b> is Build on a large board (12 × 11) with seven colors, eight star squares and twenty walls. A star is a normal square with a white star on it: whoever swallows it gets two points instead of one, plus an extra wall. You may place up to two walls in one turn – if you place two, you can't build on your next turn, only color. Here each player's first three turns are wall-free.",
  'filler.regel.ziel': 'Goal',
  'filler.regel.zielText': 'Whoever holds the most squares at the end wins – in Extreme, the most points.',
} satisfies Woerterbuch;
