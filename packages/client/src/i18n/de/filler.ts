import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „filler": Menü, Suche, Brett und Anleitung von
 * Farbduell (`screens/Filler.tsx`). Wortlaut unverändert aus dem Bildschirm.
 *
 * Der Bereich heißt nach der Kennung `filler` und nicht nach dem Spielnamen:
 * Der Name ist je nach Herkunft ein anderer („Filler" im Netz, „Farbduell" in
 * der App, siehe `APP_NAMEN` in `../index.ts`). Deshalb steht er in keinem
 * Text fest, sondern kommt als `{spiel}` aus `t('game.filler')`.
 *
 * `<b>…</b>` ist Fettschrift, die `mitFett` aus `screens/ClanTeile.ts`
 * zeichnet — so bleibt ein Absatz der Anleitung EIN Schlüssel, auch wenn sein
 * erstes Wort fett steht.
 */
export default {
  // Die vier Spielarten: Name auf der Kachel, Satz darunter.
  'filler.spielart.nebel': 'Nebel',
  'filler.spielart.nebel.text': 'Du siehst nur dein Gebiet und dessen Rand.',
  'filler.spielart.klar': 'Normal',
  'filler.spielart.klar.text': 'Das ganze Brett liegt offen - wie im Original.',
  'filler.spielart.build': 'Build',
  'filler.spielart.build.text':
    'Offenes Brett, dazu zehn Mauern je Spieler - eine je Zug, färben darfst du danach trotzdem.',
  'filler.spielart.extreme': 'Extreme',
  'filler.spielart.extreme.text':
    'Build auf großem Brett (12 × 11): sieben Farben, acht Sterne und zwanzig Mauern, bis zu zwei je Zug.',
  'filler.spielart.wischen': '← wischen zum Wechseln →',

  // Menü und Suche
  'filler.fehler.suche': 'Die Suche ist fehlgeschlagen. Noch einmal versuchen?',
  'filler.fehler.sucheBeendet': 'Die Suche wurde beendet. Noch einmal versuchen?',
  'filler.fehler.tisch': 'Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?',
  'filler.spielerGerade.eins': '{n} Spieler gerade in {spiel}',
  'filler.spielerGerade.mehr': '{n} Spieler gerade in {spiel}',
  'filler.suche.titel': 'Gegner suchen',
  'filler.suche.abbrechen': 'Suche abbrechen',
  'filler.suche.allein': 'Noch niemand sonst - bleibt es dabei, spielst du gegen einen Bot.',
  'filler.suche.gefunden.eins': '{n} Spieler gefunden',
  'filler.suche.gefunden.mehr': '{n} Spieler gefunden',
  'filler.abbrechen': 'Abbrechen',
  'filler.menue.unter': '2 Spieler · {spielart}',
  'filler.zurueckZurSpielseite': 'Zurück zur Spielseite',
  'filler.menue.suchen': 'Online Match suchen…',
  'filler.menue.bot': 'Gegen Bot spielen',
  'filler.menue.text': 'Färbe dein Gebiet um und schlucke, was daran grenzt.',
  'filler.menue.spielart': 'Spielart',
  'filler.menue.anleitung': 'Anleitung',
  'filler.menue.soSpieltMan': 'So spielt man {spiel}',
  'filler.menue.anleitungUnter': 'Regeln und die vier Spielarten',
  'filler.aufbau.titel': 'Tisch wird aufgebaut',
  'filler.aufbau.besetzt': '{besetzt} von {sitze} Plätzen besetzt',
  'filler.aufbau.verbindung': 'Verbindung wird aufgebaut…',

  // Brett
  'filler.zurueck': 'Zurück',
  'filler.aufgeben': 'Aufgeben',
  'filler.aufgeben.frage': 'Aufgeben?',
  'filler.aufgeben.text': 'Die Partie ist dann verloren.',
  'filler.mauer': 'Mauer',
  'filler.mauer.pause': 'Pause',
  'filler.mauer.zwischen': 'Mauer zwischen Feld {a} und {b}',
  'filler.mauer.gesperrt.eins': 'Mauern noch {n} Zug gesperrt',
  'filler.mauer.gesperrt.mehr': 'Mauern noch {n} Züge gesperrt',
  'filler.mauer.pauseVorlesen': 'Mauerpause nach der Doppelmauer, noch {rest} Mauern',
  'filler.mauer.bauenDoppel': 'Mauer bauen, noch {rest}, in diesem Zug noch {zug}',
  'filler.mauer.bauen': 'Mauer bauen, noch {rest}',
  'filler.farbe': 'Farbe {n}',
  'filler.hinweis.pause': 'Nach der Doppelmauer: nur Farbe',
  'filler.hinweis.zweiteMauer': 'Zweite Mauer oder Farbe wählen',
  'filler.hinweis.nochEineMauer': 'Noch eine Mauer oder Farbe',
  'filler.hinweis.kante': 'Kante antippen',
  'filler.hinweis.farbe': 'Farbe wählen',
  'filler.warten.bot': 'Bot ist am Zug',
  'filler.warten.mensch': 'Auf anderen Spieler warten',
  'filler.warten.vorlesen': ', bitte warten',
  'filler.spieler.du': 'Du',
  'filler.spieler.ki': 'KI',
  'filler.spieler.gegner': 'Gegner',

  // Abschluss
  'filler.ende.unentschieden': 'Unentschieden',
  'filler.ende.gewonnen': 'Gewonnen!',
  'filler.ende.verloren': 'Verloren',
  'filler.ende.selbstAufgegeben': 'Aufgegeben · ',
  'filler.ende.gegnerAufgegeben': 'Gegner hat aufgegeben · ',
  'filler.ende.felder': '{meine} zu {seine} Feldern',
  'filler.ende.punkte': '{meine} zu {seine} Punkten',

  // Anleitung
  'filler.regel.titel': 'Regeln',
  'filler.regel.eckfeld': 'Jeder Spieler bekommt zu Beginn ein Eckfeld.',
  'filler.regel.faerben':
    'Abwechselnd färbt man sein Gebiet in eine von sechs Farben (sieben in Extreme) und nimmt dabei alle angrenzenden Felder dieser Farbe mit.',
  'filler.regel.gegnerfarbe': 'Die Farbe des Gegners darf man nicht wählen.',
  'filler.regel.ende': 'Die Partie endet, wenn kein Feld mehr frei ist.',
  'filler.regel.spielarten': 'Die vier Spielarten',
  'filler.regel.klar': '<b>Normal</b> ist das Original: Das ganze Brett liegt offen.',
  'filler.regel.nebel':
    '<b>Nebel</b> zeigt dir nur dein eigenes Gebiet und die Felder, die direkt daran grenzen. Alles andere liegt grau - auch für den Gegner. Wo ein aufgedecktes Feld an sein Gebiet stößt, steht eine weiße Kante.',
  'filler.regel.build':
    '<b>Build</b> spielt auf offenem Brett, gibt aber jedem zehn Mauern. Eine Mauer steht zwischen zwei Feldern und hält beide Seiten auf - auch dich. Du darfst pro Zug eine setzen und danach ganz normal färben; erst das Färben gibt ab. Die ersten drei Züge der Partie sind mauerfrei - das Schloss auf dem Knopf zählt sie herunter; ab dem zweiten Zug des zweiten Spielers darf gebaut werden. Und du darfst kein Feld einmauern: Eine Kante, nach der ein freies Feld für niemanden mehr erreichbar wäre, lässt sich nicht bebauen - jedes Feld bleibt bis zum Ende zu holen. Auch den Gegner kannst du nicht einsperren.',
  'filler.regel.extreme':
    '<b>Extreme</b> ist Build auf einem großen Brett (12 × 11) mit sieben Farben, acht Sternfeldern und zwanzig Mauern. Ein Stern ist ein normales Feld mit einem weißen Stern darauf: Wer es schluckt, bekommt dafür zwei Punkte statt einem und eine Mauer dazu. Du darfst bis zu zwei Mauern in einem Zug setzen - wer zwei setzt, darf im nächsten eigenen Zug keine bauen, nur färben. Mauerfrei sind hier die ersten drei Züge jedes Spielers.',
  'filler.regel.ziel': 'Ziel',
  'filler.regel.zielText': 'Wer am Ende die meisten Felder hält, gewinnt - in Extreme die meisten Punkte.',
} satisfies Woerterbuch;
