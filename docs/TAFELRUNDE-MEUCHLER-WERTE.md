# Tafelrunde — Werte, Tempo oder Marken-Bonus: was hebt die Meuchler?

Stand: 25.09.2026. **Gebaut ist eine Katalogänderung:** mehr Leben für
Gassendieb (520 → 585), Schattenklinge (660 → 745) und Knochenspäher
(700 → 950). Tempo, Schritt und Markenbonus bleiben, wie sie waren. Begründet
ist die Änderung in `packages/game-tafelrunde/src/katalog.ts` beim Gassendieb.
Ob die Zahlen so ins Spiel gehen, entscheidet ein Mensch, der diesen Zweig
freigibt. Diese Datei liefert die Messung dafür.

Anlass ist die Board-Karte zur elften Messung (`docs/spiele/auto-battler-konzept.md`,
„Die nächsten Fragen stellt die neue Tabelle selbst"). In der Tauschprobe stehen
Knochenspäher (x0,68) und Gassendieb (x0,74) jeweils in der letzten Zeile ihrer
Kostenstufe. Die Marke Meuchler steht roh bei x0,64, normiert bei x0,65. Zu
klären war, ob Werte, Tempo oder die Marken-Boni angefasst werden, und zwar mit
Tauschprobe **und** Ausgewogenheit, jeweils vorher und nachher.

`TAFELRUNDE-MEUCHLER-ANKOMMEN.md` hat Tempo, Vorsprung und Leben schon mit
`ausgewogenheit.mjs` gemessen, die Tauschprobe aber ausdrücklich offen gelassen
(„Was diese Messung nicht sagt"). Diese Datei holt sie nach und misst zwei
Kandidaten dazu (Rüstung, Lebensbonus auf der Marke).

Gemessen auf `origin/staging` = `c45beeb` (#267), Node 24.16.0, Windows.

## Wie gemessen wurde

Je Variante eine Kopie von `dist/` und `werkzeug/` des gebauten Pakets. Die
Änderung steht jeweils nur in `dist/src/katalog.js`, `synergien.js` oder
`kampf.js` der Kopie, `src/` blieb beim Messen unberührt. Alle Läufe sind
bestimmt: dieselben Schalter ergeben dieselbe Tabelle.

```bash
node <kopie>/werkzeug/tauschprobe.mjs --partien 1000 --kontexte 2000 --saat tausch-v1   # und tausch-v2
node <kopie>/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150 --saat ausgewogenheit-v1   # und -v2
node <kopie>/werkzeug/ausgewogenheit.mjs --partien 400 --sitze 4 --mindest 100 --saat ausgewogenheit-probe
```

Der Basislauf ergibt Zahl für Zahl die Tabellen aus
`TAFELRUNDE-MEUCHLER-ANKOMMEN.md` (Ausgewogenheit) und fast die aus der elften
Messung (Tauschprobe; Gassendieb x0,75 statt x0,74, Knochenspäher x0,67 statt
x0,68 — seither hat der Bot seine Meuchler-Bewertung geändert, #249).

| Variante | Eingriff | Weg |
|---|---|---|
| **Basis** | keiner | — |
| Schritt halb | Schrittpause für `rolle === 'meuchler'` halbiert (`kampf.js`) | Tempo fürs Ankommen |
| Markentempo ×2 | Meuchler-Bonus `tempoProzent` 15/25/40 → 30/50/80 | Marken-Bonus |
| Marke +Leben | Meuchler-Bonus zusätzlich `lebenProzent` 15/25/40 | Marken-Bonus |
| Marke nur Leben | Meuchler-Bonus `lebenProzent` 15/25/40 statt Tempo | Marken-Bonus |
| Rüstung +10 | Gassendieb 15→25, Schattenklinge 15→25, Knochenspäher 20→30 | Werte |
| Leben +12,5 % | 585 / 745 / 790 | Werte |
| Leben +25 % | 650 / 825 / 875 | Werte |
| gestaffelt 875 | 585 / 745 / 875 | Werte |
| **gestaffelt 950 (gebaut)** | 585 / 745 / 950 | Werte |

Die Klingentänzerin ist in keiner Wertevariante angefasst. Sie steht in der
Tauschprobe mit x0,95 in der Mitte ihrer Stufe.

## Tauschprobe (Index in der Kostenstufe, v1 / v2; Saldo v1)

| Variante | Gassendieb (1) | Schattenklinge (2) | Knochenspäher (2) | Klingentänzerin (3) | Nachtpfeil (2, Schütze) | Dorfwache (1) |
|---|---|---|---|---|---|---|
| **Basis** | 0,75 / 0,72 (−1,24) | 0,82 / 0,79 (−1,27) | **0,67** / 0,69 (−1,61) | 0,95 / 0,95 | 1,03 / 1,02 | 1,39 / 1,37 |
| Schritt halb | 0,76 / 0,72 (−1,31) | 0,78 / 0,81 (−1,41) | 0,68 / 0,70 (−1,66) | 0,95 / 0,94 | 1,01 / 1,01 | 1,36 / 1,38 |
| Markentempo ×2 | 0,93 / 0,86 (−1,06) | 1,12 / 1,06 (−0,93) | **0,63** / 0,62 (−1,88) | 1,02 / 1,01 | **1,30** / 1,27 | 1,40 / 1,43 |
| Marke +Leben | 1,02 / 0,98 (−1,06) | 1,18 / 1,17 (−0,84) | **0,59** / 0,55 (−1,99) | 1,16 / 1,10 | **1,35** / 1,41 | 1,49 / 1,46 |
| Marke nur Leben | 0,78 / 0,72 (−1,18) | 0,86 / 0,84 (−1,24) | 0,69 / 0,68 (−1,65) | 0,95 / 0,99 | 0,98 / 0,99 | 1,39 / 1,40 |
| Rüstung +10 | 0,94 / 0,93 (−0,97) | 0,92 / 0,94 (−1,05) | 0,74 / 0,73 (−1,49) | 0,96 / 0,96 | 1,03 / 1,05 | 1,41 / 1,40 |
| Leben +12,5 % | 0,92 / 0,90 (−1,00) | 0,92 / 0,94 (−1,01) | 0,73 / 0,72 (−1,49) | 0,97 / 0,96 | 1,05 / 1,01 | 1,41 / 1,44 |
| Leben +25 % | 1,05 / 1,06 (−0,80) | **1,15** / 1,13 (−0,61) | 0,81 / 0,79 (−1,31) | 0,97 / 0,99 | 1,09 / 1,12 | 1,41 / 1,40 |
| gestaffelt 875 | 0,91 / 0,90 (−1,05) | 0,95 / 0,93 (−0,90) | 0,83 / 0,82 (−1,20) | 0,98 / 0,95 | 1,03 / 1,02 | 1,42 / 1,41 |
| **gestaffelt 950** | **0,92 / 0,88** (−1,00) | **0,92 / 0,92** (−0,97) | **0,89 / 0,92** (−1,05) | 0,98 / 0,99 | 1,01 / 1,00 | 1,38 / 1,42 |

Die drei letzten Zeilen jeder Stufe (v1):

| Variante | 1 Gold | 2 Gold | 3 Gold |
|---|---|---|---|
| **Basis** | Moosheiler 0,87 · Irrlicht 0,86 · **Gassendieb 0,75** | Grimmbart 0,91 · Schattenklinge 0,82 · **Knochenspäher 0,67** | Drachenkind 1,01 · Klingentänzerin 0,95 · Grabfürstin 0,81 |
| Leben +12,5 % | Irrlicht 0,81 · Moosheiler 0,80 · Astschütze 0,80 | Schattenklinge 0,92 · Grimmbart 0,86 · **Knochenspäher 0,73** | Wurzelriese 1,04 · Klingentänzerin 0,97 · Grabfürstin 0,77 |
| Leben +25 % | Irrlicht 0,79 · Moosheiler 0,76 · Astschütze 0,75 | Frostweberin 0,97 · Grimmbart 0,83 · **Knochenspäher 0,81** | Wurzelriese 1,03 · Klingentänzerin 0,97 · Grabfürstin 0,78 |
| gestaffelt 875 | Irrlicht 0,83 · Astschütze 0,81 · Moosheiler 0,78 | Schattenklinge 0,95 · Grimmbart 0,88 · **Knochenspäher 0,83** | Lichtwahrerin 1,04 · Klingentänzerin 0,98 · Grabfürstin 0,79 |
| **gestaffelt 950** | Irrlicht 0,83 · Astschütze 0,80 · Moosheiler 0,80 | Schattenklinge 0,92 · Knochenspäher 0,89 · Grimmbart 0,87 | Lichtwahrerin 1,03 · Klingentänzerin 0,98 · Grabfürstin 0,78 |

Bei Leben +25 % steht die Schattenklinge mit x1,15 an der **Spitze** ihrer
Stufe, vor Bogenmeisterin (x1,10) und Runenpriester (x1,06).

## Ausgewogenheit, 5.000 Partien zu viert

Marken roh v1 / v2, in Klammern gegen gleich teure Bretter (v1 / v2):

| Variante | Wächter | Krieger | Untot | Naturwesen | Elementar | Drache | **Meuchler** |
|---|---|---|---|---|---|---|---|
| **Basis** | 1,57 / 1,57 (1,53 / 1,53) | 1,50 / 1,51 (1,47 / 1,49) | 0,98 / 1,01 (1,06 / 1,10) | 0,81 / 0,79 (0,97 / 0,96) | 0,77 / 0,75 (0,83 / 0,80) | 0,75 / 0,72 (0,89 / 0,87) | **0,63 / 0,64 (0,64 / 0,66)** |
| Schritt halb | 1,59 / 1,61 (1,54 / 1,56) | 1,54 / 1,55 (1,50 / 1,52) | 1,03 / 1,00 (1,09 / 1,09) | 0,81 / 0,78 (0,96 / 0,94) | 0,75 / 0,76 (0,81 / 0,80) | 0,73 / 0,73 (0,88 / 0,87) | **0,55 / 0,56 (0,60 / 0,59)** |
| Markentempo ×2 | 1,45 / 1,46 (1,56 / 1,57) | 1,46 / 1,48 (1,54 / 1,54) | 0,97 / 0,98 (1,13 / 1,14) | 0,98 / 0,98 (1,13 / 1,13) | 0,75 / 0,75 (0,86 / 0,86) | 0,74 / 0,68 (0,93 / 0,89) | 0,65 / 0,67 (0,72 / 0,74) |
| Marke +Leben | 1,23 / 1,27 (1,32 / 1,34) | 1,33 / 1,35 (1,34 / 1,35) | 0,82 / 0,92 (0,97 / 1,01) | 1,03 / 0,98 (1,09 / 1,02) | 0,75 / 0,74 (0,81 / 0,81) | 0,72 / 0,70 (0,88 / 0,87) | 1,11 / 1,04 (0,96 / 0,95) |
| Marke nur Leben | 1,59 / 1,59 (1,54 / 1,54) | 1,53 / 1,53 (1,50 / 1,50) | 0,99 / 0,99 (1,04 / 1,05) | 0,80 / 0,79 (0,97 / 0,96) | 0,75 / 0,75 (0,81 / 0,79) | 0,71 / 0,72 (0,86 / 0,85) | 0,63 / 0,63 (0,65 / 0,66) |
| Rüstung +10 | 1,30 / 1,33 (1,39 / 1,40) | 1,27 / 1,31 (1,34 / 1,35) | 0,86 / 0,93 (0,94 / 1,00) | 0,99 / 0,99 (1,03 / 1,04) | 0,88 / 0,82 (0,92 / 0,87) | 0,81 / 0,75 (0,98 / 0,91) | 0,89 / 0,87 (0,89 / 0,89) |
| Leben +12,5 % | 1,30 / 1,34 (1,41 / 1,41) | 1,28 / 1,32 (1,37 / 1,37) | 0,86 / 0,92 (0,94 / 0,99) | 1,00 / 0,97 (1,04 / 1,03) | 0,88 / 0,83 (0,91 / 0,88) | 0,81 / 0,76 (0,97 / 0,92) | 0,87 / 0,87 (0,86 / 0,88) |
| Leben +25 % | 1,17 / 1,22 (1,29 / 1,30) | 1,20 / 1,25 (1,28 / 1,29) | 0,83 / 0,81 (0,93 / 0,91) | 1,08 / 1,03 (1,05 / 1,00) | 0,90 / 0,88 (0,94 / 0,92) | 0,79 / 0,80 (0,97 / 0,99) | 1,03 / 1,01 (0,99 / 0,99) |
| gestaffelt 875 | 1,29 / 1,34 (1,40 / 1,42) | 1,27 / 1,31 (1,36 / 1,37) | 0,91 / 0,96 (0,96 / 1,00) | 0,99 / 0,95 (1,04 / 1,02) | 0,87 / 0,83 (0,91 / 0,88) | 0,81 / 0,75 (0,97 / 0,92) | 0,87 / 0,86 (0,87 / 0,88) |
| **gestaffelt 950** | 1,28 / 1,32 (1,40 / 1,40) | 1,27 / 1,30 (1,37 / 1,36) | 0,96 / 1,00 (0,96 / 0,98) | 0,98 / 0,96 (1,04 / 1,03) | 0,86 / 0,82 (0,91 / 0,88) | 0,80 / 0,75 (0,97 / 0,92) | **0,86 / 0,85 (0,87 / 0,88)** |

Partie und Antritte (v1; Einheiten = Antritte auf dem letzten Brett):

| Variante | Antritte Meuchler | Untot | vorzeitig einseitig | Spielzeit Median | Kampf Median | an der Höchstdauer | Gassendieb | Schattenklinge | Knochenspäher | Klingentänzerin |
|---|---|---|---|---|---|---|---|---|---|---|
| **Basis** | 5.061 | 1.357 | 28,2 % | 5:50 | 14,6 s | 1,7 % | 8.184 | 1.341 | 569 | 1.481 |
| Schritt halb | 5.152 | 1.371 | 28,0 % | 5:51 | 14,8 s | 1,8 % | 8.208 | 1.345 | 573 | 1.446 |
| Markentempo ×2 | 8.662 | 1.195 | 29,7 % | 5:37 | 13,6 s | 1,3 % | 9.769 | 3.038 | 471 | 1.511 |
| Marke +Leben | 8.814 | 1.122 | 35,9 % | 5:39 | 13,8 s | 1,1 % | 9.847 | 3.337 | 451 | 1.649 |
| Marke nur Leben | 5.044 | 1.350 | 29,4 % | 5:54 | 15,2 s | 1,8 % | 8.237 | 1.307 | 565 | 1.483 |
| Rüstung +10 | 7.159 | 1.285 | 30,9 % | 5:37 | 14,0 s | 1,2 % | 10.248 | 2.536 | 856 | 1.326 |
| Leben +12,5 % | 7.020 | 1.285 | 30,2 % | 5:39 | 14,0 s | 1,2 % | 10.181 | 2.516 | 844 | 1.306 |
| Leben +25 % | 8.503 | 1.240 | 34,4 % | 5:34 | 13,7 s | 0,9 % | 12.132 | 4.188 | 1.041 | 1.436 |
| gestaffelt 875 | 6.992 | 1.392 | 30,7 % | 5:39 | 14,0 s | 1,2 % | 10.142 | 2.476 | 1.114 | 1.295 |
| **gestaffelt 950** | 6.989 | **1.507** | 30,8 % | 5:39 | 14,0 s | 1,2 % | 10.115 | 2.426 | 1.403 | 1.326 |

## Die 400er-Probe (`ausgewogenheit-probe`, Saatbasis von `test/ausgewogenheit.test.ts`)

| Variante | Spanne | Meuchler | Untot (Antritte) |
|---|---|---|---|
| **Basis** | x1,48 – x0,64 | x0,64 (398) | x1,10 (110) |
| Leben +12,5 % | x1,36 – x0,81 | x0,81 (570) | x0,93 (108) |
| Leben +25 % | x1,29 – x0,71 | x0,98 (672) | **zu dünn (92)** |
| Rüstung +10 | x1,35 – x0,86 | x0,86 (575) | x0,87 (109) |
| Marke +Leben | x1,29 – x0,74 | x0,99 (700) | **zu dünn (78)** |
| gestaffelt 875 | x1,31 – x0,81 | x0,85 (565) | x1,04 (119) |
| **gestaffelt 950** | x1,31 – x0,80 | x0,84 (565) | x1,12 (**122**) |

`test/` des Pakets aus der Kopie „gestaffelt 950": 338 / 338 grün, vor dem
Umbau in `src/`.

## Was die Zahlen sagen

1. **Tempo scheidet aus, auch in der Tauschprobe.** Halbe Schrittpause lässt
   die Tauschprobe praktisch unverändert (Gassendieb 0,75 → 0,76,
   Schattenklinge 0,82 → 0,78) und drückt die Marke von x0,63 auf x0,55. Das
   bestätigt `TAFELRUNDE-MEUCHLER-ANKOMMEN.md` mit dem zweiten Werkzeug. Die
   Erklärung der neunten Messung („die Nachbarordnung kostet ihn sein
   schnelles Ankommen") trägt damit auf beiden Werkzeugen nicht mehr.
2. **Der Marken-Bonus trifft die Falschen.** Doppeltes Markentempo und ein
   Lebensbonus auf der Marke heben vor allem den **Nachtpfeil**. Das ist ein
   Schütze mit Marke Meuchler, der schon in der Mitte stand (x1,03 → x1,30
   bzw. x1,35). Die Klingentänzerin steigt beim Lebensbonus mit auf x1,16. Der
   **Knochenspäher** trägt die Marke Untot, bekommt also keinen Bonus, und
   fällt auf x0,63 bzw. x0,59. Er bleibt die letzte Zeile. Beim Lebensbonus
   fällt zusätzlich Untot in der Probe unter die Zählschwelle (78 Antritte).
   Ein Lebensbonus **statt** des Tempos ändert gar nichts (x0,63): Die Marke
   hält fast immer nur die erste Schwelle, und dort sind +15 % Leben und
   +15 % Tempo gleich viel wert.
3. **Werte wirken, und zwar genau dort, wo sie stehen.** Rüstung +10 und
   Leben +12,5 % sind gleichwertig (Marke x0,87–0,89, Tauschprobe
   Gassendieb/Schattenklinge um x0,92). Bei beiden bleibt der Knochenspäher
   aber mit x0,73–0,74 die letzte Zeile seiner Stufe. Leben +25 % hebt die
   Marke auf x1,0, überzieht aber die Schattenklinge (x1,15, Spitze der
   Stufe) und lässt Untot in der Probe unter die Zählschwelle fallen.
4. **Gestaffelt ist der einzige Kandidat, der alle drei aus der letzten Zeile
   holt.** Mit 585 / 745 / 950 stehen Gassendieb und Schattenklinge bei x0,92,
   der Knochenspäher bei x0,89/0,92, vor Grimmbart. Keine Zeile geht über den
   Schnitt ihrer Stufe. Die Marke steigt auf x0,86/0,85 (normiert
   x0,87/0,88). Roh ist sie damit nicht mehr die unterste Zeile, das ist
   jetzt Drache (x0,80/0,75). Normiert bleibt sie knapp unten, hinter
   Elementar (x0,91/0,88). Die rohe Spanne schrumpft auf v1 von x1,57–0,63
   auf x1,28–0,80, auf v2 von x1,57–0,64 auf x1,32–0,75.
5. **Untot wird dicker statt dünner.** Der Knochenspäher trägt Untot. Der Bot
   kauft ihn mit 950 Leben rund zweieinhalbmal so oft (569 → 1.403), und die
   dünnste Zeile der Probe steigt von 110 auf 122 Antritte. Bei jedem anderen
   Kandidaten sinkt sie.
6. **Der Preis.** „Vorzeitig einseitig" steigt von 28,2 auf 30,8 %. Kämpfe
   werden 0,6 s kürzer, die Partie 11 s. Abbrüche an der Höchstdauer sinken
   von 1,7 auf 1,2 %. Das Geld kommt von Wächter und Krieger (−0,2 bis −0,3).
   Naturwesen, Elementar und Drache steigen leicht.

## Warum 950 und nicht 875 für den Knochenspäher

Mit 875 (+25 %) bleibt er bei x0,83 die letzte Zeile seiner Stufe, mit 950
(+36 %) steht er vor Grimmbart. Die Marken ändern sich zwischen beiden kaum
(Meuchler x0,87 → x0,86). Untot gewinnt 115 Antritte auf 5.000 Partien und
drei in der Probe. Der Aufschlag ist größer als bei den beiden anderen, weil
der Meuchlerbonus ihn nicht erreicht.

Nebenbei: Mit 950 hat der Knochenspäher das meiste Leben aller
Zwei-Gold-Einheiten, vor Grimmbart (900) und Hainwächterin (850). Wirksam,
also Leben geteilt durch den Rüstungsrest, liegt er mit 950 / 0,80 ≈ 1.190
trotzdem klar unter den beiden Wachen (900 / 0,60 = 1.500 und
850 / 0,55 ≈ 1.545), weil sie 40–45 Rüstung tragen und er 20.

## Was diese Messung nicht sagt

- Ob der Bot mit den neuen Werten **besser** spielt. Er kauft mehr Meuchler,
  weil `staerke` Leben zählt. Ein Sitzduell alter gegen neuer Stand ist nicht
  gelaufen.
- Acht Sitze. Gemessen ist nur zu viert, wie auf der Karte.
- Die Kombination mit der Zielwahl (`meuchlerZielwahl = 'fernkaempfer'`,
  `TAFELRUNDE-MEUCHLER-ZIELWAHL-PROBE.md`). Die Zielwahl bleibt aus.
- Die Anzeige: Sie liest die Werte aus der Sicht und schreibt keine ab
  (`packages/client` ist nicht angefasst).
