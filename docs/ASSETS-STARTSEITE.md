# Bildbestellung: Startseite (Trophäenpfad)

Die Weltkarte selbst ist gut — `weltkarte.png` hat die Inseln, die Biome und
die satten Farben, um die es geht. Was darauf liegt, ist aber noch kein Bild:
**Die Wegpunkte sind CSS-Farbverläufe, die Ortsnamen sind Textpillen.** Genau
diese beiden Stellen lassen die Seite flacher wirken als den Entwurf.

Diese Bestellung schließt die Lücke. Es sind sieben Dateien.

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal**, sRGB.
- **Kein Schachbrett-Muster** und **keine weiße Fläche** als „Transparenz".
  Probe: auf knallroten Grund legen — sichtbar ist nur, was sichtbar sein
  soll, ohne hellen Saum. Das ist uns schon dreimal passiert.

**Bitte in voller Auflösung liefern.** Ich verkleinere und wandle selbst um.
Nicht vorher herunterrechnen: Was einmal weich ist, wird nicht wieder scharf.

**Was NICHT ins Bild gehört**
- **Keine Schrift, keine Zahlen.** Zahlen und Ortsnamen setzt die App — sie
  ändern sich mit dem Spielstand und müssen übersetzbar bleiben.
- Kein Handyrahmen, keine Bedienleisten, kein Alkohol.

**Ton und Stil**
Wie `weltkarte.png` und `truhe.png`: gemalt, plastisch, kräftig, warmes Licht
von oben links. Handyspiel, kein Fotorealismus, kein Comic-Umriss.

---

## 1 bis 6 — Wegpunkte `knoten-*.png`

**Wo:** Die runden Marken auf dem Weg, eine je Trophäen-Abschnitt.
**Format:** PNG mit Alpha, **512 × 512**, Marke mittig, bei allen sechs
**exakt gleich groß und gleich ausgerichtet** — sie liegen auf demselben Weg
untereinander, jede Abweichung fällt sofort auf.

**Motiv:** Eine runde, leicht gewölbte Steinplatte, in einen Metallring
gefasst, wie eine Trittplatte im Boden. Glanzlicht oben links, weicher
Schattenwurf unten. Die Mitte ist die farbige Fläche.

**Die Mitte muss frei bleiben:** Auf die inneren **60 %** setzt die App die
Zahl. Dort also **keine Verzierung, kein Muster, kein Glanzstreifen** — nur
gleichmäßige Farbe, sonst wird die Zahl unlesbar.

| Datei | Farbe | Gehört zu |
| --- | --- | --- |
| `knoten-mint.png` | Frisches Grün | Wiesen |
| `knoten-blau.png` | Meerblau | Strand |
| `knoten-rot.png` | Lavarot | Feuerberg |
| `knoten-lila.png` | Violett | Schneefeld |
| `knoten-gold.png` | Gold, kräftiger Ring | Sternenhafen (der letzte) |
| `knoten-zu.png` | Grauer Stein, matt | Noch nicht erreicht |

Bei `knoten-zu.png` gehört **ein geschlossenes Vorhängeschloss in die Mitte**
— dort steht dann keine Zahl. Bei den anderen fünf bitte **kein** Schloss.

`knoten-gold.png` darf etwas aufwendiger sein als die anderen: Es ist das
Ziel des ganzen Wegs.

---

## 7 — `wegschild.png` (dehnbar)

**Wo:** Das Ortsschild neben jedem Wegpunkt — „WIESEN", „STRAND",
„FEUERBERG", „SCHNEEFELD", „STERNENHAFEN".
**Format:** PNG mit Alpha, **480 × 200**.

**Motiv:** Ein waagerechtes Holzbrett auf zwei kurzen Pfosten, wie ein
Wegweiser am Wanderweg. Verwittertes Holz, warme Maserung, schmale dunkle
Kante. Freundlich, nicht mittelalterlich-düster.

**Aufbau — bitte genau so, sonst kann ich es nicht dehnen:**
- Der Rahmen ist **exakt 40 Pixel** an allen vier Seiten.
- Die **innere Fläche (400 × 120)** ist ruhig und gleichmäßig, ohne Ecken
  und ohne Verlauf — sie wird gedehnt, wenn ein Name länger ist. Eine
  auffällige Maserung dort würde bei „STERNENHAFEN" verzerren.
- Die Pfosten gehören in die **unteren 40 Pixel**, also in den Rahmen.

**Ein Schild für alle Orte.** Keine fünf Varianten — der Name kommt als
Text darüber, und fünf leicht verschiedene Bretter würden unruhig wirken.

**Wichtig:** Das Schild wird nur etwa **90 Pixel breit** angezeigt. Feine
Maserung und dünne Nägel verschwinden dort — lieber kräftig und einfach.

---

## Was ich bewusst NICHT bestelle

- **Die Weltkarte** bleibt, wie sie ist. Sie ist gut.
- **Ortsnamen als Bild.** Sie stehen als Text auf dem Schild, damit wir sie
  ändern und später übersetzen können.
- **Die Bäume im Vordergrund** (`baum-kiefer.png`, `baum-palme.png`) bleiben.
- **Truhe für die tägliche Belohnung** aus dem Entwurf: Die gibt es als
  Funktion noch nicht. Sobald sie kommt, reicht `truhe.png`.

---

## Ablage

Alles nach `packages/client/public/hub/` unter genau diesen Namen.

**Es liegen bereits Platzhalter unter diesen Namen** — aus einfachen Formen
gerendert, damit die Seite schon jetzt vollständig läuft. Die echten Bilder
überschreiben sie einfach; am Code ist dafür nichts zu ändern.

## Prüfung vor der Übergabe

1. Kein Text, keine Zahlen im Bild.
2. Die sechs Wegpunkte übereinandergelegt: gleiche Größe, gleiche Position,
   gleiche Lichtquelle.
3. Ein Wegpunkt auf 44 Pixel verkleinert: Ring noch erkennbar, Mitte noch
   ruhig genug für eine Zahl?
4. Das Schild auf 90 Pixel verkleinert: noch als Holzbrett lesbar?
5. Freigestellte Teile auf rotem Grund geprüft: echtes Alpha, kein
   Schachbrett, kein heller Saum.
