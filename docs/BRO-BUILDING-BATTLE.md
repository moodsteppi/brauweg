# Bro Building Battle

Stand: 9. November 2026. Lokaler Ausbau auf `codex/broremote`; kein Upload,
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
* Beide Modi begrenzen den Vorrat auf 30 Bauteile. Am Vorratsende setzt sich
  der Turm noch, bevor gewertet wird. Ein Gleichstand bleibt ein Gleichstand.
* Jede Person erhält dieselbe durchmischte Bauteilfolge, in Säcken aus sieben
  Formen. Die Zellen eines Bauteils bilden einen einzigen starren Körper.
  Nach dem ersten Kontakt bleibt es beweglich, kippt und fällt unter Last.
  Es gibt kein Raster, das den Turm nachträglich festhält, und keine Reihenlöschung.

**Handy:** Stick oder Richtungstasten bewegen links/rechts; „Drehen“ dreht
um 90 Grad; „Fallen lassen“ beschleunigt das aktuelle Teil. Stick nach unten
beschleunigt nur während des Haltens. Tasten und Stick funktionieren gleichzeitig.
Der Controller zeigt das nächste Bauteil, Höhe, Platz und gegebenenfalls Leben.

**Allein ausprobieren:** Vor dem Öffnen einer Lobby kann „Erst allein
ausprobieren“ ausgeklappt werden. Das Solotraining läuft ohne Server auf
demselben Gerät. Tastatur: links/rechts, R, Leertaste. Touch funktioniert ebenso.

**Ende:** Ergebnis mit Rangfolge, Höhe und Leben. „Revanche vorbereiten“ führt
in dieselbe Lobby; alle bestätigen erneut „Bereit“. Der neue Start erzeugt
eine neue Partie und einen neuen Seed. Das Solotraining bietet „Noch eine Runde“
mit demselben Seed zum Üben. Ergebnisse sind lokale Party-Ergebnisse, ohne
Münzen, Trophäen, Kontobuchungen oder dauerhafte Rangliste.

## Aufbau und Ressourcen

* `packages/building-kern`: Formen, zentrierte Zellen, Seedfolge, Regelwerte,
  Rangfolge; ohne Netzwerk, Uhr, Grafik und globalen Zufall.
* `packages/client/src/broremote/building/partie.ts`: autoritative 2D-Physik
  mit dem bereits im Projekt vorhandenen Rapier 0.21.0. Eine Welt pro Spieler.
  Es wird nur im Gastgeberfenster gerechnet, bei LAN in dessen gebündelter App.
* `BauArena.tsx`: fester Physiktakt 60 Hz mit maximal sechs Nachholschritten,
  Zeichenfrequenz höchstens 30 Hz, Oberflächen-/Controllerstatus 4 Hz. In
  Hintergrund und Pause keine Physik, reduzierte Statusfrequenz. Pixeldichte
  höchstens 1,5. Schlafende Körper und maximal 30 Teile pro Bahn begrenzen Last.
  Beim Verlassen werden Timer, WebAudio und alle WASM-Welten freigegeben.
* `zeichnen.ts`: leichtgewichtige Canvas-Bühne mit facettierten schwebenden
  Inseln, plastischen Bausteinen und Zielhöhe. Kein zusätzlicher WebGL-Kontext.
  Hintergrund und Pinguin stammen aus den vorhandenen freigegebenen Hub-Dateien
  `weg-sterneninseln.webp` und `pinguin/pinguin-basis.webp`. Keine neuen großen
  Rasterdateien oder kopierten Originalspiel-Assets.
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
Handycontroller. Zauber, Rätselmodus, Kampagne, Bots und öffentliche
Spielersuche sind in diesem Ausbau nicht enthalten.

Die Physikeinbindung folgt den [Rapier-Dokumenten](https://rapier.rs/docs/user_guides/javascript/getting_started_js/).
Browser-/Physikprüfungen ersetzen keine echte WLAN-/Hotspot-Abnahme mit mehreren
iPhones. Diese Hardware-Abnahme bleibt vor einer Veröffentlichung erforderlich.

## TAFEL

Neuer Regelbaustein `building-kern` und hostseitige Rapier-Simulation ergänzen
BroRemote. Der Relay rechnet keine Physik und wertet keine Kontobelohnungen aus.
Private Controllerwerte, Pausen, Rundenwechsel und Freigabe von WASM-Welten sind
Teil des Spiels. Der externe Tafelabruf wurde von der automatischen Prüfung
blockiert; dieser lokale Übergabezettel bleibt bis zur autorisierten Tafelpflege
maßgeblich. Es wurde kein Zugriff umgangen und nichts extern geschrieben.
