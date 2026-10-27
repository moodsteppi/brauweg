# Farbduell: Banner für Spielauswahl und Start

`public/hub/banner-filler.webp`, **1200 × 800 Pixel**, WebP (Qualität 82,
unter 150 kB). Benutzt von der Spielkachel im Spiele-Reiter und vom Start
(`bannerFuer` in `SpieleNeu.tsx`, `StartNeu.tsx`); beide schneiden mit
`background-size: cover` zu, das Wichtige gehört deshalb in die Mitte.

**Warum neu (27.10.2026):** Das erste Motiv aus dem Bildwerkzeug zeigte
fallende Viererblöcke über einem Raster. Niklas: „sonst ist es Tetris". Das
Spiel ist aber ein Gebietsspiel — zwei Spieler starten in gegenüberliegenden
Ecken und schlucken mit jeder Farbwahl die angrenzenden Felder.

## Motiv

- Ein schräg von vorn gesehenes Raster aus abgerundeten, glänzenden Kacheln
  (16 × 11), dunkelblauer Grund wie die anderen Hub-Banner.
- **Zwei zusammenhängende Gebiete:** Blau wächst von links unten, Rot von
  rechts oben, beide leuchten leicht. Dazwischen neutrale Felder in Grün,
  Gelb, Violett und Dunkelgrau (Palette der Spielwahl-Grafik
  `spielwahl-filler.webp`), nie zwei gleiche nebeneinander.
- Hintergrundschein blau links, rot rechts.

## Nicht ins Bild

- Keine fallenden oder schwebenden Blöcke, **keine Viererformen
  (Tetrominos)** — genau das las sich als Tetris.
- Keine Schrift, keine Logos, kein Wasserzeichen.
- Kein Schachbrett als Transparenzersatz (das Banner ist ohnehin deckend).
- Keine Originalauflösung unter `public/`.

## Abnahme

- Auf der Spielkachel (schmal zugeschnitten) sind beide Gebiete und die
  Grenze zwischen ihnen zu erkennen.
- Niemand, der das Bild ohne Titel sieht, denkt an Tetris.

## Herstellung

Gezeichnet, nicht erzeugt: `python3 werkzeug/hub/farbduell-banner.py ziel.png`
(Pillow, NumPy; fester Zufallssamen, also jedes Mal dasselbe Bild), danach
`cwebp -q 82 ziel.png -o packages/client/public/hub/banner-filler.webp`.
Wer ein gemaltes Motiv bestellen will, nimmt diese Seite als Bestellung und
ersetzt nur die Datei.
