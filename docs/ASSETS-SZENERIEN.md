# Bildbestellung: Tischszenerien

Jeder soll sich aussuchen können, worauf er spielt. Die Szenerie ist eine
**persönliche** Einstellung wie das Kartenblatt — jeder am Tisch sieht seine
eigene. Damit gibt es keinen Streit darüber, wessen Bild gilt, und niemandem
wird ein Untergrund aufgezwungen, auf dem er die Karten schlecht erkennt.

Acht Bilder. Eins davon (`stube`) gibt es schon: `bg-spieltisch.png` wird
umbenannt und bleibt die Vorgabe.

---

## Die eine Regel, die über allem steht

**Auf jeder Szenerie müssen Spielkarten lesbar bleiben.**

Das ist kein Schmuckbild, sondern der Untergrund unter zwölf Karten. Ein
tiefroter oder dunkelblauer Filz sieht in der Auswahl großartig aus und
schluckt dann die schwarzen Farben — Kreuz und Pik verschwinden.

Deshalb bei jeder Variante:
- **Die Spielfläche ist mittelhell bis mittel-dunkel**, nie fast schwarz und
  nie fast weiß.
- **Gleichmäßig.** Kein Muster, kein Wappen, kein starker Verlauf in der
  Mitte. Struktur ja (Filzfaser, Holzmaserung), aber fein.
- **Probe vor der Übergabe:** eine weiße Karte mit schwarzem Kreuz und eine
  mit rotem Herz darauflegen. Beide müssen sich auf einen Blick
  unterscheiden lassen. Wenn nicht: aufhellen.

---

## Für alle Bilder verbindlich

**Format:** PNG, **1024 × 1536** (Hochkant 2:3), sRGB. Volle Auflösung —
ich verkleinere und wandle selbst um.

**Aufteilung — bei allen acht gleich**, damit die App nichts umbauen muss:

| Höhe | Was dort ist |
| --- | --- |
| 0–10 % | Wand oder Rand, dunkel |
| 10–75 % | **Die Spielfläche** — volle Breite, oben und unten eine Kante |
| 75–100 % | Dunkler Rand / Tischkante — darüber liegen die Handkarten |

**Muss frei bleiben**
- **Die Mitte** (30–70 % Breite, 30–65 % Höhe): dort liegt der Stich.
- **Die Ränder der Spielfläche** links, rechts und oben: dort sitzen die
  Mitspieler.
- **Keine Karten und keine Hände im Bild.**

**Was NICHT ins Bild gehört:** keine Schrift, keine Zahlen, keine
Bedienelemente, kein Handyrahmen, kein Alkohol.

**Beschnitt:** Auf hohen Handys bleiben verlässlich die mittleren 70 % der
Breite sichtbar. Alles Wichtige gehört in diesen Streifen.

---

## Die acht Szenerien

`stube` ist das vorhandene `bg-spieltisch.png` und wird nur umbenannt. Die
anderen sieben bitte in derselben Machart — gemalt, warm, plastisch.

| Datei | Szenerie | Beschreibung |
| --- | --- | --- |
| `szene-stube.png` | Stube (Vorgabe) | **Vorhanden.** Grüner Filz, Holzkante, Laternen. |
| `szene-filz-blau.png` | Blauer Filz | Wie die Stube, aber **mittelblauer** Filz — Ton wie ein Jeansstoff, nicht wie Marineblau. |
| `szene-filz-rot.png` | Roter Filz | **Gedecktes Ziegelrot**, deutlich aufgehellt. Kein Bordeaux: Darauf verschwindet Herz. |
| `szene-filz-grau.png` | Grauer Filz | Warmes Mittelgrau mit leichtem Braunstich. Die neutralste Variante. |
| `szene-holz-hell.png` | Heller Holztisch | Kein Filz: geölte helle Eiche mit feiner Maserung, wie ein Wirtshaustisch. Maserung **quer** und ruhig. |
| `szene-winter.png` | Winterstube | Grüner Filz, aber die Wand dahinter mit Raureif am Fenster und kaltem Licht von außen; die Fläche selbst bleibt warm beleuchtet. |
| `szene-sommer.png` | Gartentisch | Filz unter einem Sonnensegel, gesprenkeltes Licht **nur an den Rändern**, die Mitte gleichmäßig. |
| `szene-nacht.png` | Abends spät | Dieselbe Stube, Licht nur aus zwei Lampen, Ränder dunkler. **Die Spielfläche bleibt trotzdem mittelhell** — sonst ist die Probe oben nicht bestanden. |

---

## Ablage

Alles nach `packages/client/public/hub/` unter genau diesen Namen.

**Alle acht sind geliefert und eingebaut.** Ausgeliefert wird
`szene-*.webp` (zusammen 1,2 MB), die Originale liegen unter
`packages/client/art/szenerien/`. Die Kartenprobe haben alle bestanden:
gemessene Helligkeit der Spielfläche 29 bis 57 Prozent.

## Prüfung vor der Übergabe

1. **Die Kartenprobe** aus dem ersten Abschnitt — bei jeder der acht.
2. Kein Text, keine Karten, keine Hände im Bild.
3. Alle acht genau 1024 × 1536 und mit derselben Aufteilung: Wand oben,
   Fläche in der Mitte, dunkler Rand unten.
4. Die acht nebeneinandergelegt: erkennbar ein Satz, nicht acht Einzelbilder.
