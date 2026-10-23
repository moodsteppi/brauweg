# Bestellung: Bedienelemente der Kartenmanufaktur

Stand 23.10.2026 (Emile, mit Claude). Spiel: `docs/SPEZIFIKATION-KARTENMANUFAKTUR.md`.
Vorige Lieferungen, an deren Stil alles anschließt: `outputs/manufaktur/`
(24 Motive) und `outputs/rig/` (Einzelteile, Pakete 1–7).

## Worum es geht

Die Welt der Manufaktur ist gemalt — die Knöpfe darauf noch nicht. Heute sind
sie CSS-Flächen, ein Emoji (👆 als Zeigehand, ⚡ für die Meister-Fähigkeit),
ein gezeichneter Pfeil und Text („Zzz"). Neben den gemalten Pinguinen und
Pressen sehen sie aus wie Platzhalter. Bestellt werden darum:

- **A** — alles, was **in der Welt** liegt: Stufen-Schild (das, womit man
  ausbaut), Ausbau-Pfeil, Anzahl-Plakette, leerer Meister-Platz,
  Fähigkeits-Zeichen, Bestands-Chip, Schlaf-Zeichen.
- **B** — die **Zeigehand** der Anleitung und der Tipp-Ring darunter.
- **C** — die **untere Leiste**: Zeichen für Meister, Boost, Manufaktur,
  hoch und runter.
- **D** — die **Blätter**, in denen man sieht, was es gibt (Upgrade-Blatt,
  Meister-Übersicht): Medaillons der drei Stationen, die Mengen-Knöpfe.

Schrift, Zahlen und Preise setzt **immer das Spiel** darüber. Kein Bild trägt
eine Zahl oder ein Wort.

## Gemeinsamer Teil (vor jeden Text)

> Game UI element for a cute mobile idle game about a playing-card factory run
> by chubby penguins. Glossy soft 3D cartoon style with gentle outlines,
> matching hand-painted warm oak wood, polished brass and gold, night-blue
> accents. Lit from the top left, soft drop shadow baked in only where noted.
> Single object, centered, on a fully transparent background (real alpha
> channel). No text, no letters, no numbers, no watermark, no logo.

Text je Element: `<gemeinsamer Teil> Element: <Motiv>.`

## A — In der Welt

Die Welt ist 390 Punkte breit; ein Element wird auf dem Handy etwa so groß
gezeigt, wie in der Spalte „am Handy" steht. Gemalt wird in der genannten
Größe, damit es auf 3×-Bildschirmen scharf bleibt.

| Datei | Größe px | am Handy | Motiv | Freihalten |
| --- | --- | --- | --- | --- |
| `ui-schild-stufe.png` | 256 × 256 | 46 × 46 pt | small square wooden sign board with rounded corners, dark oak frame, lighter planks inside, four brass nails in the corners | Mitte **70 %** leer und ruhig — dort steht die Stufe (bis „400") in heller Schrift |
| `ui-schild-stufe-gold.png` | 256 × 256 | 46 × 46 pt | the same sign board with a polished gold rim and a soft warm glow, meaning "upgrade affordable" | wie oben, **pixelgleich derselbe Umriss** wie `ui-schild-stufe.png` |
| `ui-pfeil-hoch.png` | 128 × 128 | 18 × 14 pt | chunky upward arrow, polished gold, slight bevel | — |
| `ui-pfeil-hoch-grau.png` | 128 × 128 | 18 × 14 pt | the same arrow in pale dull brass (not affordable) | **gleicher Umriss** wie der goldene |
| `ui-plakette.png` | 128 × 80 | 20 × 14 pt | small rounded gold pill badge, like a tiny brass tag | Mitte 80 % leer — dort steht „+31" |
| `ui-meisterplatz.png` | 192 × 224 | 46 × 58 pt | empty brass picture frame standing upright, dashed inner border, slightly translucent dark inside, like a reserved spot | Innenfläche leer — dort stehen „+" und der Preis |
| `ui-faehigkeit-bereit.png` | 128 × 128 | 26 × 26 pt | round gold coin-like badge with a bright lightning bolt, glowing | — |
| `ui-faehigkeit-wartet.png` | 128 × 128 | 26 × 26 pt | the same round badge, dimmed, empty center (no bolt) | Mitte leer — dort läuft der Countdown „42s" |
| `ui-bestand.png` | 192 × 64 | ca. 70 × 18 pt | horizontal dark night-blue pill with a thin brass edge | als **Dreiteiler** (siehe unten): linke und rechte 32 px sind die Kappen, die Mitte wird gestreckt |
| `ui-schlaf.png` | 128 × 128 | 26 × 26 pt | three soft white "Z" shapes rising diagonally, getting bigger, like a sleeping symbol in a cartoon | — (die drei Z sind das Motiv, keine Schrift) |

**Dreiteiler `ui-bestand.png`:** Die Breite wechselt mit der Zahl
(„0" bis „346 Mio."). Kappen links und rechts je 32 px, dazwischen 128 px,
die sich **ohne sichtbares Muster** strecken lassen (einfarbig oder rein
waagrechter Verlauf). Links in der Kappe bleibt Platz für das Kartenbild,
das das Spiel einsetzt.

## B — Die Zeigehand (Anleitung)

Die Hand zeigt in den ersten Minuten, wohin man tippen soll: auf die Presse,
auf das Stufen-Schild, auf den leeren Meister-Platz. Sie wippt auf und ab.

| Datei | Größe px | am Handy | Motiv | Ankerpunkt |
| --- | --- | --- | --- | --- |
| `ui-finger.png` | 256 × 256 | 44 × 44 pt | a cute white cartoon glove hand, index finger pointing up and slightly to the left, other fingers curled, thick soft outline, small soft shadow under it | **Fingerspitze** genau bei Pixel **(84, 28)** — dort sitzt der Punkt, auf den gezeigt wird |
| `ui-tipp-ring.png` | 256 × 256 | 44 × 44 pt | a soft glowing gold ring, like a ripple on water, thin and transparent in the middle | Mitte des Rings = Mitte des Bildes |

Bitte in der Lieferung die Fingerspitze nachmessen und in `ui.json` als
`"finger": { "spitze": [x, y] }` angeben, falls sie nicht genau bei (84, 28)
liegt. Die Hand kein Pinguinflügel: Sie muss auf dunklem Holz, auf der hellen
Halle und auf Ziegel gleich gut zu sehen sein — weiß mit dunkler Kontur.

## C — Untere Leiste

Fünf Knöpfe: **Meister** (Übersicht aller Meister), **Boost** (alle bereiten
Fähigkeiten auf einmal), **Manufaktur** (Name und Umzug), **hoch**, **runter**.
Die Knopfplatte selbst gibt es schon (`menue-knopf-holz.webp`); bestellt
werden nur die Zeichen darauf.

| Datei | Größe px | am Handy | Motiv |
| --- | --- | --- | --- |
| `icon-meister.png` | 256 × 256 | 28 × 28 pt | a penguin foreman's head with a green flat cap and a small brass whistle, front view, friendly |
| `icon-boost.png` | 256 × 256 | 28 × 28 pt | a golden lightning bolt in front of a brass gear |
| `icon-manufaktur.png` | 256 × 256 | 28 × 28 pt | a small cozy printing workshop building with a chimney, warm lit window |
| `icon-hoch.png` | 256 × 256 | 22 × 22 pt | brass upward chevron arrow |
| `icon-runter.png` | 256 × 256 | 22 × 22 pt | the same chevron pointing down — **gespiegelt aus `icon-hoch`**, gleicher Umriss |

Alle fünf mit **gleicher Strichstärke und gleichem Licht**, damit die Leiste
wie ein Satz aussieht. Erkennbar bei 22 pt: wenige große Formen.

## D — Die Blätter (Upgrade und Meister-Übersicht)

Im Upgrade-Blatt steht oben, welche Station man ausbaut; in der
Meister-Übersicht steht je Station eine Zeile mit ihrem Meister. Dafür ein
Medaillon je Station und ein Meister-Bild je Station, dazu die Mengen-Knöpfe
(x1, x10, x50, Max).

| Datei | Größe px | am Handy | Motiv |
| --- | --- | --- | --- |
| `medaillon-presse.png` | 256 × 256 | 48 × 48 pt | round brass medallion with a small wooden printing press on a night-blue enamel background |
| `medaillon-paternoster.png` | 256 × 256 | 48 × 48 pt | the same medallion frame with a small paternoster lift (two rails, a tray with a card pack) |
| `medaillon-versand.png` | 256 × 256 | 48 × 48 pt | the same medallion frame with a small night-blue delivery van |
| `meister-presse.png` | 256 × 256 | 48 × 48 pt | bust portrait of a penguin foreman with green apron, round glasses and a clipboard, in the same medallion frame |
| `meister-paternoster.png` | 256 × 256 | 48 × 48 pt | the same foreman, holding a big brass crank |
| `meister-versand.png` | 256 × 256 | 48 × 48 pt | the same foreman, holding a parcel and a small bell |
| `ui-menge.png` | 192 × 112 | 80 × 46 pt | small wooden button plate with rounded corners, flat front | Mitte 80 % leer — dort stehen „x10" und der Preis |
| `ui-menge-an.png` | 192 × 112 | 80 × 46 pt | the same plate with a polished gold rim, meaning "selected" | **gleicher Umriss** wie `ui-menge.png` |

**Alle drei Medaillons und alle drei Meister mit demselben Rahmen** — gleicher
Durchmesser, gleiche Lage im Bild. Nur das Innere wechselt.

## Lieferung

Wie bei `outputs/rig/`: ein Ordner `outputs/ui/` mit

- `png/` — alle Dateien in den Zielgrößen oben,
- `originale/` — die Originale in voller Auflösung (gehen ins Archiv
  `moodsteppi/brauweg-art`, nicht ins Spiel),
- `proben/` — **jedes Bild einmal auf rotem Grund** und die Paare
  (Schild normal/gold, Pfeil gold/grau, Menge normal/an) übereinandergelegt,
- `ui.json` — Fingerspitze, Kappen von `ui-bestand`, Freihalteflächen
  (x, y, Breite, Höhe) je Bild, wie gemessen,
- `LIESMICH.txt` — was geprüft wurde.

WebP muss niemand liefern — gewandelt wird hier mit
`node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> wappen`, abgelegt unter
`packages/client/public/manufaktur/ui/`.

## Abnahme

- **Echter Alphakanal**, alle vier Ecken vollständig durchsichtig; auf Rot
  geprüft: kein Schachbrett, kein heller Saum, kein undurchsichtiges Rechteck.
- **Paare pixelgleich im Umriss** (Schild, Pfeil, Menge, Medaillon-Rahmen):
  Übereinandergelegt darf nur die Farbe wechseln, sonst springt der Knopf beim
  Zustandswechsel.
- Freihalteflächen wirklich ruhig: Eine helle Zahl muss darauf lesbar sein.
- Das Motiv füllt sein Bild (kein Rand über 10 % auf einer Seite) — sonst
  wirkt der Knopf kleiner als seine Nachbarn (Lehre aus `ASSETS-KNOEPFE.md`).
- Bei der Größe „am Handy" noch erkennbar.
- WebP nach dem Wandeln unter 40 kB je Element.

## Was NICHT ins Bild gehört

- **Kein eingebrannter Text** — keine Zahlen, keine Preise, kein „+", kein
  „x10", kein „Max", kein „Boost", keine Stufen. (Einzige Ausnahme: die drei
  Z-Formen des Schlafzeichens.)
- **Kein Schachbrett statt Alphakanal.**
- Keine Szene, kein Hintergrund, keine Halle — jedes Element allein.
- Keine Pinguine außer in `icon-meister` und `meister-*`.
- Keine Originalauflösung unter `packages/client/public/` — dort nur WebP.

## Einbau (für später, nicht Teil der Bestellung)

Heute zeichnet das Spiel diese Dinge mit CSS (`manufaktur.css`: `.mf-schild-stufe`,
`.mf-pfeil`, `.mf-anzahl`, `.mf-meisterplatz`, `.mf-faehigkeit`, `.mf-bestand`,
`.mf-zzz`, `.mf-finger`, `.mf-unten`, `.mf-menge`) und mit Emoji. Eingebaut wird
erst, wenn die Dateien da sind — kein `<img>` auf eine Datei, die es noch
nicht gibt.
