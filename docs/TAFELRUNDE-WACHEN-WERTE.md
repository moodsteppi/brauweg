# Tafelrunde — Dorfwache und Schildknappe: zu gut für ein Gold?

Stand: 25.09.2026. **Gebaut ist eine Katalogänderung:** Die Dorfwache hat
550 statt 650 Leben. Der Schildknappe bleibt, wie er ist (700). Begründet ist
die Änderung in `packages/game-tafelrunde/src/katalog.ts` bei der Dorfwache.
Ob die Zahl so ins Spiel geht, entscheidet ein Mensch, der diesen Zweig
freigibt. Diese Datei liefert die Messung dafür.

Anlass ist die Board-Karte zur elften Messung (`docs/spiele/auto-battler-konzept.md`,
„Die nächsten Fragen stellt die neue Tabelle selbst", Punkt 2). In der
Tauschprobe standen Dorfwache (x1,37) und Schildknappe (x1,32) weiter über
ihrer Stufe als jede andere Einheit im Katalog. Roh fällt das nicht auf, weil
billige Einheiten auf armen Brettern stehen. Zu prüfen war, ob eine
Ein-Gold-Wache so viel besser sein soll als der Rest ihrer Stufe.

Gemessen auf `origin/staging` = `f298ac7` (#268, Meuchler-Leben schon drin),
Node 24.16.0, Windows.

## Wie gemessen wurde

Alle Werkzeuge liefen wie in `TAFELRUNDE-MEUCHLER-WERTE.md`, mit denselben
Schaltern und Saatbasen:

```bash
node packages/game-tafelrunde/werkzeug/tauschprobe.mjs --partien 1000 --kontexte 2000 --saat tausch-v1   # und tausch-v2
node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150 --saat ausgewogenheit-v1   # und -v2
node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 400 --sitze 4 --mindest 100 --saat ausgewogenheit-probe
```

Für die Varianten stand der geänderte Wert nicht in `src/`. Ein kleines
Vorschaltskript hat ihn vor dem Laden des Werkzeugs in die Objekte von
`KATALOG` geschrieben. Bot, Kampf und Probe lesen über `einheit(id)` dieselben
Objekte. Eine Ausnahme ist `BEZUGS_SCHADEN` in `bot.ts`, das beim Laden aus dem
Angriff gerechnet wird. Die Angriffsvariante unten hat den Bezug deshalb nicht
mitverschoben. Für die gebaute Variante ist abgeglichen, dass der Bau in
`src/` Zeichen für Zeichen dieselben Tabellen liefert (Probe und Tauschprobe
v1).

## Zuerst: Misst die Probe hier überhaupt die Einheit?

Der Verdacht lag nahe. Getauscht wird der **erste** Platz des Bretts, auf dem
eine Einheit der Stufe steht (`tauschplatz` in `test/tauschprobe.ts`). Das ist
bei 1 Gold zu 53 % die vorderste Reihe, und dort verliert jeder Schütze gegen
jede Wache. Die Probe ist deshalb nach der Rolle aufgeschlüsselt, die vorher
auf dem Platz stand, und danach, ob das Brett sonst noch eine Wache hat
(Index v1 / v2):

| Platz vorher | Kontexte v1 | Dorfwache | Schildknappe | Irrlicht (auch Wache) | Astschütze | Gassendieb |
|---|---|---|---|---|---|---|
| alle | 2.000 | 1,38 / 1,42 | 1,33 / 1,35 | 0,83 / 0,82 | 0,80 / 0,79 | 0,92 / 0,88 |
| Wache, keine zweite Wache | 386 | 1,52 / 1,51 | 1,47 / 1,45 | 1,18 / 1,12 | 0,48 / 0,52 | 0,94 / 0,89 |
| Wache, mit zweiter Wache | 673 | 1,37 / 1,43 | 1,27 / 1,32 | 0,62 / 0,60 | 0,98 / 0,92 | 0,73 / 0,71 |
| Meuchler (Reihe 1) | 864 | 1,35 / 1,39 | 1,36 / 1,38 | 0,92 / 0,96 | 0,74 / 0,75 | 1,18 / 1,10 |

Die Rolle erklärt es nicht. Auf Brettern mit einer zweiten Wache und auf
Meuchlerplätzen liegen beide genauso weit vorn. Das Irrlicht ist ebenfalls
eine Wache und liegt dort unter dem Schnitt. **Es liegt an den Werten.**
Wirksames Leben (Leben geteilt durch den Rüstungsrest): Dorfwache 650 / 0,60
≈ 1.083, Schildknappe 700 / 0,58 ≈ 1.207, Irrlicht 560 / 0,65 ≈ 862. Mit 550
kommt die Dorfwache auf ≈ 917.

## Tauschprobe, 1 Gold (Index v1 / v2, Saldo v1)

| Variante | Dorfwache | Schildknappe | Irrlicht | Funkenlehrling | Gassendieb | Steinschleuderer | Astschütze | Moosheiler |
|---|---|---|---|---|---|---|---|---|
| **Basis** (650 / 700) | **1,38 / 1,42** (+0,15) | **1,33 / 1,35** (+0,02) | 0,83 / 0,82 | 1,03 / 1,05 | 0,92 / 0,88 | 0,90 / 0,90 | 0,80 / 0,79 | 0,80 / 0,79 |
| beide Leben −10 % (585 / 630) | 1,25 / 1,27 | 1,19 / 1,21 | 0,98 / 1,01 | 1,08 / 1,03 | 1,02 / 1,03 | 0,83 / 0,83 | 0,81 / 0,79 | 0,85 / 0,84 |
| beide Leben −20 % (520 / 560) | 1,16 / 1,15 | 1,07 / 1,09 | 1,04 / 1,05 | 1,11 / 1,13 | 1,09 / 1,07 | 0,84 / 0,83 | 0,82 / 0,82 | 0,87 / 0,86 |
| beide Rüstung −10 (30 / 32) | 1,13 / 1,17 | 1,17 / 1,16 | 1,02 / 1,04 | 1,11 / 1,07 | 1,09 / 1,08 | 0,82 / 0,81 | 0,80 / 0,80 | 0,84 / 0,87 |
| beide Leben −8 %, Rüstung −5 | 1,15 / 1,18 | 1,16 / 1,15 | 1,03 / 1,05 | 1,13 / 1,10 | 1,08 / 1,05 | 0,82 / 0,83 | 0,79 / 0,80 | 0,84 / 0,83 |
| beide Angriff −20 % (24 / 22) | 1,25 / 1,29 | 1,25 / 1,26 | 0,98 / 1,01 | 1,05 / 1,03 | 1,06 / 1,02 | 0,81 / 0,79 | 0,77 / 0,78 | 0,83 / 0,81 |
| nur Schildknappe 630 | 1,49 / 1,42 | 1,21 / 1,16 | 0,86 / 0,88 | 1,01 / 1,05 | 0,96 / 0,94 | 0,88 / 0,91 | 0,79 / 0,83 | 0,80 / 0,81 |
| Dorfwache 585 / Knappe 665 | 1,25 / 1,23 | 1,28 / 1,28 | 1,00 / 0,99 | 1,07 / 1,09 | 1,00 / 1,03 | 0,79 / 0,80 | 0,81 / 0,77 | 0,81 / 0,81 |
| Dorfwache 550 / Knappe 665 | 1,16 / 1,13 | 1,30 / 1,25 | 1,02 / 1,00 | 1,08 / 1,08 | 1,03 / 1,04 | 0,80 / 0,83 | 0,79 / 0,81 | 0,82 / 0,85 |
| Dorfwache 520 / Knappe 665 | 1,08 / 1,09 | 1,29 / 1,28 | 1,01 / 1,01 | 1,13 / 1,08 | 1,03 / 1,07 | 0,81 / 0,81 | 0,82 / 0,81 | 0,83 / 0,84 |
| Dorfwache 520 / Knappe 680 | 1,07 / 1,08 | 1,33 / 1,32 | 1,00 / 1,02 | 1,11 / 1,09 | 1,01 / 1,04 | 0,81 / 0,80 | 0,83 / 0,81 | 0,83 / 0,86 |
| nur Dorfwache 585 | 1,24 / 1,18 | 1,37 / 1,33 | 0,97 / 0,94 | 1,07 / 1,06 | 0,99 / 0,99 | 0,81 / 0,85 | 0,77 / 0,83 | 0,79 / 0,82 |
| **nur Dorfwache 550 (gebaut)** | **1,12 / 1,12** (−0,37) | 1,34 / 1,38 (+0,26) | 0,98 / 0,99 | 1,05 / 1,08 | 1,05 / 1,01 | 0,81 / 0,81 | 0,81 / 0,78 | 0,84 / 0,82 |
| nur Dorfwache 520 | 1,04 / 1,07 | 1,37 / 1,39 | 0,97 / 1,00 | 1,07 / 1,09 | 1,06 / 1,03 | 0,82 / 0,82 | 0,82 / 0,80 | 0,85 / 0,80 |

Bei 2 und 3 Gold ändert keine Variante die Reihenfolge wesentlich. Mit 550
steht die Hainwächterin bei x1,09 statt x0,96, die Grabfürstin bleibt mit
x0,73 die letzte Zeile ihrer Stufe (Basis x0,78).

## Ausgewogenheit, 5.000 Partien zu viert

Marken roh v1 / v2, in Klammern gegen gleich teure Bretter (v1 / v2); dazu die
Antritte von Untot und der beiden Wachen (v1):

| Variante | Wächter | Krieger | Untot | Naturwesen | Elementar | Drache | Meuchler | Antritte Untot | Dorfwache | Schildknappe | Irrlicht |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Basis** | 1,28 / 1,32 (1,40 / 1,40) | 1,27 / 1,30 (1,37 / 1,36) | 0,96 / 1,00 | 0,98 / 0,96 (1,04 / 1,03) | 0,86 / 0,82 | 0,80 / 0,75 (0,97 / 0,92) | 0,86 / 0,85 | 1.507 | 7.209 | 2.944 | 2.907 |
| beide Leben −10 % | 1,20 / 1,24 | 1,08 / 1,07 | 0,99 / 0,98 | 0,71 / 0,70 | 1,05 / 1,05 | 1,04 / 1,05 | 0,93 / 0,91 | **707** | 2.673 | 1.021 | 5.104 |
| beide Leben −20 % | 1,19 / 1,17 | 0,98 / 0,93 | 1,05 / 1,07 | 0,68 / 0,67 | 1,09 / 1,11 | 1,07 / 1,11 | 0,94 / 0,94 | **545** | 1.844 | 635 | 5.231 |
| beide Rüstung −10 | 1,19 / 1,15 | 0,98 / 0,93 | 0,96 / 1,00 | 0,71 / 0,71 | 1,11 / 1,13 | 1,09 / 1,14 | 0,97 / 0,95 | **603** | 1.831 | 736 | 5.204 |
| beide Angriff −20 % | 1,37 / 1,32 | 1,05 / 1,01 | 1,12 / 1,15 | 0,65 / 0,64 | 0,99 / 1,01 | 0,97 / 1,02 | 0,85 / 0,85 | **511** | 1.749 | 589 | 5.279 |
| nur Schildknappe 630 | 1,35 / 1,36 | 1,23 / 1,27 | 1,04 / 1,07 | 0,93 / 0,89 | 0,84 / 0,82 | 0,80 / 0,77 | 0,81 / 0,83 | **744** | 6.916 | 1.845 | 3.110 |
| Dorfwache 550 / Knappe 665 | 1,16 / 1,16 | 1,03 / 1,03 | 0,90 / 0,98 | 0,74 / 0,69 | 1,11 / 1,10 | 1,12 / 1,11 | 0,95 / 0,93 | 1.088 | 1.890 | 1.574 | 5.065 |
| Dorfwache 520 / Knappe 680 | 1,15 / 1,13 | 1,02 / 0,97 | 0,98 / 1,03 | 0,72 / 0,67 | 1,09 / 1,12 | 1,09 / 1,12 | 0,96 / 0,95 | 1.222 | 1.551 | 1.722 | 5.082 |
| nur Dorfwache 585 | 1,07 / 1,11 | 1,17 / 1,13 | 0,91 / 0,93 | 0,76 / 0,76 | 1,07 / 1,08 | 1,07 / 1,07 | 0,94 / 0,93 | 2.019 | 2.808 | 2.878 | 4.687 |
| **nur Dorfwache 550 (gebaut)** | **1,11 / 1,08 (1,17 / 1,14)** | **1,10 / 1,04 (1,11 / 1,05)** | 0,94 / 0,93 (1,07 / 1,06) | 0,77 / 0,76 (1,00 / 0,97) | 1,07 / 1,12 (1,09 / 1,13) | 1,06 / 1,12 (1,21 / 1,24) | 0,95 / 0,95 (1,00 / 1,00) | **2.019** | 2.062 | 2.856 | 4.767 |
| nur Dorfwache 520 | 1,11 / 1,08 | 1,07 / 0,99 | 0,98 / 1,01 | 0,77 / 0,74 | 1,06 / 1,11 | 1,06 / 1,12 | 0,96 / 0,97 | 2.001 | 1.710 | 2.869 | 4.748 |

Partie (v1):

| Variante | vorzeitig einseitig | Spielzeit Median | Kampf Median | an der Höchstdauer |
|---|---|---|---|---|
| **Basis** | 30,8 % | 5:39 | 14,0 s | 1,2 % |
| beide Leben −10 % | 32,8 % | 4:51 | 11,3 s | 0,2 % |
| **nur Dorfwache 550 (gebaut)** | 32,8 % | 5:05 | 11,6 s | 0,4 % |
| nur Dorfwache 520 | 32,9 % | 5:03 | 11,6 s | 0,4 % |

## Die 400er-Probe (`ausgewogenheit-probe`, Saatbasis von `test/ausgewogenheit.test.ts`)

| Variante | Spanne | Untot (Antritte) | dünnste andere Zeile |
|---|---|---|---|
| **Basis** | x1,31 – x0,80 | x1,12 (122) | Naturwesen 290 |
| beide Leben −10 % | x1,36 – x0,77 | **zu dünn (51)** | Wächter 196 |
| beide Leben −20 % | x1,45 – x0,63 | **zu dünn (42)** | Wächter 144 |
| beide Rüstung −10 | x1,19 – x0,59 | **zu dünn (55)** | Wächter 143 |
| beide Leben −8 %, Rüstung −5 | x1,29 – x0,68 | **zu dünn (56)** | Wächter 160 |
| beide Angriff −20 % | x1,33 – x0,56 | **zu dünn (43)** | Wächter 141 |
| nur Schildknappe 630 | x1,47 – x0,76 | **zu dünn (70)** | Naturwesen 311 |
| Dorfwache 585 / Knappe 665 | x1,26 – x0,81 | **zu dünn (95)** | Wächter 221 |
| Dorfwache 550 / Knappe 665 | x1,33 – x0,78 | **zu dünn (96)** | Wächter 196 |
| Dorfwache 520 / Knappe 665 | x1,23 – x0,75 | **zu dünn (99)** | Wächter 180 |
| Dorfwache 520 / Knappe 680 | x1,21 – x0,67 | x1,09 (114) | Krieger 188 |
| nur Dorfwache 585 | x1,19 – x0,84 | x0,93 (172) | Krieger 255 |
| **nur Dorfwache 550 (gebaut)** | **x1,17 – x0,80** | x1,00 (**175**) | Krieger 224 |
| nur Dorfwache 520 | x1,19 – x0,72 | x1,10 (175) | Krieger 215 |

`test/` des Pakets mit 550: 338 / 338 grün.

## Was die Zahlen sagen

1. **Nein, so viel besser soll sie nicht sein, und bei der Dorfwache zeigt
   das nicht nur die Tauschprobe.** Sie trägt Krieger und Wächter, die beiden
   obersten Marken der Ausgewogenheit (x1,28 / x1,27, alle anderen unter
   x1,0), und sie ist mit 7.209 Antritten die meistgekaufte Einheit. Mit 550
   steht sie in der Tauschprobe bei x1,12, also immer noch über dem Schnitt
   ihrer Stufe. Die rohe Markenspanne schrumpft auf v1 von x1,28–0,80 auf
   x1,11–0,77, auf v2 von x1,32–0,75 auf x1,12–0,76. In der Probe geht sie
   von x1,31–0,80 auf x1,17–0,80.
2. **Wer beide schwächt, schwächt Untot mit.** Der Bot bewertet über
   `staerke`, und die zählt Leben, Rüstung und Angriff gleichermaßen. Jeder Weg
   über beide Wachen (Leben, Rüstung, Angriff, gemischt) lässt ihn beide so
   viel seltener kaufen, dass er zum Irrlicht wechselt (2.907 → rund 5.200
   Antritte). Untot fällt dabei auf 5.000 Partien von 1.507 auf 511–707
   Antritte und in der Probe unter die Zählschwelle. Der Schildknappe ist der
   Träger, der Untot überhaupt messbar macht (katalog.ts, beim Knappen).
3. **Der Schildknappe lässt sich nicht bewegen, ohne Untot zu verlieren.**
   Mit 665 Leben steht er noch bei x1,25–1,30, Untot in der Probe schon bei
   95–99. Mit 680 hält Untot (114), sein Index bleibt aber bei x1,33. Er ist
   jetzt allein die oberste Zeile seiner Stufe (x1,34 / x1,38).
4. **Die Dorfwache allein zu schwächen stärkt Untot sogar.** Der Bot nimmt an
   ihrer Stelle öfter den Schildknappen, und Untot steigt von 1.507 auf 2.019
   Antritte, in der Probe von 122 auf 175. Die knappste Zeile der Probe
   bekommt damit mehr Luft als seit dem 06.09.2026.
5. **Warum 550 und nicht 585 oder 520.** Mit 585 bleibt sie bei x1,24 / x1,18,
   und Krieger bleibt bei x1,17. Mit 520 steht sie bei x1,04 / x1,07, genau im
   Schnitt. Die Marken sind zwischen 550 und 520 fast gleich, in der Probe
   fällt Naturwesen aber auf x0,72. Eine Wache mit zwei Marken für ein Gold
   darf in der oberen Hälfte stehen. 550 ist dort, wo sie das tut, ohne
   herauszuragen, und es ist die Zahl aus der Kopfzeile der Stufe („rund 550
   Leben").
6. **Der Preis.** Kämpfe werden kürzer (14,0 → 11,6 s, die Partie 5:39 →
   5:05), weil weniger Wachen vorn stehen. Abbrüche an der Höchstdauer sinken
   von 1,2 auf 0,4 %, „vorzeitig einseitig" steigt von 30,8 auf 32,8 %.
   Naturwesen fällt roh von x0,98 auf x0,77, gegen gleich teure Bretter aber
   nur von x1,04 auf x1,00. Das ist der Wohlstand der Bretter und nicht die
   Marke. Die Schranke der Probe (x0,5) ist weit weg (Probe: x0,80).

## Was diese Messung nicht sagt

- Wie der Schildknappe herunterkommt, ohne Untot zu verlieren. Der
  naheliegende Weg ist ein weiterer Untot-Träger nach dem Muster des Knappen
  selbst (die Marke nicht nur über eine Einheit erreichbar machen). Danach
  kann man den Knappen schwächen. Das ist eine eigene Aufgabe. (Gemessen im
  zweiten Schritt unten: Irrlicht, dann Knappe 570.)
- Ob der Bot mit den neuen Werten besser spielt. Er kauft weniger
  Dorfwachen, weil `staerke` Leben zählt. Ein Sitzduell alter gegen neuer
  Stand ist nicht gelaufen.
- Acht Sitze. Gemessen ist nur zu viert, wie auf der Karte.
- Die Anzeige: Sie liest die Werte aus der Sicht und schreibt keine ab
  (`packages/client` ist nicht angefasst).

---

# Zweiter Schritt: ein vierter Untot-Träger, dann der Knappe

Stand: 25.09.2026, gemessen auf `81df008` (#269, Dorfwache 550 schon drin),
dieselben Werkzeuge, Schalter und Saatbasen wie oben, dasselbe
Vorschaltskript. **Gebaut ist nur der erste Teil:** Das Irrlicht trägt
zusätzlich die Marke Untot (Elementar + Untot), Werte unverändert. Der
Schildknappe hat weiter 700 Leben — warum, steht unter „Der Knappe" unten.
Für den Bau ist abgeglichen, dass `src/` dieselben Tabellen liefert wie das
Vorschaltskript (Probe, Tauschprobe v1).

## Welcher Träger

Kandidaten waren alle zwölf Einheiten mit nur einer Marke (Einheiten mit zwei
Marken bekommen keine dritte, `katalog.test.ts`). Zuerst die 400er-Probe,
jeweils ohne und mit dem Knappen auf 630 — der Wert, bei dem Untot vorher auf
70 Antritte fiel. Untot mit Faktor und Antritten, dazu die Spanne:

| Vierter Träger | Knappe 700: Untot | Spanne | Knappe 630: Untot | Spanne |
|---|---|---|---|---|
| (keiner) | x1,00 (175) | x1,17 – 0,80 | **zu dünn (70)** | x1,47 – 0,76 |
| Astschütze | x1,07 (675) | x1,60 – 0,68 | x0,81 (578) | x1,59 – 0,81 |
| Steinschleuderer | x1,11 (462) | x1,56 – 0,63 | x0,92 (340) | x1,59 – 0,62 |
| **Irrlicht** | **x0,96 (451)** | **x1,15 – 0,72** | x1,21 (372) | x1,33 – 0,76 |
| Gassendieb | x1,12 (1.037) | x1,31 – 0,52 | x0,98 (985) | x1,25 – 0,61 |
| Moosheiler | x0,93 (372) | x1,27 – 0,86 | x0,51 (270) | x1,31 – 0,51 |
| Grimmbart | x1,02 (210) | x1,10 – 0,78 | x1,07 (100) | x1,28 – 0,70 |
| Nachtpfeil | x1,24 (265) | x1,24 – 0,61 | x1,34 (171) | x1,34 – 0,63 |
| Frostweberin | x1,30 (258) | x1,30 – 0,74 | x1,32 (170) | x1,32 – 0,64 |
| Schattenklinge | x1,27 (280) | x1,27 – 0,76 | x1,26 (196) | x1,32 – 0,70 |
| Runenpriester | x1,15 (232) | x1,21 – 0,78 | x1,31 (108) | x1,35 – 0,65 |
| Sturmrufer | x1,23 (214) | x1,23 – 0,77 | x1,24 (114) | x1,24 – 0,66 |
| Lichtwahrerin | x1,12 (190) | x1,18 – 0,78 | zu dünn (84) | x1,39 – 0,69 |

Die aussichtsreichen über 5.000 Partien (`ausgewogenheit-v1`), Marken roh:

| Variante | Spanne | Untot (Antritte) | auffällig |
|---|---|---|---|
| Basis (#269) | x1,11 – 0,77 | x0,94 (2.019) | |
| nur Knappe 630 | x1,17 – 0,72 | x0,87 (899) | |
| **Irrlicht** | **x1,09 – 0,74** | **x1,08 (5.346)** | |
| Irrlicht, Knappe 630 | x1,21 – 0,72 | x1,09 (4.364) | Wächter x1,21 |
| Gassendieb | x1,26 – 0,63 | x1,09 (13.180) | Meuchler x1,26, Höchstdauer 1,6 % |
| Gassendieb, Knappe 630 | x1,22 – 0,57 | x0,96 (12.185) | Naturwesen x0,57 |
| Schattenklinge | x1,28 – 0,67 | x1,28 (3.593) | Untot oben |
| Schattenklinge, Knappe 630 | x1,32 – 0,62 | x1,32 (2.489) | Untot oben |
| Grimmbart, Knappe 630 | x1,12 – 0,69 | x1,01 (1.193) | Probe auf der Kante (100) |
| Steinschleuderer, Knappe 630 | x1,46 – 0,70 | x0,90 (4.428) | Wächter x1,46 |
| Runenpriester, Knappe 630 | x1,18 – 0,66 | x1,16 (1.395) | |
| Nachtpfeil, Knappe 630 | x1,26 – 0,65 | x1,26 (2.000) | Untot oben |
| Frostweberin, Knappe 630 | x1,29 – 0,66 | x1,29 (1.950) | Untot oben |
| Sturmrufer, Knappe 630 | x1,38 – 0,65 | x1,38 (1.436) | Untot oben |

**Das Irrlicht ist der einzige Kandidat, der beides kann:** Untot hält die
Zählschwelle mit Abstand, und die Marke bleibt in der Mitte, ohne eine andere
Zeile mitzureißen. Die billigen Nicht-Wachen (Astschütze, Steinschleuderer)
reißen Wächter nach oben, der Gassendieb Meuchler und die Uhr, die Zwei- und
Drei-Gold-Kandidaten ziehen Untot selbst an die Spitze, Grimmbart lässt die
Probe auf der Kante. Das ist das Muster des Knappen: eine billige Wache, die
der Marke eine Front gibt. Dazu passt das Bild — ein Irrlicht ist in der Sage
die Seele eines Toten.

Gebaut, beide Saatbasen:

| | Basis v1 / v2 | Irrlicht v1 / v2 |
|---|---|---|
| Spanne roh | x1,11 – 0,77 / x1,12 – 0,76 | x1,09 – 0,74 / x1,08 – 0,78 |
| Untot roh (Antritte v1) | x0,94 / x0,93 (2.019) | x1,08 / x1,07 (5.346) |
| Elementar roh | x1,07 / x1,12 | x1,03 / x1,03 |
| Untot gegen gleich teure Bretter | 1,07 / 1,06 | 1,16 / 1,15 |
| vorzeitig einseitig (v1) | 32,8 % | 31,8 % |
| Spielzeit / Kampf im Median (v1) | 5:05 / 11,6 s | 5:05 / 11,8 s |
| an der Höchstdauer (v1) | 0,4 % | 0,4 % |
| Probe: Spanne, Untot | x1,17 – 0,80, 175 | x1,15 – 0,72, **451** |

Tauschprobe, 1 Gold (v1 / v2): Irrlicht 0,98 / 0,99 → 1,07 / 1,04. Der
Knappe steigt mit, 1,34 / 1,38 → **1,39 / 1,37**, weil er öfter neben einem
zweiten Untoten steht. Bei 2 und 3 Gold ändert sich die Reihenfolge nicht
wesentlich (Grabfürstin 0,73 → 0,80).

## Der Knappe

Mit dem Irrlicht als viertem Träger, Tauschprobe 1 Gold (v1 / v2) und Untot
in der Probe:

| Knappe | Knappe | zweite Zeile | Untot Probe | Knappe auf letzten Brettern (v1) | Kampfanteil `spielzeit-probe` |
|---|---|---|---|---|---|
| 700 (gebaut) | 1,39 / 1,37 | 1,08 / 1,06 | 451 | 3.713 | 48,9 % (153 s / 145 s) |
| 665 | 1,29 / – | 1,10 / – | – | – | – |
| 630 | 1,22 / – | 1,10 / – | 372 | 1.507 | 46,8 % |
| 600 | 1,20 / 1,20 | 1,11 / 1,12 | 367 | 1.075 | 46,1 % |
| 585 | 1,15 / 1,13 | 1,11 / 1,11 | – | 966 | – |
| **570** | **1,12 / 1,13** | 1,11 / 1,13 | **349** | 902 | **46,4 % (139 s / 146 s)** |
| 550 | 1,06 / 1,05 | 1,15 / 1,14 | 351 | – | – |
| 630, Rüstung 38 | 1,16 / – | 1,11 / – | 360 | – | – |

(Zum Vergleich ohne Irrlicht: Knappe 630 → Untot in der Probe 70, Kampfanteil
44,9 %; Dorfwache zurück auf 650 → 54,1 %.)

Mit 570 steht er gleichauf mit Dorfwache und Irrlicht, Untot bleibt bei 349
Antritten in der Probe (über 5.000 Partien 4.104 / 4.173, x1,13 / x1,13), die
rohe Spanne liegt bei x1,24 – 0,71 / x1,23 – 0,72 (Wächter oben, gegen gleich
teure Bretter 1,19 / 1,15). `test/ausgewogenheit.test.ts` bleibt grün.

**Gebaut ist er trotzdem nicht.** Jede Schwächung, die seinen Index bewegt,
lässt in `test/spielzeit.test.ts` die Probe „steckt seine Zeit vor allem in
die Kaempfe" reißen: Die Vorbereitung (geschätzt) überholt den Kampf. Die
Probe stand schon nach der Dorfwache auf der Kante (149 s Kampf gegen 148 s
Vorbereitung; vor #269 waren es 54 %), und die Meldung verlangt ausdrücklich,
Abschnitt 4 von `docs/TAFELRUNDE-SPIELZEIT.md` neu zu messen. Das ist keine
Katalogentscheidung, sondern eine über die Zeitempfehlung — sie gehört einem
Menschen. Mit 570 dauert die Partie im Median 4:48 statt 5:05, der einzelne
Kampf 11,2 statt 11,8 s, an der Höchstdauer enden 0,1 %.
