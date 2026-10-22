# Bestellung: Bilder für die Kartenmanufaktur

Stand 23.10.2026 (Emile, mit Claude). Spiel: `docs/SPEZIFIKATION-KARTENMANUFAKTUR.md`.
Bis die Bilder da sind, ist alles gezeichnet (CSS/SVG) und spielbar — jedes
Bild ersetzt eine gezeichnete Stelle, nichts wartet auf ein Bild.

## So geht's (ChatGPT)

1. Neuen Chat öffnen, **eine Datei je Bild**. Den gemeinsamen Teil und den
   Text des Bildes unten zusammen einfügen.
2. Bei allen Bildern mit **Alpha**: in ChatGPT „transparent background, PNG"
   dazuschreiben (steht im Text schon drin) und das Ergebnis vor dem
   Herunterladen ansehen — ein grau-weißes **Schachbrett** im Bild heißt:
   kein echter Alphakanal, bitte neu erzeugen.
3. Herunterladen und hier in den Chat legen, Dateiname egal — ich ordne zu,
   wandle in WebP (`node ~/bildwerkzeug/wandeln.mjs`), lege das Original ins
   Archiv `moodsteppi/brauweg-art` (`manufaktur/`) und baue es ein.

### Gemeinsamer Teil (vor jeden Text)

> Glossy soft 3D cartoon render, the same style as a cute mobile game with
> chubby penguin characters: rounded shapes, soft shadows, warm golden lamp
> light, night-blue and gold color palette with warm wood and brass. Clean,
> readable at small size on a phone. No text, no letters, no numbers, no
> logo, no watermark, no UI elements, no frame.

## Die Bilder

| Datei | Maße | Alpha | Wofür |
| --- | --- | --- | --- |
| `kulisse-halle.png` | 1024 × 1536 | nein | Hintergrund oben: Halle mit Lager und Tor |
| `wand-keller.png` | 512 × 512, **kachelbar** | nein | Hinter den Pressen, wiederholt nach unten |
| `presse-1.png` `presse-2.png` `presse-3.png` | 512 × 512 | ja | Druckerpresse in drei Ausbaustufen |
| `laufband.png` | 256 × 512, **senkrecht kachelbar** | ja | Das Laufband links, wiederholt |
| `lager.png` | 512 × 512 | ja | Packtisch mit Kartons oben |
| `versand.png` | 640 × 384 | ja | Lieferwagen am Tor |
| `pinguin-drucker.png` | 384 × 384 | ja | Arbeiter an der Presse |
| `pinguin-meister.png` | 384 × 384 | ja | Meister (automatisch) |
| `stapel-1.png` … `stapel-8.png` | 256 × 256 | ja | Kartenstapel je Presse |
| `taler.png` | 128 × 128 | ja | Währung der Manufaktur |
| `manufaktur-1.png` … `manufaktur-5.png` | 1024 × 512 | nein | Kopfbild je Manufaktur (Prestige) |

### kulisse-halle.png

```
A cozy old card printing factory hall seen from the front, cross-section view like a doll house. Upper third: wooden roof beams with hanging brass lamps. Middle: a packing table area on the left and a big open wooden gate on the right where a delivery van would stand. Lower third: the floor opens into a dark shaft going down (empty, only darkness at the bottom edge). Keep the middle area calm and not busy, objects will be placed there later. Portrait 1024x1536.
```
**Freihalten:** obere 10 % (Statusleiste), die mittlere Fläche (dort stehen Lager und Wagen als eigene Bilder), die untere Kante (geht in die Kellerwand über).

### wand-keller.png

```
Seamless tileable texture of an old brick cellar wall with wooden support beams, warm dim lamp light, night-blue shadows. Must tile perfectly on all four sides, no visible seams, no objects, no lamps in the corners. Square 512x512.
```
**Abnahme:** an allen vier Kanten nahtlos (ich messe die Kanten nach, siehe CLAUDE.md „Kachelbare Texturen").

### presse-1.png, presse-2.png, presse-3.png

```
A single card printing press machine, isolated object on a transparent background (PNG with real alpha), three-quarter front view.
Version 1: a small old wooden hand press with an iron screw and a stack of blank card sheets.
Version 2: a bigger cast-iron press with a big brass wheel and red details.
Version 3: a large steam-powered press with brass pipes, a small chimney puffing steam, gold trim.
Same camera, same size and same ground line for all three, so they can replace each other. Square 512x512.
```
Je Version **eine eigene Datei**. Gleiche Bodenlinie und Größe — sie ersetzen sich beim Ausbauen.

### laufband.png

```
A vertical wooden conveyor belt / paternoster lift segment with small wooden trays carrying stacks of playing cards upward, isolated on a transparent background (PNG with real alpha). It must tile seamlessly from top to bottom (the top edge continues into the bottom edge). Narrow and tall, 256x512.
```

### lager.png

```
A wooden packing table with stacked cardboard boxes of playing cards, rolls of string and a brass scale, isolated object on a transparent background (PNG with real alpha). Square 512x512.
```

### versand.png

```
A cute small delivery van in old-fashioned style, night-blue paint with gold trim, rear doors open with boxes of playing cards inside, isolated on a transparent background (PNG with real alpha), side view facing left. 640x384.
```
**Nicht:** keine Aufschrift, kein Logo, kein Kennzeichen.

### pinguin-drucker.png

```
A chubby cute penguin worker wearing a leather apron and a small flat cap, holding a fresh sheet of playing cards, isolated on a transparent background (PNG with real alpha), standing, three-quarter view. Same penguin proportions as a chubby round cartoon penguin with big eyes and an orange beak. 384x384.
```

### pinguin-meister.png

```
The same chubby cartoon penguin but as a foreman: round glasses, a gold pocket watch chain, a clipboard under the flipper, a dark green apron. Isolated on a transparent background (PNG with real alpha), standing, three-quarter view. 384x384.
```

### stapel-1.png … stapel-8.png

Ein Stapel Karten je Presse, von „billig" nach „edel". Gleicher Blickwinkel, gleiche Größe:

```
A neat small stack of playing cards with the top card face up, isolated on a transparent background (PNG with real alpha), three-quarter view, 256x256. Top card design: <DESIGN>.
```

| Datei | `<DESIGN>` |
| --- | --- |
| stapel-1 | plain red and white card back pattern, simple |
| stapel-2 | blue card back with a small golden acorn ornament |
| stapel-3 | green card back with leaf ornaments |
| stapel-4 | purple card back with stars and a moon (wizard style) |
| stapel-5 | black card back with gold poker chip ornament |
| stapel-6 | white card back with fine silver filigree |
| stapel-7 | deep red velvet look card back with gold crown ornament |
| stapel-8 | shining gold card back with a diamond in the middle |

**Nicht:** keine lesbaren Kartenwerte, keine Buchstaben, keine Zahlen auf den Karten.

### taler.png

```
A single shiny golden coin with an embossed playing card spade symbol in the center, slightly tilted, isolated on a transparent background (PNG with real alpha). 128x128.
```
Soll sich von der Hub-Münze unterscheiden: Pik-Symbol statt Stern.

### manufaktur-1.png … manufaktur-5.png

Kopfbild je Manufaktur, wird nach dem Umzug (Prestige) gezeigt. Breit, ruhig unten links (dort steht der Name als Text vom Bildschirm):

| Datei | Szene |
| --- | --- |
| manufaktur-1 | a small cozy card workshop in a half-timbered village house, evening |
| manufaktur-2 | a brick card factory by a river with a water wheel |
| manufaktur-3 | a big card factory in a snowy mountain town with smoking chimneys |
| manufaktur-4 | a grand card printing house in a harbor city with ships |
| manufaktur-5 | a golden card palace on a hill, fireworks in the night sky |

```
<SZENE>, wide establishing shot, warm lights in the windows, night-blue sky. Keep the lower left quarter calm and dark (text will be placed there). 1024x512.
```

## Abnahme

- Bilder mit Alpha auf **rotem Grund** geprüft: kein Schachbrett, kein heller Saum, keine undurchsichtigen Ecken.
- Kachelbare Bilder an den Kanten gemessen (Faktor unter 3, siehe CLAUDE.md).
- WebP unter 120 kB je Bild (Kulissen bis 250 kB), Original nur im Archiv.
- Die drei Pressen stehen auf derselben Bodenlinie.

## Was NICHT ins Bild gehört

- **Kein eingebrannter Text** — keine Schrift, keine Zahlen, keine Logos, kein „Brauweg".
- **Kein Schachbrett statt Alphakanal.**
- Keine Bedienelemente (Knöpfe, Pfeile, Zahlenfelder) — die zeichnet der Bildschirm.
- Keine Originalauflösung unter `packages/client/public/` — dort nur WebP.
- Keine Menschen, nur Pinguine.
