# Bilder für Flying Bro

Einzelspieler-Schleuderspiel im Hub (Projekt „Rider Modus hinzufügen", Arbeitsname
**Flying Bro**; der endgültige Name steht noch aus). Die Bros sind Brauweg-Pinguine,
die Gegner Giraffen, gebaut wird aus Holz, Stein und Glas.

**Stand: 6. November 2026, geliefert (26 Bilder).** Erzeugt mit ChatGPT-Bildern über
`codex exec` (ChatGPT-Anmeldung) auf dem Mood-Stand-PC, ohne Creative-KI mit
Kosten. Es gibt noch **keinen Spielcode**, und die Bilder hängen nirgends —
erst der Spielbau bindet sie ein.

---

## Was geliefert ist

Alles unter `packages/client/public/flyingbro/`, WebP, gewandelt mit
`~/bildwerkzeug/wandeln.mjs` (Profil `wappen` für alles Freigestellte, `szene`
für den Hintergrund). Zusammen **rund 700 kB**.

| Datei | Maß | Größe | Alpha |
| --- | --- | --- | --- |
| `bro-schnell-flug.webp` | 384 × 322 | 28.6 kB | ja |
| `bro-schnell-ruhe.webp` | 221 × 384 | 25.6 kB | ja |
| `bro-schwer-flug.webp` | 384 × 341 | 27.2 kB | ja |
| `bro-schwer-ruhe.webp` | 316 × 384 | 31.2 kB | ja |
| `bro-teilt-flug.webp` | 334 × 384 | 50.3 kB | ja |
| `bro-teilt-ruhe.webp` | 240 × 384 | 30.3 kB | ja |
| `giraffe-gross-getroffen.webp` | 245 × 384 | 32.5 kB | ja |
| `giraffe-gross-steht.webp` | 247 × 384 | 27.9 kB | ja |
| `giraffe-klein-getroffen.webp` | 330 × 384 | 50.9 kB | ja |
| `giraffe-klein-steht.webp` | 275 × 384 | 30.6 kB | ja |
| `giraffe-mittel-getroffen.webp` | 252 × 384 | 31.1 kB | ja |
| `giraffe-mittel-steht.webp` | 240 × 384 | 25.0 kB | ja |
| `glas-balken-angeknackst.webp` | 512 × 128 | 17.8 kB | ja |
| `glas-balken-heil.webp` | 512 × 128 | 9.1 kB | ja |
| `glas-quadrat-angeknackst.webp` | 256 × 256 | 15.8 kB | ja |
| `glas-quadrat-heil.webp` | 256 × 256 | 9.6 kB | ja |
| `hintergrund.webp` | 1536 × 1024 | 51.9 kB | nein |
| `holz-balken-angeknackst.webp` | 512 × 128 | 20.8 kB | ja |
| `holz-balken-heil.webp` | 512 × 128 | 13.8 kB | ja |
| `holz-quadrat-angeknackst.webp` | 256 × 256 | 22.9 kB | ja |
| `holz-quadrat-heil.webp` | 256 × 256 | 14.8 kB | ja |
| `schleuder.webp` | 329 × 512 | 31.4 kB | ja |
| `stein-balken-angeknackst.webp` | 512 × 128 | 11.6 kB | ja |
| `stein-balken-heil.webp` | 512 × 128 | 9.5 kB | ja |
| `stein-quadrat-angeknackst.webp` | 256 × 256 | 10.9 kB | ja |
| `stein-quadrat-heil.webp` | 256 × 256 | 7.7 kB | ja |

### Was welches Bild ist

| Gruppe | Dateien | Gedacht für |
| --- | --- | --- |
| **Bro „schnell"** | `bro-schnell-ruhe`, `bro-schnell-flug` | schlank, türkise Fliegerkappe mit Messingbrille und Schal — beschleunigt im Flug |
| **Bro „schwer"** | `bro-schwer-ruhe`, `bro-schwer-flug` | rund, Stahlrüstung und Helm, im Flug als Kanonenkugel — durchschlägt Stein |
| **Bro „teilt sich"** | `bro-teilt-ruhe`, `bro-teilt-flug` | klein, violette Bommelmütze mit drei Bommeln, gestreifter Schal; das Flugbild zeigt schon die zwei durchscheinenden Kopien |
| **Giraffe klein / mittel / groß** | `giraffe-<größe>-steht`, `giraffe-<größe>-getroffen` | Gegner. Getroffen: Spiralaugen, Beule, Sterne, Zunge raus. Die große trägt eine Krone |
| **Bauteile** | `<holz\|stein\|glas>-<quadrat\|balken>-<heil\|angeknackst>` | Quadrat 1 : 1, Balken 4 : 1, reine Vorderansicht, randlos — das Bild füllt die Physikform |
| **Schleuder** | `schleuder` | Holzgabel mit Lederwicklung und Ösen, **ohne Gummi** — das Band zeichnet das Spiel zwischen die Ösen |
| **Hintergrund** | `hintergrund` | 3 : 2, ohne Alpha. Unten ein freier Grasstreifen (der Boden), oben ruhiger Himmel |

**Blickrichtung:** Die Bros schauen nach **rechts** (Abschuss nach rechts), die
Giraffen nach **links** zur Schleuder. Wer spiegelt, spiegelt per CSS/Leinwand,
nicht als eigene Datei.

**Maße:** Figuren auf höchstens 384 px an der langen Seite (die Schleuder 512 px).
Auf dem Handy steht ein Bro bei 40–60 CSS-Pixeln, also reicht das für dreifache
Pixeldichte. Die Rohbilder kamen in 1254 px und wurden vor dem Wandeln
beschnitten (leerer Rand weg, 4 % Luft wieder dran) und verkleinert.
Bauteile wurden **ohne** Luft auf exakt 256 × 256 bzw. 512 × 128 gezogen, damit
Bild und Kollisionskasten deckungsgleich sind.

**Hochkant oder quer?** Steht beim Bestellen noch nicht fest. Der Hintergrund ist
quer (1536 × 1024) und taugt hochkant als Panorama, das mit der Kamera mitläuft.
Wird ein hochkant gefülltes Bild ohne Kamerafahrt nötig, ist das eine
Nachbestellung (9 : 16, gleicher Prompt mit „Portrait 1024x1536").

### Bekannte Schwächen (bewusst so geliefert)

- **Mittlere und große Giraffe ähneln sich.** Die große unterscheidet nur die
  Krone. Die Größe entsteht im Spiel durch Skalieren. Soll die große auch
  breiter oder bulliger wirken, die beiden `giraffe-gross-*` neu erzeugen.
- **Glasbalken angeknackst** kam etwas länglicher als 4 : 1 und ist beim Einpassen
  um rund 10 % gestaucht. Mit bloßem Auge fällt das nicht auf.
- `bro-teilt-flug` und `giraffe-klein-getroffen` wiegen je rund 50 kB, mehr als
  der Rest, wegen der durchscheinenden Kopien bzw. der vielen Sterne. Unkritisch.

### Geprüft

- **Echter Alphakanal** bei allen 25 freigestellten Bildern: Ecken `alpha = 0`,
  halbtransparente Pixel nur an Kanten (unter 1 %, beim Teil-Bro 9 % wegen der
  gewollten durchscheinenden Kopien).
- **Auf knallrotem Grund angesehen** (Kontaktbogen): kein Saum, kein
  Schachbrett, kein eingebrannter Text.
- **Keine Originalauflösung unter `public/`.** Die Originale liegen im Archivrepo
  `brauweg-art` unter `flyingbro/`, vorerst auf dem Zweig
  `flyingbro-originale`. Er wird zusammen mit diesem Zweig nach `main`
  übernommen.

---

## Woher der Stil kommt — und was ausdrücklich nicht

**Vorlage ist allein der Ritter-Pinguin** `packages/client/public/hub/pinguin.png`.
Er ging als erstes Bild in **jede** Erzeugung, dazu die Stilregeln aus
`docs/ASSETS-PINGUIN.md`: gerenderte Spielfigur, Volumen, Licht von oben links,
keine Konturlinie, kein Fotorealismus.

**Kein Bild aus einem fremden Spiel als Vorlage.** Das Spielprinzip (Schleuder,
Türme, Gegner) ist ein Genre, der Look ist es nicht. Ein erster Probelauf mit
„kleiner roter runder Pinguin, zusammengerollt" ergab einen roten Kugelvogel mit
Zornesbrauen, der einer bekannten Spielfigur zu nahe kam. Er wurde verworfen.
Seitdem steht in jedem Prompt das ausdrückliche Verbot (*no round red/yellow/blue
birds with angry eyebrows, no green pigs*), und die Bros sind erkennbar
**Brauweg-Pinguine** (schwarz-weiß, orange Schnabel und Füße) mit eigener
Ausrüstung statt farbiger Kugelkörper. **Wer nachbestellt, behält das bei.**

---

## So wurde erzeugt (zum Nachbestellen)

Ein Aufruf je Bild, nacheinander, je rund eine Minute:

```bash
echo "<Prompt>" | codex exec --skip-git-repo-check --sandbox read-only \
  --image "<pfad>/pinguin.png" [--image "<roh>/<vorlage>.png"] -
```

- Codex legt das Ergebnis unter `~/.codex/generated_images/<session-id>/` ab,
  **nicht** im Arbeitsordner (der ist in `read-only` gesperrt). Die Session-ID
  steht in der Ausgabe (`session id: …`).
- `--image` nimmt mehrere Werte. Steht der Prompt dahinter als Argument, frisst
  `--image` ihn als Dateinamen, und Codex meldet „No prompt provided". Deshalb
  kommt der Prompt über stdin (`-`).
- Das Bild kommt mit echtem Alpha zurück, wenn der Prompt es verlangt. Ein
  Freistellen von Hand war nicht nötig.
- **Folgebilder mit zweiter Vorlage:** Flugpose ← Ruhepose, getroffen ← stehend,
  angeknackst ← heil, Balken ← Quadrat desselben Materials. Nur so bleiben
  Farben und Ausrüstung gleich.
- Die Skripte dazu (`auftraege.mjs`, `erzeugen.mjs`, `verarbeiten.mjs`,
  `bogen.mjs`) liegen mit den Originalen in `brauweg-art/flyingbro/werkzeug/`.

Jeder Prompt besteht aus drei Teilen: Einleitung, Bildzeile (unten je Datei),
Stilblock.

**Einleitung:**

```text
Use your image generation tool to create exactly ONE image. Do not run shell commands and do not read files, just generate. The FIRST attached image is the style reference; the SECOND attached image is the character/object to stay consistent with.
```

(Der Teil ab „; the SECOND …" steht nur dabei, wenn es eine zweite Vorlage gibt.)

**Stilblock für alle freigestellten Bilder:**

```text
Style: match the attached Brauweg knight penguin reference in rendering — stylized 3D-rendered mobile game art, rounded modelled shapes with real volume, soft gradients over the curvature, glossy highlights on eyes and metal, one light source from the top left, soft contact shadows only where parts overlap, friendly big eyes, no black outline, not flat vector, not photorealistic. Original design for our own game "Brauweg"; do not imitate characters, objects or art of any existing game (in particular no round red/yellow/blue birds with angry eyebrows, no green pigs). Real transparent background with alpha channel — no checkerboard, no ground, no cast floor shadow, no text, no logo, no frame, no UI. One single object, centered, fully visible with a small margin.
```

**Stilblock für den Hintergrund** (ohne Alpha):

```text
Style: match the attached Brauweg knight penguin reference in rendering — stylized 3D-rendered mobile game art, soft gradients, one warm light source from the top left, not flat vector, not photorealistic. Original design for our own game "Brauweg"; do not imitate any existing game's art. No text, no logo, no frame, no UI.
```

### Bildzeile je Datei

#### `bro-schnell-ruhe`

```text
Subject: a Brauweg penguin (black back and head, white belly and face, orange beak and orange feet, big friendly eyes), slim and streamlined, wearing a turquoise leather aviator cap with brass goggles and a short turquoise scarf — the FAST one, light and agile build. Pose: standing upright and relaxed, wings at the sides, confident friendly smile, full body, three-quarter view facing right. Square 1024x1024.
```

#### `bro-schnell-flug` — zweite Vorlage: `bro-schnell-ruhe`

```text
Subject: the SAME character as in the second attached image (identical colors, gear and proportions): a Brauweg penguin (black back and head, white belly and face, orange beak and orange feet, big friendly eyes), slim and streamlined, wearing a turquoise leather aviator cap with brass goggles and a short turquoise scarf — the FAST one, light and agile build. Pose: in mid-flight, launched through the air to the right, body stretched forward, wings swept back, determined focused face, goggles pulled down over the eyes, scarf streaming behind. Side view. Square 1024x1024.
```

#### `bro-schwer-ruhe`

```text
Subject: a Brauweg penguin (black back and head, white belly and face, orange beak and orange feet, big friendly eyes), big, heavy and very round, wearing thick dark steel plate armor with rivets and a rounded steel helmet with the visor up, small bronze trims — the HEAVY one, chunky and solid. Pose: standing upright and relaxed, wings at the sides, confident friendly smile, full body, three-quarter view facing right. Square 1024x1024.
```

#### `bro-schwer-flug` — zweite Vorlage: `bro-schwer-ruhe`

```text
Subject: the SAME character as in the second attached image (identical colors, gear and proportions): a Brauweg penguin (black back and head, white belly and face, orange beak and orange feet, big friendly eyes), big, heavy and very round, wearing thick dark steel plate armor with rivets and a rounded steel helmet with the visor up, small bronze trims — the HEAVY one, chunky and solid. Pose: in mid-flight, launched through the air to the right, body stretched forward, wings swept back, determined focused face, tucked into a compact armored cannonball shape, visor down. Side view. Square 1024x1024.
```

#### `bro-teilt-ruhe`

```text
Subject: a Brauweg penguin (black back and head, white belly and face, orange beak and orange feet, big friendly eyes), small and chubby, wearing a violet knitted bobble hat with three pom-poms and a violet-and-white striped scarf — the SPLITTING one, playful and mischievous. Pose: standing upright and relaxed, wings at the sides, confident friendly smile, full body, three-quarter view facing right. Square 1024x1024.
```

#### `bro-teilt-flug` — zweite Vorlage: `bro-teilt-ruhe`

```text
Subject: the SAME character as in the second attached image (identical colors, gear and proportions): a Brauweg penguin (black back and head, white belly and face, orange beak and orange feet, big friendly eyes), small and chubby, wearing a violet knitted bobble hat with three pom-poms and a violet-and-white striped scarf — the SPLITTING one, playful and mischievous. Pose: in mid-flight, launched through the air to the right, body stretched forward, wings swept back, determined focused face, with two faint translucent violet copies of itself fanning out above and below as if about to split into three. Side view. Square 1024x1024.
```

#### `giraffe-klein-steht`

```text
Subject: a small cartoon baby giraffe, very short neck, oversized round head, stubby legs, cheeky grin — the SMALL opponent, same stylized 3D look as the penguin reference (soft fur texture, orange-brown patches, small ossicone horns). Pose: standing on all four legs, full body, three-quarter view facing LEFT, looking left and teasing. Square 1024x1024.
```

#### `giraffe-klein-getroffen` — zweite Vorlage: `giraffe-klein-steht`

```text
Subject: the SAME giraffe as in the second attached image (identical colors, patches, size and proportions), now just hit: dizzy swirly eyes, a red bump on the head, three small yellow stars circling the head, body tilted and wobbling, tongue sticking out, still standing, facing LEFT. Square 1024x1024.
```

#### `giraffe-mittel-steht`

```text
Subject: an adult cartoon giraffe of medium height, smug teasing grin, slightly plump body — the MEDIUM opponent, same stylized 3D look as the penguin reference (soft fur texture, orange-brown patches, small ossicone horns). Pose: standing on all four legs, full body, three-quarter view facing LEFT, looking left and teasing. Portrait 1024x1536.
```

#### `giraffe-mittel-getroffen` — zweite Vorlage: `giraffe-mittel-steht`

```text
Subject: the SAME giraffe as in the second attached image (identical colors, patches, size and proportions), now just hit: dizzy swirly eyes, a red bump on the head, three small yellow stars circling the head, body tilted and wobbling, tongue sticking out, still standing, facing LEFT. Portrait 1024x1536.
```

#### `giraffe-gross-steht`

```text
Subject: a big tall burly cartoon giraffe wearing a small golden crown, arrogant boss grin — the BIG opponent, same stylized 3D look as the penguin reference (soft fur texture, orange-brown patches, small ossicone horns). Pose: standing on all four legs, full body, three-quarter view facing LEFT, looking left and teasing. Portrait 1024x1536.
```

#### `giraffe-gross-getroffen` — zweite Vorlage: `giraffe-gross-steht`

```text
Subject: the SAME giraffe as in the second attached image (identical colors, patches, crown, size and proportions), now just hit: dizzy swirly eyes, a red bump on the head, three small yellow stars circling the head, body tilted and wobbling, tongue sticking out, still standing, facing LEFT. Portrait 1024x1536.
```

#### `holz-quadrat-heil`

```text
Subject: a single square warm light-brown wooden building block made of planks with visible wood grain and slightly beveled edges, small iron nails at the corners. Straight-on FRONT orthographic view, no perspective, no visible top or side faces, exactly square, intact. Square 1024x1024.
```

#### `holz-quadrat-angeknackst` — zweite Vorlage: `holz-quadrat-heil`

```text
Subject: the SAME block as in the second attached image (identical shape, size, color, orientation and front view), now damaged: several clear cracks across the face, chipped corners, a splintered plank, still in one piece. Square 1024x1024.
```

#### `holz-balken-heil` — zweite Vorlage: `holz-quadrat-heil`

```text
Subject: a long horizontal beam of the SAME material as the block in the second attached image: warm light-brown wooden building block made of planks with visible wood grain and slightly beveled edges, small iron nails at the corners. Straight-on FRONT orthographic view, no perspective, proportions exactly 4 : 1 (four times as wide as tall), intact. Landscape 1536x1024 canvas, beam centered.
```

#### `holz-balken-angeknackst` — zweite Vorlage: `holz-balken-heil`

```text
Subject: the SAME beam as in the second attached image (identical shape, 4 : 1 proportions, color and front view), now damaged: clear cracks, chipped edges, splintered wood, still in one piece. Landscape 1536x1024 canvas, beam centered.
```

#### `stein-quadrat-heil`

```text
Subject: a single square grey chiselled stone building block with beveled edges, subtle mineral speckles, solid and heavy. Straight-on FRONT orthographic view, no perspective, no visible top or side faces, exactly square, intact. Square 1024x1024.
```

#### `stein-quadrat-angeknackst` — zweite Vorlage: `stein-quadrat-heil`

```text
Subject: the SAME block as in the second attached image (identical shape, size, color, orientation and front view), now damaged: several clear cracks across the face, chipped corners, still in one piece. Square 1024x1024.
```

#### `stein-balken-heil` — zweite Vorlage: `stein-quadrat-heil`

```text
Subject: a long horizontal beam of the SAME material as the block in the second attached image: grey chiselled stone building block with beveled edges, subtle mineral speckles, solid and heavy. Straight-on FRONT orthographic view, no perspective, proportions exactly 4 : 1 (four times as wide as tall), intact. Landscape 1536x1024 canvas, beam centered.
```

#### `stein-balken-angeknackst` — zweite Vorlage: `stein-balken-heil`

```text
Subject: the SAME beam as in the second attached image (identical shape, 4 : 1 proportions, color and front view), now damaged: clear cracks, chipped edges, still in one piece. Landscape 1536x1024 canvas, beam centered.
```

#### `glas-quadrat-heil`

```text
Subject: a single square pale icy-blue glass building block, semi-transparent with bright reflections along the beveled edges. Straight-on FRONT orthographic view, no perspective, no visible top or side faces, exactly square, intact. Square 1024x1024.
```

#### `glas-quadrat-angeknackst` — zweite Vorlage: `glas-quadrat-heil`

```text
Subject: the SAME block as in the second attached image (identical shape, size, color, orientation and front view), now damaged: several clear cracks across the face, chipped corners, still in one piece. Square 1024x1024.
```

#### `glas-balken-heil` — zweite Vorlage: `glas-quadrat-heil`

```text
Subject: a long horizontal beam of the SAME material as the block in the second attached image: pale icy-blue glass building block, semi-transparent with bright reflections along the beveled edges. Straight-on FRONT orthographic view, no perspective, proportions exactly 4 : 1 (four times as wide as tall), intact. Landscape 1536x1024 canvas, beam centered.
```

#### `glas-balken-angeknackst` — zweite Vorlage: `glas-balken-heil`

```text
Subject: the SAME beam as in the second attached image (identical shape, 4 : 1 proportions, color and front view), now damaged: clear cracks, chipped edges, still in one piece. Landscape 1536x1024 canvas, beam centered.
```

#### `schleuder`

```text
Subject: a sturdy wooden Y-shaped slingshot standing upright, carved from a forked branch, leather wrapping at both fork tips and on the handle, small iron rings at the tips where a band would attach — WITHOUT any rubber band or pouch (the game draws the band). Front view, slightly turned. Portrait 1024x1536.
```

#### `hintergrund`

```text
Subject: a wide side-view landscape backdrop for a 2D physics slingshot game, painted in the same warm stylized 3D look: gently rolling green hills, distant soft snowy mountains, a few fluffy clouds, warm late-afternoon light. The bottom 15 % is a flat, empty grassy ground strip (game objects stand on it); the upper half is calm open sky for flying objects. No characters, no animals, no buildings or structures, no slingshot. FULL-BLEED opaque image, NO transparency. Landscape 1536x1024.
```
