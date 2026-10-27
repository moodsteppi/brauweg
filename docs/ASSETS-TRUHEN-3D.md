# Truhenöffnung in 3D

Fünf gemeinsame Formen mit eigenen Materialien und Details. Referenz sind die
vorhandenen Hub-Bilder (`truhenbild.ts`): Holz mit Eisen, Bronze mit Kupfer,
Silber mit blauen Feldern, Gold mit Sternen, Diamant mit facettierten Steinen.
Die Modelle werden direkt im Client aus Geometrien gebaut. Keine neuen
Rasterbilder, HDR-Dateien, Modell-Downloads oder externen Quellen erforderlich.
Nachtblaue Bühne, warme Beleuchtung, goldener Betrag und echte räumliche Münzen.
Kein eingebrannter Text, Schachbrett-Hintergrund oder Originalbild unter public.

Ablauf: geschlossen warten, Tipp, 0,6 Sekunden Spannung, Scharnierdeckel öffnet,
ab 0,85 Sekunden Münzen, ab 1,65 Sekunden Betrag, nach 3,2 Sekunden Weiter.
Keine zusätzliche Belohnungsbuchung: Angezeigt wird ausschließlich der Betrag,
den der Server bereits bestätigt hat. Weniger Bewegung öffnet sofort und
zeigt nach 350 ms Weiter. Ohne WebGL bleibt die gemalte Truhe mit demselben
Betrag bedienbar. Fokus bleibt im Dialog und kehrt danach zum Auslöser zurück.

Vorschau: `/?dev=truhe&grad=holz` (auch bronze, silber, gold, diamant).
Die Vorschau benutzt dieselbe Komponente und erlaubt beliebige Wiederholungen.

TAFEL: Truhenöffnung verwendet nun prozedurale 3D-Geometrie statt desselben
getönten GLB für alle Grade. Zeitachse in truhen-ablauf.ts; echte Deckelscharnier-
Bewegung und Münzen im Raum. TruhenGrenze hält den Abschluss ohne WebGL möglich.
