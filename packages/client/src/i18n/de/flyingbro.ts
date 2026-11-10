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
  'flyingbro.ladeFehler': 'Das Spiel ließ sich nicht laden.',
  'flyingbro.nochmalLadenSpiel': 'Nochmal laden',
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

  'flyingbro.shop.titel': 'Shop',
  'flyingbro.shop.satz': 'Hilfsmittel für einen Versuch — bezahlt mit Flugmeilen, nie mit Münzen.',
  'flyingbro.shop.vorrat': 'Vorrat: {n}',
  'flyingbro.shop.kaufenLabel': '{name} für {preis} Flugmeilen kaufen',
  'flyingbro.shop.zweiSterne': 'Mit Hilfsmittel gibt es höchstens 2 Sterne.',
  'flyingbro.hilfsmittel.fernrohr': 'Fernrohr',
  'flyingbro.hilfsmittel.fernrohr.wirkung': 'Längere Flugbahn-Vorschau für ein Level',
  'flyingbro.hilfsmittel.bauplan': 'Bauplan',
  'flyingbro.hilfsmittel.bauplan.wirkung': 'Zeigt für ein Level die drei tragenden Teile',
  'flyingbro.hilfsmittel.ersatz-pelle': 'Ersatz-Pelle',
  'flyingbro.hilfsmittel.ersatz-pelle.wirkung': 'Ein zusätzlicher Pelle am Ende der Reihe',
  'flyingbro.vorbereitung.titel': 'Hilfsmittel einsetzen',
  'flyingbro.vorbereitung.ohne': 'Ohne Hilfsmittel sind 3 Sterne drin.',
  'flyingbro.vorbereitung.los': 'Los',

  'flyingbro.ende.geschafft': 'Geschafft!',
  'flyingbro.ende.verloren': 'Die Giraffen stehen noch',
  'flyingbro.ende.bonus': 'Übrige Bros: {anzahl} × 3.000',
  'flyingbro.ende.wertet': 'Wird gewertet …',
  'flyingbro.ende.nichtGewertet': 'Nicht gewertet',
  'flyingbro.ende.meilen': '+{n} Flugmeilen',
  'flyingbro.ende.muenzen': '+{n} Münzen fürs Hub',
  'flyingbro.ende.offen': '{n} Münzen kommen morgen (Tagesgrenze)',
  'flyingbro.ende.bestwert': 'Bisher bestes Ergebnis: {sterne} von 3 Sternen',
  'flyingbro.ende.goldhelm': 'Alle Sterne! Der Goldhelm liegt im Kleiderschrank.',
} satisfies Woerterbuch;
