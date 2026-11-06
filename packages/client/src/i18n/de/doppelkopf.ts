import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „doppelkopf": was der Doppelkopf-Tisch
 * (`screens/Table.tsx`) selbst sagt — Kopfzeile, Vorbehalte, Ansagen, Armut,
 * Pflichtansage, Abrechnung. Stand bis zur englischen Fassung fest im
 * Bildschirm; der Wortlaut ist unverändert.
 *
 * Platzhalter in geschweiften Klammern füllt `tw()` (`../einsetzen.ts`).
 * Spielarten und Phasen stehen in `tisch.ts`, Regelnamen in
 * `regeln-doppelkopf.ts`.
 */
export default {
  // Kopfzeile
  'doko.verlassen': 'Tisch verlassen',
  'doko.zwischenDenRunden': 'Zwischen den Runden',
  'doko.spielartOffen': 'Spielart wird noch bestimmt',
  'doko.soloVon': '{name} solo',
  'doko.uebungsrunde': 'Übungsrunde',
  'doko.runde': 'Runde {nummer} / {gesamt}',
  'doko.bock': 'Bock ×{faktor}',
  'doko.pausiert': 'Pausiert',
  'doko.zuschauer': 'Zuschauer',
  'doko.tischFortsetzen': 'Tisch fortsetzen',
  'doko.tischPausieren': 'Tisch pausieren',
  'doko.fortsetzen': 'Fortsetzen',
  'doko.pausieren': 'Pausieren',
  'doko.letztenStichAnsehen': 'Letzten Stich ansehen',
  'doko.kartenKleiner': 'Karten verkleinern',
  'doko.kartenGroesser': 'Karten vergrößern',

  // Filz, eigener Platz, Mitspieler
  'doko.letzterStichAn': 'Letzter Stich an {name}',
  'doko.du': 'Du',
  'doko.deineKarten': 'Deine Karten',
  'doko.augen': '{augen} Augen',
  'doko.aufspiel': 'Aufspiel',
  'doko.keineKarten': 'Keine Karten auf der Hand.',
  'doko.schweine': 'Schweine',
  'doko.schweine.haelt': 'Hält die Schweine',
  'doko.botUebernimmt': 'Bot übernimmt',
  'doko.pause.titel': 'Tisch pausiert',
  'doko.pause.text':
    'Der Zugtimer steht still. Jeder am Tisch kann fortsetzen - ideal für Clantische über mehrere Abende.',
  'doko.zuruf.titel': 'Diesen Zuruf hast du noch nicht',
  'doko.zuruf.text':
    'Im Shop unter „Zurufe" gibt es ihn gegen Münzen. Er steht dir dann an jedem Tisch zur Verfügung.',
  'doko.weiterSpielen': 'Weiter spielen',

  // Parteien und Ansagen
  'doko.partei.re': 'Re',
  'doko.partei.kontra': 'Kontra',
  'doko.team.re': 'Team Re',
  'doko.team.kontra': 'Team Kontra',
  'doko.absage.1': 'Keine 90',
  'doko.absage.2': 'Keine 60',
  'doko.absage.3': 'Keine 30',
  'doko.absage.4': 'Schwarz',
  'doko.angesagt': 'Angesagt',
  'doko.ansage': 'Ansage',
  'doko.ansagen': 'Ansagen',
  'doko.parteiAnsagen': '{partei} ansagen',

  // Knöpfe
  'doko.aktion.gesund': 'Gesund',
  'doko.aktion.solo': 'Solo: {solo}',
  'doko.aktion.hochzeit': 'Hochzeit',
  'doko.aktion.armut': 'Armut',
  'doko.aktion.schmeissen': 'Schmeißen',
  'doko.aktion.armutAnnehmen': 'Armut annehmen',
  'doko.aktion.armutAblehnen': 'Armut ablehnen',
  'doko.aktion.truempfeAbgeben': 'Trümpfe abgeben',
  'doko.bestaetigen': 'Bestätigen',
  'doko.ablehnen': 'Ablehnen',
  'doko.annehmen': 'Annehmen',
  'doko.zurueck': 'Zurück',
  'doko.weiter': 'Weiter',

  // Kurznamen der Soli auf den Kacheln der Vorbehaltsabfrage
  'doko.solo.suitC': 'Kreuz',
  'doko.solo.suitS': 'Pik',
  'doko.solo.suitH': 'Herz',
  'doko.solo.suitD': 'Karo',
  'doko.solo.queens': 'Damen',
  'doko.solo.jacks': 'Buben',
  'doko.solo.fleshless': 'Fleischlos',

  // Zurufe über den Sitzen
  'doko.ruf.gesund': 'Gesund',
  'doko.ruf.gesagt': 'Gesagt',
  'doko.ruf.solo': 'Solo',
  'doko.ruf.schmeiss': 'Ich schmeiße',
  'doko.ruf.armut': 'Armut',
  'doko.ruf.hochzeit': 'Hochzeit',
  'doko.ruf.vorbehalt': 'Vorbehalt',

  // Vorbehaltsabfrage
  'doko.vb.frage': 'Bist du gesund?',
  'doko.vb.hinweis': 'Alle erklären gleichzeitig. Sagst du nichts, giltst du als gesund.',
  'doko.vb.jaGesund': '✓ Ja, gesund',
  'doko.vb.neinVorbehalt': 'Nein, Vorbehalt',
  'doko.vb.titel': 'Dein Vorbehalt',
  'doko.vb.warum.schmeiss': 'Dafür brauchst du genug Luschen oder Volle.',
  'doko.vb.warum.armut': 'Dafür darfst du höchstens drei Trümpfe haben.',
  'doko.vb.warum.hochzeit': 'Dafür brauchst du beide Kreuz-Damen.',
  'doko.vb.farbsolo': 'Farbsolo',
  'doko.vb.pflichtsoloOffen': 'Pflichtsolo offen: {wer}',
  'doko.vb.pflichtsoloDu': 'du',
  'doko.vb.pflichtsoloDich': 'Dich kann es noch treffen.',
  'doko.vb.ansagenFrage': '{wahl} ansagen?',
  'doko.vb.soloProbe':
    'Deine Karten liegen zur Probe schon in der Reihenfolge dieses Solos. Zurück stellt sie wieder her.',
  'doko.vb.wirdAngesagt': 'Wird angesagt…',

  // Pflichtansage
  'doko.pflicht.titel': 'Pflichtansage',
  'doko.pflicht.hochzeit': 'Der Klärungsstich hatte {augen} Augen.',
  'doko.pflicht.schweine': 'Du hältst die Schweine.',
  'doko.pflicht.armut': 'Du spielst die Armut.',
  'doko.pflicht.stich': 'Der Stich hatte {augen} Augen.',
  'doko.pflicht.freiwillig': 'Die Ansage ist erwartet, aber freiwillig.',
  'doko.pflicht.zwingend': 'Die Ansage erfolgt zwingend.',

  // Armut
  'doko.armut.titel': 'Armut',
  'doko.armut.einMitspieler': 'Ein Mitspieler',
  'doko.armut.text':
    '{wer} hat Armut angesagt - er hält höchstens drei Trümpfe. Nimmst du an, wirst du sein Partner: Du bekommst seine Trümpfe und gibst dafür gleich viele Karten zurück. Lehnst du ab, wird der Nächste gefragt.',
  'doko.armut.zurueckgeben': 'Gib {anzahl} Karten zurück',
  'doko.armut.abgeben': 'Gib {anzahl} Karten ab',
  'doko.karten.wirdUebergeben': 'Wird übergeben …',
  'doko.karten.uebergeben': 'Karten übergeben',
  'doko.karten.gewaehlt': '{gewaehlt} von {anzahl} gewählt',

  // Abrechnung und Zwischenstand
  'doko.auswertung': 'Auswertung',
  'doko.feigling': 'Feigling.',
  'doko.feigling.text':
    '{partei} hatte die Augen, aber zu niedrig angesagt - die Punkte gehen an die Gegenpartei. Sonderpunkte bleiben, wo sie erspielt wurden.',
  'doko.kartenpunkte': 'Kartenpunkte',
  'doko.gesamt': 'Gesamt',
  'doko.zwischenstand': 'Zwischenstand',
  'doko.restRunden': 'Verbleibende Runden: {anzahl}',
  'doko.warteAufAndere': 'Warte auf die anderen …',
  'doko.sonder.fuchs': 'Fuchs',
  'doko.sonder.karlchen': 'Karlchen',
  'doko.sonder.doppelkopf': 'Doppelkopf',
  'doko.sonder.charlie': 'Charlie',
  'doko.sonder.herzdurchlauf': 'Herzdurchlauf',
} satisfies Woerterbuch;
