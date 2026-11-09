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

Ab drei gelandeten Teilen gibt es je Runde einmal:
* **Turmanker:** bremst den eigenen Turm vier Sekunden stark ab. Schwerkraft
  und Kollisionen bleiben wirksam; die Körper werden nicht dauerhaft fixiert.
* **Schwergewicht:** wählbarer aktiver Gegner; dessen nächstes Teil erhält
  die dreifache Dichte und eine violette Darstellung. Keine Stapelung zweier
  noch ausstehender Schwergewichte. Solo wird der Angriff ausgeblendet.

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
  Zurückzoomen. Bewegung ist bildratenunabhängig und berücksichtigt die
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

Am 9. November 2026 geprüft: vollständiger Build aus dem Wurzelverzeichnis,
Client-Typprüfung, gezielte Regel-, Relay-, Controller- und Physiktests. Die
Prüfungen umfassen echte WebSocket-Verbindungen, das Weiterreichen einer
Handyeingabe bis in genau den eigenen Physikturm, Eingabe-Reset, Rundenwechsel,
gleichzeitiges Ausscheiden und eine vollständige simulierte Vierpersonenrunde.
Die gesamte Testsammlung des Monorepos wurde aus Rücksicht auf die Rechnerlast
nicht erneut ausgeführt.

Die Browserprobe zeigt Gastgeber und zwei getrennte Controller, Countdown,
Turmbau, Zielwertung und Revanche. Desktop- und Handy-Screenshots liegen lokal
in der Aufgaben-Vorschau. Der generische iOS-Simulator-Build mit zwei
Arbeitsschritten ist erfolgreich; das App-Paket enthält den gebauten Webclient
einschließlich Bauwelt. Dafür wurde kein Simulator gestartet. Dies ist ein
unsignierter lokaler Prüfbuild, kein TestFlight-Archiv. Vorschau-Tabs und der
zusätzliche lokale Vorschauserver wurden nach der Prüfung geschlossen.

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
