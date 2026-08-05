# Bildbestellung: Biome für den Trophäenpfad

Der Trophäenpfad ist heute **eine** Karte, `weltkarte.png`, mit fünf
Checkpoints darauf. Er soll ein langer, scrollbarer Weg durch mehrere Biome
werden: antippen öffnet ihn im Vollbild, dann rollt man ihn ab.

Bestellt werden **sechs Kacheln**, eine je Biom. Die Namen sind schon
vergeben — sie stehen in
[`Pfad.tsx`](packages/client/src/screens/Pfad.tsx) und stimmen mit den
Checkpoints überein:

| Kachel | Biom | Checkpoint |
| --- | --- | --- |
| `biom-1-heimat.png` | Heimat: Wiese, Wirtshaus, Anfang | 0 (Start) |
| `biom-2-wiesen.png` | Wiesen und Hügel | 100 |
| `biom-3-strand.png` | Strand und Küste | 250 |
| `biom-4-feuerberg.png` | Vulkan und schwarzes Gestein | 500 |
| `biom-5-schneefeld.png` | Schnee, Eis, Nadelbäume | 750 |
| `biom-6-sternenhafen.png` | Sternenhafen, Nachthimmel, Ziel | 1000 |

---

## Die eine Regel, an der alles hängt

Die Kacheln werden **senkrecht gestapelt**, unten die Heimat, oben der
Sternenhafen. Der Weg läuft von unten nach oben durch und muss an den
Stößen zusammenpassen.

Damit das ohne Millimeterarbeit klappt, gilt für **jede** Kachel:

- Der Weg **betritt die Kachel am unteren Rand bei genau 50 % der Breite**.
- Der Weg **verlässt die Kachel am oberen Rand bei genau 50 % der Breite**.
- An beiden Rändern läuft er auf den letzten 5 % der Höhe **senkrecht** —
  kein Bogen, keine Schräge kurz vor der Kante.

Dazwischen darf er tun, was er will: schlängeln, ausholen, an Hindernissen
vorbei. Nur Ein- und Ausgang stehen fest.

**Die Ränder müssen nicht nahtlos ineinander übergehen.** Zwischen den
Kacheln liegt Wasser beziehungsweise Nebel — jedes Biom ist eine Insel für
sich. Oberer und unterer Rand jeder Kachel sind deshalb **Wasser oder
Dunst**, nicht Land. Nur der Weg selbst kreuzt sie, als Brücke, Steg oder
Trittsteinreihe.

Das ist Absicht: So passt jede Kachel zu jeder anderen, die Reihenfolge
lässt sich ändern, und ein siebtes Biom später ist ein Bild mehr und kein
Umbau.

---

## Für alle Kacheln verbindlich

**Format**
- PNG, **1024 × 1024**, quadratisch, kein Alpha nötig.
- Farbraum sRGB.
- Originale nach `packages/client/art/`. Die Auslieferungsfassung als WebP
  erzeuge ich daraus — **nicht nach `public/` liefern**. So sind schon
  einmal 13,9 MB mitgeliefert und ausgeliefert worden.

**Echte Transparenz**
Hier nicht nötig, die Kacheln sind vollflächig. Falls doch etwas
freigestellt geliefert wird: echter Alphakanal, kein Schachbrett-Muster,
keine weiße Fläche. Dreimal passiert.

**Was NICHT ins Bild gehört**
- **Keine Schrift.** Keine Biomnamen, keine Zahlen, keine Trophäenwerte.
  Alles das setzt die App darüber und muss übersetzbar bleiben.
- **Keine Checkpoint-Marken.** Die runden Knoten auf dem Weg zeichnet die
  App (`knoten-gold.webp` und Geschwister). Male den Weg, nicht die
  Stationen.
- **Kein Pinguin.** Er ist die Spielfigur und läuft als eigenes Bild
  darüber. Ein gemalter Pinguin im Hintergrund wäre ein zweiter.
- **Keine Bedienelemente**, kein Handyrahmen.
- **Kein Alkohol**: keine Krüge, Fässer, Hopfen — auch nicht am Wirtshaus
  in der Heimat.

**Beschnitt**
Die Kachel wird auf Handybreite gezeigt, links und rechts kann etwas
wegfallen. Der Weg und alles, was zählt, gehört in die **mittleren 70 % der
Breite** (15 % bis 85 %). An den Seiten steht Beiwerk.

**Ton und Stil**
Wie `weltkarte.png` und `bg-clan.webp`: gemalt, warm, satt, freundlich.
Draufsicht aus leichter Schräge, wie eine Schatzkarte, kein Fotorealismus.
Die sechs sollen wie **ein** Satz aus einer Hand wirken — gleiche
Strichstärke, gleiche Sättigung, gleicher Lichteinfall (von links oben).

**Der Weg selbst** ist in allen sechs Kacheln erkennbar dasselbe Wegmotiv:
helle, runde Trittsteine. Was drumherum liegt, wechselt — der Weg nicht.
Er ist der rote Faden über sechs Bilder hinweg und darf nicht in jedem
Biom anders aussehen.

---

## Die einzelnen Biome

**1 — `biom-1-heimat.png`.** Wo man anfängt. Wiese, das Wirtshaus von
außen, warmes Abendlicht. Ruhig und einladend. Unten Wasser oder Dunst, der
Weg beginnt an einem Steg.

**2 — `biom-2-wiesen.png`.** Grüne Hügel, ein Bachlauf, einzelne Bäume,
vielleicht ein Zaun. Der freundlichste Abschnitt.

**3 — `biom-3-strand.png`.** Küste, heller Sand, Palmen, flaches
türkisfarbenes Wasser. Sommer, Mittagslicht.

**4 — `biom-4-feuerberg.png`.** Vulkankegel, schwarzes Gestein, glimmende
Spalten. **Bedrohlich, aber nicht düster** — der Weg bleibt sichtbar und
begehbar, das hier ist kein Endgegner, sondern eine Station.

**5 — `biom-5-schneefeld.png`.** Schnee, Eisflächen, Nadelbäume, kaltes
blaues Licht. Der Weg hebt sich hier besonders ab, weil alles hell ist —
dunklere Trittsteine als anderswo.

**6 — `biom-6-sternenhafen.png`.** Das Ziel. Nachthimmel, Sterne, ein Hafen
mit Laternen. Feierlich. Der Weg endet an einem Anleger; oben darf statt
Wasser der Sternenhimmel stehen, denn darüber kommt nichts mehr.

**Abnahme für alle sechs:** Zwei beliebige Kacheln übereinandergelegt
ergeben einen Weg, der ohne Versatz durchläuft. Der Weg ist auf jeder
Kachel auf ganzer Länge sichtbar, auch dort, wo der Untergrund die gleiche
Helligkeit hat.

---

## Danach — was ich damit mache

Die Stützpunkte werden **je Kachel** vermessen, in Prozent dieser einen
Kachel. Heute steht ein einziger Satz von 20 Punkten für die ganze Karte in
`Pfad.tsx`, mit dem Hinweis, dass beim Kartenwechsel alles neu vermessen
werden muss. Mit Kacheln gilt das nur noch für die eine, die sich ändert.

Der Pfad bekommt zwei Zustände: klein auf dem Hauptschirm wie heute, und
im Vollbild scrollbar, wenn man ihn antippt. Im Vollbild springt die
Ansicht beim Öffnen an die Stelle des Pinguins — nicht an den Anfang, denn
wer 600 Trophäen hat, will nicht erst durch drei Biome scrollen.

**Bis die Bilder da sind bleibt alles, wie es ist.** Keine Platzhalter
unter diesen Namen: Ein weiß gefüllter Platzhalter ist hier schon zweimal
live gegangen, und bei einer bildschirmfüllenden Kachel wäre es besonders
auffällig.
