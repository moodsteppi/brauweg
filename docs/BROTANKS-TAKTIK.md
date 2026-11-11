# BroTanks: Werkstatt, Teams und Fortschritt

Implementierungsstand: 11.11.2026. Ergänzt BROREMOTE-ARTILLERIE.md.
Veröffentlichung auf Staging und TestFlight erfolgt separat aus dem geprüften
Git-Stand; das externe Grafikarchiv wurde noch nicht aktualisiert.

## Spielen

BroRemote → BroTanks → Lobby eröffnen. Freie Plätze bekommen über „Bot
hinzufügen“ einen Bot. Seine Stufe (Leicht, Mittel, Schwer) und das Team
wählt der Gastgeber direkt am Platz. Höchstens vier Plätze insgesamt.
Teamkampf braucht genau zweimal zwei Bros, beispielsweise zwei Freunde
gegen zwei Bots. Bots sind sofort bereit; Änderungen an Modus, Karte,
Spieldauer oder Team setzen die Bereitschaft der Menschen zurück.

Alternativ: „Bot-Modus öffnen“, Schwierigkeit, Gegnerzahl und Karte wählen.
Im lokalen Teamkampf spielt ein Mensch mit einem Bot gegen zwei Bots.
Die gemeinsame Steuerung funktioniert mit Touch und Tastatur.

Leichte Bots schießen mit Streuung. Mittlere und schwere Bots suchen sichere
Stellungen, fahren und nutzen Reparatur, Schild oder einen sicheren Teleport.
Schwere Bots können mit dem Frostwall Deckung errichten. Die begrenzte
Schusssuche läuft einmal pro Zug, nicht in jedem Bild. Alle Botaktionen
verwenden dieselben Vorräte und Spielregeln wie menschliche Eingaben.

## Regeln

- Fünf Welten: Polarinsel, Bernsteindünen, Kristalltal, Zwillingsinseln,
  Gipfelfeste. Zufallsauswahl bleibt möglich. Ganzes Spielfeld in 1200:650,
  ohne horizontalen Kameraschwenk; Anzeigen liegen am großen Bildschirm
  im freien Himmel. Auf schmalen Ansichten wird vertikal gescrollt.
- Je ein Reparaturset (+30 LP, höchstens 100), Schutzschild (ein schädigender
  Einschlag), Teleport (sicherer freier Boden in 3–14 Metern Entfernung)
  und Treibstoffkanister (Tank wieder voll) pro Partie. Maximal ein Item
  pro Zug, danach darf geschossen werden. Ungültige Einsätze kosten nichts.
- Ein Schild schützt nicht vor Ertrinken, Stürzen oder Geländezerstörung.
  Teamkollegen nehmen keinen direkten Trefferschaden voneinander; Gelände,
  Rückstoß und Flut bleiben gefährlich. Teams starten auf getrennten Seiten
  und wechseln sich in der Zugfolge ab.
- Einzelpartie oder Best-of-3: zwei Siege entscheiden die Serie, spätestens
  nach drei Partien zählt der Stand. Gleichstände geben keinen Seriensieg.
  Neue Vorräte und neue Geländevariation pro Partie, gewählte Welt bleibt.
  Die Zugnummern springen zwischen Partien, damit alte Pakete nicht feuern
  oder ein Item der neuen Partie verbrauchen können.

## Ergebnisse und Konto

Neue Tabelle `brotanks_runde`, Migration `0044_brotanks_runde.sql`.
GET `/api/brotanks` zeigt persönliche Statistik und Freischaltungen;
POST `/api/brotanks/start` registriert einen Online-Start;
POST `/api/brotanks/ergebnis` schließt ihn genau einmal ab.

Eine nicht aufgegebene Partie ab 15 Sekunden mit mindestens zwei eigenen
Schüssen gibt 5 Münzen, ein Sieg zusätzlich 10. Höchstens 60 BroTanks-Münzen
pro Konto und Berliner Kalendertag, auch gegen Bots. Konto-Sperre und
Transaktion sichern parallele Meldungen und Tageslimit. Gäste erhalten
keine Kontomünzen. Gewertet werden einzelne Partien einer Serie, ohne
zusätzlichen Serienbonus. Ergebnisse sind kontogebunden.

Garage: Partien, Siege, verursachter Trefferschaden und Trefferquote.
Ein Schuss mit mindestens einem schädigenden Gegnertreffer zählt einmal.
Rein kosmetische Lackierungen: Werkstatt sofort, Kupferkessel nach einer
beendeten Partie, Polarwache nach drei Siegen, Königsgarde nach zehn Siegen.
Ergebnisse ohne bestätigten Online-Start bleiben auf dem Gerät. Bei einem
fehlgeschlagenen Abschluss nach Online-Start bleibt ein kontogebundener
Eintrag zur erneuten Synchronisierung in der Garage erhalten.

## Grenzen und Prüfung

Die Simulation läuft weiterhin beim Gastgeber. Kurze Verbindungsabbrüche
pausieren bei einem fehlenden aktiven Spieler; ein wieder verbundenes
Handy erhält den aktuellen Zustand einschließlich Items und Serienstand.
Ein Neuladen oder Schließen des Gastgeberfensters stellt keinen gespeicherten
Physikstand wieder her. Auch die Ergebnisprüfung ist keine serverseitige
Spielsimulation: Sie prüft Sitzung, Start, Zeit, Wertebereiche, Wiederholung
und Tageslimit, kann einen manipulierten Gastgeber aber nicht vollständig
erkennen. Lackierungen sind kosmetisch und bieten keinen Spielvorteil.

Geprüft mit gemeinsamem Raumkern, echter Zwei-Handy-/Zwei-Bot-Testlobby,
Best-of-3-Wechsel, Teleport und Schuss im Browser bei 390 Pixel Breite,
Clienttests einschließlich Building-Regressionsprüfungen sowie Datenbanktests
für Migration, Kontotrennung, doppelte Gutschriften, Tageswechsel und Limits.
Kein nativer iOS-Gerätetest oder neuer TestFlight-Build in diesem Durchlauf.
Für eine Veröffentlichung müssen Client, Relay und Migration gemeinsam
ausgerollt werden. Grafikherkunft: ASSETS-BROTANKS-AUSBAU.md.

TAFEL: BroTanks erweitert den bestehenden BroRaum und den Gastgeber-Spielkern.
Bots sind eigene Lobbyplätze ohne Controller-Schlüssel. Optionen und
Karten-ID gehören zur Partie; die private Sicht trägt Inventar, Trefferzahlen,
ursprüngliche Spielerzahl und Serienstand. Online-Fortschritt verwendet
die vorhandene Kontowährung mit eigener, transaktional begrenzter Tageskappe.
