# Bildbestellung: Pokertisch (Knöpfe, Kartenrücken, Jeton, Filz)

Der Pokertisch lief bisher komplett gemalt (CSS-Verläufe, SVG im Bündel).
Diese Bestellung ersetzt vier Stellen durch echte Bilder. Die Verbotsliste
aus `ASSETS-EASYPOKER.md` gilt unverändert — **kein Geld, keine Spielbank,
kein eingebrannter Text** (Begründung steht dort unter „Warum das wichtig
ist").

Ausgeführt am 27. August 2026: Die Bilder sind **auf diesem Rechner erzeugt**
(SVG über sharp gerastert, Skript liegt im Archiv unter
`poker/erzeugen.mjs`), Originale als PNG in `brauweg-art/poker/`,
Auslieferung als WebP unter `packages/client/public/poker/`.

**Farben** (aus dem laufenden Spiel, nicht neu erfinden): Filz `#14392a` /
`#17402f`, Holzkante `#3a2712` auf `#16100a`, Kartenrücken `#1f6b4d`,
Gold `#e2b64f`, Glanz `#ffe8a8`, Kartenpapier `#f6f1e6`.

---

## 1. Vier Aktionsplatten — `poker/knopf-{fold,check,call,bet}`

Wie die Hub-Platten (`ASSETS-KNOEPFE.md`): **512 × 160 px, echter
Alphakanal**, der Client zieht sie per `border-image` auf jede Breite.
Deshalb gelten dieselben harten Regeln:

- Platte füllt die Breite **bis auf höchstens 8 px je Seite**.
- Rahmen samt Ecken **höchstens 30 px** dick, alle vier Platten **derselbe**
  Rahmen (dunkles, lackiertes Holz wie die Tischkante).
- Schlagschatten unten, **höchstens 10 px**.
- **Kein Text, kein Symbol** — Beschriftung setzt der Client.
- Füllung je Platte: Fold Emaille-Rot `#8f3c31`, Check Elfenbein `#dfe9e2`,
  Call Blau `#3e6fa8`, Bet Grün `#3d8a60`. Oben ein schmaler Glanz, unten
  eine dunklere Kante, dazu feines Rauschen — keine glatte Fläche.

## 2. Kartenrücken — `poker/kartenruecken`

**320 × 465 px** (Verhältnis 1.452 wie `--pc-ratio`), **ohne** Alphakanal
(die Karte ist rechteckig mit runden Ecken, die Rundung schneidet der Client).
Tiefgrüner Grund `#1f6b4d`, doppelte Goldlinie als Rahmen, in der Mitte ein
Rautengitter mit einem größeren Rautenmedaillon. Kein Text, kein Wappen.
Muss auch bei 22 px Breite (kleinster Gegnersitz) noch als Rücken lesbar
sein — also grobe Formen, kein feines Ornament.

## 3. Jeton — `poker/jeton`

**256 × 256 px, echter Alphakanal** (rund freigestellt, Ecken alpha 0).
Goldener Jeton mit acht hellen Randmarken, innerem Ring und Lichtpunkt oben
links — dieselbe Zeichnung, die `.poker-jeton-zeichen` bisher als
CSS-Verlauf andeutet. **Keine Zahl, kein Währungszeichen** auf dem Jeton.

## 4. Filz — `poker/filz`

**768 × 1152 px, ohne Alphakanal.** Ein einzelnes Bild, kein Kachelmuster —
es liegt per `background-size: cover` unter dem Oval, damit gibt es keine
Nähte. Lichtkegel oben (`#17402f`), Grundton `#14392a`, unten dunkler
Rand (`#0f2c20`), darüber feines Filzrauschen. Keine Zeichnung, kein Logo:
Der Tisch ist Bühne, nicht Bild.

---

## Abnahme

- Platten: Alphakanal auf der Mittelzeile gemessen, Motiv ≥ 96 % der Breite,
  alle vier mit demselben Wert; auf rotem Grund geprüft (kein Schachbrett).
- Jeton: Ecken alpha 0, auf rotem Grund geprüft.
- Größen nach dem Wandeln: Platte ≤ 30 kB, Rücken ≤ 60 kB, Jeton ≤ 20 kB,
  Filz ≤ 150 kB.
- Am Gerät (375 px) angesehen: 2er-, 3er- und 6er-Tisch, Knöpfe an und aus,
  Rücken im kleinsten Sitz.
- Nichts aus der Verbotsliste von `ASSETS-EASYPOKER.md` im Bild.
