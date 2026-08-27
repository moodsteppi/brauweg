# Bestellung: Bilder für Easy Poker

Easy Poker läuft **ohne gelieferte Tischgrafik**. Karten, Rückseite,
Jetons, Filz und Holzkante sind gezeichnet (SVG im Bündel bzw. CSS-Verläufe) —
so wie DESIGN.md es verlangt: „Alles gemalt, nichts geladen."

Bestellt und eingebaut ist das Spielauswahl-Banner. Eine eigene Hub-Kachel
ist nicht nötig.

---

## 1. Spielauswahl-Banner (eingebaut)

**Datei:** `packages/client/public/hub/spielwahl-easypoker.webp`
**Maße:** 1200 × 300 px (4:1), WebP Qualität 82, **unter 60 kB**
**Eintrag danach:** `GEMALTE_BANNER` in `packages/client/src/hub.tsx` um
`'easypoker'` ergänzen — ohne diesen Eintrag zeigt die Spielauswahl weiter das
Ersatzbanner `spielwahl-bald.webp`, so wie heute bei Skat und Feldherr.

**Motiv:** Zwei Spielkarten auf grünem Filz, leicht überlappend, dazu ein
kleiner Stapel goldener Jetons. Von schräg oben, warmes Licht von links.

**Farben** (aus dem laufenden Spiel, nicht neu erfinden):

| Fläche | Wert |
| --- | --- |
| Filz | `#14392a`, Lichtkegel nach `#17402f` |
| Holzkante | `#3a2712` auf `#16100a` |
| Kartenpapier | `#f6f1e6` |
| Kartentinte | `#1b2429`, Rot `#bf4a3f` |
| Kartenrücken | `#1f6b4d` mit Goldmuster `#e2b64f` |
| Jetons | Gold `#e2b64f`, Glanz `#ffe8a8` |

**Freihalten:** Die unteren 20 % bleiben ruhig — dort liegt in der
Spielauswahl der Textstreifen („Poker · 2, 3, 4, 5, 6 Spieler · Hold’em").

**Was NICHT ins Bild gehört:**

- **Kein Geld.** Keine Scheine, keine Münzen mit Währungszeichen, keine
  Chips mit Geldbeträgen. Die Jetons dieses Spiels sind Partiepunkte, und das
  Bild darf nichts anderes behaupten (siehe unten, „Warum das wichtig ist").
- Keine Spielbank-Zeichen: kein Roulette, kein Würfel, kein „Casino"-Schriftzug,
  keine Neonschrift, keine Zigarre, kein Glas.
- Kein eingebrannter Text, auch nicht „Easy Poker" — der Name steht daneben.
- Keine Menschen, keine Hände.
- Kein Alpha nötig (Vollbild), aber **kein Schachbrett** als Hintergrund.

**Abnahme:** Datei kleiner als 60 kB · in der Spielauswahl auf einem
375 px breiten Gerät angesehen · Kartenwerte im Daumennagel noch als Karten
erkennbar (nicht als weiße Flecken) · nichts aus der Liste oben im Bild.

---

## 2. Hub-Kachel (nur falls gewünscht, nicht nötig)

Nur wenn Easy Poker eine eigene Kachel auf der Startseite bekommt. Dann
dieselben Farben, Format 512 × 512, freigestellt mit **echtem Alphakanal** (die
Ecken müssen `alpha=0` sein — das ist hier laut STAND.md schon dreimal
schiefgegangen). Motiv: eine einzelne Karte mit Pik-Ass, davor zwei Jetons.

---

## Warum das wichtig ist

`docs/SPIELE-IDEEN.md` führt Poker unter „Vorsicht geboten": Auch ohne echtes
Geld stuft Apple eine Gluecksspiel-Nachbildung anders ein, und `game-api`
verlangt, dass Regelwerk und Währung getrennt bleiben.

Easy Poker hält beides ein — die Jetons entstehen beim Geben, verschwinden am
Ende der Partie und lassen sich weder kaufen noch in Münzen oder Edelsteine
tauschen. **Ein Bild kann diese Trennung wieder einreißen**, wenn es Geld oder
eine Spielbank zeigt. Deshalb steht die Verbotsliste oben nicht aus
Geschmacksgründen da.
