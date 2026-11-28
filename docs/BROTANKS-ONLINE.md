# BroTanks Online: ein Bildschirm je Spieler

Stand: 28.11.2026. Lokaler Stand, noch nicht veröffentlicht.

## Spielablauf

Eigener Einstieg `/tanks-online`, sowohl unter Denken & Strategie als auch
Online-Arena. Die bisherige BroRemote-Variante bleibt bestehen.
Jeder sieht Arena und Steuerung auf seinem Handy, Tablet oder Browser.
Die kompakte Variante hat 2–4 Plätze, drei Waffen (Schneekugel,
Heringsfächer, Polterfass), Reparatur und Schild, eine Runde ohne Serie
und fünf bestehende Landschaften. Karte und Aufstellung kommen vom Server.

Quick Play sucht bis zu 30 Sekunden, bei vier echten Spielern beginnt die
Runde früher. Standardmäßig füllen Bots die freien Plätze. Jeder Teilnehmer
kann „Nicht mit Bots auffüllen“ während der Suche umschalten. Ein Veto gilt
für die ganze Lobby. Nach Ablauf starten zwei oder drei echte Spieler auch
ohne Bots; ein einzelner Spieler wartet weiter und kann Bots wieder erlauben.
Der Countdown gehört der gemeinsamen Lobby, nicht jedem neu beitretenden Gerät.

Freundeslobbys verwenden einen achtstelligen Raumcode oder Einladungslink.
Nur der Gastgeber startet. Botwahl gilt dort ebenfalls für alle Teilnehmer.
Ein getrenntes Gastgebergerät wird nicht benötigt. Die Rolle zum Starten
wechselt bei Trennung auf einen verbundenen Mitspieler.

## Gemeinsame Regeln und Server

`packages/broremote-kern/src/tanks/` enthält die bislang im Client liegenden
reinen Dateien für Gelände, Flug, Partie, Waffen und Bots. Die früheren
Clientpfade exportieren diese Module weiter; damit bleiben bestehende
BroRemote-Importe und Tests unverändert. Keine zweite Physikimplementierung.
Der Unterpfadexport `@brauweg/broremote-kern/tanks/*` sowie die drei
Client-Quellaliaslisten zeigen auf dieselbe Quelle.

`TanksOnlineRaum` verwaltet Suche, Botveto, Sitze und Matchbeginn.
`TanksOnlineGateway` akzeptiert `/ws/tanks-online` mit Protokollversion 1.
Der Server rechnet drei 1/60-Sekunden-Schritte alle 50 ms und sendet viermal
pro Sekunde Weltzustand und persönliche Steuerdaten. Der Client zeichnet
mit höchstens 30 Bildern pro Sekunde; Geschossflug wird zur Darstellung
mit der gemeinsamen Funktion nachgerechnet. Treffer und Ergebnisse bleiben
serverseitig. Im Hintergrund zeichnet der Client nicht fortlaufend.

Sitzschlüssel sind zufällige 24-Byte-Token, nur auf der jeweiligen Leitung
und im `sessionStorage`. Wiederaufnahme ersetzt die vorherige Leitung,
welche danach weder steuern noch den Sitz abmelden darf. Spieler-IDs aus
Eingaben werden nicht vertraut; die Leitung bestimmt den Sitz. Zugnummer,
Waffen, Werte und Items werden geprüft. Eingaben sind begrenzt, ebenso
Nachrichtengröße, Verbindungen je Adresse, Räume und Sendepuffer.
Die Herkunftsliste entspricht Ice Clash und der iOS-App.

Lobbyplätze bleiben bei Trennung 15 Sekunden frei gehalten; laufende
Spieler können 45 Sekunden zurückkommen, danach geben sie auf. Züge laufen
serverseitig weiter und verfallen nach der normalen Zielzeit. Leere Räume
werden nach zwei Minuten entfernt, jeder Raum spätestens nach einer Stunde.
Ein Serverneustart beendet laufende Arenen. Aktuell ein Serverprozess,
kein verteilter Raumzustand. Der Anzeigename kommt automatisch aus dem angemeldeten Konto; neue Einstiege warten auf das Laden. Nur bei fehlender Anmeldung (401) wird „Gast“ verwendet, sonst erscheint bei Ladefehlern eine Wiederholen-Aktion. Es gibt kein Namenseingabefeld; die neue Variante
vergibt keine Kontobelohnungen und schreibt noch keine Kontostatistik.

## Oberfläche und iOS

Feste, nicht scrollbare Querformatfläche mit Spielfeld, Lebenspunkten,
Zugzeit, Verbindungszeit, Zielreglern, drei Waffen, zwei Items, Fahrpfeilen
und Feuerknopf. Regler bleiben native Touch-/Tastatureingaben; Fahrbefehle
enden bei Loslassen, Fokusverlust und Verbindungsabbruch. Doppelte
Feuerbefehle werden bis zur nächsten Phase gesperrt. Erst ein bestätigter
neuer Weltzustand aktiviert die Steuerung nach Wiederverbindung.
Im Hochformat wird ein Drehhinweis angezeigt, Verlassen bleibt möglich.

Die iOS-Hülle erlaubt Querformat auf `/tanks-online` und akzeptiert
zugehörige Universal Links mit validiertem Raumcode. Der Server ergänzt
seine Apple-App-Link-Liste. Kein TestFlight-Upload in dieser Aufgabe.

Grafiken: vorhandene eigene Panzer-, Waffen-, Item-, Landschafts- und
Knopfbilder unter `/broremote/`, dazu der vorhandene Neun-Segment-Holzrahmen
unter `/hub/zierwerk/rahmen.webp`. Keine zusätzlichen Originaldateien,
keine neuen Grafikdownloads, keine zweite 3D-Szene.

## Abnahme

- Raumtests: 30-Sekunden-Grenze, Botveto und Umschalten, volle Räume,
  Privatstartrechte, Wiederverbindung, fremde/alte Eingaben, Aufgabe und
  identischer Weltzustand pro Gerät.
- WebSocket-Integration: zwei Leitungen, gemeinsame Freundespartie,
  Wiederaufnahme desselben Sitzes, gemeinsames Quick Play, Botveto,
  ungültiger Zugang und Aufgabe.
- Client: Auswahl und tatsächliche Schusswerte, Doppelfeuerschutz,
  Fahrstopp, Verbindungssperre, Botumschaltung und Wiederaufnahme.
- Bestehende BroTanks-Regel-, Flug-, Bot-, Terrain- und Controller-Tests.
- Browser: 667 × 375, 844 × 390, 1024 × 768 sowie Hochformat-Drehhinweis.
  Echter lokaler Schuss und Botzüge geprüft; kein nativer Gerätetest behauptet.

Die lokale Vorschau unter Port 5196 ist ein kleiner temporärer Proxy zur
bestehenden Vite-Vorschau auf 5195 mit dem neuen Gateway. Die sonstige
lokale Ice-Clash-Instanz auf 3000 wurde nicht gestoppt. Im normalen Server
ist das Gateway direkt in `packages/server/src/index.ts` registriert.

## TAFEL: für die spätere gemeinsame Veröffentlichung

- Hub → BroTanks Online: eigener Spieleinstieg in Strategie und Online-Arena.
- BroTanks → gemeinsamer Kern: Physik und Bots in `broremote-kern/tanks`,
  Browser-BroRemote und Online-Server nutzen dieselben Regeln.
- BroTanks Online → Gateway: serverseitige Partie, persönliche Steuerung,
  Quick-Play-Suche mit Botveto und Sitzwiederaufnahme.
- iOS → Online-Arena: Querformatfreigabe und Universal-Link-Pfad.
