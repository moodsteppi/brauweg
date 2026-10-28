# Würfelglanz: iOS-Spiel und Grafikauftrag

Auftrag vom 28.10.2026: eigenständiger Name, hochwertige Pinguin-Gestaltung
im Stil der Kartenmanufaktur, Solo und Mehrspieler. Interne Kennung
`wuerfelglanz`, Anzeigename **Würfelglanz**, eigene Motive und Oberfläche.

## Spiel und Plattform

- Regelkern `packages/game-wuerfelglanz`, 1 bis 6 Spieler, 13 Felder pro Bogen.
  Regeln siehe README des Pakets. Punktevorschauen kommen aus der Serversicht.
- Registriert in `games/registry.ts`: web aus, iOS spielbar, Android aus.
  `GameMeta.nurIos` gilt sowohl bei HTTP-Einstiegen als auch beim WebSocket-Join.
  Die historische Plattformkennung `app` steht für iOS; `android` benutzt für
  alle bisherigen Spiele unverändert die App-Freigaben.
- API erlaubt einen Tisch mit einem Platz, wenn das Modul diese Sitzzahl
  tatsächlich unterstützt. Die übrigen Spiele behalten ihre Modulgrenzen.
- Solo erstellt einen eigenen Tisch mit einem Platz; Freunde erstellen einen
  offenen Tisch mit 2 bis 6 Plätzen und teilen dessen Beitrittscode. Bots
  können freie Plätze übernehmen, alternativ mit Anwesenden starten.
- Zufall und Wertungen serverseitig, Reconnect aus `party_snapshot`. Keine
  neue Migration nötig. Bestleistung unter `bestleistung`, Spiel
  `wuerfelglanz`, Inhalt `klassisch`, Richtung `hoch`; nur vollständige Bögen.
- Client `screens/Wuerfelglanz.tsx`: Menü, Raum, Würfeltablett, interaktiver
  Wertungsbogen, Nullpunkte-Rückfrage, Ergebnis und Serverfehler. CSS-Würfel
  mit sechs korrekten Seiten, Haltemarkierung, Animation und reduzierter Bewegung.
- Spielansicht unter `/probe/wuerfelglanz?iphone` nur im Dev-Server,
  `ansicht=spiel|mehrspieler|ende` für Zustandsproben. Dort läuft der echte Kern
  ohne Konto; dieser Vorschauzustand wird niemals als Ergebnis an den Server gemeldet.

## Grafikbrief und Ablage

Werkzeug: eingebautes Imagegen, Kategorie `stylized-concept`.
Banner: zwei freundliche Pinguine mit großen blauen Augen, links ein Ritter
mit blauem Federbusch, rechts ein Pinguin mit bordeauxrotem Schal. Genau fünf
elfenbeinfarbene Würfel auf einem smaragdgrünen Samttablett in einer warm
beleuchteten mittelalterlichen Taverne. Hochwertiger Spielzeug-3D-Stil,
Nussbaum, Goldkanten, warme Laternen, blaues Abendlicht. Keine Schrift, Logos
oder Wasserzeichen. Zentrale Komposition, nutzbar als breites Spielbanner.

Tablett: derselbe Materialstil, fast senkrechte Draufsicht, leeres grünes
Samttablett mit achteckigem geschnitztem Holzrahmen, Goldkante und kleinem
Stern. Freie Mitte für interaktive Würfel. Erster Entwurf im Hochformat,
anschließend als breites 2:1-Spieltablett neu angeordnet. Keine Würfel,
Figuren, Texte oder Benutzeroberfläche im Hintergrund.

Originale im separaten Archiv:
`brauweg-art/wuerfelglanz/held-original.png`,
`tisch-hochformat-original.png`, `tablett-original.png`.
Ausgeliefert: `packages/client/public/hub/banner-wuerfelglanz.webp`
(1200 px breit, rund 159 KiB) und
`packages/client/public/wuerfelglanz/tablett.webp` (1000 px breit, rund 97 KiB).
PNG-Originale bleiben aus dem App-Paket heraus.

## Prüfungen und Übergabe

Regeltests: alle Wertungen, Bonusgrenze, gehaltene Würfel, ungültige Aktionen,
Snapshot-Fortsetzung, Seed-Vertraulichkeit, vollständige Botpartien für alle
Sitzzahlen, Ausstieg und Gleichstand.
Server: iOS-Freigabe gegenüber Web/Android, Solo-Abschluss und gespeicherte
Bestleistung, exaktes Resume, zwei echte WebSockets samt Zugwechsel.
Client: Solo-/Tischauswahl, Halten, Punkteauswahl, Nullpunkte-Bestätigung,
Zuschauer-/Mitspielersperren, Ende und korrekte Würfelseiten.

TAFEL-Zugang antwortet weiterhin mit HTTP 401 („Token ungültig“); dieser
Übergabezettel hält die neuen Bausteine und Verknüpfungen als Ersatz fest.
Noch kein Staging-Deploy oder TestFlight-Upload für dieses neue Spiel.

Die Schlussleiste liegt außerhalb des rollenden Bogens; die Würfel bleiben
beim Scrollen am oberen Rand sichtbar. So verdeckt keine Schaltfläche ein
Wertungsfeld, und die iPhone-Home-Anzeige bleibt frei.

## Bildprompts (eingebautes Imagegen)

**Banner:** Use case: stylized-concept. Asset type: wide mobile game hero illustration for an original five-dice game called Würfelglanz in the Brauweg universe. Polished premium toy-like 3D fantasy illustration matching a cozy penguin medieval tavern game: two adorable small black-and-white penguins with huge expressive blue eyes and orange beaks, left a blue-plumed knight penguin, right a burgundy scarf penguin, happily rolling exactly five rounded ivory dice with traditional black circular pips onto an emerald velvet dice tray with carved walnut rim and subtle gold trim. Warm amber lanterns, shelves, soft blue evening light through arched windows, charming detailed rich materials, joyful but sophisticated family board-game atmosphere. Landscape 3:2 composition suitable to crop to 2:1 mobile banner; dice and faces central, focal objects all within central 70%, no text anywhere, no letters, no logos, no numbers printed as text, no score sheet, no brand marks, no watermark.

**Tablett, Entwurf:** Use case: stylized-concept. Asset type: portrait background art for a premium mobile five-dice game in a cozy medieval penguin tavern, matching polished toy-like 3D game illustration. Camera almost directly overhead on a luxurious deep emerald green velvet dice tray with broad rounded octagonal carved walnut rim, delicate warm golden trim, tiny embossed star detail at top rim. The middle 75 percent must be clean uninterrupted flat green velvet, empty, usable as a gameplay surface for five interactive dice added later. Background at outer edges only: dark walnut tavern table, cropped softly glowing brass lantern at upper left, small burgundy cloth and blue cloth at bottom corners. Rich realistic stylized materials, subtle velvet nap, warm amber rim lighting, restrained blue evening reflections, elegant handcrafted board-game atmosphere. Portrait 2:3. No dice, no characters, no hands, no score sheet, no cards, no text, no lettering, no numbers, no logos, no watermark. Single uninterrupted tray, no collage, no UI.

**Tablett, Endfassung mit Entwurf als Referenz:** Recompose this exact empty green velvet and carved walnut dice tray into a wide landscape 2:1 horizontal mobile gameplay panel, seen almost directly overhead. Keep its premium toy-like 3D rendering, emerald velvet material, golden trim, warm lantern light and small gold star. The octagonal tray itself must now be wider than tall, filling most of the image; show the entire wood rim on all four sides. Leave the central 75 percent of the tray completely empty and clean for interactive dice. Crop away most outer tavern table. No dice, no text, no letters, no UI, no watermark. Landscape aspect ratio 2:1.

Vor einer Veröffentlichung müssen Server und iOS-Client gemeinsam bereitstehen.
In einer Umgebung mit expliziter `UMFANG`-Liste muss `wuerfelglanz` enthalten
sein; das macht das Spiel auf Web/Android trotzdem nicht sichtbar. Der neue
Client bringt die Spielansicht und optimierten Bilder mit; alte Clients
kennen das Spiel noch nicht.
