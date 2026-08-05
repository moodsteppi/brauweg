# Bildbestellung: Biome mit nahtlosen Übergängen

Die sechs Biom-Kacheln des Trophäenpfads (`biom-1-heimat` … `biom-6-sternenhafen`,
senkrecht gestapelt in [`Pfad.tsx`](../packages/client/src/screens/Pfad.tsx))
werden **neu generiert**. Grund: An den Stößen passen sie nicht zusammen.
Mal steht dort Nebel, mal Wasser mit einer harten Kante — die Naht ist
sichtbar, statt dass ein Biom ins nächste übergeht.

**Diese Bestellung kehrt die alte Regel um.** Die erste Fassung
([ASSETS-BIOME.md](ASSETS-BIOME.md)) legte bewusst Wasser oder Nebel zwischen
die Kacheln, damit „jedes Biom eine Insel für sich" ist und die Reihenfolge
frei bleibt. Das wird jetzt aufgegeben: Der Pfad soll **ein durchgehender
Landstrich** sein, von der Heimat bis zum Sternenhafen, mit **fließenden
Übergängen**. Der Preis dafür ist, dass die **Reihenfolge festliegt** — die
Kacheln sind aufeinander abgestimmt und nicht mehr beliebig tauschbar. Das ist
gewollt.

**Jedes Biom behält seinen eigenen Charakter.** Die Mitte jeder Kachel ist
klar ihr Biom — Heimatwiese, Strand, Feuerberg, Schneefeld. Nahtlos ist nur
der **Rand**: Wo zwei Kacheln aufeinandertreffen, zeigen sie dasselbe Gelände.

---

## Die eine Regel, an der alles hängt

Die Kacheln liegen senkrecht, unten die Heimat, oben der Sternenhafen. **Der
untere Rand jeder Kachel und der obere Rand der Kachel darunter müssen
dasselbe Bild zeigen** — gleiche Farben, gleiche Bodenart, gleiche Linien, die
über die Naht laufen. Übereinandergelegt darf man die Naht nicht finden.

Fünf innere Nähte, feste Paare (von unten nach oben):

| Naht | oben endet … | … unten beginnt | Was an der Naht steht (beide gleich) |
| --- | --- | --- | --- |
| 1 | Heimat, oberer Rand | Wiesen, unterer Rand | dieselbe grüne Wiese, ein Weg/Zaun läuft durch |
| 2 | Wiesen, oberer Rand | Strand, unterer Rand | Dünengras, das ins Sandige kippt (grün-gold) |
| 3 | Strand, oberer Rand | Feuerberg, unterer Rand | dunkler Sand / erkaltetes Lavakies |
| 4 | Feuerberg, oberer Rand | Schneefeld, unterer Rand | schwarzes Gestein mit erstem Schnee überzuckert |
| 5 | Schneefeld, oberer Rand | Sternenhafen, unterer Rand | Schnee unter tiefblauer Dämmerung |

**Die Blendzone ist das oberste und unterste Zehntel** jeder Kachel: dort
liegt das Gelände waagerecht und ruhig, ohne einzelnes Wahrzeichen (kein Baum,
kein Haus, kein Felsen genau an der Kante), damit die zwei Kacheln sauber
aneinanderstoßen. Der **eigene Charakter des Bioms lebt in den mittleren 80 %**.

**Die beiden äußeren Ränder haben keinen Nachbarn:** der unterste Rand der
Heimat ist Ufer/Wasser (der Anfang), der oberste Rand des Sternenhafens ist
Nachthimmel (das Ziel). Nur diese zwei dürfen eine echte Kante sein.

**Der Weg bleibt, wie er ist** (die Figur läuft die Mittellinie):
- Er **betritt die Kachel unten bei genau 50 % der Breite**, **verlässt sie
  oben bei genau 50 %**.
- Auf den letzten 5 % vor jeder Kante läuft er **senkrecht** — kein Bogen kurz
  vor dem Rand.
- Dazwischen darf er sich schlängeln.

---

## So wird generiert, damit die Kanten sicher passen

**Der zuverlässigste Weg: alle sechs als EINEN hohen Streifen malen und dann
schneiden.** Ein Bild **1024 × 6144** (sechs Kacheln übereinander), von der
Heimat unten bis zum Sternenhafen oben durchgemalt, danach in sechs Stücke zu
**1024 × 1024** zerschnitten (das unterste ist `biom-1-heimat`, das oberste
`biom-6-sternenhafen`). So sind die Nähte bauartbedingt perfekt — sie sind
gar keine Nähte, nur Schnitte durch ein durchgehendes Bild.

Geht das in einem Stück nicht, dann **paarweise**: Kachel N+1 aus dem oberen
Rand von Kachel N heraus fortsetzen (Outpainting), sodass das unterste Zehntel
von N+1 das oberste Zehntel von N wiederholt. Die Tabelle oben ist in beiden
Fällen die Vorgabe.

---

## Für alle Kacheln verbindlich

**Format**
- **PNG, 1024 × 1024**, quadratisch, sRGB, **kein Alpha** (die Kachel füllt
  randlos, es liegt nichts darunter).
- Ausgeliefert wird als **WebP**; die Umwandlung passiert hier
  (`node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> szene`). Bitte PNG abgeben.
- **Originale nach `packages/client/art/`, nicht nach `public/`.** Unter
  `public/` gehört nur das WebP — Originalauflösung dort ist schon zweimal live
  gegangen (13,9 MB).

**Ton und Stil**
Wie die bisherigen Biome und die Hub-Bilder: gemalt, warm, satt, ein
Handyspiel von oben-schräg gesehen. Dieselbe Hand über alle sechs — Licht,
Sättigung und Pinselduktus gleich, sonst springt es an den Nähten trotz
passender Farben.

**Was NICHT ins Bild gehört**
- **Kein Text**, keine Zahl, kein Biom-Name (die Marken zeichnet der Client).
- **Kein Schachbrettmuster** als vermeintliche Transparenz.
- **Keine Bedienelemente**, kein Rahmen, kein Handyrand.
- **Keine Figur, kein Pinguin** — die Figur setzt der Client auf den Weg.
- **Kein einzelnes Wahrzeichen genau auf der Naht** (siehe Blendzone).

---

## Abnahme

1. Sechs Dateien, exakt `biom-1-heimat` … `biom-6-sternenhafen`, je
   1024 × 1024. Die Namen bleiben — **kein Code ändert sich**, nur die Bilder.
2. **Die fünf inneren Nähte sind unsichtbar:** die sechs Kacheln in der
   richtigen Reihenfolge senkrecht aneinandergelegt ergeben ein durchgehendes
   Bild ohne Linie, ohne Farbsprung, ohne Nebelstreifen.
3. Der Weg läuft durchgehend: er trifft jede Naht bei 50 % Breite und senkrecht,
   oben wie unten.
4. **Jedes Biom ist trotzdem für sich erkennbar** — die Mitte ist eindeutig
   Heimat / Wiesen / Strand / Feuerberg / Schneefeld / Sternenhafen.
5. Unterster Rand der Heimat = Ufer, oberster Rand des Sternenhafens =
   Nachthimmel; nur diese beiden sind eine echte Kante.
6. Kein eingebrannter Text, keine Figur, keine Originalauflösung unter `public/`.

---

## Einbau nach der Lieferung

Der Ablauf steht in [JETZT-AUSFUEHREN.md](JETZT-AUSFUEHREN.md). Die sechs
WebP unter gleichem Namen nach `packages/client/public/hub/` legen — die alten
ersetzen. **Kein Code ändert sich**, `Pfad.tsx` liest dieselben Dateinamen.
Nach dem Wandeln die Dateigröße prüfen (ein Biom liegt bei ~200 kB, nicht bei
1,7 MB) und den Pfad einmal abrollen: Läuft er ohne sichtbare Naht durch?
