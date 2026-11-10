# BroRemote

Stand: 9. November 2026. Ausgangspunkt: staging `c303dbd6`.

## Auftrag und Spielausbau

BroRemote wird ein eigener Einstieg in Browser und iOS. Darunter liegt Bro
Building Battle mit einer echten Mehrgeräte-Lobby. Der Spielausbau ergänzt
Turmphysik, Höhenrennen und Standfest, Ergebnisse und Revanche. Einzelheiten
stehen in [BRO-BUILDING-BATTLE.md](BRO-BUILDING-BATTLE.md). Der bisherige
Controllertest bleibt als ausdrücklich bezeichnete Zusatzfunktion erhalten.

## Bauplan

1. Gemeinsamer Raumkern: Protokoll, Einladungen, Sitzvergabe, Bereitstatus,
   Gastgeberrechte, private Nachrichten und sichere Wiederverbindung.
2. Browser: eigener WebSocket-Kanal am vorhandenen Server. Der Vermittler
   verwaltet Zugänge; der Gastgeber verarbeitet die Spielaktionen.
3. iOS: lokaler WebSocket-Listener und QR-Scanner in der vorhandenen nativen
   Brücke. Derselbe Raumkern läuft im gebündelten Client des Gastgebers.
4. Gemeinsame Oberfläche: BroRemote, Spielauswahl, Lobby, QR, Controller und
   Verbindungsstatus. Direktzugang auch ohne Anmeldung und Internet.
5. Protokoll-, Integrations- und Oberflächenprüfungen; iOS-Bau. Kein Upload.

## Entscheidungen

BroRemote-Räume sind vorläufige Gast-Räume ohne Kontobelohnungen. So ist der
lokale Betrieb ohne Anmeldung möglich. Raumzugang, Gastgeberberechtigung und
persönliche Wiederverbindung sind unterschiedliche Geheimnisse. Private
Controllerdaten werden gezielt adressiert, niemals in den Lobbyzustand gelegt.

Raumzustand liegt im RAM der jeweiligen Autorität, Wiederverbindungsdaten nur
in der Sitzung des beteiligten Geräts. Ein Serverneustart oder das endgültige
Beenden des lokalen Gastgebers beendet den Raum. Es gibt noch keine gesicherte
Turm-Partie und keine Datenbankmigration. Spätere Spielstände gehören an den
Host-Spieladapter, nicht in die Transportvermittlung.

Der bisherige Kartenspiel-WebSocket bleibt eigenständig. Beide Kanäle teilen
sich den HTTP-Server mit einer ausdrücklichen Pfadzuordnung.

Die iOS-Kamera liest ausschließlich QR-Codes; Bilder werden weder gespeichert
noch übertragen. Die lokale Netzwerkberechtigung wird für den direkten
Geräteaustausch angefragt. Die Systemlaufzeit dient nur dem örtlichen
Nachrichtenlimit, mit dem im Privacy Manifest eingetragenen Grund 35F9.1
([Apple: zugelassene API-Gründe](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons)).

## Starten und ausprobieren

Im Spielemenü **BroRemote** öffnen, dann **Bro Building Battle** wählen.
Alternativ direkt `/broremote` aufrufen. Dieser Bildschirm benötigt kein Konto.

### Browser als Gastgeber

1. **Online → Lobby eröffnen** wählen.
2. Auf jedem Handy den QR-Code scannen oder den Einladungslink öffnen. Die
   iOS-App hat zusätzlich einen eigenen Scanner. Namen eintragen und verbinden.
3. Modus wählen; alle tippen **Ich bin bereit**. **Battle starten** öffnet das
   Spiel mit Countdown und eigener Turmbühne pro Spieler.
4. Am Handy bewegen, drehen und fallen lassen. Nach dem Ergebnis führt
   **Revanche vorbereiten** zur gleichen Lobby zurück.
5. Optional: **Nur Verbindung prüfen** öffnet weiterhin die Testbühne mit
   Auswahl-/Zahlenfeldern und privaten Beispielnachrichten.

Der vorhandene Server stellt `/ws/broremote` bereit. In Entwicklung leitet
Vite `/ws` wie bisher an Port 3000 weiter. Im Betrieb wird WSS über denselben
HTTPS-Host genutzt. Die bestehenden Herkunftseinstellungen gelten auch hier.
Keine neuen Geheimnisse oder Datenbankmigrationen erforderlich. Der Relay
arbeitet zunächst in einer Serverinstanz; für mehrere Instanzen muss die
Raumzuordnung geteilt oder eine feste Zuordnung zum Host sichergestellt werden.

### iOS-App als lokaler Gastgeber

1. Alle Geräte mit demselben WLAN oder persönlichen Hotspot verbinden.
2. **WLAN / Hotspot → Lobby eröffnen** wählen. Der QR enthält die lokale
   Adresse, den Raum und eine zeitlich begrenzte Einladung.
3. Auf den anderen iPhones **BroRemote → Bro Building Battle → QR-Code
   scannen** wählen und den Netzwerkzugriff erlauben.
4. Danach gilt derselbe Lobby- und Controllerablauf wie im Browser.

Der Client liegt im App-Paket. Auch der native Offline-Fehlerschirm bietet
einen BroRemote-Knopf. Ein öffentlicher Server und ein angemeldetes Konto sind
für diesen Weg nicht erforderlich. Lokal läuft WebSocket über private
IPv4-Adressen ohne zusätzliche TLS-Schicht; dafür ein vertrauenswürdiges WLAN
oder einen eigenen Hotspot verwenden. Es werden keine Kontotokens übertragen.
IPv6-only-Netze sind in dieser ersten Fassung nicht unterstützt.

Der Gastgeber bleibt im Vordergrund. Wird die Gastgeber-App in den Hintergrund
gelegt oder beendet, endet die lokale Lobby. Nach einem WLAN-/Hotspotwechsel
eine neue Lobby mit neuer Adresse öffnen. Zeigt ein Gerät mehrere private
Adressen an, kann der Gastgeber die passende Adresse vor dem Scannen wählen.
Die Kamera ist optional; ein eingefügter Link funktioniert ebenfalls.

Für lokale Entwicklerprüfungen kann ein Debug-Build mit `--broremote` direkt
auf diesem Bildschirm starten. Das Argument hat im Release-Build keine Wirkung.
Es wurde kein TestFlight-Archiv erstellt und nichts hochgeladen.

## Verhalten bei Unterbrechungen und Grenzen

* Vier Controller je Raum. Farben und Plätze vergibt die jeweilige Autorität.
* QR-Einladungen gelten zehn Minuten. Ein neuer QR widerruft den alten.
  Beim Entfernen eines Spielers werden dessen Wiederverbindung und der alte
  QR widerrufen. Der neue QR erscheint beim Gastgeber.
* Der persönliche Wiederverbindungsschlüssel liegt im `sessionStorage`
  (`brauweg.broremote.sitzung.v1`), getrennt von der Einladung. Beim expliziten
  Verlassen wird er gelöscht. Browser-Neuladen zeigt **Zur letzten Lobby zurück**.
* Eine neue Verbindung ersetzt die alte. Alte Verbindungen dürfen den neuen
  Sitz weder steuern noch abmelden. Eingaben enthalten Folge und Abschnitt;
  doppelte und veraltete Eingaben werden verworfen.
* Die Handyansicht sendet Bewegungen mit höchstens etwa 30 Hz. Gehaltene
  Eingaben werden alle 150 ms bestätigt und nach 600 ms ohne Bestätigung
  neutralisiert. Loslassen, Fokusverlust und Hintergrund setzen sofort zurück.
* Der Online-Gastgeber kann nach einem erkannten Ausfall 30 Sekunden lang in
  denselben Raum zurück. Währenddessen pausieren die Controller. Jeder neue
  Gastgeberanschluss beginnt einen neuen Abschnitt ohne alte private Daten.
* Serverneustart beendet Online-Räume. Online-Räume enden spätestens nach
  zwölf Stunden. Es wird kein Spielstand als dauerhaft gespeichert ausgegeben.
* Beide Wege begrenzen Nachrichtengröße, Rate und wartende Daten. Es gibt keine
  Eingabewarteschlange, die nach einem Ausfall alte Bewegungen abspielt.

## Integrationspunkte für das Turmspiel

`packages/broremote-kern` enthält Raumrechte, das versionierte Protokoll und
validierte Aktionen: Achsen, gehaltene Tasten, Auswahl, Zahlen und Reset.
`Kanal` in `packages/client/src/broremote/transport.ts` trennt Controller und
Spieloberfläche vom Verbindungsweg. Ein weiterer Transport kann diesen Vertrag
implementieren, ohne die Lobby oder Steuerfelder neu zu schreiben.

Der Gastgeber empfängt `eingabe` mit dem von der Autorität vergebenen Spieler.
An dieser Stelle verarbeitet Bro Building Battle die Aktionen und sendet
`privat.bau` an einzelne Sitze. Der gemeinsame Raumkern kennt dafür Modus,
Partiekennung und Seed; die eigentliche Physik läuft ausschließlich beim Host.
Die Testbühne mit zwei Bedienfeldern bleibt zusätzlich verfügbar.

Offen bleiben dauerhafte Spielstandwiederherstellung nach einem Host-Neuladen
und die Anbindung weiterer Spiele. Diese Lobby schreibt keine Münzen oder
Trophäen gut. Ein Host-Neuladen führt deshalb ausdrücklich zur Lobby zurück.

## Verifikation

* Gesamtprojekt inklusive Browser und Server gebaut.
* Raumtests: Rechte, vier Sitze, private Daten, Sperren, Einladungslaufzeit,
  Entfernen, Wiederverbindung, alte Verbindungen, doppelte Eingaben,
  Abschnittswechsel, Timeout, Nachrichtenlimits und eine simulierte halbe
  Stunde mit vier gleichzeitig aktiven Controllern.
* Echte WebSocket-Verbindungen: zwei Controller am Relay, Privatsicht,
  Wiederverbindung, Bedienfeldwechsel, Raumende; bestehender Spiel-WebSocket
  und BroRemote am selben HTTP-Server; fremde Herkunft abgewiesen.
* Oberfläche: QR-Beitritt, Bereitstatus, Steuerfelder, Reset bei Hintergrund,
  ungültige Zahlen, private Abschnittsdaten und clientseitige Wiederverbindung.
* iOS: Simulatorbau und 30 XCTest-Prüfungen, einschließlich eines echten
  lokalen WebSocket-Textaustauschs zwischen zwei nativen Transportinstanzen.

Der erste vollständige `npm test`-Lauf fand fünf Fehler in den neuen bzw.
betroffenen Prüfungen: Test-IDs, Keyboard-Ereignisziel und drei bisherige
iOS-Vertragsannahmen. Sie wurden korrigiert und die betroffenen Prüfungen
gezielt erneut ausgeführt. Die übrigen Prüfungen dieses Laufs bestanden.

Noch auf echten Geräten abzunehmen: QR-Kamera, WLAN-Berechtigungsdialog,
iPhone-/iPad-Host mit mehreren physischen Handys, persönlicher Hotspot,
Netzwechsel und der vollständige Offline-Ablauf im Flugmodus mit WLAN.
Der Simulatornachweis ersetzt diese Geräteabnahme nicht.

## Eingabeverzögerung messen

Schalter `?messen=1` an `/broremote` (Gastgeber). Der Einladungslink trägt
ihn dann als `m=1` in der Raute mit, das Handy misst also ohne Zutun mit;
`?messen=0` schaltet ihn wieder ab. Unten rechts steht danach eine kleine
Anzeige: am Gastgeber Median und 95 % je Abschnitt, „Tabelle kopieren“ gibt
jede Eingabe als Tabulatortext aus. Ohne Schalter ist `messung` in
`src/broremote/messen.ts` null — kein Timer, kein Ping, kein Paket mehr.

Gemessen wird: Druck am Handy, Ankunft beim Gastgeber, erster Physikschritt
danach, gezeichnetes Bild. Die Druckzeit reist als `folge` mit (Serveruhr in
ms, streng steigend), weil der Raum fremde Felder verwirft; beide Seiten
gleichen ihre Uhr über Ping/Pong ab. „Beim Server angekommen“ ist **geschätzt**
(Ankunft beim Gastgeber minus halber Ping), denn der Server stempelt nichts —
ein Stempel wäre eine Änderung am Transport.

Ohne Handy: `npx tsx werkzeug/broremote-messen.mjs --ziel lokal|staging
--anzahl 250` misst die rohe Leitung (zwei WebSockets, eine Uhr) und danach
den echten Client in Edge ohne Fenster. Vorher `npm run build` im Paket
`broremote-kern`.

Stand 10.11.2026 (staging, Kabel, Kante `ams1`): Druck → Bild Median 50 ms,
p95 72 ms. Davon Leitung ≈ 1 Ping (26 ms), Relay selbst < 1 ms, Warten auf den
Takt des Gastgebers 22 / 39 ms (`BauArena.tsx`: Physik nur im
`setTimeout`-Takt von 33 ms).

## Tafel-Übergabe

Die vorgeschriebenen Leseversuche an Visual Building und Aufgabenboard
antworteten mit HTTP 401 »Token ungültig«. Deshalb hier die Übergabe:
TAFEL: BroRemote-Raumkern, Server-Vermittler, iOS-LAN-Brücke und gemeinsame
Controlleroberfläche als neue Verbindungen ergänzen, sobald der Zugang wieder
funktioniert. Kein Dashboard-Token wurde verändert.
