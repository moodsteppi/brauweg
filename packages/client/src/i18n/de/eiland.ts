import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „eiland": Menü, Suche und Karte von Eiland
 * (`screens/Eiland.tsx`). Wortlaut unverändert aus dem Bildschirm.
 *
 * `<b>…</b>` ist Fettschrift, die `mitFett` aus `ClanTeile.ts` zeichnet — so
 * bleibt ein Regelsatz EIN Schlüssel, auch wenn ein Wort darin fett steht.
 * Der Spielname „Eiland" ist ein Eigenname und steht in jeder Sprache so da.
 */
export default {
  // Menü und Suche
  'eiland.fehler.suche': 'Die Suche ist fehlgeschlagen. Noch einmal versuchen?',
  'eiland.fehler.sucheBeendet': 'Die Suche wurde beendet. Noch einmal versuchen?',
  'eiland.fehler.tisch': 'Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?',
  'eiland.spielerGerade.eins': '{n} Spieler gerade in Eiland',
  'eiland.spielerGerade.mehr': '{n} Spieler gerade in Eiland',
  'eiland.suche.titel': 'Gegner suchen',
  'eiland.suche.unter': 'Eiland · Online Match',
  'eiland.suche.abbrechen': 'Suche abbrechen',
  'eiland.suche.allein': 'Noch niemand sonst - bleibt es dabei, spielst du gegen die KI.',
  'eiland.suche.gefunden.eins': '{n} Spieler gefunden',
  'eiland.suche.gefunden.mehr': '{n} Spieler gefunden',
  'eiland.abbrechen': 'Abbrechen',
  'eiland.menue.unter': '2 Spieler · ihr zieht gleichzeitig',
  'eiland.zurueckZurSpielseite': 'Zurück zur Spielseite',
  'eiland.menue.suchen': 'Online Match suchen…',
  'eiland.menue.text':
    'Nimm Land, sammle Ornamente und komm dem anderen zuvor. Ihr zieht gleichzeitig - und wer dasselbe Feld will, muss darum kämpfen.',
  'eiland.ki.titel': 'Gegen die KI',
  'eiland.ki.hinweis': 'Hier wählst du die Spielart.',
  'eiland.ki.spielen': 'Gegen die KI spielen',
  'eiland.spielart': 'Spielart',
  'eiland.spielart.klar': 'Offene Karte',
  'eiland.spielart.nebel': 'Im Nebel',
  'eiland.spielart.klar.text': 'Die ganze Insel liegt offen - für euch beide.',
  'eiland.spielart.nebel.text': 'Du siehst dein Gebiet und drei Felder darüber hinaus.',
  'eiland.anleitung': 'Anleitung',
  'eiland.anleitung.titel': 'So spielt man Eiland',
  'eiland.anleitung.unter': 'Regeln, Ornamente, zwei Spielarten',

  // Tisch wird aufgebaut
  'eiland.aufbau.titel': 'Tisch wird aufgebaut',
  'eiland.aufbau.besetzt': '{besetzt} von {plaetze} Plätzen besetzt',
  'eiland.aufbau.verbindung': 'Verbindung wird aufgebaut…',

  // Karte
  'eiland.zurueck': 'Zurück',
  // Davor steht die Rundenzahl als eigenes, hervorgehobenes Element.
  'eiland.runde.nebel': 'Nebel · Runde',
  'eiland.runde.offen': 'Offen · Runde',
  'eiland.einsatz.aria.eins': 'Ein Feld als Einsatz',
  'eiland.einsatz.aria.mehr': '{n} Felder als Einsatz',
  'eiland.einsatz.text.eins': '{n} Feld als Einsatz',
  'eiland.einsatz.text.mehr': '{n} Felder als Einsatz',
  'eiland.zugSteht': 'Dein Zug steht.',
  'eiland.wartetAufGegner': 'Warten auf den Gegner…',
  'eiland.offen.eins': 'Noch ein Feld',
  'eiland.offen.mehr': 'Noch {n} Felder',
  'eiland.wirdGesendet': 'Wird gesendet…',
  'eiland.passen': 'Passen',
  'eiland.abgeben': 'Abgeben',
  'eiland.zuruecksetzen': 'Zurücksetzen',

  // Felder für Vorlesegeräte; die Teile stehen durch Komma getrennt hintereinander.
  'eiland.feld.unbekannt': 'Unbekanntes Feld',
  'eiland.feld.wasser': 'Wasser',
  'eiland.feld.berg': 'Berg',
  'eiland.feld.wiese': 'Wiese',
  'eiland.feld.frei': 'frei',
  'eiland.feld.eigen': 'dein Gebiet',
  'eiland.feld.fremd': 'gegnerisches Gebiet',
  'eiland.feld.stadt': 'Stadt',
  'eiland.feld.brunnen': 'Brunnen',
  'eiland.feld.bauStadt': 'mit eingesammelter Stadt',
  'eiland.feld.bauBrunnen': 'mit eingesammeltem Brunnen',

  // Spielerstand und Abschluss
  'eiland.du': 'Du',
  'eiland.ki': 'KI',
  'eiland.gegner': 'Gegner',
  'eiland.jeRunde': '{n}/Runde',
  'eiland.unentschieden': 'Unentschieden',
  'eiland.gewonnen': 'Gewonnen!',
  'eiland.verloren': 'Verloren',
  'eiland.ergebnis': '{meine} zu {seine} Feldern',

  // Regelblatt
  'eiland.regel.titel': 'Regeln',
  'eiland.regel.start': 'Jeder startet mit einem Feld in seiner Ecke der Insel.',
  'eiland.regel.runde':
    'Pro Runde nimmst du ein freies Wiesenfeld, das an dein Gebiet grenzt - und ein Feld mehr für jedes Ornament, das du eingesammelt hast.',
  'eiland.regel.grenze':
    'Wasser und Berge gehören niemandem. Gegnerisches Gebiet kannst du nicht nehmen: Dort ist deine Grenze.',
  'eiland.regel.gleichzeitig':
    'Ihr wählt <b>gleichzeitig</b>, ohne die Wahl des anderen zu sehen. Wollen beide dasselbe Feld, wird darum gekämpft - der Ausgang steht fünfzig zu fünfzig. Wer verliert, kommt an dieser Stelle nicht weiter; Felder dahinter bleiben frei.',
  'eiland.regel.einsatz':
    'Felder, die du in einer Runde <b>nicht setzt</b>, sind dein Einsatz: Bei jedem Streitfeld fliegt einer aufs Feld. Hat nur einer von euch einen, gewinnt er das Feld sicher; haben beide einen, entscheidet wieder der Münzwurf. Die Streitfelder kommen in zufälliger Reihenfolge dran, bis die Einsätze verbraucht sind - der Rest bleibt fünfzig zu fünfzig.',
  'eiland.regel.ende': 'Die Partie endet, wenn keiner mehr irgendwohin kann.',
  'eiland.regel.ornamente.titel': 'Ornamente',
  'eiland.regel.ornamente':
    'Städte und Brunnen liegen verstreut auf der Insel. Wer das Feld nimmt, auf dem eines steht, nimmt von da an ein Feld mehr pro Runde. Es liegen immer vier auf der Karte - für jedes eingesammelte rückt eines nach.',
  'eiland.regel.spielarten.titel': 'Zwei Spielarten',
  'eiland.regel.spielarten':
    '<b>Im Nebel</b> siehst du dein Gebiet und drei Felder darüber hinaus; alles andere liegt grau - auch für den Gegner. Auf der <b>offenen Karte</b> seht ihr beide die ganze Insel. Was auf dem Zettel des anderen steht, bleibt in beiden Fällen geheim.',
  'eiland.regel.ziel.titel': 'Ziel',
  'eiland.regel.ziel': 'Wer am Ende die meisten Felder hält, gewinnt.',
} satisfies Woerterbuch;
