# BroRemote

Stand: 9. November 2026. Ausgangspunkt: staging `c303dbd6`.

## Auftrag und erste Ausbaustufe

BroRemote wird ein eigener Einstieg in Browser und iOS. Darunter liegt Bro
Building Battle mit einer echten Mehrgeräte-Lobby. Das Turmspiel nach der
Tricky-Towers-Idee folgt separat. Der Start dieser Ausbaustufe öffnet einen
ausdrücklich bezeichneten Controllertest, keine vorgetäuschte fertige Partie.

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

## Tafel-Übergabe

Die vorgeschriebenen Leseversuche an Visual Building und Aufgabenboard
antworteten mit HTTP 401 »Token ungültig«. Deshalb hier die Übergabe:
TAFEL: BroRemote-Raumkern, Server-Vermittler, iOS-LAN-Brücke und gemeinsame
Controlleroberfläche als neue Verbindungen ergänzen, sobald der Zugang wieder
funktioniert. Kein Dashboard-Token wurde verändert.
