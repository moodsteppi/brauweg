# Bestellung: Bilder für BroRemote (Startseite, Lobby, Controller)

Stand 10.11.2026 (Worker, Projekt #24 „BroRemote Design überarbeiten“,
Paket 1). Aufbau nach `docs/ASSETS-KARTENMANUFAKTUR-UI.md`, Stil nach
`docs/ASSETS-BRO-BUILDING-BATTLE.md`.

## Worum es geht

BroRemote (`packages/client/src/broremote/`) besteht heute fast nur aus
CSS-Flächen (`broremote.css`). Das einzige Bild ist der Pinguin
`/hub/pinguin/pinguin-basis.webp`, dazu kommt ein aus `div`s gezeichneter Turm
(`Turm` in `BroRemote.tsx`). Für die Steuerung stehen Zeichen wie ←, →, ↻, ↓, ⚓
und ◆ da. Neben `bauwelt.webp`, `bauinsel.webp` und `baumeister.webp` in
derselben Mappe wirkt das wie ein Platzhalter. Bestellt werden darum:

- **A**: **Startseite**, also Hintergrund und Spielkarte „Bro Building Battle“.
- **B**: **Lobby** mit QR-Rahmen, Crew-Plätzen leer und belegt,
  Bereit-Abzeichen sowie den Knöpfen primär und sekundär.
- **C**: **Controller** mit Pfeiltasten, Drehen, Fallen lassen, Zauber-Knopf
  und dem Rahmen um das Steuerfeld.

Schrift, Zahlen, Namen und Zustände setzt **immer das Spiel** darüber. Kein Bild
trägt ein Wort, eine Zahl oder ein „+“.

## Gemeinsamer Teil (vor jeden Text)

> Game UI art for BroRemote, a friendly party app where phones become
> controllers for "Bro Building Battle", a penguin tower-building physics game
> on floating sky islands. Beautiful softly rendered 3D storybook mobile game
> style: midnight navy and deep teal, gentle moonlight, small warm amber lantern
> glow, polished brass and gold trim, dark walnut wood, chunky blue slate rock,
> tiny turquoise crystals, rounded friendly shapes, soft gentle outlines. Lit
> from the top left. Same art family as a premium penguin card-workshop game.
> No text, no letters, no numbers, no symbols that read as letters, no
> watermark, no logo, no checkerboard.

Text je Element: `<gemeinsamer Teil> Element: <Motiv>. <Hintergrund>`

Hintergrund ist bei allen Elementen außer A1:
`Single object, centered, on a fully transparent background (real alpha channel).`
A1 ist undurchsichtig: `Opaque full-bleed background, no transparency.`

## A: Startseite

Die Seite ist bis 1100 px breit, am Handy 390 pt bei 18 px Rand.

| Datei | Größe px | am Handy | Motiv | Freihalten |
| --- | --- | --- | --- | --- |
| `start-hintergrund.webp` | 1920 × 1080 (Desktop), daraus Zuschnitt | ganze Seite, `background-size: cover` | wide calm night sky over a sea of soft clouds, distant floating rocky islands with tiny pine trees and warm lanterns along the left and right edges and the bottom, a faint distant tower silhouette on the far right island, subtle stars | Mitte und oberes Drittel **dunkel und ruhig**: Dort steht heller Text. Hellstes Detail höchstens 40 % Helligkeit in der Mitte. Beim Zuschnitt auf Hochformat 9:19 müssen Inseln am unteren Rand bleiben. |
| `spielkarte-building.webp` | 768 × 512 | Desktop 230 × 150 pt, Handy 100 × 100 pt (mittig beschnitten) | a small floating workshop island with a cheerful wobbly tower of colorful rounded building blocks (teal, amber, coral, violet) rising from it, a small star sparkling above the top, one tiny penguin builder with a golden helmet waving at the tower foot, lanterns on the island edge, within a soft circular night-sky vignette | Motiv in der **mittleren quadratischen Zone (512 × 512)** vollständig, weil das Handy auf 1:1 beschneidet. Rand mit echtem Alpha, damit die Karte ihren eigenen Grund behält. |

Die Spielkarte ersetzt `Turm klein`. Der große `Turm` im Hero bleibt in diesem
Paket stehen.

## B: Lobby

| Datei | Größe px | am Handy | Motiv | Freihalten |
| --- | --- | --- | --- | --- |
| `qr-rahmen.webp` | 768 × 768 | 255 × 255 pt | square ornate frame of dark walnut wood with polished brass corner caps and small rivets, tiny turquoise crystals at the four corners, a little lantern hanging from the top edge | Innenfläche **72 % (553 × 553 px, mittig) vollständig durchsichtig**. Dort liegt der weiße QR-Code. Kein Schatten oder Glanz darf in die Innenfläche fallen, sonst liest die Kamera ihn nicht. |
| `platz-leer.webp` | 640 × 160 | ca. 300 × 76 pt | horizontal rounded plaque of dark slate stone with a dashed thin brass inlay border, slightly translucent dark inside, an empty round niche on the left side like a reserved seat | Feld rechts der Nische (ab x = 150) leer. Dort stehen „Platz 3“ und der Hinweis. Die Nische (links, Ø 110 px, Mitte bei x = 80) ist leer, das Spiel setzt dort das „+“. |
| `platz-belegt.webp` | 640 × 160 | ca. 300 × 76 pt | the same plaque, now solid polished walnut with a warm brass rim and a soft amber glow, the round niche lit from inside | **pixelgleicher Umriss** wie `platz-leer`. Nische und Textfeld wie oben. Die Spielerfarbe legt das Spiel als Rand darüber, das Bild bleibt neutral warm. |
| `bereit-abzeichen.webp` | 256 × 256 | 28 × 28 pt | round brass badge with a teal enamel center and a bold friendly check mark shape made of glowing light, small sparkle | Nur ein Haken, kein Wort. Bei 28 pt erkennbar: wenige große Formen. |
| `knopf-primaer.webp` | 768 × 192 | volle Breite, 54 pt hoch | wide rounded button plate of polished gold and warm amber enamel, thick soft bevel, darker brass bottom edge like a pressable key | **Dreiteiler**: Kappen links und rechts je 96 px, dazwischen 576 px ohne Muster (einfarbig oder rein waagerechter Verlauf), damit `border-image` streckt. Mitte 80 % ruhig, dunkle Schrift muss lesbar sein. Motiv füllt **mindestens 92 % der Breite**, siehe `ASSETS-KNOEPFE.md`. |
| `knopf-sekundaer.webp` | 768 × 192 | volle Breite, 54 pt hoch | the same button shape in deep teal enamel with a thin brass rim | **pixelgleicher Umriss** wie `knopf-primaer`, gleiche Kappen. Helle Schrift muss lesbar sein. |

## C: Controller

Die Steuerfläche am Handy hat zwei Spalten. Jede Taste ist etwa 170 × 90 pt
groß: oben das Zeichen, darunter das Wort, das das Spiel setzt.

| Datei | Größe px | am Handy | Motiv | Freihalten |
| --- | --- | --- | --- | --- |
| `taste-links.webp` | 256 × 256 | 44 × 44 pt (Zeichen in der Taste) | chunky rounded arrow pointing left, polished brass with a teal glow edge | — |
| `taste-rechts.webp` | 256 × 256 | 44 × 44 pt | **waagerecht gespiegelt aus `taste-links`**, nicht neu gemalt | gleicher Umriss |
| `taste-drehen.webp` | 256 × 256 | 44 × 44 pt | a circular clockwise rotation arrow made of brass wrapped around a small teal building block | — |
| `taste-fallen.webp` | 256 × 256 | 44 × 44 pt | a chunky amber building block dropping downward with two soft motion streaks above it and a small brass down-chevron below | — |
| `zauber-knopf.webp` | 512 × 192 | ca. 170 × 64 pt | rounded spell button plate of deep violet-navy enamel with a brass rim, softly glowing magic runes as pure ornament along the edge (no letters) | Dreiteiler wie die Knöpfe: Kappen je 64 px. Links ein runder Platz (Ø 120 px) für das Zauberzeichen, rechts davon Mitte ruhig für „Turmanker“ und den Zustand. |
| `zauber-anker.webp` | 256 × 256 | 32 × 32 pt | a glowing teal brass anchor with a small stabilizing ring of light | — |
| `zauber-schwere.webp` | 256 × 256 | 32 × 32 pt | a heavy dark iron weight with a brass handle and a purple magic glow pressing downward | — |
| `controller-rahmen.webp` | 1024 × 1024 | um das Steuerfeld, 9-Teiler | ornate rectangular frame of dark walnut with brass corners and tiny lanterns at the top corners, thin slate inner edge | **Neunteiler** für `border-image`: Ecken je 160 px, die Kanten dazwischen ohne Muster streckbar. Innenfläche durchsichtig. |

Alle Tastenzeichen haben **gleiche Strichstärke und gleiches Licht**, damit
das Steuerfeld wie ein Satz aussieht. Gemalt wird so groß wie in der Spalte
„Größe px“, damit es auf 3×-Bildschirmen scharf bleibt.

## Lieferung und Ablage

- Originale in voller Auflösung bleiben im ignorierten
  `packages/client/art/broremote-ui/` und gehen ins Archiv
  `moodsteppi/brauweg-art`.
- Laufzeit: WebP unter `packages/client/public/broremote/ui/` mit
  `node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> wappen` (Elemente mit Alpha)
  bzw. `szene` (`start-hintergrund`). Vorher auf die Größen dieser Tabelle
  verkleinern, Originalauflösung wird nicht ausgeliefert.
- **Je Bild deutlich unter 500 kB, alle zusammen unter 2 MB.** Richtwerte:
  Hintergrund ≤ 250 kB, Spielkarte ≤ 120 kB, Elemente ≤ 40 kB.

## Abnahme

- **Echter Alphakanal** bei allen außer `start-hintergrund`. Alle vier Ecken
  durchsichtig, auf Rot geprüft: kein Schachbrett, kein heller Saum, kein
  undurchsichtiges Rechteck.
- **Paare pixelgleich im Umriss**: `platz-leer`/`platz-belegt`,
  `knopf-primaer`/`knopf-sekundaer`, `taste-links`/`taste-rechts`. Legt man sie
  übereinander, darf nur die Farbe wechseln.
- `qr-rahmen`: Die Innenfläche ist durchsichtig. Ein QR-Code darin lässt sich
  mit der Handykamera lesen.
- Freiflächen sind wirklich ruhig, Schrift darauf ist lesbar.
- Das Motiv füllt sein Bild, kein Rand über 10 % je Seite (Ausnahme: der Rand
  der Spielkarte für den Beschnitt).
- Bei der Größe „am Handy“ noch erkennbar.

## Was NICHT ins Bild gehört

- **Kein eingebrannter Text**: kein „BroRemote“, kein „Bereit“, kein „Platz 1“,
  keine Zahlen, kein „+“, kein „x“, keine Pfeile aus Schriftzeichen.
- **Kein Schachbrett statt Alphakanal.**
- Kein QR-Code oder QR-ähnliches Muster im Rahmen.
- Keine echten Markenlogos, keine Handy-Modelle mit erkennbarer Marke.
- Pinguine nur in `spielkarte-building`.
- Keine Originalauflösung unter `packages/client/public/`.

## Einbau (später, nicht Teil dieser Bestellung)

Heute zeichnet das Spiel diese Dinge mit CSS (`broremote.css`: `.br-hero`,
`.br-spielkarte`/`.br-spielmotiv`, `.br-qr`, `.br-platz`, `.br-avatar`,
`.br-knopf`/`.br-sekundaer`, `.br-steuertaste`, `.bb-zauber`, `.br-controller`)
und mit Zeichen. Eingebaut wird erst, wenn die Dateien da sind. Kein `<img>`
auf eine Datei, die es noch nicht gibt.

## Generierung

Offen. Die früheren BroRemote-Bilder entstanden mit dem eingebauten Imagegen
einer anderen Sitzung. Der Worker auf dem Mood-XPS hat kein eigenes
Bildmodell. Der einzige erreichbare Dienst (VerseIn) ist bezahlt, und das
Konto stand am 10.11.2026 auf 0 Münzen. Prompts und endgültige Maße werden
nach der Lieferung hier ergänzt.
