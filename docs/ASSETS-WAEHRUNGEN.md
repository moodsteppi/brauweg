# Bildbestellung: Münzen und Edelsteine

Es gibt jetzt **zwei Währungen**. Münzen fallen aus Truhen und Tagesaufgaben,
Edelsteine nur aus Kauf oder Geschenk — es gibt bewusst keinen Wechselkurs
zwischen ihnen (`packages/server/src/waehrung.ts`).

Für die Münze liegt `muenze.png` im Ordner und bleibt. **Für den Edelstein gibt
es noch kein Bild**; in der Kopfzeile steht dafür ein gezeichnetes SVG
(`EdelsteinIcon` in `packages/client/src/hub.tsx`). Dazu kommen die
Shop-Pakete, die heute nur die Einzelgrafik in drei Größen zeigen.

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal**, sRGB.
- Originale nach `packages/client/art/waehrungen/`. Die Auslieferungsfassung als
  WebP erzeuge ich daraus — **Originale gehören nicht nach `public/`**.

**Echte Transparenz — der häufigste Fehler**
Kein Schachbrett-Muster und keine weiße oder schwarze Fläche als
„Transparenz". Probe: auf knallroten **und** auf weißen Grund legen. Beim
Schriftzug ist genau das schiefgegangen: Die Farbe war auf Schwarz gerechnet und
wirkte stumpf.

**Was NICHT ins Bild gehört**
- **Keine Zahlen und keine Schrift.** Die Menge („1.500 Münzen") und der Preis
  setzt die App als Text daneben — und die Preise sind laut Plan 13 noch nicht
  entschieden. Eine eingebrannte Zahl wäre nach einer Woche falsch.
- **Keine Euro- oder Prozentzeichen**, kein „Bestseller"-Band. Die Bald-Marke
  und der Spartipp sind Bausteine der App.
- Keine Bedienelemente, kein Rahmen.
- Kein Alkohol.

**Ton und Stil**
Wie `muenze.png` und `pokal.png`: gemalt, warm, satt, mit klarer Kante —
Handyspiel, kein Fotorealismus.

**Der Edelstein ist blaugrün, nicht lila.** Lila hat in Brauweg eine feste
Bedeutung: „kommt bald" (DESIGN.md). Ein lila Edelstein neben einer lila
Bald-Marke wäre die eine Verwechslung, die man sich hier nicht leisten kann.
Gold gehört der Münze.

---

## 1 — Das Edelstein-Zeichen

`edelstein.png` — **128 × 128**, Motiv mittig, ringsum etwas Luft.

**Wozu:** Die Pille oben rechts in der Ressourcen-Leiste, neben der Münze. Dort
ist es **20 Pixel groß** — das ist die eigentliche Anforderung.

**Motiv:** Ein geschliffener Stein, Draufsicht leicht schräg, sechs- oder
achtflächig, in Blaugrün (Türkis bis Petrol). Deutliche Facetten mit einem
hellen Glanzpunkt oben links und einer dunklen Fläche unten rechts — die
Facetten sind es, die den Stein bei 20 Pixeln noch als Stein lesbar machen.

**Abnahme:** Auf **20 × 20 px** verkleinert neben `muenze.png` gelegt sind
beide auf einen Blick zu unterscheiden — nicht nur an der Farbe, sondern an der
Silhouette: die Münze rund, der Stein eckig.

---

## 2 — Münzpakete (3 Bilder)

**Maße:** je **384 × 384**, freigestellt.
**Ablage:** `packages/client/public/hub/waehrungen/`

| Datei | Motiv |
| --- | --- |
| `paket-muenzen-klein.png` | Eine kleine Handvoll Münzen, lose gehäuft — sechs bis acht Stück. |
| `paket-muenzen-mittel.png` | Ein prall gefüllter Lederbeutel, oben offen, Münzen quellen heraus. |
| `paket-muenzen-gross.png` | Eine offene Holzkiste voller Münzen, ein paar davor verstreut. |

**Steigerung:** Die drei müssen nebeneinander eine erkennbare Reihe ergeben —
mehr Münzen, größerer Behälter. Gleiche Lichtquelle (schräg oben links), gleiche
Blickrichtung. Wer das mittlere Paket für das größte hält, kauft das falsche.

**Wichtig:** Die Kiste im großen Paket darf **nicht wie eine Truhe aussehen** —
Truhen sind im Spiel etwas anderes (siehe [ASSETS-TRUHEN.md](ASSETS-TRUHEN.md))
und stehen zwei Bildschirme weiter. Also flache Kiste ohne Deckelwölbung, ohne
Schloss, ohne Beschläge.

---

## 3 — Edelsteinpakete (3 Bilder)

`paket-edelsteine-klein.png`, `-mittel.png`, `-gross.png` — **gleiche Maße**.

Dieselbe Staffelung mit Edelsteinen statt Münzen, in derselben blaugrünen
Familie wie Nummer 1. Gern gemischte Schliffe und ein oder zwei Steine in einem
zweiten Ton (tiefes Blau), damit ein Haufen nicht wie ein Klumpen wirkt.

- klein: eine Handvoll, vier bis sechs Steine
- mittel: Beutel, Steine quellen heraus
- groß: offene Kiste voller Steine

**Abnahme für 2 und 3:** Alle sechs Pakete nebeneinander auf **90 px Breite**
(so groß sind sie im Shop). Man erkennt in jeder Zeile die Steigerung und
zwischen den Zeilen die Währung.

---

## 4 — Zwei Pässe (optional)

Im Ordner liegen `season-pass.png` und `shop-vip.webp`. Sie stehen im Shop als
Pass-Kacheln und **funktionieren**. Wenn die Reihe einheitlich werden soll:

`pass-vip.png` und `pass-season.png`, **384 × 384**, freigestellt, im Stil der
Pakete — VIP mit Krone (dafür gibt es `krone.png` als Vorlage), Season mit einem
Wegweiser oder Wimpel.

**Ohne diese zwei Bilder ist nichts kaputt.** Sie stehen hier nur, weil eine
Regalreihe aus vier gemalten Paketen und einer alten PNG-Kachel auffällt.

---

## Abnahme, gesamt

1. **Sieben Dateien** (Zeichen plus sechs Pakete), exakt so benannt.
2. Das Edelstein-Zeichen ist bei **20 px** von der Münze unterscheidbar, an der
   Silhouette.
3. Die Pakete ergeben je Währung eine lesbare Leiter, bei 90 px Breite.
4. Kein Bild enthält Zahlen, Preise oder Schrift.
5. Alphaprobe auf Rot und auf Weiß, gleich hell, ohne Saum.

---

## Danach

1. **Umwandeln:** Zeichen auf 64 px (dreifache Anzeigegröße von 20), Pakete auf
   288 px. Dann WebP Qualität 85 — die freigestellten Kleinteile dürfen laut
   DESIGN.md auch PNG bleiben, wenn die Kanten davon sichtbar profitieren.
2. **Ablegen** unter `packages/client/public/hub/waehrungen/`, Originale nach
   `packages/client/art/waehrungen/`.
3. **Einbauen:** `EdelsteinIcon` in `packages/client/src/hub.tsx` wird von einem
   gezeichneten SVG zu einem `<img>`; die Klasse `front-waehrung-icon` bleibt und
   trägt schon die Maße. In `PaketKachel`
   (`packages/client/src/screens/GameSelect.tsx`) tritt an die Stelle der
   einzelnen Münz- und Steingrafik das jeweilige Paketbild — der Katalog liefert
   dafür schon `paket.id`.

**Die Pakete selbst werden nicht angefasst.** Was ein Paket enthält und was es
kosten soll, steht am Server (`packages/server/src/shop.ts`). Die Cent-Beträge
dort sind Platzhalter: **Es gibt keinen Bezahlweg und keinen Endpunkt zum
Kaufen**, jede Kachel öffnet das „Kommt bald"-Blatt.
