import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „tisch" — Gegenstück zu `de/tisch.ts`.
 *
 * Die Spielarten des Doppelkopfs behalten ihren deutschen Namen (Hochzeit,
 * Armut, Kreuz-Solo, Damensolo …) und bekommen eine kurze englische
 * Erklärung in Klammern. Grund: Wer mit Deutschen spielt oder deutsche
 * Regeln liest, begegnet genau diesen Wörtern; eine Eigenübersetzung
 * („Marriage", „Poverty") wäre am Tisch ein zweiter Name für dieselbe Sache.
 */
export default {
  'phase.vorbehalt': 'Reservations',
  'phase.armutExchange': 'Armut',
  'phase.playing': 'Tricks',
  'phase.finished': 'Scored',
  'phase.redeal': 'Redeal',
  // Zauberer
  'phase.trump': 'Choosing trump',
  'phase.bidding': 'Bidding',

  'spielart.normal': 'Normal game',
  'spielart.hochzeit': 'Hochzeit (marriage)',
  'spielart.armut': 'Armut (poverty)',
  'spielart.solo.suitC': 'Kreuz-Solo (clubs are trump)',
  'spielart.solo.suitS': 'Pik-Solo (spades are trump)',
  'spielart.solo.suitH': 'Herz-Solo (hearts are trump)',
  'spielart.solo.suitD': 'Karo-Solo (diamonds are trump)',
  'spielart.solo.queens': 'Damensolo (only queens are trump)',
  'spielart.solo.jacks': 'Bubensolo (only jacks are trump)',
  'spielart.solo.fleshless': 'Fleischlos (no trumps)',

  'tisch.verbindung.stellt': 'Reconnecting…',
  'tisch.verbindung.keine': 'No connection',
  'tisch.verbindung.verbinde': 'Connecting…',
  'tisch.verbindung.neu': 'Reconnect',
  'tisch.laedt': 'Loading table…',
  'tisch.zurueck': 'Back',
  'tisch.schliessen': 'Close',
  'tisch.regelnAnsehen': 'View table rules',
  'tisch.bot': 'Bot',
  'tisch.botNummer': 'Bot {nummer}',
  'tisch.frei': 'open',
  'tisch.ausgestiegen': 'left',
  'tisch.stichzahl': '{anzahl} tricks won',
  'tisch.vorgemerkt': 'Queued',
  'tisch.sticht': 'Trump',
  'tisch.gast': 'A guest is playing - this game does not count for the leaderboard.',

  'tisch.letzterStich': 'Last trick',
  'tisch.letzterStich.an': 'Won by {name}.',

  'tisch.regeln.titel': 'Rules at this table',
  'tisch.regeln.fehler': 'The rules could not be loaded.',
  'tisch.regeln.keine': 'No special rules. The basic game applies.',
  'tisch.regeln.an': '{an} of {gesamt} rules on.',

  'tisch.botStaerke': 'Bot strength',
  'tisch.botStaerke.hinweis': 'Applies to all bots at this table.',
  'tisch.botStufe.anfaenger': 'Beginner',
  'tisch.botStufe.standard': 'Standard',
  'tisch.botStufe.experte': 'Expert',
  'tisch.botStufe.genie': 'Genius',
  'tisch.botStufe.standard.text':
    'Solid club player: plays aces early, holds on to trumps, feeds points to the partner. Never announces.',
  'tisch.botStufe.experte.text':
    'Draws trumps with a strong hand and calls Re or Kontra when the hand is good enough.',
  'tisch.botStufe.genie.text':
    'Keeps track of what has been played and picks the card most likely to win. Really strong.',

  'tisch.warten.titel': 'Waiting for players',
  'tisch.warten.voll': 'All seats taken, starting shortly…',
  'tisch.warten.nochEiner': 'One more player · {runden} rounds',
  'tisch.warten.nochMehr': '{anzahl} more players · {runden} rounds',
  'tisch.warten.botSetzen': '+ Bot',
  'tisch.warten.botSetztSich': 'Bot is sitting down…',
  'tisch.warten.botEntfernen': 'remove',
  'tisch.warten.botStehtAuf': 'Bot is leaving…',
  'tisch.warten.hinweisOeffentlich':
    'Others will find the table in the lobby - or fill open seats with bots. The game starts as soon as every seat is taken.',
  'tisch.warten.hinweisPrivat':
    'The host lets in whoever wants to join - open seats can also be filled with bots. The game starts as soon as every seat is taken.',

  'tisch.ende.titel': 'Game over',
  'tisch.ende.runden': '{runden} rounds played.',
  'tisch.ende.platz': 'Place {platz}',
  'tisch.ende.trophaeen': 'Trophies',
  'tisch.ende.gewertet': 'Trophies have been credited. Your total is in your profile.',
  'tisch.ende.ungewertet': 'No trophies: tables with bots are not ranked.',
  'tisch.ende.zurLobby': 'Back to the lobby',

  'tisch.zuruf': 'Shout',
  'tisch.zuruf.gesperrt': 'Locked shouts are available in the shop.',

  'tisch.anfragen': 'Join requests',
  'tisch.anfragen.titel': 'Want to join',
  'tisch.anfragen.zusagen': 'Accept',
  'tisch.anfragen.ablehnen': 'Decline',
  'tisch.anfragen.fehler': 'That did not work.',
  'tisch.anfrage.gesendet': 'Request sent',
  'tisch.anfrage.leiderNicht': 'Not this time',
  'tisch.anfrage.privat': '{spiel} · private table',
  'tisch.anfrage.zurueckziehen': 'Withdraw request',
  'tisch.anfrage.warte': 'Waiting for approval',
  'tisch.anfrage.abgelehnt': 'Declined',
  'tisch.anfrage.gastgeber': 'The host',
  'tisch.anfrage.abgelehntText': '{wer} declined - or the table has filled up in the meantime.',
  'tisch.anfrage.warteText': '{wer} has to let you in. As soon as they accept, you go to the table.',
} satisfies Woerterbuch;
