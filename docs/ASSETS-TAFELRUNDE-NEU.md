# Figuren für Tafelrunde neu — Stilbibel und Stilprobe

Bestellung nach `CLAUDE.md`, Regel 5. Gehört zu `docs/TAFELRUNDE-NEU-PLAN.md`,
Abschnitte 3 und 4.

**Stand 27.11.2026:** Die Stilprobe läuft (Dorfwache, Frostweberin, Gassendieb).
Die Serie mit den übrigen 19 Figuren ist **nicht** bestellt, sie wartet auf
Abnahme 1.

---

## 1. Der Weg — lokal statt Cloud

Am 27.11.2026 umentschieden: Der Plan sah zwei bezahlte 3D-Anbieter vor (Tripo
und Meshy). Robin will den Weg aber beliebig oft und ohne laufende Kosten
wiederholen können. Darum läuft alles auf dem eigenen Rechner:

```
Konzeptbild                codex exec (ChatGPT-Bildmodell)       ~3 min
   ↓  vorbereiten.py       Figur auf 85 %, grauer Grund, 512 px
Bild → 3D                  TripoSR, lokal auf der Grafikkarte     ~45 s
   ↓  riggen.py            Blender 4.5 LTS ohne Fenster           ~10 s
Rig + fünf Bewegungen      EIN Pinguin-Skelett für alle Figuren
   ↓
Bildfolge                  bildfolgen-rendern.mjs --modell …      ~12 s
```

Pro Figur kostet das **0 €** und rund fünf Minuten. Es gibt keinen Schlüssel,
kein Guthaben und keine Anbieter-Lizenz.

**Warum ein eigenes Skelett:** Die Auto-Rigger der Anbieter (Tripo, Meshy,
Mixamo) kennen nur Menschen, also lange Arme, lange Beine und einen Hals. Ein
Pinguin hat nichts davon. Das eigene Skelett hat zehn Knochen: `root`, `hips`,
`spine`, `head`, je zwei `flipper`, `leg` und `foot`. Die fünf Bewegungen sind
einmal gebaut und passen auf jede Figur. Die Gewichte setzt Blender
automatisch (Bone Heat). Je Figur gibt es nur eine kleine Datei mit
Gelenkpunkten, abgelesen am Konzeptbild (`<figur>.punkte.json`).

**Was am Rechner gebraucht wird** (eingerichtet auf dem Mood-XPS unter
`D:\Claude\tools\3d-lokal`):

- Grafikkarte mit 8 GB. TripoSR braucht knapp 6 GB, die RTX 3070 reicht.
- Python 3.11, darin ein venv mit `torch 2.5.1+cu124` und den Paketen aus
  `TripoSR/requirements.txt`. Statt `torchmcubes` wird `PyMCubes` verwendet,
  denn torchmcubes braucht unter Windows einen CUDA-Compiler. Dafür sind zwei
  kleine Korrekturen in `tsr/models/isosurface.py` und `tsr/bake_texture.py`
  nötig.
- Blender 4.5 LTS als portable Zip (keine Installation).
- Für den Renderer `npm i --no-save` wie im Kopf von `bildfolgen-rendern.mjs`.
- Die Skripte stehen in `packages/client/src/figuren3d/lokal/`.

## 2. Stilbibel

**Vorlage:** der Ritter-Pinguin `packages/client/public/hub/pinguin.png`. Er
geht als erstes Bild in **jede** Erzeugung. Als zweites Bild geht die
abgenommene Dorfwache mit, damit Körper, Kopfgröße und Augen über alle 22
Figuren gleich bleiben.

**Der Körper ist immer derselbe:** ein gedrungener Chibi-Pinguin. Der Kopf
nimmt fast die halbe Höhe ein. Rücken, Kopf und Flossen sind dunkel
schieferblau, Bauch und Gesichtsmaske cremeweiß, Schnabel und Füße orange. Die
Augen sind groß, freundlich und glänzend. Die Einheiten unterscheiden sich nur
durch **Ausrüstung**, nie durch den Körper. Darauf baut das gemeinsame
Skelett auf.

**Lesbarkeit auf dem Brett** (Plan, Abschnitt 4):

| Was | bestimmt |
| --- | --- |
| Rolle | die Silhouette: Schild (Wache), Fernwaffe (Schütze), Stab (Magier), Klinge (Meuchler), Heilzeichen (Beistand) |
| Marke | ein wiederkehrendes Merkmal: Farbe oder Abzeichen auf der Brust |
| Kosten | den Prunk: 1 Gold einfach und geflickt, 3 Gold mit Gold, Leuchten und Krone |

**Für das Riggen gilt bei jeder Figur:**

- Frontansicht in A-Haltung: Die Flossen sind um etwa 45° abgespreizt und
  stehen sichtbar frei vom Körper.
- Beide Füße sind frei sichtbar. Roben und Mäntel enden über dem Knie.
- Waffen und Stäbe zeigen nach oben und außen, weg vom Körper. Der Schild hängt
  seitlich und verdeckt nichts.
- Das Licht ist gleichmäßig und weich, ohne harte Schatten. Die Farbe des
  Konzepts wird zur Textur des Modells, und jeder Schatten darin bleibt
  später im Kampf stehen.

**„Untot“ wird freundlich gelesen:** als Gespenst, nicht als Leiche. Die
Plattform ist ein Familienspiel.

## 3. Was nicht ins Bild gehört

- **Kein Schachbrett statt Alphakanal.** Prüfung: Ecken haben Alpha 0, das Bild
  wird auf knallrotem Grund angesehen.
- **Kein eingebrannter Text**, kein Logo, kein Rahmen, keine UI.
- **Keine Originalauflösung unter `public/`.** Dort liegt nur das fertige
  WebP-Blatt. Konzeptbild, Modell und `.blend` kommen ins Archiv
  `brauweg-art` unter `tafelrunde-neu/`.
- Kein Boden und kein Schlagschatten im Konzeptbild.
- Nichts, was einer fremden Spielfigur nachempfunden ist.
- Keine Dreiviertelansicht im Konzeptbild. Die Drehung macht später der
  Renderer, und zwar bei allen Figuren gleich.

## 4. Maße und Format

- **Konzeptbild:** 1024 × 1024 bestellt, codex liefert 1254 × 1254 als PNG mit
  echtem Alpha.
- **Blatt:** das Raster aus `BEWEGUNGEN` in `bildfolgen-rendern.mjs`, also
  dasselbe wie heute: 6 × 6 Zellen, die Todeszeile 1,5-fach breit.
  - **Zelle für die Probe: 256 px**, ergibt 1536 × 1536 px und rund 145 kB.
  - Ob es am Ende 192 oder 256 px werden, entscheidet Abnahme 1 zusammen mit
    der Größe. Bei 256 px wiegen 22 Blätter rund 3,2 MB, deshalb wird nach
    Bedarf geladen (Plan, Abschnitt 3).
- **Kamera, Licht, Drehung:** wie die heutigen Blätter (16° Kamera, 17° zur
  Kamera gedreht). Bei einem Pinguin mit großen Augen zeigt das wenig
  Gesicht; die Drehung ist bei Abnahme 1 eine offene Frage.

## 5. Abnahmekriterien (an der Bildfolge, nicht am Standbild)

1. Die Figur ist am Konzeptbild wiederzuerkennen, und die drei sehen aus wie
   aus einer Hand.
2. Das Rig hält: Beim Schlagen, Getroffenwerden und Sterben reißt das Netz
   nicht, und Waffe oder Schild bleiben an der Flosse.
3. Die fünf Bewegungen sind lesbar, vor allem `schlag` und `tod`.
4. Alpha ist sauber: auf Rot kein Saum und kein Schleier.
5. Das Blatt wiegt höchstens 200 kB bei 256 px.

## 6. Die Probefiguren

Die Prompts setzen sich aus drei Dateien zusammen:
`_einleitung.txt` + `<figur>.subjekt.txt` + `_pose-stil.txt`. Alle liegen
unter `packages/client/src/figuren3d/lokal/prompts/`. Die Dorfwache ist die
erste Figur und hat deshalb keine zweite Vorlage; ihr Prompt steht als
`dorfwache.prompt.txt` am Stück.

| Figur | Rolle | Ausrüstung |
| --- | --- | --- |
| Dorfwache | Wache | Topfhelm, Lederwams mit grünem Haus-Abzeichen, Kurzschwert, Holzschild |
| Frostweberin | Magier | Eiskristallkrone, kurze eisblaue Robe, Stab mit Eiskristall |
| Gassendieb | Meuchler | moosgrüner Kapuzenumhang (Gesicht frei), Dolch, Goldmünze |

Ergebnisse, Dauer und Kosten: siehe Abschnitt 7, wird nach dem Lauf
eingetragen.

## 7. Ergebnis der Stilprobe (27.11.2026)

Gemessen auf dem Mood-XPS mit RTX 3070 (8 GB):

| Figur | Konzept | 3D | Rig | Blatt | Kosten | Blatt bei 256 px (17° / 40°) |
| --- | --- | --- | --- | --- | --- | --- |
| Dorfwache | 200 s | 43 s | 7 s | 12 s | 0 € | 145 / 161 kB |
| Frostweberin | 87 s | 43 s | 7 s | 9 s | 0 € | 152 / 164 kB |
| Gassendieb | 78 s | 50 s | 9 s | 8 s | 0 € | 121 / 141 kB |

**Das Riggen klappt.** Bone Heat hat bei allen drei Figuren jede Ecke an
einen Knochen gebunden, auch die Robe der Frostweberin. Waffe, Stab und
Schild gehen mit der Flosse mit. Die beiden Auswege aus dem Plan (längere
Gliedmaßen, Bewegung aus Standbildern) werden nicht gebraucht.

Am Bild sichtbar:

- **Die drei passen zusammen.** Gleicher Körper, gleiche Augen, gleiche
  Farbwelt. Die Dorfwache als zweite Vorlage hält das zusammen.
- **Gröber als das Konzept.** TripoSR glättet Gesichter und kleine Teile
  (Schneeflocken, Abzeichen). Die Textur wirkt unter dem Spiellicht dunkler
  als das Konzept.
- **Bei 17° sieht man wenig Gesicht**, bei Frostweberin und Gassendieb vor
  allem Hinterkopf und Kapuze. Mit 40° sind Augen und Schnabel klar zu sehen.
  Das Blatt wird dabei rund 10 % größer.
- `lauf` ist sehr zurückhaltend; `schlag`, `getroffen` und `tod` sind gut zu
  lesen.

Was die Probe nicht entschieden hat und deshalb zu Abnahme 1 gehört:

1. Lokaler Weg mit TripoSR, oder ein stärkeres lokales Modell (TripoSG,
   TRELLIS mit 8-GB-Fassung) bzw. doch ein Cloud-Anbieter für das reine
   Modell? Das Skelett und die Bewegungen blieben in jedem Fall dieselben.
2. Drehung 17° wie heute oder 40°.
3. Zelle 256 px oder 192 px.

### Nachtest: stärkeres freies Modell (27.11.2026, abends)

Robin wollte vor Abnahme 1 ein stärkeres Modell sehen, **kostenlos**. Geprüft:

| Modell | Lizenz | 8 GB / Windows | Ergebnis |
| --- | --- | --- | --- |
| TRELLIS | MIT, aber hängt an nvdiffrast (NVIDIA, nur nicht-kommerziell) | nur mit Fork | **verworfen**: BroweGGames verkauft Edelsteine |
| Hunyuan3D 2.x | Tencent-Lizenz schließt die EU aus | – | **verworfen** |
| **TripoSG** | MIT (Code und Gewichte) | ja: 4,9 GB Spitze, ohne Flash-Decoder | **genommen**: deutlich schärfere Form, aber ohne Farbe |

TripoSG liefert nur die Form. Die Farbe kommt deshalb aus zwei Quellen
(`texturieren.py`):

- Was von vorn sichtbar ist und nach vorn zeigt, bekommt die Farbe des
  Konzeptbilds. Sie wird scharf projiziert, ein Tiefenbild sorgt für die
  Verdeckung.
- Seiten und Rückseite bekommen die Farbe aus dem Farbfeld von TripoSR.

Der Hintergrund-Entferner RMBG-1.4, den TripoSG mitbringt, wird **nicht**
benutzt (nicht-kommerzielle Lizenz). Er wird auch nicht gebraucht, weil codex
echtes Alpha liefert.

| Figur | Form (TripoSG) | Farbe | Rig | Blatt | Blatt bei 256 px, 40° |
| --- | --- | --- | --- | --- | --- |
| Dorfwache | 58 s | 36 s | 5 s | 16 s | 178 kB |
| Frostweberin | 77 s | 43 s | 10 s | 11 s | 176 kB |
| Gassendieb | 67 s | 41 s | 10 s | 14 s | 151 kB |

Dazu kommt das Konzeptbild mit rund 1,5 bis 3,5 min. Die Kosten bleiben 0 €.

**Ergebnis:** Gesichter, Augen, Abzeichen und Schnallen sind scharf, die Farben
liegen nahe am Konzept, und die Frostweberin hat überhaupt erst ein Gesicht.
Die Blätter werden etwa 10 % größer.

Schwächen:

- TripoSG macht aus der Kapuze des Gassendiebs eine spitze Zipfelmütze.
- Frei schwebende Teile (Schneeflocken, Münze) bekommen von Bone Heat kein
  Gewicht (230 bzw. 48 Ecken). `riggen.py` gibt sie dem nächsten Knochen.

Aufruf: `figur-sg.sh <name> [drehung]`. Die Umgebung ist ein eigenes venv
(`venv-sg`, Versionen in `constraints-sg.txt`), **nicht** das von TripoSR:
Ein gemeinsames hat pip einmal auf eine CPU-Torch gehoben.

Die Vorschauen (animiertes WebP), Konzeptbilder und Modelle liegen vorerst nur
auf dem Mood-XPS unter `D:\Claude\tools\3d-lokal\stilprobe\`. Ins Archiv
`brauweg-art` (`tafelrunde-neu/`) gehen sie, sobald Abnahme 1 entschieden hat,
welche Fassung gilt.

## 8. Serie (27.11.2026, nach Robins Freigabe des Umsetzungsplans)

Alle 22 Figuren laufen über den neuen Weg aus Abschnitt 7: TripoSG für die
Form, Farbe vorn aus dem Konzeptbild, Rest aus TripoSR. Ansicht 40°, Zelle
256 px. Die Besetzung (8 Pinguin-Helden, 14 Freunde) steht in
`docs/TAFELRUNDE-NEU-UMSETZUNG.md`, Abschnitt 2. Die Bildzeilen erzeugt
`packages/client/src/figuren3d/lokal/prompts_serie.py`. Freunde bekommen eine
eigene Einleitung (`_einleitung-freunde.txt`) und einen Posenblock mit Armen
statt Flossen (`_pose-stil-freunde.txt`).

**Gelenkpunkte automatisch** (`punkte_auto.py`): Gemessen werden die Füße,
die Rumpfbreite auf Bauchhöhe und die Kopfhöhe, der Rest folgt den
Proportionen der von Hand abgelesenen Dorfwache. Die Abweichung zur Handmessung
an der Dorfwache liegt unter 0,13 m.

**Gleich groß und auf einer Linie:**

- `riggen.py` bringt jeden Körper auf 1,8 m. Gemessen wird ohne einen Stab
  über dem Kopf (`koerperhoehe` aus `punkte_auto.py`).
- `bildfolgen-rendern.mjs --modelle` rendert alle Blätter in einem Durchgang
  mit einem gemeinsamen Ausschnitt.

**Weitere Grafik**, alles über codex mit dem Ritter-Pinguin als Vorlage
(`grafik_prompts.py`):

- 4 Schauplätze, hochkant und deckend, Hex-Felder **nicht** eingemalt
- 3 Kartenrahmen
- 15 Zeichen: 5 Rollen, 7 Marken, Stern, Gold, Leben
- 10 Effekte als Einzelbild, im Code animiert

`aufbereiten.mjs` beschneidet und verkleinert. Die Zielgrößen stehen im Skript.
Danach kommt das gewohnte `wandeln.mjs`.

### Arenen und eigene Oberfläche (28.11.2026)

Robin nach dem Test: Die vier Schauplätze wirkten im Spiel wie „gar keine
Arena“, und Bank, Timer, Namen und Lebensanzeigen „noch so KI-generiert
flau“. Die erste Bestellung hatte ausdrücklich eine ruhige, fast leere Mitte
verlangt. Auf dem schmalen Handy, bildschirmfüllend gestreckt, fielen dann
auch die Ränder weg.

**Arenen** (`werkzeug/arenen_prompts.py`, Stilvorlage der Ritter-Pinguin):

- Sechs Stück: Burghof, Dorfplatz, Herbstwald, Vulkan, Hafen, Kristall.
- Jede Arena hat Mauern bzw. einen Rand rundum, Tore oben und unten, einen
  Boden mit Struktur und eine Mittellinie mit Zeichen.
- Bestellmaß: Kampffläche **70 % der Breite und 75 % der Höhe**, Bild 2:3.
  Daran hängt der Einbau, deshalb muss eine Nachbestellung dieses Maß halten.
- Eingebaut über `Arenabild` (Feld.tsx), passgenau hinter dem Wabenfeld: im
  Kampf beide Hälften, in der Rüstphase nur die eigene, mit der Mittellinie an
  der Oberkante des Bretts. Das Feld steht dafür auf 84 % der Breite, damit
  die Seitenmauern sichtbar bleiben.
- Der Tischgrund ist dasselbe Bild, unscharf und dunkel, nur als Kulisse.
- Auslieferung 768 × 1152, `szene`, 140–240 kB. Je Partie wird eine geladen.

**Oberfläche** (`werkzeug/ui_prompts.py`): Als Stilvorlage dienen die Holz-
und Messing-Teile der Startseite (`stilprobe/ui/vorlage-ui.png`), damit
Tafelrunde zur App passt. Acht freigestellte Teile, `wappen`, zusammen
120 kB, unter `public/tafelrunde/neu/ui/`:

- Spielerschild
- Timer-Medaille
- Bank-Brett
- Lebensbalken-Rahmen
- Plakette
- runder Knopf
- Wimpel in Rot und Blau

Originale und Bildzeilen liegen im Archiv auf dem Zweig
`tafelrunde-neu-originale`.

### Klänge — Bestellliste für später (am Mac, mit dem Klangwerkzeug)

Auf diesem Rechner gibt es das Klangwerkzeug nicht (`CLAUDE.md`, Regel 4).
Deshalb steht hier nur, was gebraucht wird. Alles kurz (unter 0,6 s), als MP3
über `~/klangwerkzeug/wandeln.mjs … sfx`.

| Datei | Wofür |
| --- | --- |
| `faehigkeit-auf.mp3` | Mana voll, Fähigkeit wird gewirkt (allgemein) |
| `schild.mp3` | Schildwall, Panzer, Runenschild, Schutzschild |
| `heilung.mp3` | Kräuterwolke, Lichtsegen, Wachstum |
| `feuer.mp3` | Feuerstrahl, Funkenwurf, Brand |
| `blitz.mp3` | Kettenblitz |
| `frost.mp3` | Frostring |
| `hieb-schwer.mp3` | Axtwirbel, Klingentanz, Speerstoß |
| `stampfer.mp3` | Stampfer, Betäubung |
| `sprung.mp3` | Schattensprung, Hinterhalt |
| `wiederkehr.mp3` | Untot steht wieder auf |
| `kauf.mp3`, `verschmelzen.mp3` | Shop und Stern-Aufstieg (falls die alten nicht passen) |

**Belichtung der Blätter.** Neben dem Titelbild aus Blender wirkten die
Bildfolgen deutlich dunkler: Der Renderer war mit Belichtung 1,05 und
Himmelslicht 1,1 noch auf die KayKit-Figuren eingestellt, und die neuen
Figuren tragen ihre Farbe als eingebackene Textur. Für Tafelrunde neu wird mit
`--belichtung 1,65 --himmel 2,0` gerendert (`serie-final.sh`). Die alten
Blätter bleiben bei den Vorgaben. Zusammen 3,3 MB. Der Eichhornschütze liegt
mit 205 kB knapp über der Grenze aus Abschnitt 5 (großer Schweif); das ist
hingenommen, weil geladen wird, was gerade gebraucht wird.

**Titelbild** (`titelbild.py`): sieben Figuren in der Ruhepose aus Blender,
vor den Burghof gesetzt, mit einem weichen Bodenschatten. 900 × 1200, 110 kB.
