# Feldherr — Bestellung der 3D-Modelle

Stand: 7. August 2026 (überarbeitet nach Charakter-Umbau, Haus Stufe 4,
Waldtürmen und dem neuen Rasenboden).

Kontext: `docs/FELDHERR-3D-UMBAU.md`. Die gemalten Figuren des 2D-Renderers
werden durch 3D-Modelle ersetzt; gezeichnet wird mit Three/R3F im Client
(Vorbild Pro-Subway, Modelle dort unter `packages/client/public/3d/`).
**Bis auf den Ritter steht heute überall ein Platzhalter aus Grundkörpern**
(Kasten, Kegel, Walze, Kugel) — die Liste unten sagt, was sie ersetzt.

Das Brett ist fest **8 × 12 Felder, quadratische Zellen** (Geometrie-Entscheid
vom 7. August 2026). Auf Handybreite misst eine Zelle rund 45 px — jede
Silhouette muss in dieser Größe lesbar bleiben.

**Der Boden ist fertig und braucht nichts.** Rasen und Schachbrett rechnet
der Client selbst (Textur plus Instanzen-Gras); Modelle dürfen keinen
eigenen Untergrund mitbringen.

---

## Technische Vorgaben (gelten für jedes Modell)

* **Format:** glTF 2.0 binär (`.glb`), ohne Draco. Y ist oben, das Modell
  blickt nach **−Z** (glTF-Konvention) — Truppen und Rohre richtet der
  Client per Drehung aus.
* **Maßstab: 1 Einheit = 1 Feldkante.** Ein 1×1-Bau füllt höchstens
  0,9 × 0,9 Grundfläche, eine Truppe ~0,6 Durchmesser.
* **Ursprung:** Mitte der Grundfläche auf Bodenhöhe (y = 0). Nichts ragt
  unter y = 0.
* **Polygonbudget:** Truppe ≤ 3 000 Dreiecke, Bau ≤ 5 000, Geländestück
  ≤ 1 500. Ziel-Look: Low-Poly mit Flächenschattierung, passend zur
  Farbwelt des Spiels.
* **Material:** ein Material je Modell; Farbe über Vertexfarben ODER eine
  kleine Palettentextur (≤ 256 px). Kein PBR-Glanz, kein eingebranntes
  Licht, keine eingebrannten Schatten.
* **Benannte Materialien/Knoten** (der Client greift darüber zu):
  * `spieler` — alle Flächen in Spielerfarbe (Banner, Dach, Wappen);
    der Client färbt sie rot oder blau.
  * `stufe` — Metallflächen der Truppen; der Client färbt Kupfer, Silber,
    Gold, Diamant. Es gibt also **ein** Truppenmodell je Art, kein Modell
    je Stufe.
  * `rohr` — eigener Knoten bei Kanone und Mörser, der Client schwenkt ihn.
* **Animationen** (nur Truppen, erste Lieferung): drei Clips mit exakt
  diesen Namen: `stehen`, `gehen`, `schlagen`. Bauten sind statisch.
* **Dateigröße:** ≤ 200 kB je GLB. *(Der vorliegende Ritter hat 3,7 MB —
  er muss vor dem Einchecken heruntergerechnet werden.)*
* **Ablage:** Original ins Archiv `moodsteppi/brauweg-art`; ausgeliefert
  wird unter `packages/client/public/3d/feldherr/` (Regel 4 sinngemäß).

### Namensraum je Charakter

Seit dem 7. August hat jeder Charakter seine eigene Kartenhand
(`quelle/teile/karten.js`). Karten, die nur ein Charakter hat, gehören in
sein Verzeichnis; was alle teilen (Gelände, Münze, Geschosse), bleibt
oben:

```
public/3d/feldherr/            gemeinsam: Gelände, Münze, Geschosse, Trümmer
public/3d/feldherr/engineer/   die sechs Karten des Engineers
```

---

## 1 — Truppen (Engineer)

| Datei | Inhalt | Ersetzt heute |
|---|---|---|
| `engineer/schwert.glb` | Schwertkämpfer, Clips `stehen`/`gehen`/`schlagen`, Material `stufe` | Walze + Kugel |
| `engineer/bogen.glb` | Bogenschütze, Clips wie oben, Bogen sichtbar | Walze + Kugel + Stab |
| `engineer/ritter.glb` | **liegt vor**, aber unfertig: 3,7 MB, keine Clips, keine Materialnamen. Nacharbeiten statt neu bauen. | GLB (Platzhalter-Ring darunter) |

## 2 — Schützentürme

Ein Bogenschütze, der auf **Fels** oder im **Wald** gebaut wird, wird zum
Turm: unbeweglich, erhöht, eigene Silhouette. Beide Untergründe brauchen
ihr eigenes Gerüst — Stein im Fels, Holz in den Baumwipfeln.

| Datei | Inhalt | Ersetzt heute |
|---|---|---|
| `engineer/turm-fels.glb` | Steinturm ohne Figur; der Schütze wird oben daraufgesetzt. Plattformhöhe **0,5 Einheiten** | Sockel + Zinne (Kästen) |
| `engineer/turm-wald.glb` | Holzgerüst in den Wipfeln, gleiche Plattformhöhe | dasselbe Steinmodell |

## 3 — Bauten (Engineer)

| Datei | Inhalt | Ersetzt heute |
|---|---|---|
| `engineer/mauer-holz.glb` | Mauer Stufe 1: Holzpfähle, 1×1, kachelt nahtlos mit sich selbst | Kasten |
| `engineer/mauer-stein.glb` | Mauer Stufe 2: Stein, gleiche Kachellogik | Kasten (höher) |
| `engineer/mauer-fest.glb` | Mauer Stufe 3: Festungsmauer mit Wehrgang, gleiche Kachellogik | Kasten (noch höher) |
| `engineer/werkstatt-feld.glb` | **Ein Feld** der Werkstatt, kachelbar — siehe Kasten unten | roter Kasten je Feld |
| `engineer/werkstatt-aufbau.glb` | Kamin/Schornstein, kommt einmal je Werkstatt auf das erste Feld | dünner Kasten |
| `engineer/kanone.glb` | Stufe 1, flaches Rohr; Knoten `rohr` | Kasten + Walze |
| `engineer/moerser.glb` | Stufe 2, steiles Rohr; Knoten `rohr` | dasselbe, steiler gedreht |
| `engineer/haupthaus.glb` | Haupthaus mit Anbauten als eigene Knoten `ausbau2`, `ausbau3`, **`ausbau4`** (der Client blendet sie nach Stufe ein) | Kasten + Kegeldach |

> **Wichtig zur Werkstatt:** Sie ist **nicht** einfach 1×2. Zwei Werkstätten
> auf Stufe 2 verschmelzen zu einer größeren — und die kann eine **L- oder
> Z-Form** haben (vier Felder in einer 2×3-Box). Ein starres 1×2-Modell
> ließ sich darauf nur strecken, und genau das sah im Spiel wie ein
> riesiges Viereck aus. Deshalb: **ein Feldstück, das sich an jeder Kante
> nahtlos an sich selbst anschließt**, plus einen Aufbau, der einmal
> obendrauf kommt. Der Client setzt daraus jede Form zusammen.

## 4 — Gelände (für alle Charaktere)

| Datei | Inhalt | Ersetzt heute |
|---|---|---|
| `fels.glb` | Felsblock, 2–3 Formvarianten in einer Datei (Knoten `fels1`…). Feldweise gesetzt | zwei Kegel |
| `baum.glb` | Nadelbaum, 2 Varianten (`baum1`, `baum2`). Der Client stellt drei je Waldfeld | Stamm + Kegel ×3 |
| `see.glb` | Wasserfläche **eines Feldes** plus Uferstücke; ein See ist ein Block aus 1–3 Feldern und wird als Ganzes gebaut | flache Platte über den ganzen Block |
| `vulkan.glb` | Vulkankegel mit Krateröffnung. **Blockweise**: der Berg deckt 2×2 Felder ab, die Höhe wächst mit der Grundfläche (Glutschein kommt vom Spiel) | Kegel + Glutscheibe |
| `krater.glb` | Was nach dem Ausbruch bleibt: eingesunkene Senke, gleiche Blockmaße wie der Vulkan | flacher Kegel + Glutscheibe |

## 5 — Kleinteile und Effekte

| Datei | Inhalt | Ersetzt heute |
|---|---|---|
| `muenze.glb` | Münze des Rundenanfangs. Drei Materialien: `rand`, `kopf` (oben), `zahl` (unten) — der Client dreht sie so, dass die richtige Seite oben landet | Zylinder mit drei Farbflächen |
| `pfeil.glb` | Pfeil des Schützen, fliegt vom Bogen zum Ziel; Länge ~0,3 Einheiten | Schaft + Spitze |
| `kugel.glb` | Kanonenkugel, fliegt im Bogen | Kugel |
| `wrack-turm.glb` | Ausgebranntes Gestell, bleibt 15 s liegen, wo ein Felsturm fiel — das Feld ist so lange gesperrt | rote Kachel |
| `wrack-kanone.glb` | Dasselbe für eine gefallene Fels-Kanone | rote Kachel |

*Nicht als Modell nötig:* Rauch, Funken, Glut, Staub, Explosionen und die
Lebensbalken — die rechnet der Client als Partikel bzw. Sprites.

---

## Reihenfolge der Lieferung

1. **Was man am häufigsten sieht:** Haupthaus, Mauer (drei Stufen),
   Werkstatt-Feldstück, Schwertkämpfer, Bogenschütze.
2. **Das Auffällige:** Kanone/Mörser, beide Türme, Fels und Baum.
3. **Der Rest:** Vulkan, Krater, See, Münze, Geschosse, Wracks.

Der Ritter läuft nebenher: Er liegt vor und muss nur nachgearbeitet werden
(Größe, Clips, Materialnamen).

---

## Abnahmekriterien

1. Import in Three.js ohne Warnungen; Testszene: Modell auf einer
   1×1-Bodenkachel, Kamera leicht von oben aufgeklappt (Spielkamera:
   Neigung 10°, Abstand 17).
2. Maßstab, Pivot und Blickrichtung wie oben; nichts unter y = 0.
3. Silhouette bei 45 px Zellbreite lesbar (Handyprobe).
4. Materialien `spieler`/`stufe`/Knoten `rohr`, `ausbau2`…`ausbau4`
   vorhanden und exakt so benannt; Umfärben im Client funktioniert ohne
   Nacharbeit.
5. Clip-Namen exakt `stehen`/`gehen`/`schlagen`; Loops laufen sauber rund.
6. Kachelbare Teile (Mauer, Werkstatt-Feldstück, See) stoßen an jeder
   Kante nahtlos aneinander — Probe: vier Stück im Quadrat und in L-Form.

## Was NICHT ins Modell gehört

* Kein Boden, kein Sockel, kein Gras, kein Schattenfleck — der Untergrund
  kommt vom Spiel.
* Kein eingebrannter Text, keine Beschriftung, kein Logo.
* Keine Kamera, kein Licht, keine Umgebung in der Datei.
* Keine Originalauflösung unter `public/` — Originale ins Archiv
  (dreimal passiert bei Bildern, siehe CLAUDE.md Regel 4/5).
