# Würfelglanz

Eigenständiges Fünf-Würfelspiel für die iOS-App, allein oder mit zwei bis sechs
Spielern. Ein Bogen umfasst 13 Züge; die Plattform-Rundenzahl ist dabei 1.

Pro Zug bis zu drei Würfe; gehaltene Würfel bleiben liegen und können vor
dem dritten Wurf wieder freigegeben werden. Ein freies Wertungsfeld wird
endgültig mit seinem Wert belegt, auch mit null Punkten. Die sechs Zahlenfelder
zählen ihre jeweiligen Augen. Ab 63 Punkten im oberen Block gibt es 35 Bonuspunkte.
Dreier-/Viererpasch zählen alle Augen; volles Haus 25, kleine Straße 30, große
Straße 40, Fünferglanz 50; Chance zählt alle Augen. Straßen berücksichtigen
verschiedene Werte. Volles Haus verlangt ausdrücklich 3+2. Keine Joker- oder
zusätzlichen Fünferboni. Gleichstand teilt den Rang.

Alle Aktionen werden erneut im Kern validiert. `Sicht.moeglich` liefert die
Punktevorschau; die Oberfläche berechnet keine Regeln nach. Zufallszustand nur
im serverseitigen `Partie`-Snapshot, niemals in `Sicht`. Geheime Seed-Basis
kommt von der Plattform. Snapshot-Version und Protokollversion jeweils 1.

Solo hat keine gegnerbezogene Trophäenverteilung; vollständige Bögen melden
ihre Bestleistung `klassisch` mit Richtung `hoch` an die vorhandene Plattform.
Die 13 Einträge zählen für Erfahrung. Keine neue Währung, kein Einsatz.

Bots arbeiten mit denselben legalen Aktionen; Anfänger tragen früher ein,
weitere Stufen halten die häufigste Zahl und nutzen bis zu drei Würfe.
