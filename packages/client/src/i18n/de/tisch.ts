import type { Woerterbuch } from '../woerterbuch';

/** Deutsche Texte, Bereich „tisch". Umgezogen aus dem alten i18n.ts, Wortlaut unverändert. */
export default {
  'phase.vorbehalt': 'Vorbehalte',
  'phase.armutExchange': 'Armut',
  'phase.playing': 'Stiche',
  'phase.finished': 'Abgerechnet',
  'phase.redeal': 'Neu geben',
  // Zauberer
  'phase.trump': 'Trumpf wird bestimmt',
  'phase.bidding': 'Ansagen',

  'spielart.normal': 'Normalspiel',
  'spielart.hochzeit': 'Hochzeit',
  'spielart.armut': 'Armut',
  'spielart.solo.suitC': 'Kreuz-Solo',
  'spielart.solo.suitS': 'Pik-Solo',
  'spielart.solo.suitH': 'Herz-Solo',
  'spielart.solo.suitD': 'Karo-Solo',
  'spielart.solo.queens': 'Damensolo',
  'spielart.solo.jacks': 'Bubensolo',
  'spielart.solo.fleshless': 'Fleischlos',

  /*
   * Die gemeinsamen Bausteine des Spieltisches (`tisch/`): Wartebereich,
   * Letzter Stich, Regelblatt, Partie-Ende, Beitrittsanfragen. Sie gelten für
   * JEDES Kartenspiel; standen bis zur englischen Fassung fest im Bildschirm.
   * Platzhalter in geschweiften Klammern füllt `tw()` (`../einsetzen.ts`).
   */
  'tisch.verbindung.stellt': 'Verbindung wird wiederhergestellt…',
  'tisch.verbindung.keine': 'Keine Verbindung',
  'tisch.verbindung.verbinde': 'Verbinde…',
  'tisch.verbindung.neu': 'Neu verbinden',
  'tisch.laedt': 'Tisch wird geladen…',
  'tisch.zurueck': 'Zurück',
  'tisch.schliessen': 'Schließen',
  'tisch.regelnAnsehen': 'Tischregeln ansehen',
  'tisch.bot': 'Bot',
  'tisch.botNummer': 'Bot {nummer}',
  'tisch.frei': 'frei',
  'tisch.ausgestiegen': 'ausgestiegen',
  'tisch.stichzahl': '{anzahl} Stiche gewonnen',
  'tisch.vorgemerkt': 'Vorgemerkt',
  'tisch.sticht': 'Sticht',
  'tisch.gast': 'Ein Gast spielt mit - diese Runde zählt nicht für die Rangliste.',

  'tisch.letzterStich': 'Letzter Stich',
  'tisch.letzterStich.an': 'Ging an {name}.',

  'tisch.regeln.titel': 'Regeln an diesem Tisch',
  'tisch.regeln.fehler': 'Die Regeln ließen sich nicht laden.',
  'tisch.regeln.keine': 'Keine Sonderregeln. Es gilt das Grundspiel.',
  'tisch.regeln.an': '{an} von {gesamt} Regeln an.',

  'tisch.botStaerke': 'Bot-Stärke',
  'tisch.botStaerke.hinweis': 'Gilt für alle Bots an diesem Tisch.',
  'tisch.botStufe.anfaenger': 'Anfänger',
  'tisch.botStufe.standard': 'Standard',
  'tisch.botStufe.experte': 'Experte',
  'tisch.botStufe.genie': 'Genie',
  'tisch.botStufe.standard.text':
    'Solider Vereinsspieler: spielt Ässe früh, hält Trümpfe, schmiert dem Partner. Sagt nichts an.',
  'tisch.botStufe.experte.text':
    'Zieht bei starkem Blatt die Trümpfe und sagt Re oder Kontra an, wenn die Hand es trägt.',
  'tisch.botStufe.genie.text':
    'Zählt mit, was schon gespielt wurde, und wählt die Karte mit dem sichersten Gewinn. Richtig stark.',

  'tisch.warten.titel': 'Wartet auf Mitspieler',
  'tisch.warten.voll': 'Alle Plätze belegt, es geht gleich los…',
  'tisch.warten.nochEiner': 'Noch ein Spieler · {runden} Runden',
  'tisch.warten.nochMehr': 'Noch {anzahl} Spieler · {runden} Runden',
  'tisch.warten.botSetzen': '+ Bot',
  'tisch.warten.botSetztSich': 'Bot setzt sich…',
  'tisch.warten.botEntfernen': 'entfernen',
  'tisch.warten.botStehtAuf': 'Bot steht auf…',
  'tisch.warten.hinweisOeffentlich':
    'Andere finden den Tisch in der Lobby - oder fülle freie Plätze mit Bots. Sobald alle Plätze belegt sind, geht es los.',
  'tisch.warten.hinweisPrivat':
    'Wer beitreten will, lässt der Gastgeber herein - freie Plätze lassen sich auch mit Bots füllen. Sobald alle Plätze belegt sind, geht es los.',

  'tisch.ende.titel': 'Partie beendet',
  'tisch.ende.runden': '{runden} Runden gespielt.',
  'tisch.ende.platz': 'Platz {platz}',
  'tisch.ende.trophaeen': 'Trophäen',
  'tisch.ende.gewertet': 'Trophäen sind gutgeschrieben. Dein Stand steht im Profil.',
  'tisch.ende.ungewertet': 'Keine Trophäen: An Tischen mit Bots wird nicht gewertet.',
  'tisch.ende.zurLobby': 'Zurück zur Lobby',

  'tisch.zuruf': 'Zuruf',
  'tisch.zuruf.gesperrt': 'Gesperrte Zurufe gibt es im Shop.',

  'tisch.anfragen': 'Beitrittsanfragen',
  'tisch.anfragen.titel': 'Möchten mitspielen',
  'tisch.anfragen.zusagen': 'Zusagen',
  'tisch.anfragen.ablehnen': 'Ablehnen',
  'tisch.anfragen.fehler': 'Das hat nicht geklappt.',
  'tisch.anfrage.gesendet': 'Anfrage gesendet',
  'tisch.anfrage.leiderNicht': 'Leider nicht',
  'tisch.anfrage.privat': '{spiel} · privater Tisch',
  'tisch.anfrage.zurueckziehen': 'Anfrage zurückziehen',
  'tisch.anfrage.warte': 'Warte auf Zusage',
  'tisch.anfrage.abgelehnt': 'Abgelehnt',
  'tisch.anfrage.gastgeber': 'Der Gastgeber',
  'tisch.anfrage.abgelehntText': '{wer} hat abgelehnt - oder der Tisch ist inzwischen voll.',
  'tisch.anfrage.warteText': '{wer} muss dich hereinlassen. Sobald die Zusage kommt, geht es an den Tisch.',
} satisfies Woerterbuch;
