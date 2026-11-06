# Bilder für Flying Bro

Einzelspieler-Schleuderspiel im Hub (Projekt „Rider Modus hinzufügen", Arbeitsname
**Flying Bro**; der endgültige Name steht noch aus). Die Bros sind die drei
Pinguine aus dem Logo (Pelle, Malve, Tjark), die Gegner Giraffen, gebaut wird aus Holz, Stein und Glas.

**Stand: 6. November 2026, geliefert (29 Bilder; Bros und Langhals am selben Tag nach
der geänderten Spezifikation neu erzeugt, danach die Schleuder aus Kartenkisten und die drei Flugposen).** Erzeugt mit ChatGPT-Bildern über
`codex exec` (ChatGPT-Anmeldung) auf dem Mood-Stand-PC, ohne Creative-KI mit
Kosten. Es gibt noch **keinen Spielcode**, und die Bilder hängen nirgends —
erst der Spielbau bindet sie ein.

### Abweichung vom ursprünglichen Auftrag — und woher sie kommt

> **Vor der Freigabe zu bestätigen:** Diese Lieferung folgt nicht mehr dem
> ursprünglichen Auftragstext, sondern der Spezifikation und der Nachbesserung
> vom 06.11.2026 (beides unten belegt). Die Spezifikation liegt **nicht** in
> diesem Diff und ist noch nicht auf `staging`, also lässt sich hier nur der
> Verweis prüfen, nicht die Quelle selbst. Wer freigibt, bestätigt damit, dass
> Pelle, Malve, Tjark und die Kartenkisten-Schleuder gelten sollen. Am
> sichersten wird der Spezifikationszweig **vor** diesem Zweig nach `staging`
> geführt. Gilt doch der alte Auftrag, liegen die alten Bilder im Archiv
> (siehe unten) und lassen sich zurückholen.

Der Auftrag (Projekt #18, Aufgabe 2) bestellte drei Bros „je eine Farbe/Form
für **schnell, schwer, teilt sich**" und eine Schleuder ohne nähere Angabe. Die
erste Lieferung (Commit `bf03349e`) hielt sich daran: `bro-schnell-*`,
`bro-schwer-*`, `bro-teilt-*` und eine Astgabel-Schleuder. **Beides ist durch die
Spezifikation überholt.** Sie liegt in diesem Diff nicht bei, weil sie in einer
eigenen Aufgabe entsteht: `docs/SPEZIFIKATION-FLYINGBRO.md` auf dem Zweig
`aufgabe/flying-bro-spezifikation-und-physik-mess-fbb7cf29`, Commit `401dbb91`
(„Flying Bro: Entscheidungen vom 06.11.2026 in die Spezifikation"). Die
maßgeblichen Stellen wörtlich:

> **Keine Astgabel-Schleuder.** Unsere Schleuder ist ein Gummiband zwischen
> zwei gestapelten Kartenkisten (passt zur Kartenplattform).
>
> **Keine Fähigkeit des Vorbilds:** kein Aufteilen in drei, kein Explodieren,
> kein Ei-Abwurf, kein Bumerang, kein gerader Beschleunigungsstoß. Unsere drei
> stehen unten und sind aus dem Pinguinsein abgeleitet (Bauch rutschen,
> gleiten, gefrieren).
>
> Die drei Pinguine aus dem Logo. […] Die drei Fähigkeiten unten gelten so
> (bestätigt 06.11.2026).
>
> | | Pelle | Malve | Tjark |
> | --- | --- | --- | --- |
> | Rolle | Grund-Bro, kommt in jedem Level | Weite und Glas | Stein |
> | Fähigkeit | **Bauchrutscher** | **Gleitflug** | **Eisblock** |

Dort steht außerdem: „Am 06.11.2026 hat Niklas entschieden: […] die Fähigkeiten
Bauchrutscher, Gleitflug und Eisblock gelten". Die Nachbesserung vom selben Tag
hat das für diese Bilder übernommen. Ihr Wortlaut: „Giraffen, Bauteile, Schleuder
und Hintergrund sind gut und bleiben. Die DREI BROS passen NICHT mehr." Danach
bestellt sie je Bro ein Ruhe- und ein Fähigkeitsbild (`bro-pelle-ruhe`,
`bro-pelle-rutsch`, `bro-malve-ruhe`, `bro-malve-gleit`, `bro-tjark-ruhe`,
`bro-tjark-eisblock`) und schließt einen sich teilenden Bro ausdrücklich aus.

Was aus den alten Rollen wurde:

| Auftrag | Spezifikation | Bild |
| --- | --- | --- |
| schnell | entfällt. Am weitesten trägt Malve (Gleitflug, Höchsttempo 24 m/s) | `bro-malve-*` |
| schwer | **Tjark**: Eisblock, Masse ×3, stark gegen Stein | `bro-tjark-*` |
| teilt sich | **gestrichen** (Fähigkeit des Vorbilds). An ihre Stelle tritt Pelle als Grund-Bro mit Bauchrutscher | `bro-pelle-*` |
| Schleuder | zwei gestapelte Kartenkisten statt Astgabel | `schleuder` (neu erzeugt) |
| je Bro **Ruhe + Flug** | je Bro **Ruhe, Flug, Fähigkeit** und Siegerpose | `bro-<name>-ruhe`, `bro-<name>-flug` und die Fähigkeitspose; die Siegerpose fehlt noch |

**Zu den Posen:** Der Auftrag wollte je Bro Ruhe und Flug, die Nachbesserung
Ruhe und Fähigkeit. Die Fähigkeitsposen sind **keine** Flugposen: Pelle liegt
beim Bauchrutscher am Boden, Tjark steckt im Eiswürfel, nur Malves Gleitflug
ist ein Flug. Deshalb gibt es zusätzlich je Bro eine eigene **Flugpose**
(`bro-<name>-flug`: gestreckt wie ein Torpedo, Flossen angelegt). Sie zeigt den
Bro zwischen Abschuss und Fähigkeit, also in dem Zustand, in dem er die meiste
Zeit zu sehen ist. Malves Flug unterscheidet sich vom Gleitflug durch angelegte
statt ausgebreitete Flossen.

Die verworfenen Bilder liegen im Archivrepo unter `flyingbro/verworfen/`.

---

## Was geliefert ist

Alles unter `packages/client/public/flyingbro/`, WebP, gewandelt mit
`~/bildwerkzeug/wandeln.mjs` (Profil `wappen` für alles Freigestellte, `szene`
für den Hintergrund). Zusammen **rund 680 kB**.

| Datei | Maß | Größe | Alpha |
| --- | --- | --- | --- |
| `bro-malve-flug.webp` | 384 × 244 | 17.0 kB | ja |
| `bro-malve-gleit.webp` | 384 × 234 | 18.3 kB | ja |
| `bro-malve-ruhe.webp` | 189 × 384 | 19.0 kB | ja |
| `bro-pelle-flug.webp` | 384 × 312 | 21.4 kB | ja |
| `bro-pelle-ruhe.webp` | 346 × 384 | 24.6 kB | ja |
| `bro-pelle-rutsch.webp` | 384 × 198 | 18.4 kB | ja |
| `bro-tjark-eisblock.webp` | 383 × 384 | 37.7 kB | ja |
| `bro-tjark-flug.webp` | 384 × 288 | 19.9 kB | ja |
| `bro-tjark-ruhe.webp` | 340 × 384 | 24.4 kB | ja |
| `giraffe-gross-getroffen.webp` | 207 × 384 | 29.8 kB | ja |
| `giraffe-gross-steht.webp` | 181 × 384 | 20.4 kB | ja |
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
| `schleuder.webp` | 512 × 468 | 59.6 kB | ja |
| `stein-balken-angeknackst.webp` | 512 × 128 | 11.6 kB | ja |
| `stein-balken-heil.webp` | 512 × 128 | 9.5 kB | ja |
| `stein-quadrat-angeknackst.webp` | 256 × 256 | 10.9 kB | ja |
| `stein-quadrat-heil.webp` | 256 × 256 | 7.7 kB | ja |

### Was welches Bild ist

| Gruppe | Dateien | Gedacht für |
| --- | --- | --- |
| **Pelle** (rot-orange, Steuerkreuz auf der Flosse) | `bro-pelle-ruhe`, `bro-pelle-flug`, `bro-pelle-rutsch` | Grund-Bro. Flug: gestreckt, Flossen angelegt. Fähigkeit **Bauchrutscher**: flach auf dem Bauch, Körper rund 2 : 1 breit wie die Kapsel 0,7 × 0,3 m |
| **Malve** (lila, runde Brille) | `bro-malve-ruhe`, `bro-malve-flug`, `bro-malve-gleit` | Flug: gestreckt, Flossen angelegt. Fähigkeit **Gleitflug**: Flossen weit ausgebreitet, Körper waagerecht |
| **Tjark** (türkis, vier Spielknöpfe auf der Flosse) | `bro-tjark-ruhe`, `bro-tjark-flug`, `bro-tjark-eisblock` | Flug: gestreckt, Flossen angelegt. Fähigkeit **Eisblock**: im Eiswürfel eingefroren, Gesicht sichtbar; der Würfel ist quadratisch wie der Körper 0,6 × 0,6 m |
| **Giraffe klein / mittel / groß** | `giraffe-<größe>-steht`, `giraffe-<größe>-getroffen` | Kalb, Giraffe, Langhals (Spezifikation: 0,6 / 1,3 / 2,1 m). Getroffen: Spiralaugen, Beule, Sterne, Zunge raus. Der **Langhals** hat einen Hals etwa doppelt so lang wie der Rumpf hoch und trägt eine kleine Krone |
| **Bauteile** | `<holz\|stein\|glas>-<quadrat\|balken>-<heil\|angeknackst>` | Quadrat 1 : 1, Balken 4 : 1, reine Vorderansicht, randlos — das Bild füllt die Physikform |
| **Schleuder** | `schleuder` | Nach Spezifikation **zwei Stapel aus je zwei Kartenkisten** (Herz über Pik, Karo über Kreuz), **ohne Gummi**. Das Band zeichnet das Spiel zwischen die beiden Eisenringe oben innen, im Bild 512 × 468 etwa bei (215, 65) und (298, 65), also bei 42 % und 58 % der Breite und 14 % der Höhe. Die erste Astgabel ist verworfen, siehe unten |
| **Hintergrund** | `hintergrund` | 3 : 2 quer, ohne Alpha. Unten ein freier Grasstreifen (der Boden), oben ruhiger Himmel |

Die Bros sind die drei Pinguine aus dem Logo (`packages/client/public/icon-512.png`),
Namen und Fähigkeiten nach `docs/SPEZIFIKATION-FLYINGBRO.md` (Stand 06.11.2026).
Pelle und Malve sind beschrieben wie in `docs/werbung/tiktok-serien/figuren.md`
(Bild-Prompts 1 und 6), Tjark wie dort Nr. 7. Ohne Karten in der Hand, denn im Spiel
sind sie Geschosse.

**Blickrichtung:** Die Bros schauen nach **rechts** (Abschuss nach rechts), die
Giraffen nach **links** zur Schleuder. Wer spiegelt, spiegelt per CSS/Leinwand,
nicht als eigene Datei.

**Maße:** Figuren auf höchstens 384 px an der langen Seite (die Schleuder 512 px).
Bei 28 px je Meter (Spezifikation) ist ein Bro im Gesamtbild nur rund 17 px groß,
in der Flugkamera größer — 384 px reicht auch für dreifache Pixeldichte. Die
Rohbilder kamen in 1254 bzw. 1536 px und wurden vor dem Wandeln beschnitten
(leerer Rand weg, 4 % Luft wieder dran) und verkleinert. Bauteile wurden
**ohne** Luft auf exakt 256 × 256 bzw. 512 × 128 gezogen, damit Bild und
Kollisionskasten deckungsgleich sind.

**Querformat:** Das Spiel läuft quer (Bezugsmaß 844 × 390, etwa 2,16 : 1). Der
Hintergrund ist mit 1536 × 1024 bereits quer und bleibt. Er wird **unten
bündig** eingepasst (`background-position: bottom` bzw. Unterkante an die
Unterkante der Bühne): Dann bleiben Grasstreifen, Hügel und Berge im Bild, und
abgeschnitten wird nur ruhiger Himmel. Mittig eingepasst fiele der Boden fast
ganz weg.

### Bekannte Schwächen und Widersprüche

- **Die Spezifikation bestellt mehr**, als hier liegt (Abschnitt „Bilder"): je
  Bro auch die Siegerpose (Flug ist inzwischen geliefert), je Giraffe auch liegend und weglaufend, je
  Stoff drei Rissstufen und die Formen Dreieck und Kreis, drei Weltkulissen.
  Geliefert ist der Umfang dieser Aufgabe; der Rest ist eine eigene Bestellung.
- **Getroffene Giraffen zeigen Beule und Sterne.** Die Spezifikation will
  Giraffen, die „beleidigt" umfallen, ohne Bösewicht zu sein; Beule und Sterne
  sind slapstickhaft und nicht böse. Wer es sanfter will, bestellt `getroffen`
  ohne Beule nach.
- **Glasbalken angeknackst** kam etwas länglicher als 4 : 1 und ist beim Einpassen
  um rund 10 % gestaucht. Mit bloßem Auge fällt das nicht auf.

### Geprüft

- **Echter Alphakanal** bei allen 28 freigestellten Bildern: Ecken `alpha = 0`
  (höchstens 1), halbtransparente Pixel nur an Kanten (unter 1 %, bei den
  getroffenen Giraffen bis 6,5 % wegen der Sterne und Bewegungsstriche).
- **Auf knallrotem Grund angesehen** (Kontaktbogen): kein Saum, kein
  Schachbrett, kein eingebrannter Text. Die erste `bro-pelle-flug` hatte einen
  hellen Schleier (alpha 16–31 rund um die Figur, 6 % halbtransparent) und
  wurde neu erzeugt, statt sie mit einem eigenen Schwellwert zu beschneiden.
- **Keine Originalauflösung unter `public/`.** Die Originale liegen im Archivrepo
  `brauweg-art` unter `flyingbro/`, vorerst auf dem Zweig
  `flyingbro-originale`. Er wird zusammen mit diesem Zweig nach `main`
  übernommen. Die verworfenen ersten Bros (schnell, schwer, teilt sich) und
  die erste große Giraffe sowie die Astgabel-Schleuder liegen dort unter
  `flyingbro/verworfen/`.

---

## Woher der Stil kommt — und was ausdrücklich nicht

**Stilvorlage ist der Ritter-Pinguin** `packages/client/public/hub/pinguin.png`.
Er ging als erstes Bild in **jede** Erzeugung, dazu die Stilregeln aus
`docs/ASSETS-PINGUIN.md`: gerenderte Spielfigur, Volumen, Licht von oben links,
keine Konturlinie, kein Fotorealismus. **Figurvorlage der Bros ist das Logo**
`packages/client/public/icon-512.png`: Es ging als zweites Bild in die drei
Ruhebilder, und der Prompt verlangt, die flache Logofigur in den gerenderten
Stil zu übertragen.

**Kein Bild aus einem fremden Spiel als Vorlage**, und es gilt die Abgrenzung aus
`docs/SPEZIFIKATION-FLYINGBRO.md`: keine Vögel, keine Schweine, keine Astgabel-Schleuder, kein Bro, der
sich teilt. Ein erster Probelauf mit „kleiner roter runder Pinguin,
zusammengerollt" ergab einen roten Kugelvogel mit Zornesbrauen, der einer
bekannten Spielfigur zu nahe kam, und wurde verworfen. Seitdem steht in jedem
Prompt das ausdrückliche Verbot (*no round red/yellow/blue birds with angry
eyebrows, no green pigs*). Weil Pelle rot-orange und rundlich ist, also genau
in dieser Zone liegt, verlangt jeder Bro-Prompt zusätzlich eine
**Pinguin-Silhouette** (aufrechter ovaler Körper, Flossen, cremeweiße
Gesichtsmaske) und verbietet Brauen und Federschopf. **Wer nachbestellt, behält
das bei.**

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
- **Zweite Vorlage:** Ruhebild eines Bros ← Logo, Flug- und Fähigkeitspose ← Ruhebild,
  Langhals ← mittlere Giraffe, getroffen ← stehend,
  angeknackst ← heil, Balken ← Quadrat desselben Materials. Nur so bleiben
  Farben und Abzeichen gleich.
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

#### `bro-pelle-ruhe` — zweite Vorlage: Logo `icon-512.png`

```text
Subject: PELLE, the red-orange penguin from the attached logo (second image): a short chubby penguin with a red-orange back, head and flippers, cream-white belly and face, bright orange beak and feet, a small white plus-shaped gamepad cross printed on his left flipper, huge eager friendly eyes, wide grin — clearly a penguin silhouette (upright oval body, two flippers, orange feet, cream-white face mask and belly), NOT a round ball-shaped bird, no eyebrows, no feather tuft on the head, no clothing or hat. Translate the flat logo character into the 3D-rendered style of the first image. Pose: standing upright, waving cheerfully with one flipper, the gamepad cross on the flipper clearly visible, full body, three-quarter view facing RIGHT. Square 1024x1024.
```

#### `bro-pelle-flug` — zweite Vorlage: `bro-pelle-ruhe`

```text
Subject: the SAME character as in the second attached image (identical colors, markings, proportions): PELLE, the red-orange penguin from the attached logo (second image): a short chubby penguin with a red-orange back, head and flippers, cream-white belly and face, bright orange beak and feet, a small white plus-shaped gamepad cross printed on his left flipper, huge eager friendly eyes, wide grin — clearly a penguin silhouette (upright oval body, two flippers, orange feet, cream-white face mask and belly), NOT a round ball-shaped bird, no eyebrows, no feather tuft on the head, no clothing or hat. Pose: FLIGHT right after being launched: flying through the air to the right, body stretched out horizontally and slightly tilted upward like a little torpedo, head forward, both flippers pressed back along the body (NOT spread like wings), feet trailing behind, an excited determined face. No motion lines, no dust, no background. Facing RIGHT. Landscape 1536x1024 canvas.
```

#### `bro-pelle-rutsch` — zweite Vorlage: `bro-pelle-ruhe`

```text
Subject: the SAME character as in the second attached image (identical colors, markings, proportions): PELLE, the red-orange penguin from the attached logo (second image): a short chubby penguin with a red-orange back, head and flippers, cream-white belly and face, bright orange beak and feet, a small white plus-shaped gamepad cross printed on his left flipper, huge eager friendly eyes, wide grin — clearly a penguin silhouette (upright oval body, two flippers, orange feet, cream-white face mask and belly), NOT a round ball-shaped bird, no eyebrows, no feather tuft on the head, no clothing or hat. Pose: BELLY SLIDE: lying completely flat on his belly, sliding fast to the right like a toboggan, head forward and slightly raised, both flippers pressed back along the body, feet trailing behind, a few small snow/dust puffs under the belly, gleeful face. The body is long and flat (about 2.3 times as wide as tall). Landscape 1536x1024 canvas. Facing RIGHT.
```

#### `bro-malve-ruhe` — zweite Vorlage: Logo `icon-512.png`

```text
Subject: MALVE, the purple penguin from the attached logo (second image): a tall slim penguin with a deep violet-purple back, head and flippers, cream-white belly and face, orange beak and feet, wearing round thin glasses, half-lidded clever eyes, a confident slight smile — clearly a penguin silhouette (upright oval body, two flippers, orange feet, cream-white face mask and belly), NOT a round ball-shaped bird, no eyebrows, no feather tuft on the head, no hat; the glasses are her only accessory. Translate the flat logo character into the 3D-rendered style of the first image. Pose: standing upright, flippers crossed calmly over her belly, glasses glinting, full body, three-quarter view facing RIGHT. Square 1024x1024.
```

#### `bro-malve-flug` — zweite Vorlage: `bro-malve-ruhe`

```text
Subject: the SAME character as in the second attached image (identical colors, markings, proportions, glasses): MALVE, the purple penguin from the attached logo (second image): a tall slim penguin with a deep violet-purple back, head and flippers, cream-white belly and face, orange beak and feet, wearing round thin glasses, half-lidded clever eyes, a confident slight smile — clearly a penguin silhouette (upright oval body, two flippers, orange feet, cream-white face mask and belly), NOT a round ball-shaped bird, no eyebrows, no feather tuft on the head, no hat; the glasses are her only accessory. Pose: FLIGHT right after being launched: flying through the air to the right, body stretched out horizontally and slightly tilted upward like a little torpedo, head forward, both flippers pressed back along the body (NOT spread like wings), feet trailing behind, an excited determined face. No motion lines, no dust, no background. Facing RIGHT. Landscape 1536x1024 canvas.
```

#### `bro-malve-gleit` — zweite Vorlage: `bro-malve-ruhe`

```text
Subject: the SAME character as in the second attached image (identical colors, markings, proportions, glasses): MALVE, the purple penguin from the attached logo (second image): a tall slim penguin with a deep violet-purple back, head and flippers, cream-white belly and face, orange beak and feet, wearing round thin glasses, half-lidded clever eyes, a confident slight smile — clearly a penguin silhouette (upright oval body, two flippers, orange feet, cream-white face mask and belly), NOT a round ball-shaped bird, no eyebrows, no feather tuft on the head, no hat; the glasses are her only accessory. Pose: GLIDE: gliding through the air to the right with both flippers spread wide like wings, body horizontal and calm, feet tucked back, glasses on, focused serene expression. Seen from the side, slightly from below. Landscape 1536x1024 canvas. Facing RIGHT.
```

#### `bro-tjark-ruhe` — zweite Vorlage: Logo `icon-512.png`

```text
Subject: TJARK, the turquoise penguin from the attached logo (second image): a stocky penguin with a bright teal-turquoise back, head and flippers, cream-white belly and face, orange beak and feet, four round white game-controller buttons printed on one flipper, wild excited eyes, cocky wide grin — clearly a penguin silhouette (upright oval body, two flippers, orange feet, cream-white face mask and belly), NOT a round ball-shaped bird, no eyebrows, no feather tuft on the head, no clothing or hat. Translate the flat logo character into the 3D-rendered style of the first image. Pose: standing upright, one flipper raised in a thumbs-up-like gesture, the four controller buttons on the flipper clearly visible, full body, three-quarter view facing RIGHT. Square 1024x1024.
```

#### `bro-tjark-flug` — zweite Vorlage: `bro-tjark-ruhe`

```text
Subject: the SAME character as in the second attached image (identical colors, markings, proportions): TJARK, the turquoise penguin from the attached logo (second image): a stocky penguin with a bright teal-turquoise back, head and flippers, cream-white belly and face, orange beak and feet, four round white game-controller buttons printed on one flipper, wild excited eyes, cocky wide grin — clearly a penguin silhouette (upright oval body, two flippers, orange feet, cream-white face mask and belly), NOT a round ball-shaped bird, no eyebrows, no feather tuft on the head, no clothing or hat. Pose: FLIGHT right after being launched: flying through the air to the right, body stretched out horizontally and slightly tilted upward like a little torpedo, head forward, both flippers pressed back along the body (NOT spread like wings), feet trailing behind, an excited determined face. No motion lines, no dust, no background. Facing RIGHT. Landscape 1536x1024 canvas.
```

#### `bro-tjark-eisblock` — zweite Vorlage: `bro-tjark-ruhe`

```text
Subject: the SAME character as in the second attached image (identical colors, markings, proportions): TJARK, the turquoise penguin from the attached logo (second image): a stocky penguin with a bright teal-turquoise back, head and flippers, cream-white belly and face, orange beak and feet, four round white game-controller buttons printed on one flipper, wild excited eyes, cocky wide grin — clearly a penguin silhouette (upright oval body, two flippers, orange feet, cream-white face mask and belly), NOT a round ball-shaped bird, no eyebrows, no feather tuft on the head, no clothing or hat. Pose: ICE BLOCK: frozen inside a solid cube of clear light-blue ice, seen straight from the front (the cube is an exact square, edges beveled and frosty, a few frost cracks at the corners). Tjark is curled up inside, his face clearly visible through the ice, cheeky surprised grin, eyes looking right. Square 1024x1024. Facing RIGHT.
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

#### `giraffe-gross-steht` — zweite Vorlage: `giraffe-mittel-steht`

```text
Subject: the LONG-NECK giraffe: same species, colors and fur as the medium giraffe in the second attached image, but with an EXTREMELY long neck — the neck alone is about twice as long as the body is tall, so the head sits far above the body (total height about 2.1 times the body length); a sturdy body, a small golden crown, a proud slightly snooty smile (cheeky, not evil) — the BIG opponent, same stylized 3D look as the penguin reference (soft fur texture, orange-brown patches, small ossicone horns). Pose: standing on all four legs, full body, three-quarter view facing LEFT, looking left and teasing. Portrait 1024x1536.
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
Subject: the launcher of our game — NOT a Y-shaped forked-branch slingshot, NO forked stick, NO wooden fork. Instead: TWO separate columns standing side by side on the same baseline with a gap between them about as wide as one crate; each column is two small sturdy wooden playing-card crates stacked on top of each other (the lower crate slightly larger). The crates are made of light wooden planks with metal corner brackets; on their fronts are big embossed playing-card suit symbols (a red heart, a black spade, a red diamond, a black club — one symbol per crate, no letters, no numbers), and the top crate of each column has its lid slightly ajar with the white edges of a few playing cards peeking out. At the top INNER corner of each top crate sits one small iron ring facing the gap, where a rubber band would be tied — WITHOUT any rubber band, rope or pouch (the game draws the band). Straight front view, very slightly from above, both columns fully visible. Portrait 1024x1536.
```

#### `hintergrund`

```text
Subject: a wide side-view landscape backdrop for a 2D physics slingshot game, painted in the same warm stylized 3D look: gently rolling green hills, distant soft snowy mountains, a few fluffy clouds, warm late-afternoon light. The bottom 15 % is a flat, empty grassy ground strip (game objects stand on it); the upper half is calm open sky for flying objects. No characters, no animals, no buildings or structures, no slingshot. FULL-BLEED opaque image, NO transparency. Landscape 1536x1024.
```
