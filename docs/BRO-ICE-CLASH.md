# Bro Ice Clash

Eigenständiges Online-Spiel unter `/ice-clash`, als quadratische Spielkachel unter Games → Brain (Deutsch: Denken). Online-Suche für vier Plätze (30 Sekunden, danach Bots), private Lobby mit Code und Link für zwei bis vier Spieler, Üben gegen drei Bots. Hochkant mit Vogelperspektive. Die Arena füllt den Bildschirm; mit zwei Fingern zoomen und verschieben, mit ⤢ zur Gesamtansicht zurückkehren.

## Gleichzeitige Planungszüge

Jeder Zug hat 15 Sekunden Planungszeit. Figuren und Physik stehen dabei still. Mit einem Finger eine Richtung einzeichnen: Wischlänge bestimmt die Stärke (maximal 150 Welt-Einheiten). Loslassen übermittelt den Entwurf. „Festlegen“ bestätigt ihn unveränderlich. Ein letzter übermittelter Entwurf wird nach Ablauf automatisch ausgeführt, ohne Eingabe bleibt ein verbundener Spieler stehen. Der Server hält sämtliche Richtungen geheim: jeder Socket sieht ausschließlich seinen eigenen Plan. Andere Spieler sehen nur den Bereit-Status. Zugnummern verhindern verspätete Eingaben für einen späteren Zug.

Nach 15 Sekunden beginnen alle Bewegungen gleichzeitig, mit vier Sekunden Gleitzeit. Impulse, Kollisionen, Items und Stürze werden serverseitig berechnet. Eisanker schwächt fremde Impulse während dieses Zuges, Schneeball und Windstoß wirken in Bewegungsrichtung. Fähigkeiten werden während der Planung ausgewählt und bei Ausführung einmal verbraucht. Jeder zweite Zug kündigt den Eisabbruch an; erst nach dessen Gleitphase schrumpft die Scholle um 35 Einheiten. Letzter Überlebender bekommt eine Krone; simultaner Sturz ist ein Gleichstand. Drei Kronen gewinnen die Partie.

## Verbindung und Darstellung

40-ms-Simulationsschritte und Zustände alle 80 ms. WebSocket `/ws/ice` mit Origin-Prüfung, Größen-, Nachrichten-, Raum- und Verbindungsgrenzen. Protokollversion 2 verlangt Planungszüge; alte Clients erhalten einen Neuladehinweis. Ein alter Socket kann keinen wieder verbundenen Sitz steuern. Geheime Sitzberechtigung im Session Storage ermöglicht Wiederaufnahme im selben Tab. Bereits festgelegte Züge bleiben bei Wiederverbindung bestehen. Abwesende Spieler erhalten ab dem nächsten Zug einen Bot-Plan; fehlt beim Ablauf jeder Plan, übernimmt der Bot sofort. Lobbyplätze bleiben 15 Sekunden reserviert. Räume im Serverspeicher: Neustarts beenden Partien. Keine Kontobelohnungen.

Vier eigene transparente Pinguin-Emotes: Hallo, Haha, Ups, Jubel. Jeder Spieler kann sie auch beim Zuschauen senden; Anzeige drei Sekunden, mindestens zwei Sekunden Abstand. Nur die vier erlaubten Kennungen werden akzeptiert. Titelbild, senkrechte Pinguin-Spielfigur, Eisoberfläche und Emotes liegen als WebP unter `public/ice-clash`, Originale lokal unter `art/ice-clash`; Entstehung in `ASSETS-ICE-CLASH.md`. Der Kleiderschrank-Pinguin erscheint in Lobby und Siegeransicht. Auf dem Eis gemeinsame Topdown-Figur mit farbigen Markierungen.

Die iPhone-Hülle hält Ice Clash hochkant, BroRemote behält Querformat-Unterstützung, iPad behält alle Ausrichtungen. Native Änderungen werden erst mit einem künftigen App-Build ausgeliefert. Dieser Auftrag veröffentlicht ausschließlich Staging, ohne TestFlight.

## Prüfungen

Reproduzierbarer Spielkern ohne Netzwerk/Datenbank: Planungsdauer, gleichzeitige Bewegung, Geheimhaltung, unveränderliche Bestätigung, ungültige/veraltete Eingaben, Kollisionen, Eisabbruch, Items, Emote-Limits und komplette Bot-Partien. WebSocket-Tests für private/öffentliche Lobby, Rechte, geheime Pläne, Sitzwiederaufnahme und Herkunftsprüfung. Client prüft Protokollvertrag, Verbindung, Fingerplanung und Zoom. Hochkant-Browserprüfung vor Veröffentlichung und Live-Prüfung auf Staging danach.
