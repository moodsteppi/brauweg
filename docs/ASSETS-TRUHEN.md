# Bildbestellung: Truhen

Truhen sind da: eine **Tagestruhe**, die jeden Tag einmal bereitsteht, und
**elf Stufentruhen**, die mit den Stufen 2, 3, 5, 8, 12, 16, 20, 25, 30, 40 und
50 aufgehen. Fünf Gradstufen, von Holz bis Diamant. Drin sind Münzen, sonst
nichts.

**Alles funktioniert schon** — die Truhen sind gezeichnete SVGs in
`packages/client/src/screens/Aufgaben.tsx`, der Grad steckt in der Farbe. Diese
Bestellung tauscht sie gegen gemalte Bilder.

Im Ordner liegt bereits ein `truhe.png`. Es bleibt: Es ist der Knopf am rechten
Rand des Startbildschirms und muss dort keine Gradstufe zeigen.

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal**, sRGB.
- Originale nach `packages/client/art/truhen/`. Die Auslieferungsfassung als
  WebP erzeuge ich daraus — **Originale gehören nicht nach `public/`**. So sind
  schon einmal 13,9 MB mitgeliefert und ausgeliefert worden.

**Echte Transparenz — der häufigste Fehler**
Kein Schachbrett-Muster und keine weiße oder schwarze Fläche als
„Transparenz". Probe: auf knallroten **und** auf weißen Grund legen — sichtbar
ist nur die Truhe, ohne Saum, in beiden Fällen gleich hell.

**Was NICHT ins Bild gehört**
- **Keine Schrift und keine Zahlen.** Die Spanne („1 bis 3 Münzen") setzt die
  App als Text daneben, und sie kann sich ändern.
- **Keine Münzen und keine Edelsteine im geschlossenen Zustand** — sonst
  verrät das Bild den Inhalt, bevor jemand tippt.
- Keine Bedienelemente, kein Rahmen, kein Schlagschatten nach außen (den setzt
  die App über CSS).
- Kein Alkohol.

**Ton und Stil**
Wie die vorhandenen Hub-Bilder: gemalt, warm, satt, freundlich — Handyspiel,
kein Fotorealismus.

**Lesbar bei 46 Pixeln.** In der Liste ist eine Truhe 2,9 rem breit. Der Grad
muss auf einen Blick zu erkennen sein, und zwar **an der Form, nicht nur an der
Farbe**: Rot-Grün-Schwäche ist laut Plan 13 ein offener Punkt, und Silber gegen
Gold ist auch für andere Augen knapp. Also: mehr Beschläge, mehr Zierrat, andere
Deckelform mit steigendem Grad.

---

## 1 — Die fünf Truhen, geschlossen

**Maße:** je **384 × 336** px (Verhältnis 8 : 7 wie der heutige Rahmen).
Die Truhe steht mittig, ringsum etwas Luft.
**Ablage:** `packages/client/public/hub/truhen/`

| Datei | Grad | Motiv |
| --- | --- | --- |
| `truhe-holz.png` | Holz | Schlichte Holzkiste, zwei Eisenbänder, einfaches Schloss. Kein Zierrat. Das ist die Tagestruhe — sie soll freundlich sein, nicht armselig. |
| `truhe-bronze.png` | Bronze | Dieselbe Bauform, Bänder und Schloss aus Bronze, Ecken beschlagen. |
| `truhe-silber.png` | Silber | Kräftigere Beschläge, Deckel leicht gewölbt, Silberbeschlag mit feiner Gravur. |
| `truhe-gold.png` | Gold | Gewölbter Deckel, Goldbeschläge, Zierleisten an den Kanten, größeres Schloss. |
| `truhe-diamant.png` | Diamant | Die prächtigste: hell, mit Kristallen an den Ecken und einem großen Stein am Schloss. Ein feines Leuchten am Schloss ist erlaubt — aber **kein Lichtkegel ins Bild**. |

**Steigerung:** Die Reihe muss nebeneinandergelegt eine erkennbare Leiter
ergeben. Niemand soll Silber für wertvoller halten als Gold. Gleiche
Blickrichtung, gleiche Grundstellung, gleiche Lichtquelle (von schräg oben
links) — nur Material und Zierrat wachsen.

---

## 2 — Die fünf Truhen, offen

`truhe-holz-offen.png` … `truhe-diamant-offen.png`, **gleiche Maße**.

Derselbe Blickwinkel, Deckel nach hinten offen, Truhe **leer** — was drin war,
schreibt die App als Zahl daneben. Ein leiser Lichtschein aus dem Inneren ist
erlaubt.

**Wozu zwei Zustände:** Eine geholte Truhe bleibt in der Liste stehen, damit man
sieht, dass es gestern etwas gab. Offen und ausgegraut sagt „war schon", ohne
eine Zeile Text.

**Abnahme:** Offen und geschlossen übereinandergelegt sitzt der Korpus an
derselben Stelle — sonst springt die Truhe beim Öffnen.

---

## 3 — Der Aufgeh-Moment (optional, ein Bild)

`truhe-strahlen.png` — **768 × 768**, PNG mit Alpha.

Ein Strahlenkranz, der beim Öffnen hinter der Truhe aufgeht. Freigestellt, ohne
Grund, **innen ruhig**: Die App setzt Truhe und Fundzahl mittig darüber, die
inneren 40 % bleiben also frei.

Dasselbe Muster wie `stufe-auf.png` aus [ASSETS-STUFEN.md](ASSETS-STUFEN.md) —
wenn beide geliefert werden, dürfen sie sich ähnlich sehen, das ist erwünscht.

**Ohne dieses Bild funktioniert alles.** Der Fund erscheint dann auf dem
schlichten Blatt, so wie heute.

---

## Abnahme, gesamt

1. **Zehn Dateien** (fünf zu, fünf offen), exakt so benannt, alle 384 × 336.
2. Nebeneinandergelegt ergeben die fünf Grade eine Leiter, die man **ohne
   Farbwahrnehmung** noch lesen kann — an Form und Zierrat.
3. Auf 46 px Breite ist jede Truhe noch eine Truhe und der Grad noch zu ahnen.
4. Alphaprobe auf Rot und auf Weiß, gleich hell, ohne Saum.
5. Keine Schrift, keine Zahlen, kein Inhalt im geschlossenen Zustand.

---

## Danach

Der Einbau ersetzt `TruhenBild` in
`packages/client/src/screens/Aufgaben.tsx` — die Funktion zeichnet heute Deckel
und Korpus und wird zu einem `<img>` mit `truhe-${grad}${offen ? '-offen' : ''}`.

1. **Umwandeln:** auf dreifache Anzeigegröße (2,9 rem ≈ 46 px, in der
   Fundanzeige 6 rem ≈ 96 px → 288 px reichen), dann WebP Qualität 85.
2. **Ablegen** unter `packages/client/public/hub/truhen/`, Originale nach
   `packages/client/art/truhen/`.
3. Der CSS-Selektor `.truhe-bild` trägt schon die Maße und den Schatten; er
   greift für `<img>` genauso wie für `<svg>`.

**Die Grade selbst werden nicht angefasst.** Welche Truhe welchen Grad hat und
was sie ausschüttet, steht am Server (`packages/server/src/truhen.ts`).

**Keine Platzhalter unter diesen Namen.** Bis zur Lieferung zeichnet die App;
ein leeres PNG wäre ein weißer Kasten, und die sind hier schon zweimal live
gegangen.
