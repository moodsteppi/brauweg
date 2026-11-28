# Bro Bluff: Kartenmodus

Eigenständiges Tischspiel `brobluff` für 2–4 Spieler, im Games-Tab unter Kartenspiele auf Web und iOS. Kein BroRemote und keine Physik-Arena. Ein Tisch spielt eine Partie; öffentliche/private Lobby, Einladungen, Bot-Plätze, Verbindungswiederaufnahme und Ergebnisabrechnung nutzen die Plattform.

## Regeln

20 Karten: je sechs Kronen, Anker und Diamanten sowie zwei Joker. Jeder aktive Spieler bekommt fünf Karten, Restkarten bleiben unbenutzt. Pro Austeilung wird ein Motiv zufällig bestimmt. Ein Spieler legt ein bis drei Karten verdeckt und behauptet damit, alle passen. Joker sind immer passend. Der nächste Spieler legt ebenfalls oder zweifelt nur die letzte Ablage mit „Bluff!“ an.

Mindestens eine falsche Karte: Der Legende verliert eine Halterung. Alles passend: Der Zweifler verliert eine Halterung. Drei verlorene Halterungen bedeuten Ausscheiden. Der letzte verbliebene Spieler gewinnt. Ausgeschiedene können zuschauen, sehen aber weiterhin keine fremden Hände. Platzierungen folgen der Ausscheidereihenfolge.

Die letzte Ablage einer leeren Hand bleibt anfechtbar. Danach werden leere Hände bei der Zugfolge übersprungen. Sobald nur noch ein Spieler Karten hat, muss er die letzte Ablage anzweifeln. Damit endet jede Austeilung und niemand hängt fest. Nach der Aufdeckung bestätigt der nächste Startspieler „Neu austeilen“; der bestehende Zugtimer bzw. Bot kann diese Aktion ebenfalls ausführen. Der bestrafte Spieler beginnt, sofern er noch dabei ist, sonst der nächste aktive Platz. Ein Verlassen markiert den Sitz für die bestehende Bot-Übernahme.

## Architektur

`packages/game-brobluff` implementiert die reine `GameModule`-Schnittstelle. Die vollständige Zugliste enthält maximal 25 Kartenkombinationen plus Anzweiflung. Zufall kommt aus der privaten Serversaat, Zustand ist JSON und snapshotfähig. Nur `sichtFuer` liefert Hand, öffentliche Kartenanzahlen und die bereits aufgedeckten Karten; Saat, fremde Hände und ungeprüfte Ablagen werden niemals übertragen. Bots verwenden dieselbe eingeschränkte Sicht. Alle Bot-Stufen verwenden derzeit dieselbe Bluffstrategie.

`BroBluffTable` verwendet `useTable` und den vorhandenen Wartebereich. Das Brett zeigt Stühle, drei Halterungen, verdeckte Ablage, Handwahl, Aufdeckung, Wasser-Ausscheiden und Sieger. „Neue Partie“ führt zur Bro-Bluff-Lobby, legt keinen Tisch ungefragt für andere an. Tutorial in fünf Schritten im Spiel. Kein Sprachchat, keine zusätzlichen Spezialkarten und keine eigenen Belohnungsregeln.

Entwicklungsprobe: `/probe/brobluff`, Aufdeckung: `/probe/brobluff?fall=aufdecken`. Nur im vorhandenen Entwicklungs-Probenmodus erreichbar. Kein Produktspiel ohne Server.

## Prüfung

Regeltests: Geheimhaltung, reproduzierbare Austeilung, ehrliche/falsche Behauptungen, Joker, letzte Hand, Aufdeckphase, Ausscheiden, illegale Züge und 90 vollständige Bot-Partien über 2–4 Sitze. Ergänzend Client-Interaktion und Plattformregistrierung prüfen. Tafel-Zugang meldete beim Einrichten 401; Architekturübergabe zusätzlich als TAFEL-Abschnitt im PR.
