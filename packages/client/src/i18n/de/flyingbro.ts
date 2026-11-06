import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „flyingbro" — der Spielbildschirm (flyingbro/).
 * „Flying Bro" bleibt in jeder Sprache so: Es ist der Name des Spiels. Die
 * Leveltitel stehen in den Leveldateien des Kerns und sind Inhalt, keine
 * Oberfläche.
 */
export default {
  'flyingbro.titel': 'Flying Bro',
  'flyingbro.zurueck': 'Zurück',
  'flyingbro.laedt': 'Lädt …',
  'flyingbro.standFehler': 'Dein Spielstand ließ sich nicht laden.',
  'flyingbro.nochmalLaden': 'Nochmal versuchen',
  'flyingbro.meilen': 'Flugmeilen',
  'flyingbro.welt.1': 'Heimat',
  'flyingbro.welt.2': 'Wiesen',
  'flyingbro.welt.3': 'Strand',
  'flyingbro.gesperrt': 'Gesperrt — schaff erst das Level davor.',
  'flyingbro.levelLabel': 'Level {nr}, {sterne} von 3 Sternen',
  'flyingbro.sterneSumme': '{sterne} von {max} Sternen',

  'flyingbro.pause': 'Pause',
  'flyingbro.weiter': 'Weiter',
  'flyingbro.nochmal': 'Nochmal',
  'flyingbro.levelwahl': 'Levelwahl',
  'flyingbro.naechstesLevel': 'Nächstes Level',
  'flyingbro.punkte': 'Punkte',
  'flyingbro.hinweis.zielen': 'Ziehen und loslassen',
  'flyingbro.hinweis.pelle': 'Tippen: Bauchrutscher',
  'flyingbro.hinweis.malve': 'Halten: Gleitflug',
  'flyingbro.hinweis.tjark': 'Tippen: Eisblock',
  'flyingbro.drehen': 'Bitte Handy drehen',

  'flyingbro.ende.geschafft': 'Geschafft!',
  'flyingbro.ende.verloren': 'Die Giraffen stehen noch',
  'flyingbro.ende.bonus': 'Übrige Bros: {anzahl} × 3.000',
  'flyingbro.ende.wertet': 'Wird gewertet …',
  'flyingbro.ende.nichtGewertet': 'Nicht gewertet',
  'flyingbro.ende.meilen': '+{n} Flugmeilen',
  'flyingbro.ende.muenzen': '+{n} Münzen fürs Hub',
  'flyingbro.ende.offen': '{n} Münzen kommen morgen (Tagesgrenze)',
  'flyingbro.ende.bestwert': 'Bisher bestes Ergebnis: {sterne} von 3 Sternen',
} satisfies Woerterbuch;
