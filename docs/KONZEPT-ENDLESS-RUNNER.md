# Konzept: Endless Runner mit 3D-Pinguin („Brauweg-Lauf“)

Subway-Surfers-Feeling, aber in **eurer** Welt: der Pinguin rennt durch Biome
(Heimat → Wiesen → Strand → Feuerberg …), nicht durch eine U-Bahn.

---

## 1. Spielidee (kurz)

| | |
|---|---|
| **Kamera** | Schräg von hinten oben (Third-Person), Pinguin fest in der Bildmitte unten |
| **Bewegung** | Die **Welt scrollt** auf den Spieler zu — der Pinguin bleibt in X/Z lokal, wechselt nur die Spur |
| **Spuren** | 3 Bahnen (links / Mitte / rechts), Swipe oder Tasten |
| **Aktionen** | Spur wechseln, springen, optional ducken / rutschen |
| **Hindernisse** | Fässer, Kisten, Steine, niedrige Äste — je Biom anders |
| **Sammeln** | Münzen / Edelsteine / kleine Truhen (Anbindung an Hub-Währung möglich) |
| **Länge** | Endless: Strecke aus wiederholten **Chunk**-Modulen, Schwierigkeit steigt mit Tempo |

**Kerntrick wie Subway Surfers:** Der Charakter „läuft“ per Animation auf der Stelle (oder mit minimalem Bob). Vorwärtsgeschwindigkeit steckt in der **Welt** (`world.z += speed * dt`), nicht im Pinguin-Root.

---

## 2. Was du schon hast / was fehlt

### Schon im Repo
- `penguin_base.glb` — stehender/Base-Pinguin (Hub/Avatar)
- Biome-2D-Kacheln (`biom-1` … `biom-6`) — gute **Motiv**-Referenz für Runner-Chunks
- R3F/Three schon im Client (`Avatar3D`, Chest-Aligner)

### Subway-Pinguine (Stand Aug 2026)
Quelle: `brauweg-art/3d/Subway/`
- `cute penguin flee 3d model.glb` → Client: `public/3d/subway/penguin_flee.glb`
- `cute penguin runNew 3d model.glb` → Client: `public/3d/subway/penguin_run.glb`

**Demo:** `/?dev=runner` — Start → Flee-Pose (~1,6 s) → Run-Pose, Welt scrollt.

**Wichtig:** Beide GLBs haben Armature/Skin, aber **keine `animations`-Clips**
(gebackene Stand-Posen). Zusätzlich liegen alle Bones bei Origin — Skinning
verzerrt die Figur (grauer Balken). Die Demo wandelt SkinnedMesh → statisches
Mesh um und setzt die Füße auf y=0. Bis neu exportiert mit Clips `Flee` / `Run`
und korrekter Bind-Pose nutzt die Demo Bobbing.

---

## 3. Technik-Skizze (React Three Fiber)

```
Canvas
 └─ Camera (fixed offset hinter dem Pinguin)
 └─ Lights
 └─ WorldRoot  (position.z steigt jeden Frame)     ← „Bewegung“
 │    ├─ Chunk[0]  Bahn + Deko + Hindernisse
 │    ├─ Chunk[1]
 │    └─ Chunk[n]  (recycle: hinten ab, vorne neu spawnen)
 └─ PlayerRoot  (x = lane, y = jump, z ≈ 0)
      └─ PenguinGLB + AnimationMixer (Run / Jump)
```

**Chunk-Recycling:** Sobald Chunk hinter der Kamera ist → nach vorne teleportieren und Inhalt neu würfeln. So bleibt die Szene klein (5–8 Chunks).

**Kollision:** Einfach zuerst — Bounding-Boxen Spur×Höhe, kein Physik-Engine nötig (kein Cannon/Rapier am Anfang).

**Steuerung:** Touch-Swipe (links/rechts/hoch/runter) + Desktop-Pfeile.

---

## 4. Bewegter Hintergrund — so machst du das

Drei brauchbare Stufen (von einfach → richtig):

### A — Parallax-Skybox / 2D-Ebenen (schnellster Start)
- Weite Berge/Himmel als **große Quads** oder Cylinder mit Textur
- Textur-Offset oder Ebene langsam in −Z schieben, langsamer als die Bahn
- Eure Biome-PNGs können als **far backdrop** dienen (gestreckt, weichzeichner)

### B — Modular 3D-Chunks (Subway-Surfers-Standard) ← empfohlen
Pro Biom ein Bausatz aus kleinen GLBs:

| Asset | Beispiel |
|---|---|
| `track_straight.glb` | 3 Spuren Boden, Länge z. B. 10 m |
| `track_curve` (später) | optional |
| `prop_rock.glb`, `prop_barrel.glb` | Hindernisse |
| `deco_tree.glb`, `deco_palm.glb` | Seiten-Deko (habt ihr schon 2D: Palme/Kiefer) |
| `collect_coin.glb` | Münze |

Hintergrund = viele Chunks hintereinander. „Bewegung“ = `WorldRoot.z`.

### C — Voll animierte Szene in Blender
Eine lange Strecke als Video/ sequenz — **schlecht** für Endless (Ende, Speicher). Nur für Trailer.

**Praktisch:** In Blender/Tripo je Biom 3–5 Track-Stücke + 5 Props exportieren (GLB, Y-up, Meter). Skalierung wie Avatar: Pinguin-Höhe ≈ 1.

---

## 5. Was ich von dir brauche (Checkliste)

Schick Pfade oder leg Dateien unter `brauweg-art/3d/runner/`:

1. **`penguin_run.glb`** (oder Name)
   - Animationen: mindestens `Run`, ideal `Jump`, `Fall`/`Hit`
   - Einheit Meter, Origin an den Füßen
2. **Forward-Achse** der Animation (läuft er Richtung −Z?)
3. **Ein erstes Track-Stück** (auch grau/Platzhalter ok): flacher Boden, 3 sichtbare Spuren
4. Optional: 2–3 Hindernisse + 1 Collectible
5. Welches **Biom zuerst?** (Vorschlag: Feuerberg — passt zum aktuellen Hub-Screenshot)
6. **Ziel im Produkt:** Mini-Game im Hub? Belohnung Münzen? Nur Tech-Demo unter `/?dev=runner`?

---

## 6. Bewegter Hintergrund — konkrete Rezepte

### Rezept 1: Textur-Scroll (2D-Feeling hinter 3D-Bahn)
```
skyPlane.material.map.offset.x += speed * 0.02 * dt
```
Gut für Wolken/Lava-Glow in der Ferne.

### Rezept 2: Chunk-Zug (echtes Endless)
```
world.position.z += speed * dt
if (chunk.z > recycleZ) chunk.z -= numChunks * chunkLength
```
Das ist der Subway-Surfers-Weg.

### Rezept 3: Laufband-Shader
Boden-Mesh fest, UV scrollt — spart Draws, schwerer für Hindernisse. Später.

---

## 7. Vorschlag: erster Meilenstein

**`/?dev=runner`** (wie Avatar/Chest-Aligner):

1. Pinguin Run-Loop in der Mitte  
2. Eine Spur-Bahn aus wiederholten Chunks, Tempo hochdrehbar  
3. Links/Rechts Spur wechseln  
4. Ein Hindernis-Typ + Münzen  
5. Game-Over bei Treffer  

Kein Shop, kein Account — nur Technik-Beweis.

Danach: Biom-Wechsel, Power-ups, Anbindung an Münzen/Aufgaben.

---

## 8. Was du mir als Nächstes schreiben solltest

```
Lauf-Pinguin:   <Pfad zur GLB/FBX>
Animationen:    Run / Jump / …
Track:          <Pfad oder „noch nicht“>
Biom zuerst:    feuerberg | wiesen | …
Ziel:           nur Demo | Hub-Minispiel | …
```

Dann kann ich die Dev-Szene anlegen und die Scroll-Logik verdrahten — sobald die Dateien liegen.
