import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „cambio": der Cambio-Tisch (`screens/CambioTable.tsx`).
 * Vorher fest im Bildschirm, Wortlaut unverändert — bis auf „Du bist am Zug"
 * (stand dort als „Du ist am Zug").
 */
export default {
  'cambio.verbinde': 'Verbinde mit dem Tisch…',
  'cambio.neueRunde': 'Neue Runde…',
  'cambio.zurueck': 'Zurück',
  'cambio.runde': 'Runde {nr} / {von}',

  'cambio.stapel.verdeckt.eins': 'Nachziehstapel, {n} Karte',
  'cambio.stapel.verdeckt.mehr': 'Nachziehstapel, {n} Karten',
  'cambio.stapel.offen': 'Ablagestapel',
  'cambio.gezogen': 'Gezogen',
  'cambio.platz.verdeckt': 'Verdeckter Platz {nr}',

  // Ein Zug bleibt „ein Zug", nicht „1 Zug" — so stand es vorher auch da.
  'cambio.ruf.offen.eins': '{name} hat gerufen - noch ein Zug',
  'cambio.ruf.offen.mehr': '{name} hat gerufen - noch {n} Züge',
  'cambio.tag.fertig': 'fertig',

  'cambio.punkte.eins': '{n} Punkt',
  'cambio.punkte.mehr': '{n} Punkte',

  'cambio.phase.aufgedeckt': 'Aufgedeckt',
  'cambio.phase.duAmZug': 'Du bist am Zug',
  'cambio.phase.andereAmZug': 'Mitspieler ist am Zug',
  'cambio.phase.turn': 'Ziehen, nehmen oder Cambio rufen',
  'cambio.phase.decide': 'Tauschen oder abwerfen',

  'cambio.aktion.peekOwn': 'Eine eigene Karte ansehen',
  'cambio.aktion.peekOther': 'Eine fremde Karte ansehen',
  'cambio.aktion.blindSwap': 'Zwei Karten blind tauschen',
  'cambio.aktion.lookAndSwap.entscheiden': 'Tauschen oder verzichten',

  'cambio.knopf.rufen': 'Cambio rufen',
  'cambio.knopf.abwerfen': 'Abwerfen',
  'cambio.knopf.nichtTauschen': 'Nicht tauschen',
  'cambio.hinweis.turn': 'Stapel antippen zum Ziehen, eigenen Platz für die offene Karte',
  'cambio.hinweis.decide': 'oder einen eigenen Platz antippen zum Tauschen',

  'cambio.blind.erste': 'Zwei Karten antippen, die getauscht werden sollen',
  'cambio.blind.zweite': 'Erste Karte gewählt, jetzt die zweite antippen',
  'cambio.blind.zurueck': 'Auswahl zurücknehmen',

  'cambio.zurufe.titel': 'Zurufe',
  'cambio.zurufe.text': 'Weitere Zurufe gibt es im Shop.',
  'cambio.allesKlar': 'Alles klar',

  'cambio.blatt.rufGut': '{name} rief Cambio: und lag vorn: null Punkte.',
  'cambio.blatt.rufSchlecht': '{name} rief Cambio: daneben, plus Strafpunkte.',
  'cambio.blatt.statt': '(statt {n})',
  'cambio.blatt.gesamt': 'Gesamtstand',
  'cambio.blatt.wenigIstGut': 'Wenig ist gut. Es gewinnt, wer am Ende am wenigsten hat.',
  'cambio.weiter': 'Weiter',
} satisfies Woerterbuch;
