# Bildbestellung: Böden und Ränder für Pro-Subway

Der Endlos-Lauf (Spielauswahl → Alleine → Pro-Subway) baut seine Strecke aus
28-m-Kacheln. Zurzeit ist der Boden **gefärbte Geometrie**: eine Grundfläche
je Biom, gestrichelte Spurtrenner, Bordstein-Blöcke im Wechsel, Flecken,
eine niedrige Randhecke. Das funktioniert und liest sich schnell — aber es
ist Farbfläche, keine Malerei. Diese Bestellung ersetzt die Farbflächen durch
**gemalte, kachelbare Texturen** im Stil der übrigen Brauweg-Bilder.

Gestaltungsregeln stehen in [DESIGN.md](DESIGN.md); sie gelten unverändert.

---

## Was bestellt wird

Je Biom **eine Bodenkachel** und **eine Randleiste** — sechs Biome, also
zwölf Bilder. Die Biome sind dieselben wie auf dem Trophäenpfad:

| # | Biom | Boden-Motiv | Rand-Motiv |
|---|---|---|---|
| 1 | Heimat | sattes Gras mit Trampelpfad-Spuren | Holzzaun/Hecke |
| 2 | Wiesen | helleres Blumengras | Wildhecke mit Blüten |
| 3 | Strand | fester Sand mit Muschelsprenkeln | Dünengras/Treibholz |
| 4 | Feuerberg | dunkles Gestein mit Glutrissen | Basaltkante, Glut |
| 5 | Schneefeld | Schnee mit Eisplatten | Schneewehe/Eiskante |
| 6 | Sternenhafen | dunkles Pflaster mit Goldadern | Goldgeländer, Sterne |

## Für alle Bilder verbindlich

**Format**
- **WebP wird ausgeliefert, PNG wird geliefert.** Umwandlung hier
  (`node ~/bildwerkzeug/wandeln.mjs <quellordner> <zielordner> szene`).
- **Bodenkachel: 1024 × 1024 px**, Draufsicht senkrecht von oben, sRGB,
  **ohne** Alphakanal.
- **Randleiste: 1024 × 256 px**, Seitenansicht leicht von oben, sRGB, ohne
  Alphakanal.

**Kachelbarkeit — das entscheidende Kriterium**
- Die Bodenkachel wird **in Laufrichtung endlos wiederholt** (und einmal quer
  über drei Spuren gestreckt). Ober- und Unterkante müssen nahtlos
  aneinanderpassen, Links/Rechts ebenso.
- Die Randleiste wiederholt sich **nur waagerecht**; linke und rechte Kante
  müssen nahtlos schließen.
- **Prüfschritt vor Abgabe:** Bild doppelt nebeneinander- und
  übereinanderlegen. Jede sichtbare Naht ist ein Abnahmefehler — im Spiel
  zieht die Kachel zwölfmal pro Sekunde vorbei, eine Naht wird zum Stroboskop.

**Keine Richtungsmerkmale**
- Kein Gefälle, keine Pfeile, keine Schrift, kein Schattenwurf in eine feste
  Richtung. Das Licht kommt im Spiel aus der 3D-Szene; eingebrannte Schatten
  stehen sonst quer zur Sonne.
- **Ruhig in der Mitte:** Auf der Kachel laufen Figur, Hindernisse und
  Münzen. Starke Kontraste und kleinteilige Muster machen die Fläche
  unruhig und verstecken die Spielobjekte — Tiefe über Ton, nicht über
  Kontrast.

**Ton und Stil**
Wie die Hub-Szenen (`bg-blatt.webp`, Biome des Trophäenpfads): gemalt, warm,
stofflich. Kein Fotorealismus, keine harten Normal-Map-Optiken.

**Was NICHT ins Bild gehört**
- Kein Text, keine Logos, keine Spielobjekte (Münzen, Hindernisse).
- Kein Schachbrett als vermeintliche Transparenz (Alphakanal ist hier gar
  nicht erwünscht — die Flächen sind deckend).
- Kein Alkohol (Feuerberg-Glut ja, Lagerfeuer-Romantik mit Krügen nein).

---

## Dateinamen und Ablage

```
runner-boden-heimat.png        runner-rand-heimat.png
runner-boden-wiesen.png        runner-rand-wiesen.png
runner-boden-strand.png        runner-rand-strand.png
runner-boden-feuerberg.png     runner-rand-feuerberg.png
runner-boden-schneefeld.png    runner-rand-schneefeld.png
runner-boden-sternenhafen.png  runner-rand-sternenhafen.png
```

Originale ins Archivrepo
[`moodsteppi/brauweg-art`](https://github.com/moodsteppi/brauweg-art) unter
`runner/`, die gewandelten WebP nach `packages/client/public/runner/`.
Richtwert nach dem Wandeln: eine Bodenkachel um 60–120 kB.

## Einbau (für die Sitzung, die die Lieferung verdrahtet)

In `Runner.tsx` steht je Biom die Farbtabelle `BIOME_LOOK`. Der Umbau ist je
Biom eine `meshStandardMaterial map` mit `RepeatWrapping` (Wiederholung in
Laufrichtung ≈ Kachellänge 4 m → `repeat.set(1, 7)` je 28-m-Chunk) statt der
`color`-Fläche; Bordsteine und Striche bleiben Geometrie darüber. Die
Texturen mit `useTexture` aus drei laden und **je Biom cachen** — nicht je
Chunk, sechs Chunks teilen sich dieselbe Kachel.

## Abnahmekriterien

1. PNG, Maße wie oben, sRGB, ohne Alphakanal.
2. Doppelt gelegt nahtlos (waagerecht und — beim Boden — senkrecht).
3. Kein Text, kein eingebrannter Richtungsschatten, Mitte ruhig.
4. Neben `biom-4-feuerberg` (Trophäenpfad) gelegt: sieht nach demselben
   Haus aus.
