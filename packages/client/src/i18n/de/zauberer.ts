import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „zauberer": was bis zur Sprachumstellung fest im
 * Zauberer-Tisch stand (`screens/WizardTable.tsx`). Wortlaut unverändert bis
 * auf „1 Stich ist zu vergeben" (vorher „1 Stich sind").
 *
 * Platzhalter in geschweiften Klammern (`{nr}`) setzt der Tisch selbst ein
 * (`tz` in `WizardTable.tsx`) — `t()` kennt keine. Die Wortstellung gehört
 * deshalb zum Text: Im Englischen steht die Zahl oft an anderer Stelle.
 * Einzahl und Mehrzahl sind eigene Schlüssel (`.eins`/`.mehr`).
 *
 * Die Phasen „Trumpf wird bestimmt" und „Ansagen" stehen NICHT hier, sondern
 * als `phase.trump`/`phase.bidding` im Bereich „tisch" — dort meldet sie auch
 * die Mitte des Tisches.
 */
export default {
  // Laden und Kopfzeile
  'zauberer.laden': 'Tisch wird geladen…',
  'zauberer.verbinde': 'Verbinde…',
  'zauberer.zurueck': 'Zurück',
  'zauberer.verlassen': 'Tisch verlassen',
  'zauberer.runde': 'Runde {nr} / {gesamt}',
  'zauberer.pausiert': 'Pausiert',
  'zauberer.zuschauer': 'Zuschauer',
  'zauberer.fortsetzenKnopf': 'Tisch fortsetzen',
  'zauberer.pausierenKnopf': 'Tisch pausieren',
  'zauberer.tafelKnopf': 'Punktetafel ansehen',
  'zauberer.letzterKnopf': 'Letzten Stich ansehen',
  'zauberer.regelnKnopf': 'Tischregeln ansehen',
  'zauberer.kleiner': 'Karten verkleinern',
  'zauberer.groesser': 'Karten vergrößern',

  // Rundenzeile und eigene Lage
  'zauberer.zwischenRunden': 'Zwischen den Runden',
  'zauberer.karten.eins': '{n} Karte',
  'zauberer.karten.mehr': '{n} Karten',
  'zauberer.keinTrumpf': 'kein Trumpf',
  'zauberer.ohneTrumpf': 'ohne Trumpf',
  'zauberer.trumpf': 'Trumpf',
  'zauberer.trumpfFarbe': 'Trumpf {farbe}',
  // Summe der Ansagen gegen die Handgröße, z.B. „4 auf 5".
  'zauberer.summeAuf': '{summe} auf {n}',
  'zauberer.deineKarten': 'Deine Karten',
  'zauberer.nichtAngesagt': 'Noch nicht angesagt',
  'zauberer.gebot': 'Gebot {n}',
  'zauberer.stiche.eins': '{n} Stich',
  'zauberer.stiche.mehr': '{n} Stiche',
  'zauberer.fehlt': 'noch {n}',
  'zauberer.genau': 'genau richtig',
  'zauberer.zuViel': '{n} zu viel',
  'zauberer.du': 'Du',
  'zauberer.aufspiel': 'Aufspiel',

  // Am Tisch
  'zauberer.letzterStichAn': 'Letzter Stich an {name}',
  'zauberer.keineKarten': 'Keine Karten auf der Hand.',
  'zauberer.blindHinweis': 'Deine Karte kennst du nicht, die der anderen schon.',
  'zauberer.blindLegen': 'Deine verdeckte Karte legen',
  'zauberer.geber': 'Geber',
  'zauberer.ausgestiegen': 'ausgestiegen',
  'zauberer.botUebernimmt': 'Bot übernimmt',

  // Zuruf, den man noch nicht hat
  'zauberer.zuruf.titel': 'Diesen Zuruf hast du noch nicht',
  'zauberer.zuruf.text':
    'Im Shop unter „Zurufe" gibt es ihn gegen Münzen. Er steht dir dann an jedem Tisch zur Verfügung.',
  'zauberer.weiterSpielen': 'Weiter spielen',

  // Pause
  'zauberer.pause.titel': 'Tisch pausiert',
  'zauberer.pause.text':
    'Der Zugtimer steht still. Jeder am Tisch kann fortsetzen - ideal für Clantische über mehrere Abende.',
  'zauberer.fortsetzen': 'Fortsetzen',

  // Ansage
  'zauberer.ansage.titel': 'Wie viele Stiche machst du?',
  'zauberer.ansage.verdeckt':
    'Verdeckt angesagt: Die anderen Zahlen siehst du erst, wenn alle angesagt haben.',
  'zauberer.ansage.zuerst.eins': '{n} Stich ist zu vergeben. Du sagst zuerst an.',
  'zauberer.ansage.zuerst.mehr': '{n} Stiche sind zu vergeben. Du sagst zuerst an.',
  'zauberer.ansage.bisher': 'Bisher angesagt: {liste}',
  'zauberer.ansage.summe': ', Summe {summe} von {n}',
  'zauberer.ansage.gesperrt': 'Damit ginge die Summe auf',
  'zauberer.ansage.sendet': 'Wird angesagt…',
  'zauberer.ansage.waehlen': 'Zahl wählen',
  'zauberer.ansage.knopf': '{n} ansagen',

  // Trumpfwahl
  'zauberer.trumpfwahl.titel': 'Du bestimmst den Trumpf',
  'zauberer.trumpfwahl.text': 'Aufgedeckt wurde ein Zauberer, du wählst die Farbe.',

  // Abrechnung und Punktetafel
  'zauberer.abgerechnet': 'Runde {nr} abgerechnet',
  'zauberer.spalte.spieler': 'Spieler',
  'zauberer.spalte.gebot': 'Gebot',
  'zauberer.spalte.stiche': 'Stiche',
  'zauberer.spalte.punkte': 'Punkte',
  'zauberer.spalte.gesamt': 'Gesamt',
  'zauberer.spalte.runde': 'Rd.',
  'zauberer.weiter': 'Weiter',
  'zauberer.tafel.titel': 'Punktetafel',
  'zauberer.tafel.leer': 'Noch keine Runde abgerechnet.',
  'zauberer.schliessen': 'Schließen',
} satisfies Woerterbuch;
