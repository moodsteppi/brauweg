# Bildbestellung: Zauberer

Das zweite Spiel der Plattform ist gebaut und **vollständig spielbar** — es
läuft auf dem Textblatt und den vorhandenen Tischszenerien. Diese Bestellung
gibt ihm sein eigenes Gesicht: ein gemaltes 60-Karten-Blatt, zwei
Zauber-Szenerien und die Trumpf-Plakette.

**Nichts davon blockiert etwas.** Bis zur Lieferung läuft alles auf den
vorhandenen Bildern und dem Textblatt weiter.

Regelwerk und Begriffe stehen in [wizard-spec.md](wizard-spec.md), die
Gestaltungsregeln in [DESIGN.md](DESIGN.md) und
[DESIGN-DOKO.md](DESIGN-DOKO.md) (die gelten für den Tisch unverändert).

---

## Für alle Bilder verbindlich

**Format**
- Karten: **PNG mit echtem Alphakanal**, 420 × 610 px (Verhältnis 1 : 1,45 wie
  `--pc-ratio`). Ausgeliefert wird später als WebP Qualität 85 — bitte trotzdem
  PNG liefern, die Umwandlung passiert hier.
- Ganzseitige Szenerien: PNG, **1024 × 1536** (Hochkant 2:3), sRGB.
- Freigestellte Einzelteile: PNG mit Alphakanal.

**Echte Transparenz — der häufigste Fehler**
Kein Schachbrettmuster und keine weiße Fläche als „Transparenz". Das ist
zweimal passiert und musste danach von Hand herausgerechnet werden. Zur Probe:
Bild auf knallroten Grund legen — sichtbar ist nur, was sichtbar sein soll,
ohne hellen Saum.

**Was NICHT ins Bild gehört**
- **Keine Schrift**, außer den ausdrücklich bestellten Kartenwerten (siehe
  Abschnitt 1). Keine Überschriften, keine Namen, keine Zahlen sonst.
- **Keine Bedienelemente**, keine Knöpfe, keine Leisten, kein Handyrahmen.
- **Kein Alkohol** — keine Krüge, Fässer, Hopfen, auch nicht als Wortspiel.
- **Keine Markenzeichen.** Das Spiel heißt bei uns **Zauberer**; das Wort
  „Wizard" und jede Anlehnung an die Aufmachung des Originalspiels (Amigo)
  gehören nicht ins Bild. Eigene Figuren, eigene Handschrift.

**Ton und Stil**
Wie die vorhandenen Bilder (`weltkarte.png`, `bg-shop.png`, `bg-clan.png`):
gemalt, warm, satt, freundlich — Handyspiel, kein Fotorealismus, kein
Comic-Umriss. Die Zauberwelt darf kühler und nächtlicher sein als die
Wirtshaus-Szenen des Doppelkopfs, aber es bleibt dieselbe Hand.

**Lesbarkeit geht vor Motiv.** Auf einem Hochkant-Handy liegen bis zu zwanzig
Handkarten nebeneinander; von den meisten ist nur ein **schmaler Streifen am
linken Rand** sichtbar. Alles, was eine Karte identifiziert, gehört in diesen
Streifen.

---

## 1 — Das Kartenblatt (60 Motive)

**Wo:** Hand, Stich, letzter Stich, Trumpf-Plakette, Blattvorschau.
**Ablage:** `packages/client/public/karten/zauberwald/`

### 1a — Zahlenkarten, 52 Stück

Vier Farben zu je dreizehn Werten. **Französische Farben** wie im
Doppelkopfblatt, damit dieselben Symbole überall dasselbe heißen:

| Farbe | Zeichen | Dateien |
| --- | --- | --- |
| Kreuz | ♣ | `kreuz_1.png` … `kreuz_13.png` |
| Pik | ♠ | `pik_1.png` … `pik_13.png` |
| Herz | ♥ | `herz_1.png` … `herz_13.png` |
| Karo | ♦ | `karo_1.png` … `karo_13.png` |

**Aufbau jeder Zahlenkarte**
- **Oben links, groß: die Zahl (1–13) und darunter das Farbzeichen.** Beides
  muss in den **linken 22 % der Kartenbreite** liegen und dort auch allein
  lesbar sein. Das ist die wichtigste Anforderung der ganzen Bestellung.
- Der Rest der Karte trägt das Motiv der Farbe (siehe unten), gern mit der
  Zahl noch einmal groß in der Mitte oder als Anzahl von Symbolen.
- **Kein Kopfstand-Duplikat** (keine gedrehte Wiederholung unten rechts) — auf
  dem Handy kostet das nur Fläche.
- Ecken abgerundet (Radius ≈ 6 % der Breite), heller Kartengrund.

**Motivwelt je Farbe** — vier Reiche, an denen man die Farbe auch ohne Zeichen
erkennt:

| Farbe | Reich | Grundton |
| --- | --- | --- |
| Kreuz ♣ | **Wald** — Blätter, Ranken, Pilze | tiefes Grün |
| Pik ♠ | **Berg** — Kristall, Fels, Schnee | Blaugrau |
| Herz ♥ | **Feuer** — Glut, Laternen, Funken | Warmrot |
| Karo ♦ | **Wasser** — Wellen, Sterne, Nacht | Tiefblau |

Herz und Karo müssen als **rote bzw. helle Farben** von Kreuz und Pik auf
einen Blick unterscheidbar bleiben — im Zweifel gilt Lesbarkeit vor
Farbkonzept.

**Steigerung mit dem Wert:** Die 1 ist schlicht, die 13 ist die prächtigste
Karte der Farbe. Der Sprung darf sichtbar sein, muss aber gleichmäßig laufen —
niemand soll die 9 für höher halten als die 11.

### 1b — Vier Zauberer, jeder ein eigenes Motiv

`zauberer_1.png` … `zauberer_4.png`

Vier verschiedene Figuren, alle unverkennbar Zauberer, je eine zu einem der
vier Reiche (Wald, Berg, Feuer, Wasser). **Trotzdem gleich stark:** Keine
Figur darf mächtiger wirken als die anderen — im Spiel sind alle vier
gleichwertig, es zählt nur, wer sie zuerst legt.

- **Oben links, groß: ein „Z"** im selben Feld, in dem sonst die Zahl steht.
  Das ist die Zeile, die im schmalen Streifen sichtbar bleibt.
- Deutlich anderer Kartengrund als bei den Zahlenkarten (dunkler, mit Aura) —
  ein Zauberer soll im Fächer sofort auffallen.
- Gern ein wiederkehrendes Zeichen bei allen vieren (z. B. derselbe Sternkranz),
  damit sie als Satz erkennbar sind.

### 1c — Vier Narren, jeder ein eigenes Motiv

`narr_1.png` … `narr_4.png`

Vier verschiedene Gaukler, ebenfalls je einem Reich zugeordnet, ebenfalls
gleichwertig. **Freundlich, nicht erniedrigend:** Der Narr verliert jeden
Stich, aber er ist keine Strafe — er ist die Karte, mit der man sich elegant
aus einem Stich heraushält.

- **Oben links, groß: ein „N"**, dieselbe Stelle wie oben.
- Hellerer, luftigerer Grund als bei den Zauberern.

### 1d — Rückseite

`ruecken.png` — ein Motiv, das ohne Oben und Unten funktioniert
(Sternenmuster, Zaubersiegel). Fremde Hände liegen als kleine Reihen
übereinander; das Muster muss auch **auf 20 % Breite** noch ruhig wirken.

### Abnahme des Blatts

1. Alle 60 Dateien vorhanden, exakt so benannt, gleiche Maße.
2. Auf 60 px Breite verkleinert ist an **jeder** Karte im linken Streifen
   Wert und Farbe erkennbar.
3. Zauberer und Narr sind bei dieser Größe voneinander und von jeder
   Zahlenkarte unterscheidbar.
4. Nebeneinandergelegt wirken die vier Farben gleich hell — keine Farbe
   verschwindet gegen die anderen.

---

## 2 — Zwei Tischszenerien

**Wo:** Hintergrund des Zaubertisches (`szeneBild`), wählbar wie die acht
vorhandenen Szenerien.
**Ablage:** `packages/client/public/hub/`
**Maße:** 1024 × 1536

Über dem Bild liegen Karten, Namen und Zahlen. **Die Mitte muss ruhig und
eher dunkel sein** — dort liegt der Stich. Details gehören an die Ränder.

**Beschnitt:** Auf hohen Handys bleiben verlässlich nur die **mittleren 70 %
der Breite** sichtbar (15 % bis 85 %). Die volle Höhe bleibt.

| Datei | Motiv |
| --- | --- |
| `szene-zauberturm.png` | Studierstube in einem Turm: dunkles Holz, Kerzen, Bücherregale, ein Fenster mit Nachthimmel. Warmes Licht von schräg oben, Mitte flächig ruhig. |
| `szene-sternenwiese.png` | Freiluft-Tisch unter Sternen: Wiese, ein Lagerfeuer außerhalb der Bildmitte, Lichterketten zwischen zwei Bäumen. Kühler Grundton, ruhige Mitte. |

**Zonen (beide Bilder)**

| Höhe | Was dort liegt | Anforderung |
| --- | --- | --- |
| 0–10 % | Kopfzeile: Runde, Trumpf, Symbolknöpfe | ruhig, dunkel |
| 10–70 % | **Mitspieler, Stich, Trumpf-Plakette** | sehr ruhig, gleichmäßig; hier liegt alles Wichtige |
| 70–85 % | Eigener Bereich (Name, Gebot) | ruhig |
| 85–100 % | Handkarten von Rand zu Rand | ruhig, dunkel |

---

## 3 — Trumpf-Plakette

`plakette-trumpf.png` — freigestellt, ca. 240 × 300 px.

Ein kleiner gemalter Rahmen, in dem die **aufgedeckte Trumpfkarte** steckt:
Holz oder Metall, mit einem Haken oder Ring oben, als hinge er am Tisch. Innen
ein **freies Feld von 200 × 290 px**, in das die App die Karte setzt — das Feld
bleibt vollständig transparent.

Unter dem Rahmen setzt die App die Zeile „Trumpf ♦". Der untere Rand darf
deshalb nicht in einer Spitze auslaufen.

---

## 4 — Was NICHT bestellt wird

- **Kein Bild für die Spielauswahl.** Die Kachel ist ein gemaltes SVG im Code
  (`SpielBild` in `GameSelect.tsx`), so wie bei allen anderen Spielen.
- **Keine Regelkacheln.** Die sieben Hausregeln tragen Zeichen aus
  `regelbilder.ts`.
- **Keine Symbole für Gebote.** Die Zahlen setzt die App.

---

## 5 — Einbau nach der Lieferung

Damit die Bilder nicht nur herumliegen, hier der Weg — drei Schritte:

1. **Verkleinern und umwandeln.** Karten auf dreifache Anzeigegröße, dann WebP
   Qualität 85. Originale nach `packages/client/art/`, **niemals** unter
   `public/`.
2. **Blatt eintragen:** ein Eintrag in `DECKS` (`packages/client/src/decks.ts`)
   mit `dir: 'zauberwald'`, dazu die Kennung in `CARD_DECKS`
   (`packages/server/src/decks.ts`) und ein `deck.*`-Eintrag im Wörterbuch.
   **Wichtig:** `decks.ts` bildet Rang auf Dateiname ab (`RANK_DIR`). Für
   Zahlen 1–13 sowie `Z` und `N` muss diese Tabelle ergänzt werden, sonst
   fällt das Blatt still auf Text zurück.
3. **Blattauswahl je Spiel filtern.** Der Blatt-Wähler zeigt heute jedes Blatt
   für jedes Spiel. Ein Zauberblatt an einem Doppelkopftisch hätte für Bube,
   Dame und König keine Dateien. Deshalb bekommt `Deck` ein Feld `games?:
   string[]`, und der Wähler zeigt nur, was zum gewählten Spiel passt. **Ohne
   diesen Schritt ist die Lieferung nicht einbaubar.**

Danach: Szenerien in `szenen.ts` und `packages/server/src/scenes.ts`
eintragen, Plakette in `styles.css` an `.wiz-trumpf` hängen.
