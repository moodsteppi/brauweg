# Bestellung: Doko-Meister-Outfit für den Pinguin

Stand 17.10.2026. Belohnung der Lernserie „Doppelkopf lernen" (sieben Tage am
Stück, `docs/LERNPFAD.md`). Im Katalog stehen die beiden Stücke schon
(`hut-doktorhut`, `oberteil-meisterrobe` in `packages/server/src/kosmetik.ts`)
und werden heute als **Zeichnung** gezeigt (`AUSSEHEN` in
`packages/client/src/pinguin.tsx`). Gemalt werden sollten sie beim Einbau per
Bild-KI — die hatte an dem Tag kein Guthaben. Diese Bestellung ersetzt die
Zeichnung, sobald die Bilder da sind: ein `bild:`-Eintrag je Stück, sonst nichts.

## Maße und Format

| | Wert |
| --- | --- |
| Rahmen | **480 × 512 px** je Stück, deckungsgleich mit `public/hub/pinguin/pinguin-basis.webp` (Doppel des Rahmens 240 × 256 in `pinguin.tsx`) |
| Format | PNG mit **echtem Alphakanal** fürs Archiv, ausgeliefert als WebP (`node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> szene`) |
| Dateigröße | WebP unter 25 kB je Stück (die vorhandenen Hüte liegen bei 6–15 kB) |
| Ablage | Original nach `moodsteppi/brauweg-art` (`pinguin/hut-doktorhut.png`, `pinguin/oberteil-meisterrobe.png`), WebP nach `packages/client/public/hub/pinguin/` |

## Inhalt

- **`hut-doktorhut`** — schwarzer Doktorhut (Mörtelbrett), leicht von vorn
  oben, goldene Quaste rechts, kleines goldenes **Kreuz-Symbol (♣)** vorn am
  Band. Sitzt auf der Kalotte wie die anderen Hüte: Hutkrone y 8–148, x
  100–380 im 480er-Rahmen (siehe `hut-krone.webp`: x 172–308, y 8–147).
- **`oberteil-meisterrobe`** — königsblaue Gelehrtenrobe mit breiter
  Goldborte an den Vorderkanten und Ärmelenden, weißer Kragen, zwei goldene
  Knöpfe, goldenes **♣** links auf der Brust. Form und Sitz wie
  `oberteil-frack.webp` (x 113–367, y 214–423).
- Stil der vorhandenen Stücke: glänzend, weich ausgeleuchtet, 3D-Comic wie
  Krone und Frack. Vorlage zum Mitschicken: der Pinguin mit Krone und Frack
  (`pinguin-basis.webp` + beide Ebenen).

## Freihalte-Zonen

- Alles außerhalb des Stücks **vollständig transparent** — vor allem die
  Ecken: Die Ebenen liegen gestapelt, eine undurchsichtige Ecke löscht den
  Pinguin darunter (`CLAUDE.md`, „Was regelmäßig Zeit kostet").
- Der Hut lässt die Augen frei (unter y 150), die Robe Kopf und Füße
  (über y 214 und unter y 430).

## Abnahme

- Auf **rotem Grund** geprüft, einzeln und zusammen mit
  `pinguin-basis.webp` gestapelt: kein Schachbrett, kein heller Saum.
- Deckungsgleich: Gestapelt sitzt der Hut auf dem Kopf und die Robe auf dem
  Bauch, ohne Verschieben.
- Auch bei 3 rem Höhe (Profilbild oben links) noch als Doktorhut und blaue
  Robe erkennbar.

## Was NICHT ins Bild gehört

- **Kein Schachbrett statt Alphakanal**, kein eingebrannter Hintergrund.
- **Kein Text**, keine Jahreszahl, kein „Meister"-Schriftzug, keine Zahl 7.
- Kein Pinguin, kein Kopf, keine Flossen — nur das Stück.
- Keine Originalauflösung unter `packages/client/public/`.
