# Feldherr — Bestellung der 3D-Modelle (Stufe 2)

Kontext: `docs/FELDHERR-3D-UMBAU.md`. Die gemalten Figuren des 2D-Renderers
werden durch 3D-Modelle ersetzt; gezeichnet wird mit Three/R3F im Client
(Vorbild Pro-Subway, Modelle dort unter `packages/client/public/3d/`).
Ein Ritter-GLB liegt beim Auftraggeber bereits vor — es ist die
Stilreferenz und wird gegen die Vorgaben hier abgeglichen.

Das Brett ist fest **8 × 12 Felder, quadratische Zellen** (Geometrie-Entscheid
vom 7. August 2026). Auf Handybreite misst eine Zelle rund 45 px — jede
Silhouette muss in dieser Größe lesbar bleiben.

---

## Technische Vorgaben (gelten für jedes Modell)

* **Format:** glTF 2.0 binär (`.glb`), ohne Draco. Y ist oben, das Modell
  blickt nach **−Z** (glTF-Konvention) — Truppen und Rohre richtet der
  Client per Drehung aus.
* **Maßstab: 1 Einheit = 1 Feldkante.** Ein 1×1-Bau füllt höchstens
  0,9 × 0,9 Grundfläche, eine Truppe ~0,6 Durchmesser, das Werk (1×2)
  höchstens 0,9 × 1,9.
* **Ursprung:** Mitte der Grundfläche auf Bodenhöhe (y = 0). Nichts ragt
  unter y = 0.
* **Polygonbudget:** Truppe ≤ 3 000 Dreiecke, Bau ≤ 5 000, Geländestück
  ≤ 1 500. Ziel-Look: Low-Poly mit Flächenschattierung, passend zur
  bisherigen Farbwelt des Spiels.
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
* **Dateigröße:** ≤ 200 kB je GLB.
* **Ablage:** Original ins Archiv `moodsteppi/brauweg-art`; ausgeliefert
  wird unter `packages/client/public/3d/feldherr/` (Regel 4 sinngemäß).

---

## Erste Lieferung

| Datei | Inhalt |
|---|---|
| `schwert.glb` | Schwertkämpfer, Clips stehen/gehen/schlagen, Material `stufe` |
| `bogen.glb` | Bogenschütze, wie oben; zusätzlich Variante `bogen-turm.glb` (Schütze im Steinturm, statisch) |
| `ritter.glb` | liegt vor — gegen diese Vorgaben prüfen (Maßstab, Pivot, Clips, Materialnamen) |
| `mauer-holz.glb` | Mauer Stufe 1: Holzpfähle, 1×1, kachelt nahtlos mit sich selbst |
| `mauer-stein.glb` | Mauer Stufe 2: Stein, gleiche Kachellogik |
| `mauer-fest.glb` | Mauer Stufe 3: Festungsmauer mit Wehrgang, gleiche Kachellogik |
| `werk.glb` | Produktionsgebäude 1×2; Ausbaustufen über Material `stufe` |
| `kanone.glb` | Stufe 1, flaches Rohr; Knoten `rohr` |
| `moerser.glb` | Stufe 2, steiles Rohr; Knoten `rohr` |
| `haupthaus.glb` | Haupthaus; Anbauten der Stufen 2 und 3 als eigene Knoten `ausbau2`, `ausbau3` (der Client blendet sie ein) |
| `fels.glb` | Felsblock, 2–3 Formvarianten in einer Datei (Knoten `fels1`…) |
| `baum.glb` | Nadelbaum, 2 Varianten (`baum1`, `baum2`) |
| `vulkan.glb` | Vulkankegel mit Krateröffnung (der Glutschein kommt vom Spiel) |
| `wrack.glb` | ausgebranntes Gestell für gefallene Fels-Stellungen |

Zweite Lieferung (nach Sichtung der ersten): Werk-`arbeiten`-Loop,
Mauer-Übergangsstücke, Ufer-/Seerand-Stücke für die abgerundeten Seen aus
der Anforderungsliste.

---

## Abnahmekriterien

1. Import in Three.js ohne Warnungen; Testszene: Modell auf einer
   1×1-Bodenkachel, Kamera leicht von oben aufgeklappt (Spielkamera).
2. Maßstab, Pivot und Blickrichtung wie oben; nichts unter y = 0.
3. Silhouette bei 45 px Zellbreite lesbar (Handyprobe).
4. Materialien `spieler`/`stufe`/Knoten `rohr` u. a. vorhanden und exakt so
   benannt; Umfärben im Client funktioniert ohne Nacharbeit.
5. Clip-Namen exakt `stehen`/`gehen`/`schlagen`; Loops laufen sauber rund.

## Was NICHT ins Modell gehört

* Kein Boden, kein Sockel, kein Gras, kein Schattenfleck — der Untergrund
  kommt vom Spiel.
* Kein eingebrannter Text, keine Beschriftung, kein Logo.
* Keine Kamera, kein Licht, keine Umgebung in der Datei.
* Keine Originalauflösung unter `public/` — Originale ins Archiv
  (dreimal passiert bei Bildern, siehe CLAUDE.md Regel 4/5).
