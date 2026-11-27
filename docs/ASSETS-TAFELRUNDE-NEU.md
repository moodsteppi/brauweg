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

Die Vorschauen (animiertes WebP), Konzeptbilder und Modelle liegen vorerst nur
auf dem Mood-XPS unter `D:\Claude\tools\3d-lokal\stilprobe\`. Ins Archiv
`brauweg-art` (`tafelrunde-neu/`) gehen sie, sobald Abnahme 1 entschieden hat,
welche Fassung gilt.
