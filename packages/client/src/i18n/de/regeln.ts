import type { Woerterbuch } from '../woerterbuch';

/** Deutsche Texte, Bereich „regeln". Umgezogen aus dem alten i18n.ts, Wortlaut unverändert. */
export const regeln: Woerterbuch = {
  // Regelnamen der Tischerstellung. Der Editor zeigt jede boolesche Option
  // aus defaultConfig; fehlt hier ein Eintrag, erscheint der rohe Schluessel -
  // sichtbar haesslich statt unsichtbar kaputt.
  'regel.secondDulleBeatsFirst': 'Zweite Dulle sticht Erste',
  'regel.defusedDullen': 'Entschärfte Dullen',
  'regel.schweinchen': 'Schweinchen',
  'regel.superSchweine': 'Superschweine',
  'regel.spFuchsGefangen': 'Fuchs gefangen',
  'regel.spKarlchen': 'Karlchen',
  'regel.spDoppelkopf': 'Doppelkopf-Sonderpunkt',
  'regel.spCharlieGefangen': 'Karlchen gefangen',
  'regel.spHerzdurchlauf': 'Herzdurchlauf',
  'regel.spInSolo': 'Sonderpunkte im Solo',
  'regel.soloLeadsOut': 'Solo kommt raus',
  'regel.hochzeit': 'Hochzeit',
  'regel.stilleHochzeit': 'Stille Hochzeit',
  'regel.armut': 'Armut',
  'regel.armutAnnounceReturnedTrumps': 'Armut: Rücktrümpfe ansagen',
  'regel.schmeiss5Luschen': 'Schmeißen bei 5 Luschen',
  'regel.schmeiss7Volle': 'Schmeißen bei 7 Vollen',
  'regel.countPoints': 'Punkte mitzählen',
  'regel.announcements': 'Re und Kontra',
  'regel.absagen': 'Absagen',
  'regel.pflichtansage': 'Pflichtansage',
  'regel.pflichtansageFolge': 'Pflichtansage: Folgeansage',
  'regel.pflichtansageArmut': 'Pflichtansage: Armut',
  'regel.pflichtansageSchweine': 'Pflichtansage: Schweine',
  'regel.pflichtansageImSolo': 'Pflichtansage: auch im Solo',
  'regel.feigling': 'Feigling im Normalspiel',
  'regel.feiglingSolo': 'Feigling im Solo',
  'regel.bock': 'Bockrunden',
  'regel.pflichtsolo': 'Pflichtsolo',
  'regel.training': 'Training',
  'regel.scharf': 'Scharfer Doppelkopf',

  // Tischregeln von Skat. `training` und `bock` teilt es sich mit dem
  // Doppelkopf — die Schlüssel stehen weiter oben und gelten für beide.
  'regel.nurBubenSpitzen': 'Nur Buben sind Spitze',
  'regel.patrouillen': 'Patrouillen',
  'regel.saechsischeSpitze': 'Sächsische Spitze',
  'regel.handNichtBestraft': 'Hand wird nicht bestraft',
  'regel.ramsch': 'Ramsch, wenn alle passen',
  'regel.schieberamsch': 'Schieberamsch',
  'regel.jungfrauen': 'Jungfrauen',
  'regel.kontraRe': 'Kontra und Re',
  'regel.hirsch': 'Hirsch',

  // Hausregeln des Zauberers.
  'regel.lastSpecialWins': 'Der letzte sticht',
  'regel.bidSumForbidden': 'Es darf nicht aufgehen',
  'regel.zeroBonus': 'Bonus für angesagte Null',
  'regel.hiddenBids': 'Verdeckt ansagen',
  'regel.blindFirstRound': 'Blinde erste Runde',
  'regel.dealerPicksBlind': 'Geber wählt blind',
  'regel.noTrump': 'Trumpffrei',
  'regel.jesterPicksTrump': 'Narr: Geber wählt',

  // Hausregeln von Cambio.
  'regel.peekOwn': '7/8: Eigene ansehen',
  'regel.peekOther': '9/10: Fremde ansehen',
  'regel.blindSwap': 'Bube: Blind tauschen',
  'regel.lookAndSwap': 'Dame: Ansehen und tauschen',
  'regel.redKingZero': 'Roter König zählt null',
  'regel.peekTwoAtStart': 'Zwei Karten zu Beginn ansehen',
  'regel.callerMustBeStrictlyLower': 'Gleichstand lässt den Ruf misslingen',
  'regel.failPenalty': 'Strafpunkte bei misslungenem Ruf',

  // Meldungen des Zauberer-Regelsatzes.
  'ruleset.noTrumpVsJesterPicks': 'Ohne Trumpf gibt es nichts zu wählen.',
  'ruleset.noTrumpVsDealerPicks': 'Ohne Trumpf gibt es nichts zu wählen.',
  'ruleset.hiddenBidsVsBidSum': 'Verdeckt angesagt gibt es keinen letzten Ansager.',
  'ruleset.roundsOutOfRange': 'So viele Runden gibt das Blatt nicht her.',
  'ruleset.bedenkzeit': 'Die Bedenkzeit muss zwischen 20 Sekunden und 3 Stunden liegen.',
  'ruleset.zuschlag': 'Der Zuschlag braucht eine Bedenkzeit und darf höchstens 60 Sekunden betragen.',
  'ruleset.tableSizeUnsupported': 'Diese Spielerzahl gibt es bei diesem Spiel nicht.',

  // Meldungen des Cambio-Regelsatzes.
  'ruleset.noActionCards': 'Ohne Aktionskarten bleibt wenig zu entscheiden.',

  /*
   * Regelsatz-Meldungen der jüngeren Spiele.
   *
   * Sie fehlten: Poker, Filler, Mememory und Feldherr kamen nach der ersten
   * Übersetzungsrunde dazu, ihre Prüfmeldungen wurden nicht nachgetragen.
   * `t()` gibt bei einem unbekannten Schlüssel den Schlüssel zurück — im
   * Regelsatz-Editor stand also wörtlich "ruleset.blindZuKlein" am Feld. Die
   * Texte nennen die Grenze, statt nur "ungültig" zu sagen: Wer sie liest,
   * soll wissen, was er eintragen darf.
   */
  /*
   * Denselben Sachverhalt gibt es unter zwei Präfixen: Doppelkopf, Wizard,
   * Skat und Cambio bilden ihre Meldungen als `ruleset.${code}`, an anderer
   * Stelle steht derselbe Code als `error.…`. Bis das vereinheitlicht ist
   * (eigene Karte), braucht es beide Einträge — sonst steht im Editor der
   * nackte Schlüssel.
   */
  'ruleset.roundsNotMultipleOfRotation': 'Die Rundenzahl muss eine volle Geberrunde ergeben.',

  /*
   * Regelsatz-Widersprüche aus den Validatoren von Doppelkopf und Skat.
   *
   * Die Erklärungen gab es längst — sie stehen als zweites Argument in
   * `err(...)` im jeweiligen Validator. Nur landeten sie nirgends: Der Adapter
   * baut aus dem Code `ruleset.${code}` und lässt den Text fallen. Im
   * Regelsatz-Editor stand deshalb wörtlich "ruleset.PFLICHTANSAGE_NEEDS_ANNOUNCEMENTS"
   * am Feld. Hier sind sie, mit Umlauten.
   *
   * Zwei Codes bedeuten in beiden Spielen NICHT dasselbe (TABLE_SIZE,
   * TRAINING) — ein gemeinsames Wörterbuch kann nur einen Text haben, deshalb
   * stehen dort bewusst die neutralen Fassungen.
   */
  'ruleset.ARMUT_ANNOUNCE': 'Die Ansage der Rückgabe-Trümpfe setzt aktivierte Armut voraus.',
  'ruleset.BOCK_FACTOR': 'Der Bock-Multiplikator muss mindestens 2 betragen.',
  'ruleset.BOCK_TRIGGER_ANNOUNCEMENTS': 'Der Auslöser „Re und Kontra" setzt Ansagen voraus.',
  'ruleset.BOCK_WINDOW': 'Die Länge eines Bock-Fensters muss positiv sein.',
  'ruleset.FEIGLING_NEEDS_ANNOUNCEMENTS': 'Feigling setzt aktivierte Ansagen voraus.',
  'ruleset.HIRSCH_NEEDS_KONTRA': 'Hirsch setzt erlaubtes Kontra/Re voraus.',
  'ruleset.HOCHZEIT_CLARIFY': 'Die Klärungsfrist der Hochzeit muss zwischen 1 und 3 Stichen liegen.',
  'ruleset.JUNGFRAUEN_NEEDS_RAMSCH': 'Jungfrauen setzen Ramsch voraus.',
  'ruleset.PFLICHTANSAGE_NEEDS_ANNOUNCEMENTS': 'Pflichtansage setzt aktivierte Ansagen voraus.',
  'ruleset.PFLICHTANSAGE_THRESHOLDS': 'Die Schwellen der Pflichtansage müssen absteigend sein.',
  'ruleset.PFLICHTSOLO_ROUNDS': 'Für ein Pflichtsolo je Spieler reichen die Runden nicht.',
  'ruleset.PFLICHT_ARMUT_NEEDS_ARMUT': 'Der Armut-Auslöser setzt erlaubte Armut voraus.',
  'ruleset.SCHIEBERAMSCH_NEEDS_RAMSCH': 'Schieberamsch setzt Ramsch voraus.',
  'ruleset.SCHWEINCHEN_SOLO': 'Schweinchen im Solo setzt aktivierte Schweinchen voraus.',
  'ruleset.TRAINING': 'Trainingstisch: keine Trophäen, keine Ranglistenwertung.',
  'ruleset.blindZuKlein': 'Der kleine Blind muss mindestens 1 betragen.',
  'ruleset.grosserBlindZuKlein': 'Der große Blind muss über dem kleinen liegen.',
  'ruleset.stapelZuKlein': 'Zu wenig Jetons - es braucht mindestens zehn große Blinds.',
  'ruleset.stapelZuGross': 'So viele Jetons vergibt der Tisch nicht (höchstens 100.000).',
  'ruleset.spaltenAusserhalb': 'Zwischen 4 und 12 Spalten.',
  'ruleset.zeilenAusserhalb': 'Zwischen 4 und 12 Zeilen.',
  'ruleset.farbzahlAusserhalb': 'Zwischen 4 und 8 Farben.',
  'ruleset.zuWenigFarben': 'So wenige Farben reichen für dieses Feld nicht.',
  'ruleset.varianteUnbekannt': 'Diese Spielart gibt es nicht.',
  'ruleset.barrierenzahlAusserhalb': 'Zwischen 0 und 20 Mauern je Spieler.',
  'ruleset.ungeradeKartenzahl': 'Das Feld braucht eine gerade Kartenzahl - sonst bleibt eine Karte ohne Paar.',
  'ruleset.merkzeitAusserhalb': 'Die Merkzeit liegt zwischen 0,3 und 5 Sekunden.',
  'ruleset.zuWenigMotive': 'Für dieses Feld gibt es zu wenige Motive.',
  'ruleset.zusatzUngueltig': 'Die Liste eigener Motive ist nicht lesbar.',
  'ruleset.botStufeUngueltig': 'Diese Spielstärke gibt es nicht.',

  // Eiland. Die Zahlen stehen ausgeschrieben statt eingesetzt: Der Regelsatz
  // ist die einzige Stelle, an der sie sich ändern können, und ein Text, der
  // sie selbst ausrechnet, kann nicht falsch werden — er wird nur nie gelesen.
  'ruleset.feldzahlUngerade': 'Die Karte braucht eine gerade Feldzahl - sonst lässt sie sich nicht spiegeln.',
  'ruleset.seenAusserhalb': 'Zwischen 0 und 6 Seen je Kartenhälfte.',
  'ruleset.bergeAusserhalb': 'Zwischen 0 und 12 Bergen je Kartenhälfte.',
  'ruleset.ornamenteAusserhalb': 'Zwischen 1 und 8 Ornamenten auf der Karte.',
  'ruleset.sichtweiteAusserhalb': 'So weit sieht hier niemand - die Sichtweite passt nicht zur Kartengröße.',
  'ruleset.kontingentAusserhalb': 'Zwischen 1 und 20 Feldern je Runde.',
  'ruleset.zuVieleHindernisse': 'So viel Wasser und Fels lässt kein Land mehr übrig.',
  'ruleset.rundenfristAusserhalb': 'Eine Runde dauert zwischen 10 Sekunden und 5 Minuten.',
  'feldherr.feldUnbekannt': 'Diese Feldgröße gibt es nicht.',
  'feldherr.nurZuZweit': 'Feldherr wird zu zweit gespielt.',
  'feldherr.eineRunde': 'Feldherr kennt keine Runden - ein Gefecht entscheidet.',
  // Bahnauswahl (seit 22.09.2026, packages/game-golf/src/bahnwahl.ts): Kurs,
  // Filter oder Einzelauswahl stehen im Regelsatz des Tisches.
  'ruleset.golf.auswahlDoppelt': 'Kurs, Filter und eigene Auswahl schließen einander aus - nur eines davon.',
  'ruleset.golf.kursUnbekannt': 'Diesen Kurs gibt es nicht.',
  'ruleset.golf.filterUngueltig': 'Der Filter kennt nur die Stufen 1 bis 5 und die Themen der Bahnen.',
  'ruleset.golf.filterLeer': 'Keine Bahn passt zum Filter - gezogen wird aus allen.',
  'ruleset.golf.bahnenUngueltig': 'Die Auswahl enthält eine unbekannte oder doppelte Bahn.',
  'ruleset.golf.bahnenAnzahl': 'Eine eigene Auswahl hat 2 bis 15 Bahnen.',
  'ruleset.golf.varianteUngueltig': 'Der Name der Spielart ist zu lang.',
  // Fun-Modus (seit 23.09.2026, packages/game-golf/src/modus.ts und
  // minispiele/golf/modifikator.ts): Roulette je Loch, Wind und Wetter.
  'ruleset.golf.modusUnbekannt': 'Golf spielt klassisch oder im Fun-Modus.',
  // Meldungen des BroCooked-Regelsatzes.
  'brocooked.regelnUnbekannt': 'Der Regelsatz fehlt oder ist beschädigt.',
  'brocooked.kuechenLeer': 'Mindestens eine Küche muss dabei sein.',
  'brocooked.kuecheUngueltig': 'Diese Küche gibt es nicht.',
  'brocooked.rundeTakteUngueltig': 'Eine Schicht dauert zwischen 10 Sekunden und 10 Minuten.',
  'brocooked.sitzzahl': 'In der Küche stehen einer bis vier Köche.',
  'brocooked.runden': 'Zwischen einer und sechs Schichten je Partie.',
  // Meldungen des Partykisten-Regelsatzes.
  'partykiste.regelnUnbekannt': 'Der Regelsatz fehlt oder ist beschädigt.',
  'partykiste.minispieleLeer': 'Mindestens ein Minispiel muss dabei sein.',
  'partykiste.minispielUnbekannt': 'Dieses Minispiel gibt es nicht.',
  'partykiste.trinkmodus': 'Trinkmodus geht nur an oder aus.',
  'partykiste.schluckFaktor': 'Der Härtegrad liegt zwischen 1 und 3.',
  'partykiste.sitzzahl': 'Die Partykiste spielt zu viert bis zu zwölft.',
  'partykiste.rundenzahl': 'Zwischen 3 und 15 Minispielen je Turnier.',
  'ruleset.partykiste.inhaltsHaerte': 'Die Inhalte sind harmlos (1), pikant (2) oder derb (3).',
  'ruleset.partykiste.inhaltsMischung': 'Die Inhalte kommen genau aus einer Stufe oder gemischt aus allen.',
  'ruleset.partykiste.paket': 'Dieses Themenpaket gibt es nicht.',

  // Spielmodi der Partykiste (22.09.2026).
  'ruleset.partykiste.modus': 'Diesen Spielmodus gibt es nicht.',
  'ruleset.partykiste.themenOhnePaket': 'Ein Themenabend braucht ein Themenpaket.',
  'ruleset.noWayToLearnOwnCards': 'So sieht niemand je seine eigenen Karten.',
  'ruleset.freeCall': 'Ohne Strafe ruft man immer sofort.',
  'ruleset.failPenaltyOutOfRange': 'So viele Strafpunkte gehen nicht.',

  // Meldungen des Skat-Regelsatzes.
  //
  // TABLE_SIZE meldet auch der Doppelkopf-Validator — beide Module bilden
  // ihre Schlüssel als `ruleset.${code}`, und dieselbe Kennung landet damit
  // im selben Eintrag. Der Text darf deshalb nicht "Skat wird zu dritt
  // gespielt." lauten: Am Doppelkopf-Tisch wäre er schlicht falsch.
  'ruleset.TABLE_SIZE': 'Diese Spielerzahl gibt es bei diesem Spiel nicht.',
  'ruleset.ROUNDS_MULTIPLE': 'Die Rundenzahl muss eine volle Geberrunde ergeben.',
  'ruleset.BOCK_NEEDS_KONTRA': 'Bockrunden brauchen erlaubtes Kontra und Re.',
  'ruleset.notAnObject': 'Der Regelsatz fehlt oder ist beschädigt.',
  'ruleset.fieldMissing': 'Dem Regelsatz fehlt ein Feld.',
  'ruleset.fieldWrongType': 'Ein Feld des Regelsatzes hat den falschen Typ.',
  // Tafelrunde meldet alle sechs Zahlen des Regelsatzes ueber DIESEN einen
  // Schluessel, deshalb steht hier kein Zahlenbereich: Welches Feld gemeint
  // ist, sagt der Regelsatz-Editor ueber `path`.
  'ruleset.wertAusserhalb': 'Dieser Wert liegt außerhalb des erlaubten Bereichs.',
};
