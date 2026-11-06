import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „poker": Menü, Lobby und Tisch von Poker
 * (`screens/EasyPoker.tsx`). Vorher fest im Bildschirm, Wortlaut unverändert —
 * die Tests in `EasyPoker.neu.test.tsx` suchen danach.
 *
 * Die Zugnamen (Fold, Check, Call, Bet) standen schon im Deutschen englisch und
 * bleiben so. `poker.zug.erhoehen` gibt es, weil das Englische zwischen „Bet"
 * (nichts offen) und „Raise" (es steht schon ein Einsatz) unterscheidet; im
 * Deutschen hieß beides immer „Bet".
 */
export default {
  'poker.titel': 'Poker',
  'poker.unter': 'Zwei Karten, bis zu sechs am Tisch, vier Knöpfe.',
  'poker.regelnNachlesen': 'Regeln nachlesen',
  'poker.info': 'Info',

  // Die drei fertigen Einsätze.
  'poker.vorgabe.locker': 'Locker',
  'poker.vorgabe.abend': 'Abend',
  'poker.vorgabe.hoch': 'Hoch',

  'poker.fehler.jetons': 'Dafür fehlen dir BroJetons. Im Shop gibt es welche gegen Münzen.',
  'poker.fehler.aufmachen': 'Der Tisch liess sich nicht aufmachen. Noch einmal versuchen?',
  'poker.fehler.suche': 'Die Suche ist fehlgeschlagen. Noch einmal versuchen?',
  'poker.fehler.liste': 'Die Tischliste liess sich nicht laden.',
  'poker.fehler.platzWeg': 'Der Platz ist weg. Einen anderen Tisch versuchen?',

  // Einsatz-Blatt.
  'poker.einsatz.titel': 'Einsatz einstellen',
  'poker.einsatz.erklaerung': 'Wer den Tisch aufmacht, setzt den Mindest-Einsatz und die Blinds. Die anderen bringen denselben Stapel mit.',
  'poker.einsatz.vorgabe': 'Vorgabe',
  'poker.einsatz.vorgabeName': 'Einsatzvorgabe',
  'poker.einsatz.mindest': 'Mindest-Einsatz',
  'poker.einsatz.kleinerBlind': 'Kleiner Blind',
  'poker.einsatz.grosserBlind': 'Großer Blind',
  'poker.einsatz.ungueltig': 'Der große Blind muss über dem kleinen liegen, und der Einsatz mindestens das Zehnfache des großen Blinds sein.',
  'poker.einsatz.soSpielen': 'So spielen',
  'poker.einsatz.kurz': '{einsatz} · Blinds {blinds}',
  'poker.einsatz.lang': 'Mindest-Einsatz {einsatz} · Blinds {blinds}',

  // Online-Tisch (Lobby).
  'poker.lobby.titel': 'Online-Tisch',
  'poker.lobby.zurueck': 'Zurück zum Pokermenü',
  'poker.lobby.suchen': 'Passenden Tisch suchen',
  'poker.lobby.suchenUnter': 'gleicher Einsatz · sonst neu aufmachen',
  'poker.lobby.eigener': 'Eigenen Tisch aufmachen',
  'poker.lobby.eigenerUnter': '6 Plätze · deine Blinds',
  'poker.lobby.offene': 'Offene Tische',
  'poker.lobby.laedt': 'Tische werden geladen…',
  'poker.lobby.leer': 'Gerade wartet niemand. Mach den ersten Tisch auf.',
  'poker.lobby.tisch': 'Tisch',
  'poker.lobby.zuHoch': 'Zu hoch',
  'poker.lobby.beitreten': 'Beitreten',

  // Hauptmenü.
  'poker.menue.sofort': 'Sofort spielen',
  'poker.menue.sofortUnter': 'gegen den Computer · {n} Plätze',
  'poker.menue.online': 'Online spielen',
  'poker.menue.fehltJetons': 'Für diesen Einsatz brauchst du {n} BroJetons. Im Shop gibt es welche gegen Münzen.',
  'poker.menue.name': 'Name',
  'poker.menue.namePlatzhalter': 'Name…',
  'poker.menue.nameAmTisch': 'Name am Tisch',
  'poker.menue.einsatz': 'Einsatz',
  'poker.menue.eigenenEinsatz': 'Eigenen Einsatz…',
  'poker.menue.eigenerEinsatz': 'Eigener Einsatz',
  'poker.menue.spieler': 'Spieler',
  'poker.menue.spielerzahl': 'Spielerzahl',
  'poker.menue.gegenComputer': 'Du gegen den Computer',
  'poker.menue.mitComputern': 'Du und {n} Computer',

  // Warten am Tisch.
  'poker.warten.titel': 'Am Tisch',
  'poker.warten.besetzt': '{besetzt} von {gesamt} Plätzen besetzt',
  'poker.warten.verbindung': 'Verbindung wird aufgebaut…',
  'poker.warten.einsatz': ' · Mindest-Einsatz {einsatz} · Blinds {blinds}',
  'poker.warten.abbrechen': 'Abbrechen',
  'poker.warten.starten': 'Jetzt starten',
  'poker.warten.startenUnter': 'zu {n} · ohne Auffüllen',
  'poker.warten.auffuellen': 'Mit Computern auffüllen',
  'poker.warten.auffuellenUnter': 'und loslegen',
  'poker.warten.plaetze': 'Plätze',
  'poker.warten.computer': 'Computer',
  'poker.warten.frei': 'Frei',
  'poker.warten.aktiv': '{n} Spieler gerade am Tisch',

  // Am Filz.
  'poker.du': 'Du',
  'poker.platz': 'Platz {nr}',
  'poker.duBistDran': 'Du bist dran',
  'poker.ueberlegt': '{name} überlegt…',
  'poker.wirdGezeigt': 'Es wird gezeigt…',
  'poker.verlassen': 'Spiel verlassen',
  'poker.kopf.hand': 'Hand {nr}/{von}',
  'poker.punktestand': 'Dein Punktestand',
  'poker.topf': 'Topf',
  'poker.marke.geber': 'Geber',
  'poker.marke.geberKurz': 'G',
  'poker.verbindung': 'Verbindung…',

  'poker.strasse.preflop': 'Vor dem Flop',
  'poker.strasse.flop': 'Flop',
  'poker.strasse.turn': 'Turn',
  'poker.strasse.river': 'River',

  'poker.zug.fold': 'Fold',
  'poker.zug.check': 'Check',
  'poker.zug.call': 'Call',
  'poker.zug.bet': 'Bet',
  'poker.zug.erhoehen': 'Bet',

  'poker.kombi.1': 'Höchste Karte',
  'poker.kombi.2': 'Ein Paar',
  'poker.kombi.3': 'Zwei Paare',
  'poker.kombi.4': 'Drilling',
  'poker.kombi.5': 'Straße',
  'poker.kombi.6': 'Flush',
  'poker.kombi.7': 'Full House',
  'poker.kombi.8': 'Vierling',
  'poker.kombi.9': 'Straight Flush',

  // Ergebnis einer Hand.
  'poker.band.geteilt': 'Geteilter Topf',
  'poker.band.gewonnen': '+{n} gewonnen',
  'poker.band.verloren': 'Hand verloren',
  'poker.band.ausgestiegen': 'Die anderen sind ausgestiegen.',
  'poker.band.gefoldet': 'Du hast gefoldet.',
  'poker.band.duHattest': 'Du hattest {kombi}.',

  // Ende der Partie.
  'poker.ende.unentschieden': 'Unentschieden',
  'poker.ende.gewonnen': 'Gewonnen!',
  'poker.ende.verloren': 'Verloren',
  'poker.ende.text': '{nr} von {von} Händen gespielt · Start waren {jetons} Jetons',
  'poker.ende.nochmal': 'Noch eine Runde',
  'poker.ende.zurueck': 'Zurück zur Spielauswahl',

  // Setzen.
  'poker.setzen.titel': 'Wie viel setzen?',
  'poker.setzen.regler': 'Einsatz, {min} bis {max}',
  'poker.setzen.schnellwahl': 'Schnellwahl',
  'poker.setzen.min': 'Min',
  'poker.setzen.halberTopf': '½ Topf',
  'poker.setzen.topf': 'Topf',
  'poker.setzen.allIn': 'All-in',
  'poker.setzen.knopf': 'Bet {n}',
  'poker.setzen.knopfErhoehen': 'Bet {n}',
  'poker.setzen.allInKlein': 'all-in',
  'poker.setzen.abbrechen': 'Abbrechen',

  // Regelblatt. `{fuenf}` wird fett eingesetzt (poker.regeln.ziel.fuenf).
  'poker.regeln.titel': 'So geht Poker',
  'poker.regeln.verstanden': 'Verstanden',
  'poker.regeln.ziel': 'Ziel',
  'poker.regeln.ziel.text': 'Jeder bekommt zwei verdeckte Karten. In der Mitte liegen nach und nach fünf offene Karten. Wer aus seinen zwei und den fünf offenen die besten {fuenf} Karten bildet, gewinnt den Topf. Am Tisch sitzen zwei bis sechs.',
  'poker.regeln.ziel.fuenf': 'fünf',
  'poker.regeln.blinds': 'Die Blinds',
  'poker.regeln.blinds.text': 'Vor jeder Hand zahlen zwei Sitze einen Pflicht-Einsatz: den kleinen Blind (SB) und den großen Blind (BB). Zu zweit zahlt der Geber den kleinen, der andere den großen. Zu dritt und mehr sitzt der kleine Blind links vom Geber, der große links davon. Der Knopf wandert jede Hand weiter.',
  'poker.regeln.knoepfe': 'Die vier Knöpfe',
  'poker.regeln.fold': 'aussteigen. Du verlierst, was du schon gesetzt hast, mehr nicht.',
  'poker.regeln.check': 'weiter, ohne zu setzen. Geht nur, wenn nichts offen steht.',
  'poker.regeln.call': 'den offenen Einsatz bezahlen. Die Zahl auf dem Knopf ist der Preis.',
  'poker.regeln.bet': 'setzen oder erhöhen. Auch hier steht der Betrag auf dem Knopf.',
  'poker.regeln.ablauf': 'Der Ablauf',
  'poker.regeln.ablauf.text': 'Vor dem Flop · Flop (drei Karten) · Turn (eine) · River (eine). Vor jeder neuen Karte wird gesetzt. Wer als Letzter nicht gefoldet hat, gewinnt ohne Zeigen. Sonst werden die Hände verglichen. Wer all-in weniger setzen konnte als die anderen, spielt nur um den Topf bis zu seinem Beitrag - der Rest ist ein Nebentopf.',
  'poker.regeln.rang': 'Was schlägt was',
  'poker.regeln.rang.9': 'fünf in Reihe, alle gleiche Farbe',
  'poker.regeln.rang.8': 'vier gleiche Werte',
  'poker.regeln.rang.7': 'Drilling und Paar',
  'poker.regeln.rang.6': 'fünf gleiche Farbe',
  'poker.regeln.rang.5': 'fünf in Reihe',
  'poker.regeln.rang.4': 'drei gleiche Werte',
  'poker.regeln.fuss': 'Gespielt wird mit BroJetons. Die kauft man im Shop gegen Münzen; zurück in Münzen gehen sie nicht. Wer den Tisch aufmacht, stellt Mindest-Einsatz und die Blinds ein.',
} satisfies Woerterbuch;
