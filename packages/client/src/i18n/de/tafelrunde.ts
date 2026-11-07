import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „tafelrunde": was die Bildschirme der Tafelrunde
 * zeigen — Einstieg, Suche, Wartesaal, Rüstkammer, Kampf, Endbild, Regeln —,
 * dazu die Namen der Einheiten und Marken.
 *
 * Der Wortlaut ist der, der bis zur Übersetzung (45ec24f) fest im Code stand;
 * die Datei fehlte in jenem Commit, und der Bildschirm zeigte rohe Schlüssel.
 *
 * Platzhalter in geschweiften Klammern füllt `tz` (minispiele/tafelrunde/text.ts).
 * Einzahl und Mehrzahl stehen als eigene Schlüssel (`.eins` / `.mehr`).
 * Texte, die mit „ · " oder „, " beginnen, hängt der Bildschirm an einen
 * anderen an — das Trennzeichen gehört deshalb in den Text.
 *
 * Einheiten (`tafelrunde.einheit.<id>`) und Marken (`tafelrunde.marke.<marke>`
 * samt `.wirkung`) stehen exakt so da, wie packages/game-tafelrunde sie nennt
 * (katalog.ts, synergien.ts). Gezeigt werden sie auf Deutsch NIE — dort gilt
 * der Text aus der Sicht (`nachschlagen` in minispiele/tafelrunde/text.ts);
 * sie stehen hier nur, weil die Probe zu jedem englischen Schlüssel einen
 * deutschen verlangt. Ändert das Modul einen Namen, gehört die englische
 * Fassung nachgezogen.
 *
 * Eine Zeile je Schlüssel — packages/server/test/woerterbuch.ts liest diese
 * Datei per Regex.
 */
export default {
  // Allgemein
  'tafelrunde.ui.abbrechen': 'Abbrechen',
  'tafelrunde.ui.zurueck': 'Zurück',
  'tafelrunde.ui.zurueckZumMenue': 'Zurück zum Menü',
  'tafelrunde.ui.schliessen': 'Schließen',
  'tafelrunde.ui.blattSchliessen': 'Blatt schließen',
  'tafelrunde.ui.code': 'Code',
  'tafelrunde.ui.verbindung': 'Verbindung wird aufgebaut…',
  'tafelrunde.ui.runde': 'Runde {n}',
  'tafelrunde.ui.einheit': 'Einheit',
  'tafelrunde.ui.tischVon': 'Tisch von {name}',
  'tafelrunde.ui.offenerTisch': 'Offener Tisch',
  'tafelrunde.ui.plaetzeBesetzt': '{belegt} von {plaetze} Plätzen besetzt',
  'tafelrunde.ui.sitz.ki': 'KI',
  'tafelrunde.ui.sitz.nummer': 'Sitz {n}',

  // Rollen
  'tafelrunde.ui.rolle.wache': 'Wache',
  'tafelrunde.ui.rolle.schuetze': 'Schütze',
  'tafelrunde.ui.rolle.magier': 'Magier',
  'tafelrunde.ui.rolle.meuchler': 'Meuchler',
  'tafelrunde.ui.rolle.beistand': 'Beistand',

  // Bot-Stufen
  'tafelrunde.ui.bot.sanft': 'Sanft',
  'tafelrunde.ui.bot.normal': 'Normal',
  'tafelrunde.ui.bot.hart': 'Hart',

  // Einstieg
  'tafelrunde.ui.einstieg.unter': 'Auto-Battler · bis zu 8 Spieler',
  'tafelrunde.ui.einstieg.mitspielerzahl': '{n} Spieler gerade in Tafelrunde',
  'tafelrunde.ui.einstieg.suchen': 'Mitspieler suchen',
  'tafelrunde.ui.einstieg.text': 'Kaufe Recken, stelle sie aufs Feld und lege drei gleiche zusammen - aus dreien wird eine stärkere. Wer am längsten steht, gewinnt.',
  'tafelrunde.ui.einstieg.mitFreunden': 'Mit Freunden',
  'tafelrunde.ui.einstieg.erstellen': 'Tisch erstellen',
  'tafelrunde.ui.einstieg.beitreten': 'Tisch beitreten',
  'tafelrunde.ui.einstieg.allein': 'Allein',
  'tafelrunde.ui.einstieg.gegenBots': 'Gegen Bots spielen',
  'tafelrunde.ui.einstieg.anleitung': 'Anleitung',
  'tafelrunde.ui.einstieg.anleitungUnter': 'Laden, Verschmelzen, Klassen, Kampf',

  // Suche
  'tafelrunde.ui.suche.abbrechen': 'Suche abbrechen',
  'tafelrunde.ui.suche.niemand': 'Noch niemand sonst - bleibt es dabei, wird mit Bots aufgefüllt.',
  'tafelrunde.ui.suche.gefunden': '{n} Spieler gefunden',

  // Tisch erstellen
  'tafelrunde.ui.erstellen.unter': 'Tafelrunde · Tisch mit Code',
  'tafelrunde.ui.erstellen.aufmachen': 'Tisch aufmachen',
  'tafelrunde.ui.erstellen.hinweisOffen': 'Der Tisch steht in der Liste und ist zusätzlich über seinen Code erreichbar.',
  'tafelrunde.ui.erstellen.hinweisCode': 'Nur wer den Code hat, kommt an diesen Tisch. Du startest, wann du willst.',
  'tafelrunde.ui.erstellen.plaetze': 'Plätze',
  'tafelrunde.ui.erstellen.fuerWen': 'Für wen',
  'tafelrunde.ui.erstellen.nurMitCode': 'Nur mit Code',
  'tafelrunde.ui.erstellen.offenFuerAlle': 'Offen für alle',
  'tafelrunde.ui.erstellen.freiePlaetze': 'Freie Plätze',
  'tafelrunde.ui.erstellen.mitBotsFuellen': 'Mit Bots füllen',
  'tafelrunde.ui.erstellen.freiLassen': 'Frei lassen',
  'tafelrunde.ui.erstellen.botStaerke': 'Wie hart spielen die Bots',

  // Tisch beitreten
  'tafelrunde.ui.beitreten.unter': 'Mit Code oder an einen offenen Tisch',
  'tafelrunde.ui.beitreten.knopf': 'Beitreten',
  'tafelrunde.ui.beitreten.text': 'Tippe den Code ein, den du bekommen hast - oder nimm einen offenen Tisch.',
  'tafelrunde.ui.beitreten.code': 'Beitrittscode',
  'tafelrunde.ui.beitreten.vorschau': '{tisch} · {belegt}/{plaetze} Plätzen besetzt',
  'tafelrunde.ui.beitreten.offeneTische': 'Offene Tische',
  'tafelrunde.ui.beitreten.keinTisch': 'Gerade steht kein offener Tisch. Mach selbst einen auf.',

  // Wartesaal und Aufbau
  'tafelrunde.ui.wartesaal.titel': 'Dein Tisch',
  'tafelrunde.ui.wartesaal.unter': 'Tafelrunde · Warten auf Mitspieler',
  'tafelrunde.ui.wartesaal.verlassen': 'Tisch verlassen',
  'tafelrunde.ui.wartesaal.starten': 'Partie starten',
  'tafelrunde.ui.wartesaal.hinweisBots': 'Freie Plätze übernehmen Bots - du kannst sofort losspielen.',
  'tafelrunde.ui.wartesaal.hinweisZuWenige': 'Ohne Bots braucht es mindestens einen Mitspieler.',
  'tafelrunde.ui.wartesaal.hinweisMenschen': 'Es spielen {n} Menschen, die leeren Plätze fallen weg.',
  'tafelrunde.ui.wartesaal.codeLabel': 'Beitrittscode {code}',
  'tafelrunde.ui.wartesaal.codeKopiert': 'Code kopiert',
  'tafelrunde.ui.wartesaal.codeKopieren': 'Code kopieren',
  'tafelrunde.ui.wartesaal.linkKopiert': 'Link kopiert',
  'tafelrunde.ui.wartesaal.linkKopieren': 'Link kopieren',
  'tafelrunde.ui.wartesaal.amTisch': 'Am Tisch',
  'tafelrunde.ui.wartesaal.bot': 'Bot',
  'tafelrunde.ui.wartesaal.freierPlatz': 'Freier Platz',
  'tafelrunde.ui.wartesaal.gastgeber': 'Gastgeber',
  'tafelrunde.ui.wartesaal.freiePlaetze': 'Freie Plätze beim Start',
  'tafelrunde.ui.wartesaal.weglassen': 'Weglassen',
  'tafelrunde.ui.wartesaal.da.eins': '{n} Spieler ist da. Der Gastgeber startet die Partie.',
  'tafelrunde.ui.wartesaal.da.mehr': '{n} Spieler sind da. Der Gastgeber startet die Partie.',
  'tafelrunde.ui.aufbau.titel': 'Tisch wird aufgebaut',

  // Fehler
  'tafelrunde.ui.fehler.suche': 'Die Suche ist fehlgeschlagen. Noch einmal versuchen?',
  'tafelrunde.ui.fehler.sucheBeendet': 'Die Suche wurde beendet. Noch einmal versuchen?',
  'tafelrunde.ui.fehler.tischNochmal': 'Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?',
  'tafelrunde.ui.fehler.tisch': 'Der Tisch ließ sich nicht aufmachen.',
  'tafelrunde.ui.fehler.beitreten': 'Beitreten fehlgeschlagen.',

  // Ladebildschirm
  'tafelrunde.ui.laden.dateien': 'Dateien werden heruntergeladen',
  'tafelrunde.ui.laden.zaehler': '{erledigt} von {gesamt} Dateien',

  // Kopf, Phase, Mitspielerleiste
  'tafelrunde.ui.kopf.leben': 'Leben',
  'tafelrunde.ui.kopf.rang': 'Rang',
  'tafelrunde.ui.kopf.feld': '{belegt}/{plaetze} Feld',
  'tafelrunde.ui.kopf.ausgeschieden': ' · ausgeschieden',
  'tafelrunde.ui.kopf.markenVon': 'Marken von {name}',
  'tafelrunde.ui.phase.vorbereitung': 'Platzierungsphase',
  'tafelrunde.ui.phase.kampf': 'Kampfphase',
  'tafelrunde.ui.phase.ende': 'Partie vorbei',
  'tafelrunde.ui.phase.restSekunden.eins': 'Noch {n} Sekunde in dieser Phase',
  'tafelrunde.ui.phase.restSekunden.mehr': 'Noch {n} Sekunden in dieser Phase',
  'tafelrunde.ui.phase.bereitZaehler': '{bereit} von {offen} bereit',
  'tafelrunde.ui.leiste.titel': 'Mitspieler - noch {lebend} von {gesamt}',
  'tafelrunde.ui.leiste.gegner': 'Gegner',
  'tafelrunde.ui.leiste.du': 'Du',
  'tafelrunde.ui.leiste.raus': 'raus',
  'tafelrunde.ui.leiste.weg': 'weg',
  'tafelrunde.ui.leiste.bereit': 'bereit',
  'tafelrunde.ui.leiste.rang': 'Rang {n}',
  'tafelrunde.ui.leiste.kachel': '{name}, {leben} Leben',
  'tafelrunde.ui.leiste.kachelAus': ', ausgeschieden',
  'tafelrunde.ui.leiste.kachelGegner': ', dein Gegner diese Runde',
  'tafelrunde.ui.leiste.kachelOben': ', Brett liegt oben',
  'tafelrunde.ui.leiste.synergien': 'Synergien',
  'tafelrunde.ui.leiste.keineMarken': 'Noch keine Marken',

  // Brett, Bank, Waben
  'tafelrunde.ui.brett.feld': 'Feld {n}',
  'tafelrunde.ui.brett.ziel': ' · Ziel',
  'tafelrunde.ui.brett.leer': 'Dein Feld ist leer - zieh einen Recken von der Bank auf eine Wabe oder tipp erst ihn, dann die Wabe an.',
  'tafelrunde.ui.bank.titel': 'Reservebank',
  'tafelrunde.ui.bank.platz': 'Bankplatz {n}',
  'tafelrunde.ui.bank.leer': 'Deine Bank ist leer - kauf dir unten im Laden einen Recken.',
  'tafelrunde.ui.wabe.titel': '{name}, {rolle}, Stufe {stufe}',
  'tafelrunde.ui.wabe.nochEine': 'noch 1',
  'tafelrunde.ui.buehne.zumKampf': 'Zum Kampf',
  'tafelrunde.ui.zuschauer.hinweis': 'Du schaust zu',
  'tafelrunde.ui.auswahl.gewaehlt': '{name} gewählt - Ziel antippen',
  'tafelrunde.ui.ausgeschieden.hinweis': 'In Runde {n} ausgeschieden. Du kannst weiter zusehen.',
  'tafelrunde.ui.verschmolzen': '{n}× {name} verschmolzen',

  // Laden
  'tafelrunde.ui.laden.titel': 'Laden',
  'tafelrunde.ui.laden.zuWenigGold': 'Zu wenig Gold',
  'tafelrunde.ui.laden.bankVoll': 'Bank voll',
  'tafelrunde.ui.laden.verschmilzt': 'verschmilzt!',
  'tafelrunde.ui.laden.kopien': '{hat} von {von}',
  'tafelrunde.ui.laden.ansehen': '{name} ansehen',
  'tafelrunde.ui.laden.vorratLeer': 'Der Vorrat gibt nichts mehr her - alle Recken sind im Umlauf. Mach dich bereit.',
  'tafelrunde.ui.laden.neuWuerfeln': 'Neu würfeln',
  'tafelrunde.ui.laden.hoechsterRang': 'Höchster Rang',
  'tafelrunde.ui.laden.rangSteigern': 'Rang steigern',
  'tafelrunde.ui.laden.wartet': 'Wartet…',
  'tafelrunde.ui.laden.bereit': 'Bereit',
  'tafelrunde.ui.hinweis.warten': 'Auf die anderen warten',
  'tafelrunde.ui.hinweis.ziel': 'Ziel antippen - oder abbrechen',
  'tafelrunde.ui.hinweis.ruesten': 'Karte antippen zum Kaufen · Einheit ziehen oder antippen zum Setzen',

  // Einheitenblatt
  'tafelrunde.ui.blatt.titel': '{name}, Stufe {stufe}',
  'tafelrunde.ui.blatt.stufe': ', Stufe {stufe}',
  'tafelrunde.ui.blatt.nachschlagen': '{name} nachschlagen',
  'tafelrunde.ui.blatt.kampfwerte': 'Kampfwerte',
  'tafelrunde.ui.wert.leben': 'Leben',
  'tafelrunde.ui.wert.schaden': 'Schaden',
  'tafelrunde.ui.wert.tempo': 'Tempo',
  'tafelrunde.ui.wert.reichweite': 'Reichweite',
  'tafelrunde.ui.wert.feld': 'Feld',
  'tafelrunde.ui.wert.felder': 'Felder',
  'tafelrunde.ui.wert.ruestung': 'Rüstung',
  'tafelrunde.ui.knopf.kaufen': 'Kaufen',
  'tafelrunde.ui.knopf.ablegen': 'Ablegen',
  'tafelrunde.ui.knopf.verkaufen': 'Verkaufen',
  'tafelrunde.ui.knopf.verschieben': 'Verschieben',
  'tafelrunde.ui.knopf.aufstellen': 'Aufstellen',

  // Marken und Synergien
  'tafelrunde.ui.bonus.leben': '+{n} % Leben',
  'tafelrunde.ui.bonus.angriff': '+{n} % Angriff',
  'tafelrunde.ui.bonus.tempo': '+{n} % Tempo',
  'tafelrunde.ui.bonus.ruestung': '+{n} Rüstung',
  'tafelrunde.ui.stand.ab': 'ab {schwelle}: {bonus}',
  'tafelrunde.ui.stand.nochBisMit': 'noch {fehlt} bis {naechste}: {bonus}',
  'tafelrunde.ui.stand.nochBis': 'noch {fehlt} bis {naechste}',
  'tafelrunde.ui.marke.titel': 'Marke {name}',
  'tafelrunde.ui.marke.aufDemBrett': '{n} auf dem Brett',
  'tafelrunde.ui.marke.nochBis': ' · noch {fehlt} bis {naechste}',
  'tafelrunde.ui.marke.hoechsteStufe': ' · höchste Stufe',
  'tafelrunde.ui.marke.stufen': 'Stufen',
  'tafelrunde.ui.marke.traeger': 'Trägt diese Marke',
  'tafelrunde.ui.marke.gold': ' Gold',
  'tafelrunde.ui.chip.von': ' von {n}',

  // Kampf
  'tafelrunde.ui.kampf.titel': 'Kampf',
  'tafelrunde.ui.kampf.gegen': '{a} gegen {b}',
  'tafelrunde.ui.kampf.gegenAbbild': '{a} gegen das Abbild von {b}',
  'tafelrunde.ui.kampf.zeileLaeuft': '{gegen} · läuft…',
  'tafelrunde.ui.kampf.zeileUnentschieden': '{gegen} · unentschieden',
  'tafelrunde.ui.kampf.zeileGewinnt': '{gegen} · {sieger} gewinnt',
  'tafelrunde.ui.kampf.zeileVerliert': '{gegen} · {sieger} gewinnt, {verlierer} verliert {n} Leben',
  'tafelrunde.ui.kampf.dasAbbild': 'das Abbild',
  'tafelrunde.ui.kampf.abbildVon': 'Abbild von {name}',
  'tafelrunde.ui.kampf.figur': '{name}, Stufe {stufe}, {zustand}',
  'tafelrunde.ui.kampf.gefallen': 'gefallen',
  'tafelrunde.ui.kampf.leben': '{leben} von {hoechstes} Leben',
  'tafelrunde.ui.kampf.weitere': 'Weitere Kämpfe',
  'tafelrunde.ui.kampf.nichtsAufgestellt': 'nichts aufgestellt',
  'tafelrunde.ui.kampf.stehen': '{stehen} von {gesamt} stehen',
  'tafelrunde.ui.kampf.unentschieden': 'Unentschieden',
  'tafelrunde.ui.kampf.gewinnt': '{name} gewinnt',
  'tafelrunde.ui.kampf.gewonnen': 'Gewonnen!',
  'tafelrunde.ui.kampf.verloren': 'Verloren',
  'tafelrunde.ui.kampf.niemandVerliert': 'Niemand verliert Leben',
  'tafelrunde.ui.kampf.abbildVerliertNichts': 'Ein Abbild verliert nichts',
  'tafelrunde.ui.kampf.duVerlierst': 'Du verlierst {n} Leben',
  'tafelrunde.ui.kampf.verliert': '{name} verliert {n} Leben',
  'tafelrunde.ui.kampf.zeitAbgelaufen': ' · Zeit abgelaufen',
  'tafelrunde.ui.kampf.zurueckZuDeinem': 'Zurück zu deinem Kampf',
  'tafelrunde.ui.kampf.laeuftVonSelbst': 'Der Kampf läuft von selbst - danach geht der Laden wieder auf.',
  'tafelrunde.ui.kampf.duSiehstZu': 'Du siehst {name} zu - tippe oben einen anderen Sitz an, um dessen Kampf zu sehen.',
  'tafelrunde.ui.kampf.heereTretenAn': 'Die Heere treten an',

  // Abschluss und Endbild
  'tafelrunde.ui.abschluss.runden.eins': '{n} Runde gespielt',
  'tafelrunde.ui.abschluss.runden.mehr': '{n} Runden gespielt',
  'tafelrunde.ui.abschluss.ausgeschieden': ' · ausgeschieden in Runde {n}',
  'tafelrunde.ui.ende.beendet': 'Partie beendet',
  'tafelrunde.ui.ende.geteilterSieg': 'Geteilter Sieg',
  'tafelrunde.ui.ende.gewonnen': 'Gewonnen!',
  'tafelrunde.ui.ende.knapp': 'Knapp vorbei',
  'tafelrunde.ui.ende.ausgeschieden': 'Ausgeschieden',
  'tafelrunde.ui.ende.spielerAmTisch': '{n} Spieler am Tisch',
  'tafelrunde.ui.ende.platz': 'Platz {platz} von {von}',
  'tafelrunde.ui.ende.durchgestanden.eins': '{n} Runde durchgestanden',
  'tafelrunde.ui.ende.durchgestanden.mehr': '{n} Runden durchgestanden',
  'tafelrunde.ui.ende.ueberstanden.eins': '{n} Runde überstanden',
  'tafelrunde.ui.ende.ueberstanden.mehr': '{n} Runden überstanden',
  'tafelrunde.ui.ende.aufstellung': 'Deine letzte Aufstellung',
  'tafelrunde.ui.ende.keinRecke': 'Am Ende stand kein Recke mehr auf dem Feld.',
  'tafelrunde.ui.ende.stufe': 'Stufe {n}',
  'tafelrunde.ui.ende.zurAuswahl': 'Zur Spielauswahl',
  'tafelrunde.ui.ende.weiterZusehen': 'Weiter zusehen',
  'tafelrunde.ui.ende.siegerEiner': 'Gewonnen hat {name}.',
  'tafelrunde.ui.ende.siegerGeteilt': 'Geteilter Sieg: {namen}.',
  'tafelrunde.ui.ende.und': ' und ',

  // Regeln — die fetten Stellen sind eigene Schlüssel, der Rest beginnt bzw. endet mit Leerzeichen
  'tafelrunde.ui.regeln.titel': 'So spielt man Tafelrunde',
  'tafelrunde.ui.regeln.regeln': 'Regeln',
  'tafelrunde.ui.regeln.laden': 'Jede Runde legt der Laden fünf Recken aus. Kaufen kostet Gold; wer nichts findet, würfelt neu.',
  'tafelrunde.ui.regeln.bank': 'Gekaufte Recken landen auf der Reservebank. Aufs Feld kommen sie, indem du sie auf eine Wabe ziehst - oder antippst und dann die Wabe antippst.',
  'tafelrunde.ui.regeln.verschmelzen.fett': 'Drei gleiche Recken derselben Stufe verschmelzen von selbst',
  'tafelrunde.ui.regeln.verschmelzen.rest': ' zu einem stärkeren. Aus drei Einsternigen wird ein Zweisterniger, aus drei davon ein Dreisterniger.',
  'tafelrunde.ui.regeln.rang': 'Wie viele Recken gleichzeitig auf dem Feld stehen dürfen, sagt dein Rang. Rang steigern kostet Gold und bringt einen Feldplatz - und bessere Karten im Laden.',
  'tafelrunde.ui.regeln.klassen.vor': 'Recken gehören Klassen an wie Krieger, Wächter oder Untot. Stehen ',
  'tafelrunde.ui.regeln.klassen.fett': 'zwei Träger derselben Klasse auf dem Feld',
  'tafelrunde.ui.regeln.klassen.nach': ', wird die Klasse stärker; ab drei und ab fünf noch einmal deutlicher. Der Bonus gilt nur für die Träger selbst und nur auf dem Feld - was auf der Bank liegt, zählt nicht mit. Was gerade greift und wie weit es bis zur nächsten Stufe ist, zeigt die Synergie-Leiste. Tippe einen Zähler darin an, und du bekommst alle Stufen der Klasse und alle Recken, die sie tragen.',
  'tafelrunde.ui.regeln.gold': 'Gold gibt es jede Runde: ein Grundbetrag, Zins auf dein Erspartes und ein Bonus für Serien. Was die nächste Runde bringt, steht klein neben deinem Gold.',
  'tafelrunde.ui.regeln.kampf': 'Sind alle bereit, kämpft dein Feld gegen das eines Mitspielers - von selbst, du siehst nur zu. Der Verlierer verliert Leben: je mehr Gegner noch stehen, desto mehr.',
  'tafelrunde.ui.regeln.aus': 'Wer keine Lebenspunkte mehr hat, scheidet aus. Der Letzte gewinnt.',
  'tafelrunde.ui.regeln.ziel': 'Ziel',
  'tafelrunde.ui.regeln.zielText': 'Als Letzter am Tisch stehen bleiben.',

  // Einheiten — Wortlaut aus packages/game-tafelrunde/src/katalog.ts
  'tafelrunde.einheit.dorfwache': 'Dorfwache',
  'tafelrunde.einheit.schildknappe': 'Schildknappe',
  'tafelrunde.einheit.astschuetze': 'Astschütze',
  'tafelrunde.einheit.steinschleuderer': 'Steinschleuderer',
  'tafelrunde.einheit.funkenlehrling': 'Funkenlehrling',
  'tafelrunde.einheit.irrlicht': 'Irrlicht',
  'tafelrunde.einheit.gassendieb': 'Gassendieb',
  'tafelrunde.einheit.moosheiler': 'Moosheiler',
  'tafelrunde.einheit.hainwaechterin': 'Hainwächterin',
  'tafelrunde.einheit.grimmbart': 'Grimmbart',
  'tafelrunde.einheit.bogenmeisterin': 'Bogenmeisterin',
  'tafelrunde.einheit.nachtpfeil': 'Nachtpfeil',
  'tafelrunde.einheit.frostweberin': 'Frostweberin',
  'tafelrunde.einheit.schattenklinge': 'Schattenklinge',
  'tafelrunde.einheit.knochenspaeher': 'Knochenspäher',
  'tafelrunde.einheit.runenpriester': 'Runenpriester',
  'tafelrunde.einheit.wurzelriese': 'Wurzelriese',
  'tafelrunde.einheit.drachenkind': 'Drachenkind',
  'tafelrunde.einheit.sturmrufer': 'Sturmrufer',
  'tafelrunde.einheit.grabfuerstin': 'Grabfürstin',
  'tafelrunde.einheit.klingentaenzerin': 'Klingentänzerin',
  'tafelrunde.einheit.lichtwahrerin': 'Lichtwahrerin',

  // Marken — Wortlaut aus packages/game-tafelrunde/src/synergien.ts
  'tafelrunde.marke.krieger': 'Krieger',
  'tafelrunde.marke.krieger.wirkung': 'Jeder Krieger auf dem Brett bekommt Rüstung dazu und steckt damit jeden Treffer besser weg.',
  'tafelrunde.marke.elementar': 'Elementar',
  'tafelrunde.marke.elementar.wirkung': 'Jedes Elementarwesen auf dem Brett schlägt härter zu — der Bonus geht auf den Angriff.',
  'tafelrunde.marke.meuchler': 'Meuchler',
  'tafelrunde.marke.meuchler.wirkung': 'Jeder Meuchler auf dem Brett schlägt öfter zu — der Bonus geht auf das Tempo.',
  'tafelrunde.marke.waechter': 'Wächter',
  'tafelrunde.marke.waechter.wirkung': 'Jeder Wächter auf dem Brett bekommt Leben und Rüstung dazu und wird zur Mauer davor.',
  'tafelrunde.marke.naturwesen': 'Naturwesen',
  'tafelrunde.marke.naturwesen.wirkung': 'Jedes Naturwesen auf dem Brett bekommt Leben dazu und bleibt entsprechend länger stehen.',
  'tafelrunde.marke.untot': 'Untot',
  'tafelrunde.marke.untot.wirkung': 'Jeder Untote auf dem Brett bekommt Angriff und Leben dazu, beides maßvoll.',
  'tafelrunde.marke.drache': 'Drache',
  'tafelrunde.marke.drache.wirkung': 'Jeder Drache auf dem Brett schlägt härter und öfter zu — zwei Träger sind schon die erste Stufe.',
} satisfies Woerterbuch;
