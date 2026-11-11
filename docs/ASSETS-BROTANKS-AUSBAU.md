# BroTanks: Grafik-Ausbau

Bestellung: detailreiche, freundlich plastische Pinguin-Fantasy im vorhandenen Stil.
Quadratische Menübilder für BroRemote (Pinguine mit Handycontrollern) und DreckBro
(schlammige Pinguine), Panzer und Waffen als freigestellte Motive, Landschaften
mit freiem Spielbereich. Keine Schrift, keine eingebrannten Bedienelemente,
kein Schachbrett als Ersatz für Transparenz. Originale nur im ignorierten
Grafikordner, ausgelieferte Motive als verkleinerte WebP.

Umgesetzt: BroRemote- und DreckBro-Menübilder, BroTanks-Spielkarte,
Waffen-Stillleben, transparenter Panzer und Polarlicht-Hintergrund.
Erstellt mit OpenAI Image Generation am 11.11.2026. Laufzeitdateien unter
`public/broremote/ausbau`, Originale lokal unter `art/` bzw. im Generierungsordner.
Keine Veröffentlichung im externen Grafikarchiv vorgenommen.

TAFEL: BroTanks hat elf Waffen. Neue IDs 8–10: Gletscherhammer, Sturmkugel,
Frostwall. Relay akzeptiert elf Munitionsplätze; acht Plätze bleiben für alte
Clients lesbar. Fünf Geländeprofile werden mit expliziter Karten-ID und deterministischem Seed gewählt.
Neue Fähigkeiten erfordern gemeinsam aktualisierten Gastgeber und Server.

## Maßstab
Zeichenwelt fest 1200 × 650, Panzer-Sprite 40 × ca. 33 Einheiten,
Rohr ca. 22 Einheiten. 30 Panzerbreiten pro Spielfeld. Die vorhandene
64-Meter-Physikwelt wird gleichmäßig auf diese Zeichenwelt abgebildet;
Physikwerte werden nicht als Pixelwerte neu interpretiert. Einpassen mit
identischem Faktor in beiden Achsen; kein positionsabhängiger Zoom.
Vorbild für Komposition: https://www.shellshocklive.com/ (Screenshots).
1200 × 650 sind unsere Vorgabe, keine Behauptung über dessen Engine.

## Kartenmenü und Arsenal (11.11.2026)
18 neue Laufzeitbilder: 11 einzelne Waffen, Feuer-Emblem, vier Medaillonknöpfe,
zwei neue Landschaften. OpenAI Image Generation; Materialstil Messing, Eis,
Holz, nachtblauer Samt. Keine eingebrannte Beschriftung. Bilder aus Atlanten
extrahiert und auf 192 bzw. 128 Pixel reduziert; Landschaften 1440 Pixel.
Das Kartenmenü zeigt Polarinsel, Bernsteindünen und Kristalltal, alternativ
Überraschung. Der Gastgeber sendet bei `spielen` eine optionale Karten-ID
0–2. Der Raumkern validiert sie und kodiert sie im Partieseed (Modulo 3,
32-Bit-Grenze berücksichtigt), sodass die Auswahl Reconnects überlebt.
Alte Clients ohne Auswahl behalten zufällige Karten. Keine Physikänderung.
Waffenbilder sind im Handy-Arsenal und am Gastgeber beim aktiven Spieler
sichtbar. Leere Waffen sind deaktiviert; Vorwahl bleibt auch beim Warten möglich.
Grafikquellen lokal in `art/brotanks-inventar`, `art/brotanks-welten`,
`art/brotanks-knoepfe`; ursprüngliche Atlanten zusätzlich im Codex-Generierungsordner.

## Volle Breite und Bot-Modus
Die BroTanks-Bühne hebt die Breitenbegrenzung ihres Containers auf; 1200:650
bleibt erhalten. Bei knapper Höhe wird vertikal gescrollt statt horizontal
beschnitten oder auf eine schmale Bühne verkleinert.
Unter BroTanks → Bot-Modus öffnen gibt es lokales Spiel gegen 1–3 Bots mit
Kartenwahl und echter ZielController-Steuerung auf demselben Gerät. Keine
Lobby nötig. Angemeldete Spieler erhalten auch hier Kontobelohnungen, wenn der
Partiestart online bestätigt wurde (Regeln siehe BROTANKS-TAKTIK.md).
Bots berechnen einmal pro Zug eine begrenzte Menge von Flugbahnen, bewerten
Treffer und Eigenschaden und verwenden verfügbaren Munitionsvorrat. Sie
visieren sichtbar an und feuern nach 1,2 Sekunden Spielzeit. Pause und
Hintergrundstopp halten auch Bot-Züge an. Alle Eingaben gehen durch dieselbe
Partielogik wie menschliche Schüsse. Revanche führt zur Konfiguration zurück.

## Werkstatt und taktische Ausrüstung

Neue Lieferung: eine breite Werkstattkulisse (1536×1024, links ruhige Fläche für darüberliegende HTML-Texte, rechts Pinguin-Mechaniker und kompakter Spielzeugpanzer) sowie vier quadratische Inventarmotive (1024×1024, Motiv mittig mit mindestens 12 % Sicherheitsrand): Reparaturkoffer, Schutzschild-Generator, Teleport-Kompass, Treibstoffkanister. Stil: detailliertes, freundliches 3D-Fantasy-Spielzeug, Messing, Dunkelblau, Türkis, warme Werkstattbeleuchtung. Kein Text, keine Marken, kein Schachbrett, keine realistischen Waffen oder militärischen Hoheitszeichen. Inventar auf tiefblauem Hintergrund, keine vorgetäuschte Transparenz. Auslieferung als WebP: Kulisse höchstens 1600 px, Icons 256 px. Originale ausschließlich im ignorierten art-Ordner. Abnahme: auf Handygröße erkennbar, kein Beschnitt, kein eingebrannter Text. Erstellt und visuell geprüft mit OpenAI Image Generation am 11.11.2026. Laufzeitdateien: `public/broremote/taktik/werkstatt.webp`, `reparatur.webp`, `schild.webp`, `teleport.webp`, `treibstoff.webp`. Originale unter `art/brotanks-werkstatt/`.


## Ergänzung: Inseln, Gipfel und fertige Lieferung

Zwei weitere Kulissen mit 1536×1024 Pixeln: freundliche alpine Zwillingsinseln
mit offenem Kanal und eine violette Gipfelwelt mit goldener Festung. Ruhiger
Himmel für Anzeigen, freie mittlere Fläche für das tatsächlich zerstörbare
Gelände. Keine Schrift oder Bedienknöpfe. Die Hintergrundkulisse ist rein
dekorativ; die Kontur im Kartenmenü zeigt zusätzlich das echte Geländeprofil.
Dateien: `public/broremote/welten/inseln.webp` und `gipfel.webp`; Originale
unter `art/brotanks-welten/`. Erstellt mit OpenAI Image Generation am 11.11.2026.

Alle sieben neuen Motive wurden in der Lobby und bei 390 Pixel Breite geprüft,
ohne defekte Bilder oder horizontalen Überlauf. Bilder mit dem vorhandenen
Bildwerkzeug konvertiert; Inventar 256 Pixel, Kulissen 1536 Pixel. Keine
Original-PNGs unter public. Die Originale wurden noch nicht ins externe
Grafikarchiv hochgeladen.

Aktueller Kartenvertrag: `tanksoptionen` speichert Modus, Serie und optional
Karten-ID 0–4 im Raum; `partie.tanks` übernimmt sie beim Start. Alte Clients
mit `spielen.karte` 0–2 behalten den Seed-Vertrag (Modulo 3).

Schuss- und Einschlagklänge werden kurz im Audiokontext synthetisiert, mit
unterschiedlicher Tonhöhe, Klangform, Dauer und Geräuschanteil je Waffe.
Keine fremden Aufnahmen, keine zusätzlichen Audiodateien. Ton ist zunächst
aus und wird über den Lautsprecherknopf aktiviert. Reduzierte Bewegung
unterdrückt Rückstoß und Bildschirmwackeln.
