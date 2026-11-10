# Bro Building Battle

Stand: 9. November 2026, Grafikausbau und ruhige Kamera. Lokaler Ausbau auf `codex/broremote`; kein Upload,
kein TestFlight-Build und kein Deploy.

## Spielablauf

**Spiele → BroRemote → Bro Building Battle.** Gastgeber öffnet eine Lobby,
ein bis vier Handys treten per QR bei. Der Gastgeber wählt den Modus. Ein
Moduswechsel hebt den bisherigen Bereitstatus auf, damit niemand unbemerkt
mit anderen Regeln startet. Nach „Battle starten“ folgt ein Countdown.

* **Höhenrennen:** 16 Meter Höhe drei Sekunden stabil halten. Spätestens
  nach drei Minuten gewinnt die höchste stehende Konstruktion. Bewegte oder
  gerade fallende Teile zählen nicht zur Höhe.
* **Standfest:** Drei Leben. Jedes abgestürzte Bauteil kostet genau ein Leben.
  Im Mehrspielermodus gewinnt der letzte verbliebene Spieler; bei Ablauf
  entscheiden Leben, stabile Höhe und verbaute Teile. Allein lautet das Ziel,
  30 Bauteile mit mindestens einem Leben zu verbauen.
* Im Höhenrennen gibt es bis zum Zeitlimit laufend Nachschub, auch nach
  vollständigem Einsturz und über 30 Teile hinaus. Standfest behält seinen
  Vorrat von 30 Teilen. Dort setzt sich der Turm am Vorratsende noch, bevor
  gewertet wird. Ein Gleichstand bleibt ein Gleichstand.
* Jede Person erhält dieselbe durchmischte Bauteilfolge, in Säcken aus sieben
  Formen. Die Zellen eines Bauteils bilden einen einzigen starren Körper.
  Nach dem ersten Kontakt bleibt es beweglich, kippt und fällt unter Last.
  Es gibt kein Raster, das den Turm nachträglich festhält, und keine Reihenlöschung.

**Handy:** Vier große Bautasten: links, rechts, drehen, fallen lassen. Kein Joystick.
Links/rechts halten bewegt das Teil; „Drehen“ dreht
um 90 Grad; „Fallen lassen“ beschleunigt das aktuelle Teil. Richtung und Aktion funktionieren mit mehreren Fingern gleichzeitig.
Die Bauknöpfe sperren während des Zielcountdowns; Zauber bleiben verfügbar.
Der Controller zeigt das nächste Bauteil, Höhe, Platz und gegebenenfalls Leben.

**Allein ausprobieren:** Vor dem Öffnen einer Lobby kann „Erst allein
ausprobieren“ ausgeklappt werden. Das Solotraining läuft ohne Server auf
demselben Gerät. Tastatur: links/rechts, R, Leertaste. Touch funktioniert ebenso.

**Ende:** Ergebnis mit Rangfolge, Höhe und Leben. „Revanche vorbereiten“ führt
in dieselbe Lobby; alle bestätigen erneut „Bereit“. Der neue Start erzeugt
eine neue Partie und einen neuen Seed. Das Solotraining bietet „Noch eine Runde“
mit demselben Seed zum Üben. Ergebnisse landen im Baualbum. Angemeldete Konten erhalten 5 Münzen pro
regulärer Runde und 10 zusätzlich für einen Sieg, höchstens 60 pro Berliner
Kalendertag. Eine reguläre Runde braucht mindestens 15 Sekunden und drei
verbaute Teile; Aufgabe gibt keine Münzen. Gäste/offline gestartete Runden
speichern auf dem Gerät. Kontomünzen brauchen einen Online-Start.

## Höhe, Ziel und Zauber

Neue Teile erscheinen bei `2 * max(7, Turmhöhe + 5)`, also 14 statt 7 Metern
über einer leeren Plattform. Die Kamera folgt der größeren Bühne weich.
Sobald die stabile Höhe 16 Meter erreicht, wird über dieser Bahn ein großer
3–2–1-Zähler angezeigt. Nachschub stoppt; ein bereits schwebendes Teil wird
unverbraucht in den Vorrat zurückgelegt. Unterhalb des Ziels fällt der Zähler
auf null, und die nächste Figur wird wieder freigegeben. Nach drei Sekunden
steht der Sieg fest. Andere Bahnen laufen weiter.

### Zufälliger Item-Vorrat (lokaler Ausbau, 10.11.2026)

Oben rechts jeder Bahn und auf dem Handy stehen zwei gerahmte Plätze:
das **wirklich nächste Bauteil** und das **aktuell erhaltene Item**. Das
Solotraining benutzt denselben Status wie ein verbundener Controller.

Nach 8–12 Spielsekunden kommt das erste zufällige Item. Ein belegter Platz
wird nie überschrieben. Bauen bleibt möglich; Wegwerfen und Neuwürfeln gibt
es nicht. Erst nach Verbrauch beginnt die nächste Wartezeit von 18–28
Spielsekunden. Pausen und Verbindungsunterbrechungen halten auch diese Uhr an.
Der Gastgeber zieht aus einem eigenen, je Sitz reproduzierbaren Zufallsstrom;
die gemeinsame Bauteilfolge bleibt unverändert. Keine direkte Wiederholung,
sofern mehrere geeignete Items vorhanden sind. Solo enthält nur Eigenhilfen.

| Item | Wirkung |
| --- | --- |
| Turmanker | Beruhigt den eigenen Turm 4 Sekunden. Schwerkraft und Kollisionen bleiben wirksam. |
| Wolkensteg | Feste, 3 m breite Zusatzplattform. Platzierung mit links/rechts/höher/tiefer, anschließend bestätigen. |
| Steinsiegel | Das nächste eigene Teil wird beim ersten Kontakt unbeweglich. Das aktuell fallende Teil bleibt unverändert. |
| Schwergewicht | Das nächste Teil eines gewählten aktiven Gegners bekommt dreifache Dichte. |
| Eisglätte | Das nächste Teil eines gewählten aktiven Gegners bekommt sehr geringe Reibung. |

Ein Steg darf höchstens 1 m unter der zum Beginn der Platzierung erreichten
stabilen Höhe liegen, mit einer Bodenposition von 0,4 m und einer absoluten
Obergrenze von 12 m. Maximal drei pro Bahn. Die Vorschau ist grün bei freier
Stelle und rot bei einer Kollision. Der Gastgeber prüft die Stelle bei der
Bestätigung erneut. Die Plattform selbst zählt nicht als Turmhöhe. Nur darauf
verbaute, stabile Teile zählen. Während der maximal 8 Sekunden zum Platzieren
wartet das aktive Teil, die restliche Physik und die Rundenuhr laufen weiter.
Zurück oder Zeitablauf behält das Item und setzt das Bauen fort. Am Ziel kann
kein neuer Platziermodus gestartet werden; der Turmanker bleibt verfügbar.

Jeder Fund trägt eine eindeutige Kennung innerhalb der Runde. Veraltete oder
doppelte Aktivierungen können weder ein neues Item verbrauchen noch eine
zweite Plattform erzeugen. Angriffe behalten ihr Item bei ungültigen Zielen;
dieselbe wartende Wirkung wird nicht gestapelt. Das Zurücklegen eines aktiven
Teils am Ziel bewahrt seine Verzauberungen. Der Relay-Filter begrenzt alle
neuen Felder; private Vorschau und Platzierung werden bei Reconnect erneut
zugestellt. Die bestehende Sitzungs- und Abschnittsprüfung bleibt erhalten.

### Referenz und eigene Umsetzung

Recherche am 10.11.2026: Die [offizielle Entwickler-FAQ zu Tricky Towers](https://steamcommunity.com/app/437920/discussions/0/1739968490571088139/)
beschreibt hilfreiche und gegnerische Magie, etwa feste Steine, verbindende
Ranken, Eis und schwere Bauteile. Das Original bietet zwei Zauber zur Auswahl;
der Verbrauch eines Zaubers entfernt beide. Bro Building Battle verwendet
auf Wunsch **ein einzelnes zufälliges Item** mit eigenem Nachschubrhythmus.
Die Zusatzplattform ist auch in der [Community-Zauberliste](https://tricky-towers.fandom.com/wiki/Spells)
beschrieben. Namen, Gestaltung, Grenzen und Bedienung hier sind eigenständig;
keine Originalgrafiken oder Originalparameter werden übernommen.

### Prüfung und Übergabe

Gezielte Prüfungen: reale Rapier-Physik für Landung, Eisreibung, Gewicht,
Steinversiegelung, Stegkollision und -grenzen; Zufall und Itemverbrauch;
Bedienwechsel mit Tastatur und Touch-Absichten; privater Vorrat nach Reconnect.
Ein Worker, keine parallelen Kompletttests und kein iOS-Simulator.
Physische iPhone-/Hotspot-Prüfung bleibt eine anschließende Geräteabnahme.

TAFEL-Übergabe: Zufallsitems, Vorschau und kontextabhängige Controllerbuttons
lokal umgesetzt. Externer Tafeleintrag ist in dieser Sitzung nicht zugänglich.
Kein Upload auf Staging, ins Grafikarchiv oder nach TestFlight beauftragt.

Pinguine wippen, erschrecken bei Abstürzen und hüpfen beim Sieg. Kurze
Splitter-, Zauber- und Siegesfunken begleiten das Spiel; kein zusätzlicher
Renderloop. Reduzierte Bewegung wird respektiert.

## Baualbum und Kontobelohnung

`building_runde` (Migration 0043, freie Nummer gegen den abgerufenen
`origin/staging` geprüft) speichert Starts, Ergebnisse und tatsächliche
Münzgutschriften je Konto und Partiekennung. Endpunkte: `GET /api/building`,
`POST /api/building/start`, `POST /api/building/ergebnis`. Alle verlangen die
bestehende Sitzung; Gastkonten erhalten keine Kontogutschrift.

Ein Start ist idempotent. Abschlüsse sind höchstens 24 Stunden nachmeldbar;
neuere Starts löschen keine ausstehenden Ergebnisse. Eine Kontosperre in
Transaktion schützt Wiederholungsschutz, Tageskappe und Münzgutschrift gemeinsam.
Auch parallele Meldungen bezahlen dieselbe Runde nur einmal. Berliner
Mitternacht bestimmt den Auszahlungstag. Das Baualbum zeigt die letzten 30
Runden sowie die daraus erhaltenen Abzeichen Baumeister, Turmkönig,
Wolkenkratzer und Standhaft. Die Datenbank behält auch ältere Ergebnisse.

Die Physik bleibt beim Gastgeber. Wie Flying Bro nimmt der Server gemeldete
Ergebnisse mit Plausibilitäts- und Zeitprüfung an; er spielt die Physik nicht
nach. Die tägliche Belohnung ist deshalb bewusst begrenzt. Keine Trophäen und
keine öffentliche kompetitive Rangliste.

Lokal: `brauweg.building.chronik.v1` in localStorage, höchstens 30 Runden.
Ein erfolgreicher Online-Start bindet die ausstehende Meldung an das Konto;
im Baualbum kann sie nach einem Verbindungsfehler erneut gesendet werden.
Kontoverläufe werden nur für das angemeldete Konto angezeigt. Der reine
Gastgeberbildschirm verdient keine Münzen für fremde Controller.

## Aufbau und Ressourcen

* `packages/building-kern`: Formen, zentrierte Zellen, Seedfolge, Regelwerte,
  Rangfolge; ohne Netzwerk, Uhr, Grafik und globalen Zufall.
* `packages/client/src/broremote/building/partie.ts`: autoritative 2D-Physik
  mit dem bereits im Projekt vorhandenen Rapier 0.21.0. Eine Welt pro Spieler.
  Es wird nur im Gastgeberfenster gerechnet, bei LAN in dessen gebündelter App.
* `BauArena.tsx`: fester Physiktakt 60 Hz mit maximal sechs Nachholschritten,
  Zeichenfrequenz höchstens 30 Hz, Oberflächen-/Controllerstatus 4 Hz. In
  Hintergrund und Pause keine Physik, reduzierte Statusfrequenz. Pixeldichte
  höchstens 1,5. Schlafende Körper, das Entfernen abgestürzter Teile und die
  dreiminütige Rundenzeit begrenzen die Last. Die 0,65-Sekunden-Nachschubpause
  ergibt eine natürliche Obergrenze von 278 Teilen pro Runde; sie ist eine
  Validierungsgrenze, kein vorzeitiges Spielende.
  Beim Verlassen werden Timer, WebAudio und alle WASM-Welten freigegeben.
* `zeichnen.ts`: Canvas-Bühne mit illustrierter Werkstattinsel, Holz-/Metall-
  Bausteinen und Zielband. Acht 96er-Materialbilder werden einmal gerastert und
  für sämtliche Steine wiederverwendet. Kein zusätzlicher WebGL-Kontext.
  Kulisse `bauwelt.webp`, Insel `bauinsel.webp` und Baumeister `baumeister.webp`
  liegen als WebP unter `public/broremote/`. Die beiden neuen Motive wiegen
  zusammen rund 166 kB. Größere Porträts, Platzplaketten, Fortschrittsleiste
  und farblich passende Vorschauen ergänzen die Oberfläche.
* `kamera.ts`: Der Ausschnitt beginnt bei 22 Metern und weitet sich bei Bedarf
  in Acht-Meter-Stufen sanft nach außen. Einmal gezeigter Raum bleibt bis zum
  Rundenwechsel erhalten. Fallende Teile oder Einstürze führen niemals zum
  Zurückzoomen. Im Höhenrennen wird oberhalb der Ziellinie kein weiterer
  Spawn eingeplant; dadurch bleibt der Ausschnitt bei höchstens 46 Metern.
  Bewegung ist bildratenunabhängig und berücksichtigt die
  Systemeinstellung für reduzierte Bewegung.
  Prompt, Freihaltezonen und Herkunft: `ASSETS-BRO-BUILDING-BATTLE.md`.
  Keine kopierten Originalspiel-Assets. Das Bildoriginal bleibt lokal im
  ignorierten Kunstordner, bis ein Archivupload ausdrücklich freigegeben ist.
* Kurze Aufsetz-/Absturzklänge werden lokal synthetisiert, standardmäßig stumm;
  der Tonknopf aktiviert sie bewusst. Keine Audio-Downloads.
* Rapier lädt erst beim Einstieg in die Bauwelt. Handys, die nur Controller
  sind, laden weder Physik noch Spielbühne. Die iOS-App bündelt die Abhängigkeit
  bereits mit dem Webclient; keine neuen nativen Berechtigungen.
* Clientprüfungen sind auf höchstens zwei Worker begrenzt. Für diese Änderung
  gezielte Läufe mit einem Worker; Builds nacheinander. Kein Simulator bleibt
  ohne laufende Geräteprüfung geöffnet.

## Verbindung und Unterbrechung

BroRemote bleibt die gemeinsame Lobbyautorität für Online und LAN. Der
Hostbefehl `spielen` ist nur in der Lobby mit verbundenen, bereiten Spielern
zulässig. Die öffentliche Sicht enthält Modus, Seed und Partiekennung. Es
gibt weiterhin `starten` für den ausdrücklich bezeichneten Verbindungstest.

Spielaktionen tragen wie zuvor Abschnitt und Sequenz. Die Simulation erhält
sie über einen Ref statt über einen React-Render je Netzwerkpaket. Gedrückte
Eingaben werden in Raumautorität **und** Simulation nach 600 ms ohne Auffrischung
neutralisiert. Kurze Tastendrücke werden bis zum nächsten Physikschritt gepuffert.
Die nächste Figur übernimmt kein gehaltenes „Fallen lassen“.

Persönliche Bauwerte gehen als validiertes `Privat.bau` an genau den jeweiligen
Controller; keine vollständigen Physikkörper über die Leitung. Ungültige Werte
und unbekannte Zusatzfelder werden abgewiesen beziehungsweise entfernt.

Bei fehlendem Controller oder unterbrochener Hostverbindung pausiert die ganze
Runde. Der Gastgeber kann ausdrücklich ohne fehlende Spieler weiterspielen;
diese geben damit auf. Ein wiederverbundenes Handy übernimmt seinen bestehenden
Sitz. Wird nur die Hostverbindung neu aufgebaut, bleibt dessen Welt bestehen.
**Neuladen/Schließen der Gastgeberseite verliert die Welt:** Nach erneutem
Beitritt führt der Host deshalb zur Lobby zurück und startet kein scheinbar
fortgesetztes Spiel. LAN-Hintergrundverhalten bleibt wie in `BROREMOTE.md`:
iOS beendet den lokalen Listener, daher muss dort eine neue Lobby geöffnet werden.

## Inspiration und Grenzen

Die [offizielle Beschreibung von Tricky Towers](https://www.trickytowers.com/)
nennt physikbasiertes Stapeln, bis zu vier Spieler und Race-, Survival- und
Puzzle-Modi. Übernommen ist die Grundidee eines instabilen Turmwettbewerbs.
Bro Building Battle verwendet eigene Oberfläche, Regeln, Pinguine und
Handycontroller. Rätselmodus, Kampagne, Bots und öffentliche
Spielersuche sind in diesem Ausbau nicht enthalten.

Die Physikeinbindung folgt den [Rapier-Dokumenten](https://rapier.rs/docs/user_guides/javascript/getting_started_js/).
Browser-/Physikprüfungen ersetzen keine echte WLAN-/Hotspot-Abnahme mit mehreren
iPhones. Diese Hardware-Abnahme bleibt vor einer Veröffentlichung erforderlich.

## Lokale Abnahme

Der Grafikausbau ist im vollständigen Build aus dem Wurzelverzeichnis geprüft.
Gezielte Prüfungen umfassen echte WebSocket-Verbindungen, zwei unabhängige
Controller, private Bauwerte über 30 Teile, Reconnect und Rundenwechsel,
fortgesetzten Nachschub nach vollständigem Einsturz, drei Sekunden Zielhalten,
Zauber, eine vollständige simulierte Vierpersonenrunde und Kontobelohnungen
mit Tageskappe. Der Kameratest deckt Einrasten, Fallteile, Einsturz, Zieleinlauf,
Bildratenunabhängigkeit, reduzierte Bewegung und Rundenneustart ab.
Die gesamte Testsammlung des Monorepos wurde aus Rücksicht auf die Rechnerlast
nicht erneut ausgeführt. Gezielte Prüfungen laufen mit einem Worker, Builds
nacheinander.

Browserabnahme: tatsächliche Zweipersonenpartie mit getrennten Controllern,
1280 × 800 für den Gastgeber und 390 × 844 für den Controller. Die zwei
Layoutgrößen wurden mit lokalen Prüfframes geöffnet, weil die Browser-
Größenumschaltung die bereits offenen Tabs nicht zuverlässig änderte. Die
Prüfseiten wurden anschließend gelöscht und die zusätzlichen Tabs geschlossen.
Screenshots liegen im lokalen Aufgabenordner `bro-building-battle-v3`.

Der generische, unsignierte iOS-Prüfbuild des vorigen Ausbaus war erfolgreich;
für diesen Grafikausbau wurde kein erneuter nativer Build und kein echter
WLAN-/Hotspot-Gerätetest durchgeführt. Die Änderungen liegen im gemeinsam
verwendeten Webclient. Kein TestFlight-Archiv, Deploy oder Upload. Die kleine
lokale Vorschau auf Port 5186 bleibt zum Ausprobieren verfügbar; sie besitzt
keine Kontodatenbank und vergibt daher keine Kontomünzen.

## TAFEL

Neuer Regelbaustein `building-kern` und hostseitige Rapier-Simulation ergänzen
BroRemote. Der Relay rechnet keine Physik. Kontobelohnungen liegen im getrennten Building-Dienst mit authentifizierten HTTP-Endpunkten und Tageskappe.
Private Controllerwerte, Pausen, Rundenwechsel und Freigabe von WASM-Welten sind
Teil des Spiels. Der externe Tafelabruf wurde von der automatischen Prüfung
blockiert; dieser lokale Übergabezettel bleibt bis zur autorisierten Tafelpflege
maßgeblich. Es wurde kein Zugriff umgangen und nichts extern geschrieben.

## TAFEL: Grafikausbau und fortlaufender Nachschub

Höhenrennen endet nicht mehr nach 30 Teilen. Controllerübertragung und
Ergebnisspeicherung akzeptieren die innerhalb der drei Minuten möglichen
Bauzahlen; Standfest bleibt begrenzt. Ruhige Kamera ohne Zurückzoomen,
illustrierte Insel und Baumeister, zwischengespeicherte Bausteinmaterialien.
Alle Änderungen und Bildoriginale bleiben lokal. Kein externer Schreibzugriff.
