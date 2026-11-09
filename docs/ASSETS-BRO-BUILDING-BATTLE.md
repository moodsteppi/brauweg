# Bro Building Battle: Arena-Hintergrund

Ein neues Landschaftsbild für die gemeinsame Gastgeber-Bühne. Bauteile,
Spieler, Plattformen und Zielmarkierung werden getrennt in Canvas/HTML gezeichnet.

## Bestellung

* Format: Landschaft, 1536 × 1024 oder größer, später WebP im Szenenprofil.
* Motiv: schwebende Felsinseln in einer ruhigen nächtlichen Fantasywelt.
* Nachtblau, Petrol, kleine warme Laternenlichter, weiches Mondlicht. Plastisch
  gemalter, freundlicher 3D-Spielstil passend zum bestehenden Pinguin-Hub.
* Zentrale 70 Prozent überwiegend offene, dunkle Himmel-/Nebelfläche. Kleine,
  weit entfernte Inseln und Bäume an Seiten und unterem Bildrand.
* Keine Figuren, keine großen Bauwerke in der Mitte, kein zentraler Pfad,
  keine Spielplattformen, keine Bausteine oder vorhandenen Markenmotive.
* Kein eingebrannter Text, Logo, UI, Wasserzeichen. Keine Transparenz nötig,
  kein Schachbrett. Keine Originalauflösung unter `public/` ausliefern.
* Abnahme: farbige Bauteile klar lesbar, keine hellen Details hinter Zielhöhe,
  Randbeschnitt für 1 bis 4 Spielfelder möglich, WebP deutlich unter 500 kB.

## Generierung

Werkzeug: eingebautes Imagegen, neue Illustration ohne hochgeladene Referenz.
Prompt:

> Create a polished fantasy game environment backdrop for Bro Building Battle,
> a friendly penguin-themed physics tower-building party game. Landscape 3:2
> composition. Beautiful softly rendered 3D storybook mobile game art, midnight
> navy and deep teal sky, gentle moonlight and subtle mist. Distant small floating
> rocky islands with tiny pine trees and a few warm amber lanterns at the far
> left and right edges and at the bottom. Keep the central 70 percent calm,
> dark, open sky with very low detail for overlaying colorful falling blocks.
> Rich atmospheric depth, subtle stars, inviting and premium, crisp painterly
> materials. No characters, no towers in the center, no central road or stepping
> stones, no game platforms, no building blocks, no text, no logo, no interface,
> no watermark, no checkerboard, opaque background.

Original bleibt lokal im ignorierten Kunstordner; Archivübertragung erst,
wenn Uploads wieder freigegeben sind. Laufzeitdatei:
`packages/client/public/broremote/bauwelt.webp`.

## Ausbau: Werkstattinsel und Baumeister

Die bestehende Nachtkulisse bleibt ruhig. Zwei freigestellte Motive ergänzen
die Bühne im plastischen, warm beleuchteten Stil der Kartenmanufaktur.

* `bauinsel.webp`: 1536 × 1024, frontale schwebende Werkstattinsel. Gerade,
  waagerechte Baukante, dunkles Holz mit Messingbeschlägen, fein ausgearbeiteter
  Felsunterbau, kleine blaue Kristalle und Moos ausschließlich unter der Kante.
  Kein isometrischer Blick: Die Bildkante muss zur 2D-Kollision passen.
  Motiv vollständig mit mindestens 5 % transparentem Rand. Keine Aufbauten,
  Figuren oder Bauteile auf der Fläche. Ausrichtung beim Einbau an der
  tatsächlichen Oberkante des gelieferten Motivs.
* `baumeister.webp`: 1024 × 1536, ein freundlicher Pinguin-Baumeister, ganzer
  Körper mit goldgelbem Bauhelm, dunkelblauer Arbeitsschürze, kleiner Kelle.
  Leicht nach rechts gedreht, Füße vollständig sichtbar, kompakte Silhouette.
  Für größere Spielerporträts und die Rundenbegrüßung, keine zusätzliche
  Figurenlogik. Mindestens 8 % freier Rand.
* Echter Alphakanal, kein Schachbrett, keine weiße Matte, kein eingebrannter
  Text, Logo, UI oder Wasserzeichen. Originale nur im ignorierten Kunstordner.
* Laufzeit: WebP mit Profil `wappen`, zusammen unter 500 kB. Alpha auf
  farbigem Grund prüfen. Pro Motiv ein gemeinsam geladenes Bild, keine
  Texturladung pro Frame; weiterhin höchstens 30 Bilder/s.
* Abnahme: Baukante und Physik deckungsgleich, keine Deko über dem Turm,
  gute Erkennbarkeit bei 1 bis 4 Spielern. Animationen achten auf reduzierte
  Bewegung. Prompts und endgültige Maße werden nach Lieferung ergänzt.

### Lieferung und Einbau (9. November 2026)

Eingebautes Imagegen, zwei neue Illustrationen. Originale unverändert lokal
unter `packages/client/art/broremote-building-v3/`; Archivupload bleibt aus.
Für die tatsächlichen Anzeigegrößen auf 768 × 512 (Insel) und 512 × 768
(Baumeister) verkleinert, danach mit dem vorhandenen Werkzeug und Profil
`wappen` in WebP gewandelt. Gemeinsam rund 166 kB. Beide besitzen echten
Alphakanal; Ecken und Darstellung vor farbigem Hintergrund werden geprüft.
Laufzeitdateien: `packages/client/public/broremote/bauinsel.webp` und
`packages/client/public/broremote/baumeister.webp`.

Die obere Baukante liegt im Inseloriginal bei y=366, der Balken reicht von
x=80 bis x=1456 (Original 1536 × 1024). Die Canvas-Zeichnung richtet genau
diese Kante an der physikalischen Plattform aus. Das Motiv wird einmal geladen.

#### Prompt: Werkstattinsel

> Use case: stylized-concept. Asset type: isolated foreground platform for a polished penguin fantasy physics tower-building game, matching the warm ornate navy-and-brass workshop aesthetic of a premium storybook 3D mobile game. Create ONE floating workshop island on a truly transparent background, landscape 3:2, 1536x1024. Straight-on FRONT elevation with only a very thin visible top surface, not isometric. Perfectly horizontal flat top ledge, empty unobstructed from end to end, no objects above it. Thick beautifully crafted dark walnut beam with rounded brass corner caps and small brass rivets, understated engraved diamond emblem centered on front fascia. Below the beam an exquisitely detailed tapered rocky floating island: chunky blue slate facets, moss tufts clinging below the edge, a few small luminous turquoise crystals embedded in rock. Warm amber edge lighting, soft cool moonlight, tactile wood grain, friendly rounded shapes. Entire object centered with 8 percent transparent margin on all sides. Top beam spans 85% width; rocky underside has about half as much height as total beam width. No ground, no cast shadow on a floor, no backdrop, no mist outside silhouette, no characters, no blocks, no trees, no poles, no scenery, no text, no lettering, no watermark, no checkerboard. Actual transparent alpha.

#### Prompt: Baumeister

> Use case: stylized-concept. Asset type: one isolated full-body penguin builder mascot for Bro Building Battle, a premium cozy fantasy game in the same family as a penguin card workshop. Portrait 2:3 composition, 1024x1536. A very cute plump black-and-white baby penguin with warm blue expressive eyes, orange beak and orange feet, fluffy tactile feathers. Wears a beautifully made golden-yellow brass-accented construction helmet with a small diamond badge (NO lettering), dark navy canvas work apron with stitched seams and brass buttons, tiny tool pocket. Holding a small rounded silver mason's trowel in one flipper, other flipper proudly resting at hip. Friendly confident happy expression, facing slightly toward the right but looking at viewer. Full body completely visible with 10% transparent margin including feet, compact silhouette, eye-level view. High-end softly rendered 3D storybook game artwork, warm amber key light, gentle cool rim light, detailed materials, charming rounded proportions. One character only. Truly transparent background with alpha; no floor, no scene, no backdrop, no shadow outside character, no text, no wordmark, no watermark, no checkerboard.
