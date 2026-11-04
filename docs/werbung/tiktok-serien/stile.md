# TikTok-Serien — Stilrichtungen (Stufe 2)

Projekt #15 „TikTok Ads für BroweGGames", Stufe 2, Aufgabe 3 von 10.
Stand 04.11.2026.

Auftrag: Mit den von Tom gewählten Figuren (`figuren.md`, „Auswahl")
dieselbe Szene — Pinguin und Freunde beim Kartenspiel, 9:16 — in 4 bis 6
comichaften Stilrichtungen zeichnen, von nah an Rick and Morty bis
eigenständig. Je Richtung ein Satz, was sie ausmacht, und je Hauptfigur ein
Referenzbild (vorn, seitlich) für die späteren Videos. Keine Videos, kein Ton.

## Stand — BILDER NOCH NICHT ERZEUGT

**Es gibt in diesem Stand noch kein einziges Bild.** Fertig sind die sechs
Stilrichtungen, der Szenen-Prompt und die Referenz-Prompts (unten). Erzeugt wird
erst, wenn ein Mensch die Münzen freigibt:

- Jedes Bildmodell im versein-MCP kostet Münzen (`list_models media=image`,
  billigstes 5, Nano Banana Pro 21 bei 2K bzw. 30 bei 4K). Der unbegrenzte Plan
  gilt über den MCP nicht (`billing_note`).
- Die letzte Vorgabe zu Münzen ist Toms „KEINE Muenzen" vom 02.11.2026
  (`belege.md`, Abschnitt 2). Dieser Auftrag sagt dazu nichts.
- Der andere Weg, die KI-Erzeugung im Creative, ist für Worker gesperrt
  (`steuerung.mjs creative …`: „Creative-Werkzeuge sind dem Orchestrator
  vorbehalten"). Der Auftrag nennt auch kein Creative.

Angefragt am 04.11.2026 per Ruf an der Aufgabe, ohne Antwort in 5 Minuten:

| Posten | Modell | Anzahl | Münzen |
|---|---|---:|---:|
| Szene je Stilrichtung, 9:16 | Nano Banana Pro 4K | 6 | 6 × 30 = 180 |
| Referenzbogen je Figur (vorn + seitlich auf einem 16:9-Bild) | Nano Banana Pro 2K | 7 | 7 × 21 = 147 |
| **Summe** | | 13 | **327** (Obergrenze mit Nachbesserungen 450) |

Guthaben vor der Anfrage: 4.460 Münzen (`get_balance`, 04.11.2026). Preise aus
`estimate_cost` am selben Tag: `kie-nano-banana-pro` 2K 9:16 = 21, 4K 9:16 = 30,
2K 16:9 = 21; `kie-nano-banana-2` 2K = 20.

**Wasserzeichen:** Über den MCP liefert VerseIn nur die Fassung mit Zeichen
(`README.md`, Abschnitt „Bild 1"). Für den Stilvergleich reicht das; als
Startbild für Videos taugt es erst, wenn ein Mensch die Fassung ohne Zeichen im
VerseIn-Web lädt.

Vorbereitet (kostet nichts): Das App-Icon `packages/client/public/icon-1024.png`
liegt als Farbreferenz bei VerseIn (Upload vom 04.11.2026), die Prompts als
Datei `C:/Users/Jan/tiktok-stile-64af/prompts.json` auf Mood XPS.

## Die sechs Stilrichtungen

Reihenfolge von nah an Rick and Morty (1) bis eigenständig (6). Der
Serienname steht in keinem Prompt — er zieht das Modell sonst zu den echten
Figuren (`README.md`, „Stil").

### 1 — Sitcom-Linie

Am nächsten an Rick and Morty: dicke, leicht zittrige schwarze Outlines, flache Farben mit einer harten Schattenstufe, Glubschaugen mit Mini-Pupillen, schiefe Proportionen — der Look erwachsener US-Sitcom-Trickserien.

Stilblock (englisch, steht vor dem Szenen-Prompt):

> Style: adult animated sitcom cartoon, thick uniform black outlines with a slightly wobbly hand-drawn feel, flat colors with one hard cel-shadow step, no gradients, big round googly eyes with small pupils often slightly uneven in size, exaggerated proportions with large heads and thin limbs, muted green-grey and warm brown room colors with saturated character colors. Do not copy any existing show: no lab coats, no spiky hair, no portals.

### 2 — Kabel-Cartoon kantig

Noch nah dran, aber geometrischer: Figuren aus Rechtecken, Dreiecken und Kreisen, dünnere gleichmäßige Linien, knallige Flächen und Schlagschatten wie in den eckigen Kabel-Cartoons der 2000er.

Stilblock (englisch, steht vor dem Szenen-Prompt):

> Style: angular 2000s cable TV cartoon, characters built from simple geometric shapes (rectangles, triangles, circles), thin clean even black outlines, bold saturated flat colors, sharp graphic drop shadows, slightly tilted perspective of the room, small dot eyes or big oval eyes, very expressive poses. No gradients, no textures.

### 3 — Ligne claire

Franko-belgischer Abenteuer-Comic: gleich dünne, ruhige Linie ohne Schraffur, klare Flächenfarben, ein liebevoll detaillierter Raum — erzählt wie ein Album-Panel statt wie ein Trickfilm.

Stilblock (englisch, steht vor dem Szenen-Prompt):

> Style: Franco-Belgian ligne claire comic panel, clean uniform thin black ink lines with no hatching, flat clear colors, no cel shading, richly detailed but tidy background (bookshelf, rug, lamp, framed pictures without any writing), characters with simple dot eyes and friendly rounded shapes, calm balanced composition like a page from a classic adventure comic album.

### 4 — Gummi-Retro

Zeichentrick der 1930er, eigenständig umgesetzt: schlauchförmige, schwingende Arme, Kuchenstück-Augen, weiße Handschuhe, warme Sepia-Palette mit Filmkorn — lustig gealtert statt modern.

Stilblock (englisch, steht vor dem Szenen-Prompt):

> Style: 1930s rubber hose cartoon, bendy noodle limbs without elbows, pie-cut eyes, white cartoon gloves on flippers and hooves, bouncy squash-and-stretch poses, limited warm palette (cream, sepia, muted red, mustard, teal), subtle film grain and slight vignette, hand-inked lines with thick-thin variation. Original characters, not imitating any existing studio character.

### 5 — Riso-Indie-Comic

Indie-Comic im Risodruck: krakelige Bleistift-Tusche-Linie, nur drei Druckfarben (Pink, Blau, Gelb) mit Rasterpunkten und leichtem Versatz — wirkt handgemacht und nach Zine, kaum noch nach Trickserie.

Stilblock (englisch, steht vor dem Szenen-Prompt):

> Style: indie comic printed with risograph, scratchy hand-drawn ink line, only three spot colors (fluorescent pink, medium blue, yellow) plus paper white, visible halftone dots, slight misregistration between color layers, paper grain, overprint where colors overlap. Characters simple and charming with dot eyes.

### 6 — Sticker-Papierschnitt

Am eigenständigsten: Figuren als ausgeschnittene Papier-Sticker mit dickem weißem Rand, flache Formen ohne schwarze Linie, leichte Papierschatten — passt zur App-Optik und hebt sich im TikTok-Feed ab.

Stilblock (englisch, steht vor dem Szenen-Prompt):

> Style: layered cut-paper sticker illustration, every character and object is a flat paper cut-out shape with a thick white sticker border and a soft small drop shadow, no black outlines, simple flat shapes, slight paper texture, bright friendly palette (red-orange, violet, teal, giraffe yellow, night blue), playful and modern.

## Die Szene (für alle sechs gleich)

Dieselbe Szene, damit nur der Stil sich unterscheidet. Am Tisch sitzen die
sieben Figuren aus Toms Auswahl; Pelle trägt die Gastgeber-Auslegung (Nr. 4).
Klein-Pelle (Nr. 5) gehört in Rückblenden und ist deshalb nicht am Tisch.
Oben 15 % ruhig und unten 20 % frei, weil TikTok dort Text und Bedienelemente
einblendet.

> Vertical 9:16 illustration. A cozy evening card game at a round wooden table in a small warm living room, seen from slightly above and in front, the table filling the lower half of the image. Around the table, all fully visible and clearly separated: (1) Pelle, a short chubby penguin with a red-orange back and flippers, cream-white belly and face, orange beak, a small white plus-shaped gamepad cross on his left flipper, wearing a too-small navy blazer and a crooked orange bow tie, eagerly slamming down one playing card with a wide grin, he is the host; (2) Malve, a tall slim penguin with a deep violet-purple back and head, cream belly, round thin glasses, half-lidded unimpressed eyes, cards held close to her chest; (3) Gundi, a friendly golden-yellow giraffe with brown patches and stubby horns, sitting on a too-small stool, her very long neck bent so her head looks away from everyone's cards on purpose, eyes squeezed shut; (4) Hinnerk, a huge fluffy polar bear with a red knitted scarf, broad happy smile, tiny cards in his enormous paws; (5) Paco, a fluffy alpaca with a big cream wool cloud on his head and a caramel body, confused eyes, holding his cards the wrong way round; (6) Oktavia, a coral-pink octopus on the far side of the table, each tentacle holding a small fan of cards; (7) Puk, a small puffin with a colorful striped beak standing on the back of a chair in the foreground corner, filming the table with a plain generic phone on a selfie stick, the screen facing away from the viewer. On the table: a bowl of crisps, a teapot and cups, a small pile of face-down cards. Playing cards show only heart and spade symbols, no letters, no numbers. Leave the top 15 percent of the image calm (wall, lamp) and keep important details out of the bottom 20 percent. No text, no letters, no logo, no watermark, no alcohol, no money, no brand logos. All characters are original designs.

## Referenzbilder je Hauptfigur

„Hauptfigur" heißt hier: jede der sieben Figuren aus Toms Auswahl. Pelles
Auslegungen 4 (Gastgeber) und 5 (Klein-Pelle) sind dieselbe Figur und bekommen
keinen eigenen Bogen. Je Figur entsteht **ein** Bild mit Vorder- und
Seitenansicht nebeneinander. So bleibt es in beiden Ansichten sicher dieselbe
Figur, und es kostet ein Bild statt zwei.

Gezeichnet werden die Bögen in **Stil 1 (Sitcom-Linie)**, dem Stil
aus Stufe 1, solange Tom noch keine Richtung gewählt hat. Wählt er eine
andere, entstehen die Bögen in der gewählten Richtung neu (7 × 21 Münzen).

Vorgabe für jeden Bogen:

> Character reference turnaround sheet, 16:9, plain flat warm light grey background (#EDE6DA). The SAME character shown twice at the same scale, standing, full body, neutral friendly pose: on the left a front view facing the viewer, on the right an exact side profile view facing right. Even lighting, no scene, no props except the ones named, no text, no labels, no letters, no numbers, no logo, no watermark. Playing cards, if any, show only heart and spade symbols.

Figuren:

- **1 Pelle:** a short chubby penguin with a red-orange back, head and flippers, cream-white belly and face, bright orange beak and feet, a small white plus-shaped gamepad cross printed on his left flipper, huge eager eyes, wide grin. No clothes.
- **6 Malve:** a tall slim penguin with a deep violet-purple back and head, cream-white belly, orange beak and feet, round thin glasses, half-lidded unimpressed eyes, one eyebrow raised.
- **8 Gundi:** a friendly giraffe with warm golden-yellow fur and rich brown patches, cream muzzle, two stubby horns with dark knobs, very long neck, kind eyes, standing on all four legs.
- **13 Hinnerk:** a huge fluffy polar bear with cream-white fur, small black eyes, big black nose, broad happy smile, a cozy red knitted scarf, standing upright on his hind legs.
- **14 Puk:** a small puffin with a black back, white face and belly, a big colorful striped beak (orange, yellow, grey), bright orange feet, cheerful winking eyes, no phone.
- **19 Paco:** a fluffy alpaca with a huge round cloud of cream-white wool on his head, light caramel body, long neck, big confused eyes, buck teeth, a question-mark-shaped tuft of wool on top (shape only, no text), standing on four legs.
- **20 Oktavia:** a cheerful octopus with coral-pink skin and lighter suction cups, big excited eyes, wide smile, eight tentacles, floating slightly above the ground.

## Abnahme je Bild (vor dem Kontaktbogen)

- keine Buchstaben, Zahlen, Schrift, Logos; Karten nur mit Herz und Pik
- alle sieben Figuren erkennbar und getrennt, Gundi schaut weg
- kein Alkohol, kein Geld, kein erkennbares Handy (Puk filmt mit der Rückseite)
- keine Nähe zu bekannten Figuren (Laborkittel, Haartolle, Portal)
- unten 20 % frei von wichtigen Details

## Kontaktbogen (folgt mit den Bildern)

Ein Bogen 3 × 2 mit den sechs Szenen (Nummer und Name der Richtung darunter)
und ein Bogen mit den sieben Referenzbögen, gebaut mit sharp, abgelegt
außerhalb des Repos und als Artefakt an der Aufgabe.
