import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „partykiste": was die Bildschirme der Partykiste
 * zeigen — Menü, Auswahl, Einstellungen, Lager, die Runden der Minispiele,
 * Wertung —, dazu die Namen und Ansagen der Minispiele.
 *
 * Wortlaut unverändert aus dem Code übernommen, wie er vor der Übersetzung
 * (45ec24f) im Bildschirm stand. Die Meldungen des Regelsatzes stehen nicht
 * hier, sondern in „regeln-partykiste" — ein Schlüssel steht in genau EINEM
 * Bereich.
 *
 * Platzhalter in geschweiften Klammern füllt `tz` (minispiele/partykiste/text.ts).
 * Einzahl und Mehrzahl stehen als eigene Schlüssel (`.eins` / `.mehr`): Wie
 * eine Sprache zählt, entscheidet die Sprache, nicht der Bildschirm.
 * Führende oder folgende Leerzeichen sind Absicht: Der Bildschirm hängt den
 * Text ohne eigenen Zwischenraum an (z. B. `bus.daneben`, `becher.trifft`).
 *
 * Eine Zeile je Schlüssel — Werkzeuge lesen diese Datei per Regex.
 */
export default {
  // Allgemein: Plätze, wer dran ist, Warten
  'partykiste.ui.platz': 'Platz {n}',
  'partykiste.ui.bot': 'Bot {n}',
  'partykiste.ui.du': 'du',
  'partykiste.ui.duBistDran': 'Du bist dran',
  'partykiste.ui.istDran': '{name} ist dran',
  'partykiste.ui.fehlenNoch': 'Es fehlen noch:',
  'partykiste.ui.gleichWeiter': 'Gleich geht es weiter …',
  'partykiste.ui.nochOffen.eins': 'Noch {n} Person …',
  'partykiste.ui.nochOffen.mehr': 'Noch {n} Leute …',
  'partykiste.ui.verdeckteKarte': 'verdeckte Karte',
  'partykiste.ui.verlassen': 'Verlassen',

  // Zähler: Schlucke im Trinkmodus, sonst Strafpunkte
  'partykiste.ui.zaehler.schluck.eins': 'Schluck',
  'partykiste.ui.zaehler.schluck.mehr': 'Schlücke',
  'partykiste.ui.zaehler.strafpunkt.eins': 'Strafpunkt',
  'partykiste.ui.zaehler.strafpunkt.mehr': 'Strafpunkte',

  // Kartenränge (Bus fahren, Königsbecher)
  'partykiste.ui.rang.11': 'B',
  'partykiste.ui.rang.12': 'D',
  'partykiste.ui.rang.13': 'K',
  'partykiste.ui.rang.14': 'A',

  // Härtegrade (`schluckFaktor`)
  'partykiste.ui.haerte.1': 'gemütlich',
  'partykiste.ui.haerte.2': 'normal',
  'partykiste.ui.haerte.3': 'kurzer Abend',

  // Namen der Minispiele
  'partykiste.ui.minispiel.name.imposter': 'Imposter',
  'partykiste.ui.minispiel.name.quiz': 'Allgemeinwissen',
  'partykiste.ui.minispiel.name.werbinich': 'Wer bin ich?',
  'partykiste.ui.minispiel.name.niemals': 'Ich hab noch nie',
  'partykiste.ui.minispiel.name.wereher': 'Wer würde eher?',
  'partykiste.ui.minispiel.name.busfahrer': 'Bus fahren',
  'partykiste.ui.minispiel.name.schaetzen': 'Schätzen',
  'partykiste.ui.minispiel.name.entweder': 'Entweder - oder',
  'partykiste.ui.minispiel.name.wahrheitpflicht': 'Wahrheit oder Pflicht',
  'partykiste.ui.minispiel.name.kategorien': 'Kategorien-Battle',
  'partykiste.ui.minispiel.name.mehrheit': 'Mehrheitsraten',
  'partykiste.ui.minispiel.name.regelkarte': 'Regel-Karte',
  'partykiste.ui.minispiel.name.bombe': 'Bombe',
  'partykiste.ui.minispiel.name.zehnsekunden': '10 Sekunden',
  'partykiste.ui.minispiel.name.koenigsbecher': 'Königsbecher',

  // Ansagen der Minispiele im Trinkmodus
  'partykiste.ui.minispiel.ansage.imposter': 'Einer hat ein anderes Wort. Reihum ein Satz - dann wird gezeigt.',
  'partykiste.ui.minispiel.ansage.quiz': 'Eine Frage, vier Antworten. Falsch heißt trinken.',
  'partykiste.ui.minispiel.ansage.werbinich': 'Du siehst alle Namen außer deinem. Frag die Runde aus.',
  'partykiste.ui.minispiel.ansage.niemals': 'Wer es doch getan hat, trinkt. Ehrlich bleiben ist billiger.',
  'partykiste.ui.minispiel.ansage.wereher': 'Zeig auf einen. Jede Stimme ist ein Schluck.',
  'partykiste.ui.minispiel.ansage.busfahrer': 'Rot oder Schwarz, höher oder tiefer, innen oder außen.',
  'partykiste.ui.minispiel.ansage.schaetzen': 'Eine Zahl. Wer am nächsten liegt, gewinnt - wer am weitesten weg ist, trinkt.',
  'partykiste.ui.minispiel.ansage.entweder': 'A oder B. Die Minderheit trinkt, bei Gleichstand alle.',
  'partykiste.ui.minispiel.ansage.wahrheitpflicht': 'Reihum: wählen, machen - oder kneifen und trinken.',
  'partykiste.ui.minispiel.ansage.kategorien': 'Reihum laut etwas nennen. Wer stockt oder doppelt, trinkt.',
  'partykiste.ui.minispiel.ansage.mehrheit': 'Selbst antworten - und tippen, was die Mehrheit sagt. Daneben heißt trinken.',
  'partykiste.ui.minispiel.ansage.regelkarte': 'Eine Regel für die nächsten zwei Runden. Jeder Verstoß ist ein Schluck.',
  'partykiste.ui.minispiel.ansage.bombe': 'Nenn etwas und gib weiter. Sie tickt - wer sie hält, wenn sie hochgeht, trinkt.',
  'partykiste.ui.minispiel.ansage.zehnsekunden': 'Drei Dinge in zehn Sekunden. Die Runde urteilt - nicht geschafft heißt trinken.',
  'partykiste.ui.minispiel.ansage.koenigsbecher': 'Reihum eine Karte ziehen, jede Karte ist eine Regel. Wen sie trifft, der trinkt.',

  // Dieselben Ansagen alkoholfrei — nur die Sätze, die vom Trinken reden
  'partykiste.ui.minispiel.ansageOhne.quiz': 'Eine Frage, vier Antworten. Falsch gibt einen Strafpunkt.',
  'partykiste.ui.minispiel.ansageOhne.niemals': 'Wer es doch getan hat, kassiert einen Strafpunkt. Ehrlich bleiben ist billiger.',
  'partykiste.ui.minispiel.ansageOhne.wereher': 'Zeig auf einen. Jede Stimme ist ein Strafpunkt.',
  'partykiste.ui.minispiel.ansageOhne.schaetzen': 'Eine Zahl. Wer am nächsten liegt, gewinnt - wer am weitesten weg ist, kassiert.',
  'partykiste.ui.minispiel.ansageOhne.entweder': 'A oder B. Die Minderheit kassiert, bei Gleichstand alle.',
  'partykiste.ui.minispiel.ansageOhne.wahrheitpflicht': 'Reihum: wählen, machen - oder kneifen und kassieren.',
  'partykiste.ui.minispiel.ansageOhne.kategorien': 'Reihum laut etwas nennen. Wer stockt oder doppelt, kassiert.',
  'partykiste.ui.minispiel.ansageOhne.mehrheit': 'Selbst antworten - und tippen, was die Mehrheit sagt. Daneben gibt einen Strafpunkt.',
  'partykiste.ui.minispiel.ansageOhne.regelkarte': 'Eine Regel für die nächsten zwei Runden. Jeder Verstoß ist ein Strafpunkt.',
  'partykiste.ui.minispiel.ansageOhne.bombe': 'Nenn etwas und gib weiter. Sie tickt - wer sie hält, wenn sie hochgeht, kassiert.',
  'partykiste.ui.minispiel.ansageOhne.zehnsekunden': 'Drei Dinge in zehn Sekunden. Die Runde urteilt - nicht geschafft gibt Strafpunkte.',
  'partykiste.ui.minispiel.ansageOhne.koenigsbecher': 'Reihum eine Karte ziehen, jede Karte ist eine Regel. Wen sie trifft, der kassiert.',

  // Auswahl: Modus, Themenpaket, Minispiele
  'partykiste.ui.auswahl.titel': 'Auswahl',
  'partykiste.ui.auswahl.modus': 'Modus',
  'partykiste.ui.auswahl.themenabendOhnePaket': 'Für den Themenabend unten ein Themenpaket wählen.',
  'partykiste.ui.auswahl.themenpakete': 'Themenpakete',
  'partykiste.ui.auswahl.themenpaket': 'Themenpaket',
  'partykiste.ui.auswahl.paketAlles': 'alles',
  'partykiste.ui.auswahl.paketAllesText': 'Ohne Thema',
  'partykiste.ui.auswahl.paketMischt': 'Hat ein Paket zu wenig eigene Inhalte, mischt die Kiste allgemeine dazu.',
  'partykiste.ui.auswahl.paketGesperrt': 'Gesperrte Pakete braucht nur, wer die Runde aufmacht - alle anderen spielen mit.',
  'partykiste.ui.auswahl.minispiele': 'Minispiele',
  'partykiste.ui.auswahl.minispieleLaden': 'Minispiele werden geladen …',
  'partykiste.ui.auswahl.zuWenig': 'Mindestens {n} Minispiele - sonst kommt dasselbe ständig wieder.',
  'partykiste.ui.auswahl.gemischt': 'Die angeklickten Spiele kommen gemischt dran, keins zweimal hintereinander.',
  'partykiste.ui.auswahl.vonAn': '{an} von {alle} an',
  'partykiste.ui.auswahl.alleAn': 'Alle an',
  'partykiste.ui.auswahl.gesperrt': 'gesperrt',
  'partykiste.ui.auswahl.ablauf.gleichzeitig': 'gleichzeitig',
  'partykiste.ui.auswahl.ablauf.reihum': 'reihum',

  // Spielmodi
  'partykiste.ui.modus.turnier.titel': 'Turnier',
  'partykiste.ui.modus.turnier.text': 'Jeder für sich, die Tabelle entscheidet.',
  'partykiste.ui.modus.eskalation.titel': 'Eskalation',
  'partykiste.ui.modus.eskalation.text': 'Wird von Drittel zu Drittel schärfer.',
  'partykiste.ui.modus.themenabend.titel': 'Themenabend',
  'partykiste.ui.modus.themenabend.text': 'Ein Themenpaket bestimmt den Abend.',
  'partykiste.ui.modus.team.titel': 'Team',
  'partykiste.ui.modus.team.text': 'Zwei Lager, gezählt wird fürs Lager.',

  // Themenpakete
  'partykiste.ui.paket.wg-abend': 'WG-Abend',
  'partykiste.ui.paket.jga': 'JGA',
  'partykiste.ui.paket.weihnachten': 'Weihnachten',
  'partykiste.ui.paket.studenten': 'Studenten',
  'partykiste.ui.paket.arbeit': 'Arbeit',

  // Inhaltsstufen
  'partykiste.ui.inhalt.titel': 'Inhalte',
  'partykiste.ui.inhalt.stufe.1': 'harmlos',
  'partykiste.ui.inhalt.stufe.2': 'pikant',
  'partykiste.ui.inhalt.stufe.3': 'derb',
  'partykiste.ui.inhalt.text.1': 'Geht an jedem Tisch.',
  'partykiste.ui.inhalt.text.2': 'Kneipenniveau, mal anzüglich.',
  'partykiste.ui.inhalt.text.3': 'Richtig derb, ab 18.',
  'partykiste.ui.inhalt.gemischt': 'gemischt',
  'partykiste.ui.inhalt.gemischtText': 'Zufall aus allen Stufen.',
  'partykiste.ui.inhalt.gemischtGast': 'Zufall aus harmlos und pikant.',
  'partykiste.ui.inhalt.derbGrundGast': 'nur mit Konto',

  // Chips der Regelzeile: Modus und Inhalte
  'partykiste.ui.chip.eskalation': 'Eskalation',
  'partykiste.ui.chip.eskalationStufe': 'Eskalation · Stufe {stufe} von 3',
  'partykiste.ui.chip.themenabend': 'Themenabend',
  'partykiste.ui.chip.themenabendPaket': 'Themenabend: {paket}',
  'partykiste.ui.chip.team': 'Team-Abend',
  'partykiste.ui.chip.inhalte': 'Inhalte {stufe}',
  'partykiste.ui.chip.inhalteBis': 'Inhalte bis {stufe}',
  'partykiste.ui.chip.inhalteSteigen': 'Inhalte steigen',
  'partykiste.ui.chip.inhalteGemischt': 'Inhalte gemischt',
  'partykiste.ui.chip.inhalteGemischtOhneDerb': 'Inhalte gemischt, ohne derb',
  'partykiste.ui.hinweis.gastDerb': 'Ein Gast spielt mit - „derb“ gibt es erst ohne Gast.',

  // Regelzeile
  'partykiste.ui.regelzeile.aria': 'Regelsatz dieses Tisches',
  'partykiste.ui.regelzeile.alle': 'alle {alle} Minispiele',
  'partykiste.ui.regelzeile.teil': '{anzahl} von {alle} Minispielen',
  'partykiste.ui.regelzeile.runden': '{n} Runden',
  'partykiste.ui.regelzeile.haerte': 'Härte {wert}',
  'partykiste.ui.regelzeile.steigt': 'steigt',
  'partykiste.ui.regelzeile.trinkmodus': 'Trinkmodus',
  'partykiste.ui.regelzeile.alkoholfrei': 'alkoholfrei',

  // Einstellungen
  'partykiste.ui.einstellungen.titel': 'Einstellungen',
  'partykiste.ui.einstellungen.trinkmodus': 'Trinkmodus',
  'partykiste.ui.einstellungen.trinkspiel': 'Trinkspiel',
  'partykiste.ui.einstellungen.alkoholfrei': 'Alkoholfrei',
  'partykiste.ui.einstellungen.runden': 'Runden',
  'partykiste.ui.einstellungen.haerte': 'Härte',
  'partykiste.ui.einstellungen.hinweisTrinken': 'Wer verliert, trinkt - die Härte nimmt alle Schlücke mal.',
  'partykiste.ui.einstellungen.hinweisOhne': 'Statt Schlücken gibt es Strafpunkte, die Härte nimmt sie mal. Die Punkte fürs Turnier bleiben gleich.',
  'partykiste.ui.einstellungen.hinweisGilt': 'Gilt für deine eigene Runde, online wie gegen Bots.',

  // Angebot einer offenen Runde
  'partykiste.ui.angebot.titel': 'Offene Runde',
  'partykiste.ui.angebot.titelVon': 'Offene Runde von {host}',
  'partykiste.ui.angebot.unlesbar': 'Die Regeln dieser Runde ließen sich nicht lesen.',
  'partykiste.ui.angebot.dortGelten': 'Dort gelten die Regeln der Runde, nicht deine Einstellungen.',
  'partykiste.ui.angebot.beitreten': 'Beitreten',
  'partykiste.ui.angebot.eigene': 'Eigene aufmachen',
  'partykiste.ui.angebot.abbrechen': 'Abbrechen',

  // Team-Abend: Lager
  'partykiste.ui.lager.name': 'Lager {lager}',
  'partykiste.ui.lager.vorRunde1': 'Vor Runde 1',
  'partykiste.ui.lager.aufstellen': 'Lager aufstellen',
  'partykiste.ui.lager.tippe': 'Tippe auf einen Namen, um ihn ins andere Lager zu setzen.',
  'partykiste.ui.lager.stelltAuf': '{name} stellt die Lager auf …',
  'partykiste.ui.lager.los': 'Los geht’s',
  'partykiste.ui.lager.stand': 'Stand der Lager',
  'partykiste.ui.lager.ungleich': 'Die Lager sind ungleich groß - es entscheidet der Schnitt je Kopf.',

  // Wer zuletzt getippt hat
  'partykiste.ui.letzter.du': 'Du warst Letzter - {folge}',
  'partykiste.ui.letzter.wer': '{name} war Letzter - {folge}',
  'partykiste.ui.letzter.trinkt': '{zahl} {wort}!',
  'partykiste.ui.letzter.ein': 'ein',
  'partykiste.ui.letzter.glueck': 'Glück gehabt!',

  // Wertung nach der Runde
  'partykiste.ui.wertung.punkte': '+{n} Punkte',
  'partykiste.ui.wertung.keine': 'keine Punkte',
  'partykiste.ui.wertung.fuerDich': '{n} {wort} für dich',
  'partykiste.ui.wertung.warten': 'Warten auf die anderen …',
  'partykiste.ui.wertung.weiter': 'Weiter',

  // „Passt nicht" — Gründe beim Melden eines Inhalts
  'partykiste.ui.passtNicht.grund.sinnlos': 'ergibt keinen Sinn',
  'partykiste.ui.passtNicht.grund.zu-zahm': 'zu zahm für die Stufe',
  'partykiste.ui.passtNicht.grund.zu-hart': 'zu hart für die Stufe',
  'partykiste.ui.passtNicht.grund.unbekannt': 'kennt keiner',
  'partykiste.ui.passtNicht.grund.falsch': 'falsch',
  'partykiste.ui.passtNicht.grund.sonstiges': 'sonstiges',

  // Imposter
  'partykiste.ui.imposter.hinweis': 'Hinweis: {hinweis}',
  'partykiste.ui.imposter.reihenfolge': 'Redereihenfolge',
  'partykiste.ui.imposter.duBistEs': 'Du bist es - zeig es niemandem',
  'partykiste.ui.imposter.deinWortGeheim': 'Dein Wort - zeig es niemandem',
  'partykiste.ui.imposter.reiheAnsage': 'Redereihenfolge - jeder sagt einen Satz zum Wort:',
  'partykiste.ui.imposter.gesehen': 'Gesehen',
  'partykiste.ui.imposter.duBistImposter': 'Du bist der Imposter',
  'partykiste.ui.imposter.deinWort': 'Dein Wort',
  'partykiste.ui.imposter.rederunde': '{n}. Rederunde - ',
  'partykiste.ui.imposter.reihum': 'Reihum ein Satz, in dieser Reihenfolge. Dann: Wer passt nicht?',
  'partykiste.ui.imposter.nochmal': 'Noch eine Runde reden',
  'partykiste.ui.imposter.noetig': '{ist} von {soll} nötig',
  'partykiste.ui.imposter.ertappt': 'Ertappt!',
  'partykiste.ui.imposter.durchgekommen': 'Durchgekommen',
  'partykiste.ui.imposter.duWarstEs': 'Du warst es',
  'partykiste.ui.imposter.warEs': '{name} war es',
  'partykiste.ui.imposter.wortDerRunde': 'Wort der Runde:',
  'partykiste.ui.imposter.zeigteAuf': 'zeigte auf {name}',

  // Allgemeinwissen
  'partykiste.ui.quiz.keineAntwort': 'keine Antwort',

  // Wer bin ich?
  'partykiste.ui.werbinich.fragAus': 'Frag die Runde aus',
  'partykiste.ui.werbinich.nurJaNein': 'Nur Ja-Nein-Fragen. Die Runde antwortet laut.',
  'partykiste.ui.werbinich.antwortet': 'Antwortet nur mit Ja oder Nein.',
  'partykiste.ui.werbinich.erraten': 'Erraten!',
  'partykiste.ui.werbinich.aufgeben': 'Aufgeben',

  // Ich hab noch nie
  'partykiste.ui.niemals.getan': 'hat es getan',
  'partykiste.ui.niemals.nochNie': 'noch nie',
  'partykiste.ui.niemals.habIch': 'Hab ich',
  'partykiste.ui.niemals.nochNieKnopf': 'Noch nie',

  // Bus fahren
  'partykiste.ui.bus.frage.0': 'Rot oder Schwarz?',
  'partykiste.ui.bus.frage.1': 'Höher oder tiefer?',
  'partykiste.ui.bus.frage.2': 'Innen oder außen?',
  'partykiste.ui.bus.wahl.0.0': 'Rot',
  'partykiste.ui.bus.wahl.0.1': 'Schwarz',
  'partykiste.ui.bus.wahl.1.0': 'Höher',
  'partykiste.ui.bus.wahl.1.1': 'Tiefer',
  'partykiste.ui.bus.wahl.2.0': 'Innen',
  'partykiste.ui.bus.wahl.2.1': 'Außen',
  'partykiste.ui.bus.ausgefahren': 'Ausgefahren',
  'partykiste.ui.bus.duFaehrst': 'Du fährst',
  'partykiste.ui.bus.faehrt': '{name} fährt',
  'partykiste.ui.bus.richtig': 'richtig',
  'partykiste.ui.bus.daneben': 'daneben, ein {wort}',
  'partykiste.ui.bus.dreiTipps': 'Drei richtige Tipps, dann ist der Nächste dran.',
  'partykiste.ui.bus.treffer': '{n} von 3',

  // Schätzen
  'partykiste.ui.schaetzen.antwort': 'Die Antwort',
  'partykiste.ui.schaetzen.keine': 'keine Schätzung',
  'partykiste.ui.schaetzen.antwortIn': 'Antwort in {einheit}',
  'partykiste.ui.schaetzen.deine': 'Deine Schätzung:',
  'partykiste.ui.schaetzen.zahl': 'Zahl',
  'partykiste.ui.schaetzen.schaetzungIn': 'Schätzung in {einheit}',
  'partykiste.ui.schaetzen.tippen': 'Tippen',

  // Entweder - oder
  'partykiste.ui.entweder.oder': 'oder',
  'partykiste.ui.entweder.gleichstand': 'Gleichstand - alle trinken.',
  'partykiste.ui.entweder.minderheit': 'Die Minderheit trinkt.',
  'partykiste.ui.entweder.keineWahl': 'keine Wahl',

  // Wahrheit oder Pflicht
  'partykiste.ui.wp.vorbei': 'Vorbei',
  'partykiste.ui.wp.alleDurch': 'Alle durch',
  'partykiste.ui.wp.frage': 'Wahrheit oder Pflicht?',
  'partykiste.ui.wp.wahrheit': 'Wahrheit',
  'partykiste.ui.wp.pflicht': 'Pflicht',
  'partykiste.ui.wp.machEs': 'Mach es vor der Runde. Dann ehrlich tippen.',
  'partykiste.ui.wp.zuschauen': 'Zuschauen - und dann entscheiden, ob das zählt.',
  'partykiste.ui.wp.gemacht': 'Gemacht',
  'partykiste.ui.wp.gekniffen': 'Gekniffen',
  'partykiste.ui.wp.gemachtKlein': 'gemacht',
  'partykiste.ui.wp.gekniffenKlein': 'gekniffen',

  // Kategorien-Battle
  'partykiste.ui.kat.benannt': 'Von der Runde benannt',
  'partykiste.ui.kat.gestockt': 'Gestockt',
  'partykiste.ui.kat.leergespielt': 'Leergespielt',
  'partykiste.ui.kat.duVerloren': 'Du hast verloren',
  'partykiste.ui.kat.verloren': '{name} hat verloren',
  'partykiste.ui.kat.niemand': 'Niemand ist gestockt',
  'partykiste.ui.kat.nennungen': '{n} Nennungen zu „{kategorie}"',
  'partykiste.ui.kat.duNenn': 'Du bist dran - nenn etwas',
  'partykiste.ui.kat.stand': '{n} genannt · Runde {runde} von {gesamt} um den Tisch',
  'partykiste.ui.kat.genannt': 'Genannt',
  'partykiste.ui.kat.gestocktKnopf': 'Gestockt',
  'partykiste.ui.kat.einspruch': 'Einspruch',
  'partykiste.ui.kat.stockt': 'Stockt!',
  'partykiste.ui.kat.doppelt': 'Doppelt!',

  // Mehrheitsraten
  'partykiste.ui.mehrheit.gleichstand': 'Gleichstand - keine Mehrheit, alle lagen daneben.',
  'partykiste.ui.mehrheit.ergebnis': 'Die Mehrheit: {seite}',
  'partykiste.ui.mehrheit.keinTipp': 'kein Tipp',
  'partykiste.ui.mehrheit.sagtTippt': 'sagt {sagt}, tippt {tippt}',
  'partykiste.ui.mehrheit.deinStand': 'Du: {eigene} · Dein Tipp: {tipp}',
  'partykiste.ui.mehrheit.schritt1': 'Schritt 1 - was sagst du?',
  'partykiste.ui.mehrheit.schritt2': 'Schritt 2 - was sagt die Mehrheit?',
  'partykiste.ui.mehrheit.du': 'Du: {eigene}',
  'partykiste.ui.mehrheit.sagt': 'Die Mehrheit sagt …',
  'partykiste.ui.mehrheit.aendern': 'Eigene Antwort ändern',

  // Regel-Karte
  'partykiste.ui.regel.abJetzt': 'Ab jetzt gilt',
  'partykiste.ui.regel.neu': 'Neue Regel',
  'partykiste.ui.regel.bisSchluss': 'Gilt bis zum Schluss.',
  'partykiste.ui.regel.bisRunde': 'Gilt bis zum Ende von Runde {n}.',
  'partykiste.ui.regel.melden': 'Wer verstößt, meldet sich selbst - oder die Runde meldet ihn.',
  'partykiste.ui.regel.verstanden': 'Verstanden',
  'partykiste.ui.regel.geltend': 'Geltende Regel',
  'partykiste.ui.regel.marke': 'Regel',
  'partykiste.ui.regel.bisRundeKurz': 'bis Runde {n}',
  'partykiste.ui.regel.verstoesse': 'Verstöße:',
  'partykiste.ui.regel.ichVerstoss': 'Ich hab verstoßen',
  'partykiste.ui.regel.dochNicht': 'Doch nicht',
  'partykiste.ui.regel.melde': 'Jemanden melden',
  'partykiste.ui.regel.anklage': '{name}: {ist} von {soll} Stimmen - dann ist es ein {wort}.',
  'partykiste.ui.regel.mehrheitZaehlt': 'Es zählt, wenn die Mehrheit denselben meldet.',

  // Bombe
  'partykiste.ui.bombe.hoch': 'Die Bombe ist hochgegangen',
  'partykiste.ui.bombe.tickt': 'Die Bombe tickt',
  'partykiste.ui.bombe.bumm': 'BUMM',
  'partykiste.ui.bombe.entschaerft': 'Entschärft',
  'partykiste.ui.bombe.duHattest': 'Du hattest sie',
  'partykiste.ui.bombe.hatte': '{name} hatte sie',
  'partykiste.ui.bombe.niemand': 'Niemand mehr da, dem man sie geben könnte',
  'partykiste.ui.bombe.weitergaben.eins': '{n} Weitergabe zu „{kategorie}"',
  'partykiste.ui.bombe.weitergaben.mehr': '{n} Weitergaben zu „{kategorie}"',
  'partykiste.ui.bombe.duHast': 'Du hast die Bombe - nenn etwas und gib weiter!',
  'partykiste.ui.bombe.hat': '{name} hat die Bombe',
  'partykiste.ui.bombe.server': 'Wann sie hochgeht, weiß nur der Server.',
  'partykiste.ui.bombe.weiter': 'Genannt - weiter!',

  // 10 Sekunden
  'partykiste.ui.zehn.du': 'Du',
  'partykiste.ui.zehn.geschafft': 'Geschafft',
  'partykiste.ui.zehn.nichtGeschafft': 'Nicht geschafft',
  'partykiste.ui.zehn.drei': 'Drei: {aufgabe}',
  'partykiste.ui.zehn.duGesprochen': 'Du hast gesprochen.',
  'partykiste.ui.zehn.gesprochen': '{name} hat gesprochen.',
  'partykiste.ui.zehn.geschafftKlein': 'geschafft',
  'partykiste.ui.zehn.nichtGeschafftKlein': 'nicht geschafft',
  'partykiste.ui.zehn.keinUrteil': 'kein Urteil',
  'partykiste.ui.zehn.dinge': '{n} Dinge in zehn Sekunden',
  'partykiste.ui.zehn.aufgabeKommt': 'Die Aufgabe kommt mit „Los" - für alle gleichzeitig, und die Uhr läuft auf dem Server.',
  'partykiste.ui.zehn.los': 'Los',
  'partykiste.ui.zehn.gleichUhr': 'Gleich geht die Uhr los …',
  'partykiste.ui.zehn.nenne': 'Nenne {n}!',
  'partykiste.ui.zehn.nennt': '{name} nennt {n}',
  'partykiste.ui.zehn.fertig': 'Fertig',
  'partykiste.ui.zehn.zuhoeren': 'Zuhören - gleich wird geurteilt.',
  'partykiste.ui.zehn.hastDu': 'Hast du {n} geschafft? Ehrlich sein - niemand sonst hat zugehört.',
  'partykiste.ui.zehn.rundeUrteilt': 'Die Runde urteilt',
  'partykiste.ui.zehn.hat': 'Hat {name} {n} geschafft?',
  'partykiste.ui.zehn.geurteilt': '{ist} von {soll} geurteilt',

  // Königsbecher
  'partykiste.ui.becher.dich': 'dich',
  'partykiste.ui.becher.jemand': 'Jemand',
  'partykiste.ui.becher.stapel': '{n} Karten im Stapel',
  'partykiste.ui.becher.assDu': 'Du hast das Ass gezogen - alle trinken!',
  'partykiste.ui.becher.assDuOhne': 'Du hast das Ass gezogen - alle kassieren!',
  'partykiste.ui.becher.ass': '{name} hat das Ass gezogen - alle trinken!',
  'partykiste.ui.becher.assOhne': '{name} hat das Ass gezogen - alle kassieren!',
  'partykiste.ui.becher.um': 'Die Runde ist um',
  'partykiste.ui.becher.handHoch': 'Hand hoch!',
  'partykiste.ui.becher.leg': 'Leg deine Karte auf die Flasche',
  'partykiste.ui.becher.legt': '{name} legt die Karte auf die Flasche',
  'partykiste.ui.becher.zeig': 'Zeig auf jemanden',
  'partykiste.ui.becher.duZiehst': 'Du ziehst',
  'partykiste.ui.becher.zeigt': '{name} zeigt auf jemanden',
  'partykiste.ui.becher.zieht': '{name} zieht',
  'partykiste.ui.becher.deineKarte': 'Deine Karte',
  'partykiste.ui.becher.karteVon': '{name}s Karte',
  'partykiste.ui.becher.keineKarte': 'Noch keine Karte',
  'partykiste.ui.becher.trifft': ' - trifft {wen}',
  'partykiste.ui.becher.koenige.eins': 'Becher: {n} König',
  'partykiste.ui.becher.koenige.mehr': 'Becher: {n} Könige',
  'partykiste.ui.becher.handHochKnopf': 'Hand hoch',
  'partykiste.ui.becher.oben': 'Oben! Wer als Letzter tippt, kassiert.',
  'partykiste.ui.becher.ziehen': 'Karte ziehen',
  'partykiste.ui.becher.duTrinkst': 'Du trinkst',
  'partykiste.ui.becher.trinkt': '{name} trinkt',
  'partykiste.ui.becher.nachRunde': 'Nach dieser Runde gilt',
  'partykiste.ui.becher.letzterKoenig': 'hat den letzten König',
  'partykiste.ui.becher.gezogen': '{ist}/{soll} gezogen',
} satisfies Woerterbuch;
