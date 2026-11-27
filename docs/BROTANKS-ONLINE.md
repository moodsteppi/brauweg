# BroTanks als eigenständiges Online-Spiel

Einstieg unter `/brotanks`, zusätzlich zur unveränderten BroRemote-Auswahl. Games zeigt BroTanks Online unter Brains & Strategie. Zwei bis vier Freunde öffnen eine private Lobby, teilen Link oder achtstelligen Code, wählen eines der fünf vorhandenen Schlachtfelder und bestätigen ihre Bereitschaft. Jeder sieht und steuert auf seinem eigenen Gerät. Die erste Online-Fassung spielt Einzelrunden; BroRemote und Bottraining behalten ihre bisherigen Modi.

## Gemeinsamer Regelkern

`packages/broremote-kern/src/tanks/` enthält Gelände, Flugrechnung, Waffen und Partie. Die bisherigen Clientmodule exportieren diesen Kern weiter. Damit verwenden Bottraining, BroRemote und der neue Server dieselben Regeln. Der zusätzliche Exportpfad `@brauweg/broremote-kern/tanks/*` ist in Vite, Vitest und TypeScript auf die Quellen abgebildet.

`TanksGateway` bedient `/ws/tanks`. Physik läuft serverseitig in festen 1/60-Sekunden-Schritten, Zustände werden fünfmal pro Sekunde übertragen. Die Zeichenbühne spielt die gemeinsame Flugrechnung mit 30 Bildern pro Sekunde ab. Flugbahnen werden nicht in jedem Snapshot mitgeschickt. Herkunftsprüfung, Nachrichtengröße, Nachrichtenrate, Raum-/Verbindungsgrenzen und Rückstauschutz begrenzen den Dienst. Eingaben gehören zum authentifizierten Sitz sowie zur aktuellen Partie und Zugnummer; ein Client liefert keine Treffer oder Ergebnisse.

## Verbindung und Lebensdauer

Jeder Sitz bekommt einen zufälligen Wiederaufnahmeschlüssel; nur dieser Schlüssel, nicht der Raumcode, erlaubt die Übernahme des Sitzes. Speicherung im sessionStorage, nicht im Einladungslink. Ein zweites Socket ersetzt das erste. Die Browser-Verbindung prüft Ping und antwortlose Leitungen und verbindet sich erneut. Bei Verlassen wird die Fahrt zurückgesetzt. Fehlende Spieler haben bis zu 60 Sekunden zum Wiederverbinden, danach scheiden sie aus; Zugzeiten laufen weiter. Lobbyrechte gehen beim Trennen oder Verlassen an einen verbleibenden Spieler. Eine Revanche entfernt verlassene Sitze.

Räume liegen im Arbeitsspeicher einer Serverinstanz (wie Ice Clash). Ein Neustart beendet sie; die Oberfläche meldet dann eine abgelaufene Lobby. Vollständig leere Räume werden nach zwei Minuten, alle Räume spätestens nach zwei Stunden entfernt. Kein eigener Kontobelohnungs- oder Ranglistenpfad in dieser Fassung.

## Bildschirm und iOS

Eigene bildschirmfüllende Ansicht mit kleiner Statuszeile und kompakter Steuerleiste außerhalb des Canvas. Waffenwahl, Winkel, Stärke und Fahren bleiben direkt erreichbar. Items öffnen nur bei Bedarf. Bei Hochformat fordert ein Hinweis zum Drehen auf. iOS erlaubt `/brotanks` im Querformat; Einladungslinks übernehmen nur gültige Raumcodes vom konfigurierten Server.

Die breite Kamera nutzt die Bildschirmbreite ohne verzerrte Panzer. Zwei-Finger-Zoom und Ziehen, Mausrad, Plus/Minus und Umschaltung zur gesamten 1200×650-Zeichenwelt bleiben lokal auf jedem Gerät. BroRemote behält seine bisherige Kameradarstellung. Safe-Area-Abstände berücksichtigen Aussparungen und den Home-Indikator.

## Prüfung

Bestehende 103 BroTanks-/Hubtests bestanden. Drei zusätzliche Steuerungstests prüfen einmaliges Feuern, ausbleibende verzögerte Zielwerte nach Verbindungsverlust und das Beenden der Fahrt. Zwei echte WebSocket-Tests prüfen gemeinsame Welt, Hostrechte, Bereitschaft, Fremdeingaben, Wiederaufnahme, ungültige Sitzungsschlüssel, Hostwechsel/Revanche und Origin-Ablehnung. Client- und Server-Typecheck bestanden. Zwei Browser-Spieler konnten beitreten, bereit werden und dieselbe Partie starten. Native iOS-Änderungen benötigen vor TestFlight noch einen Geräte-/Simulatorlauf.

TAFEL: Neuer Baustein TanksGateway, verbunden mit dem gemeinsam verwendeten Tanks-Regelkern und dem Client tanks-online. Eigenständiger Online-Einstieg ist vom BroRemote-Relay getrennt. Native Hülle ergänzt Querformat und Einladungsrouting. Tafel-Zugang war zuletzt wegen ungültigem Worker-Token nicht verfügbar; diesen Abschnitt bei Wiederherstellung übernehmen.
