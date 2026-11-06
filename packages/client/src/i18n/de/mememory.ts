import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „mememory": Menü, KI-Match, Warteraum, Tisch und
 * Ende des Mememory-Bildschirms. Wortlaut unverändert aus dem Code
 * übernommen (`screens/Mememory.tsx`, `minispiele/mememory/`). Vorschlags-
 * kasten und Sammlungsseite stehen im eigenen Bereich `mememory-kasten`.
 *
 * „Mememory" ist ein Eigenname und steht nicht im Wörterbuch — der
 * Bildschirm schreibt ihn direkt. „Meme" steht als Rückfallname drin
 * (`mememory.tisch.meme`), damit eine Sprache es anders nennen könnte.
 */
export default {
  'mememory.sammlung': 'Sammlung',
  'mememory.mehr': 'Mehr',
  'mememory.seiten': 'Seiten',
  'mememory.zurueck': 'Zurück',
  'mememory.abbrechen': 'Abbrechen',
  // `tn`: „1 Spieler" und „2 Spieler" sind im Deutschen gleich, im Englischen nicht.
  'mememory.spielerGerade.eins': '{n} Spieler gerade in Mememory',
  'mememory.spielerGerade.mehr': '{n} Spieler gerade in Mememory',
  'mememory.spielerUnbekannt': '… Spieler gerade in Mememory',

  'mememory.einstellungen.titel': 'Einstellungen',
  'mememory.einstellungen.oeffnen': 'Einstellungen öffnen',
  'mememory.einstellungen.lautstaerke': 'Lautstärke',
  'mememory.einstellungen.aus': 'aus',

  'mememory.mehrSeite.imBau': 'Im Bau',
  'mememory.mehrSeite.imBauText': 'Hier wird noch gewerkelt. Was schon geht, steht unten.',
  'mememory.mehrSeite.kastenText': 'Eigene Memes einreichen',
  'mememory.mehrSeite.freunde': 'Freunde',
  'mememory.mehrSeite.freundeText': 'Direkt zusammen spielen',
  'mememory.mehrSeite.bald': 'bald',

  'mememory.menue.unter': 'Zwei Bilder, ein Paar, zwei bis vier Spieler.',
  'mememory.menue.zurueck': 'Zurück zur Spielseite',
  'mememory.menue.online': 'Online Match suchen…',
  'mememory.menue.ki': 'Gegen die KI',
  'mememory.menue.kiText': 'Bis zu drei Gegner, jeder mit eigener Spielstärke.',
  'mememory.menue.kiKnopf': 'Gegen die KI spielen',
  'mememory.menue.mehrVon': 'Mehr von Mememory',
  'mememory.menue.sammlungText': 'Deine Memes und der Gurt',
  'mememory.menue.mehrText': 'Vorschlagskasten und Freunde',

  'mememory.ki.titel': 'KI-Match erstellen',
  'mememory.ki.unterEins': 'Wie gut soll dein Gegner sich erinnern?',
  'mememory.ki.unterMehr.eins': '{n} Gegner - jeder mit eigenem Gedächtnis.',
  'mememory.ki.unterMehr.mehr': '{n} Gegner - jeder mit eigenem Gedächtnis.',
  'mememory.ki.laeuft': 'Tisch wird aufgemacht…',
  'mememory.ki.starten': 'Match starten',
  'mememory.ki.gegner': 'Gegner',
  'mememory.ki.gegnerNr': 'Gegner {n}',
  'mememory.ki.entfernen': 'Gegner {n} entfernen',
  'mememory.ki.staerkeVon': 'Spielstärke von Gegner {n}',
  'mememory.ki.hinzu': '+ Gegner hinzufügen',
  'mememory.ki.bisZu': 'bis zu {n}',

  'mememory.stufe.beschriftung': 'Spielstärke',
  'mememory.stufe.leicht': 'Leicht',
  'mememory.stufe.leicht.satz': 'Merkt sich nur die letzten zwei Züge und deckt sonst blind auf.',
  'mememory.stufe.mittel': 'Mittel',
  'mememory.stufe.mittel.satz': 'Merkt sich drei Züge - aber jede Karte nur mit halber Wahrscheinlichkeit.',
  'mememory.stufe.schwer': 'Schwer',
  'mememory.stufe.schwer.satz': 'Vier Züge, dreht nichts unnötig zweimal um und behält manches für immer.',
  'mememory.stufe.experte': 'Experte',
  'mememory.stufe.experte.satz': 'Vergisst nichts. Was einmal offen lag, hat er.',

  'mememory.suche.titel': 'Mitspieler suchen',
  'mememory.suche.unter': 'Mememory · Online Match',
  'mememory.suche.abbrechen': 'Suche abbrechen',
  'mememory.suche.allein': 'Noch niemand sonst - bleibt es dabei, wird mit Bots aufgefüllt.',
  'mememory.suche.gefunden.eins': '{n} Spieler gefunden',
  'mememory.suche.gefunden.mehr': '{n} Spieler gefunden',

  'mememory.fehler.suche': 'Die Suche ist fehlgeschlagen. Noch einmal versuchen?',
  'mememory.fehler.sucheBeendet': 'Die Suche wurde beendet. Noch einmal versuchen?',
  'mememory.fehler.tisch': 'Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?',

  'mememory.warten.titel': 'Tisch wird aufgebaut',
  'mememory.warten.auffuellen.eins': 'Mit Bots auffüllen ({n})',
  'mememory.warten.auffuellen.mehr': 'Mit Bots auffüllen ({n})',
  'mememory.warten.besetzt': '{besetzt} von {plaetze} Plätzen besetzt',
  'mememory.warten.verbindung': 'Verbindung wird aufgebaut…',
  'mememory.warten.botStaerke': 'Spielstärke der Bots',

  'mememory.tisch.ki': 'KI',
  'mememory.tisch.du': 'Du',
  'mememory.tisch.sitz': 'Sitz {n}',
  'mememory.tisch.verlassen': 'Spiel verlassen',
  'mememory.tisch.stapel': 'Karten warten auf dem Stapel',
  'mememory.tisch.karte': 'Karte {n}',
  'mememory.tisch.karteOffen': 'Karte {n}, aufgedeckt',
  'mememory.tisch.gesammelt': 'Gesammelt',
  'mememory.tisch.meme': 'Meme',
  'mememory.tisch.werfen': '{name} werfen',
  'mememory.tisch.reaktion': 'Reaktion {zeichen} senden',
  'mememory.tisch.verbindung': 'Verbindung…',

  'mememory.ende.zuEnde': 'Partie zu Ende',
  'mememory.ende.unentschieden': 'Unentschieden',
  'mememory.ende.gewonnen': 'Gewonnen!',
  'mememory.ende.verloren': 'Verloren',
  'mememory.ende.geteilt': 'Geteilter Sieg',
  'mememory.ende.platz': '{platz}. Platz',
  'mememory.ende.nochEine': 'Noch eine Runde',
  'mememory.ende.zurueck': 'Zurück zur Spielauswahl',
} satisfies Woerterbuch;
