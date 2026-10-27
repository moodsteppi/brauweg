# Tafelrunde — Probe: Meuchler suchen Fernkämpfer

Stand: 23.09.2026. **Ein Vergleichsschalter, keine Regel.** Im Spiel greift
nichts davon: `STANDARD_REGLER.meuchlerZielwahl` steht auf `'naechster'`, und
mit diesem Wert läuft jeder Kampf Ereignis für Ereignis wie vorher. Ob ein
Meuchler künftig Fernkämpfer sucht, ist eine neue Regel im Sinn des Kopfes von
`packages/game-tafelrunde/src/kampf.ts` — **darüber entscheidet ein Mensch**,
diese Datei liefert nur die Zahlen dafür.

Anlass: `docs/TAFELRUNDE-MEUCHLER-KAMPFBILD.md`, Abschnitt „Welcher Hebel die
Zahlen am ehesten erklärt" — `sucheZiel` gibt jedem Meuchler den Nächsten,
62–74 % seiner Hiebe landen auf der gepanzerten vorderen Reihe.

Gemessen auf `origin/staging` = `a7a7ccd` („Tafelrunde: die sieben
Antrittszahlen im Kommentar von ausgewogenheit.test.ts stimmen seit #249 nicht
mehr (#252)") plus dem Schalter auf diesem Zweig. Node 24.16.0, Windows. Alle
Läufe sind bestimmt: gleiche Schalter, gleiche Tabelle.

## Was gebaut ist

| Stelle | Was |
|---|---|
| `packages/game-tafelrunde/src/kampf.ts:408` | neues Reglerfeld `meuchlerZielwahl: 'naechster' \| 'fernkaempfer'` |
| `src/kampf.ts:445` | `STANDARD_REGLER.meuchlerZielwahl = 'naechster'` — der gebaute Stand |
| `src/kampf.ts:819` | `FERNKAEMPFER_ROLLEN` = Schütze, Magier, Beistand |
| `src/kampf.ts:831` | `waehleZiel`: Meuchler unter `'fernkaempfer'` nimmt den nächsten lebenden Fernkämpfer (Abstand, dann Rang — dieselbe Gleichstandsregel wie `sucheZiel`), sonst den Nächsten |
| `src/kampf.ts:785` | `sucheZiel` bekommt einen optionalen Filter; ohne ihn unverändert |
| `src/kampf.ts:1060` | die Zugschleife fragt `waehleZiel` statt `sucheZiel` |
| `src/kampf.ts:1124`, `:1139` | Schritt auf das gewählte Ziel; eingekeilt Ersatzhieb (siehe unten) |
| `werkzeug/ausgewogenheit.mjs`, `werkzeug/meuchler-kampfbild.mjs` | Schalter `--meuchlerziel naechster\|fernkaempfer`, Vorgabe aus dem Standard; abweichend meldet die Kopfzeile `ABWEICHENDER STAND` |
| `test/kampf.test.ts:402` | neue Probe (siehe unten) |

**Die Rollen, am Katalog belegt** (`src/katalog.ts`, `werteFuer(id, 1).reichweite`):
Schützen (Astschütze, Steinschleuderer, Bogenmeisterin, Nachtpfeil, Drachenkind)
und Magier (Funkenlehrling, Frostweberin, Grabfürstin 3, Sturmrufer 4) haben
Reichweite 3–4, jeder Beistand (Moosheiler, Runenpriester, Lichtwahrerin) 2,
jede Wache und jeder Meuchler 1. Die drei Rollen sind damit genau die Menge,
die `meuchler-kampfbild.mjs` als „Fern" zählt (`reichweite > 1`). Gefragt wird
im Kampf trotzdem die Rolle, nicht die Zahl.

### `schrittZiel` und der Ersatzhieb

`schrittZiel` bekommt schon heute den Platz des gewählten Ziels
(`schrittZiel(wer, ziel.platz, belegt)`). Weil `ziel` jetzt aus `waehleZiel`
kommt, läuft der Meuchler auf den Fernkämpfer zu und nicht auf die Front —
dafür musste an `schrittZiel` nichts geändert werden.

Offen bleibt die Regel „nur **strikt** näher". Steht die gegnerische Wache auf
dem einzigen Feld, das dem Schützen näher liegt, ist der Meuchler eingekeilt.
Ohne weitere Zeile stünde er dann neben dieser Wache und täte bis zur
Höchstdauer nichts, während sie auf ihn einschlägt. Deshalb schlägt er,
wenn er eingekeilt ist, den **nächsten** Gegner, sofern der in Reichweite
steht (`:1139`). Ein Seitwärtsschritt auf gleich weite Felder wäre die andere
Lösung. Den verbietet der Kommentar an `schrittZiel` aber aus gutem Grund
(zwei Blockierte laufen umeinander herum), deshalb ist er nicht gebaut.

**Im Standard greift der Ersatzhieb nie:** Dort ist `ziel` schon der Nächste.
Wenn der außer Reichweite steht, gilt das für jeden anderen auch.

## Nachweis: der Standard ist unverändert

| Lauf | Ergebnis |
|---|---|
| `npm test` in `packages/game-tafelrunde`, **vor** der Änderung (a7a7ccd) | **337 / 337** grün |
| dasselbe **nach** der Änderung | **338 / 338** grün = die 337 + die neue Probe |
| `meuchler-kampfbild.mjs` v1 mit Regler aus | alle Zahlen gleich wie in `TAFELRUNDE-MEUCHLER-KAMPFBILD.md` (gemessen auf 91099b9), 52.551 Kämpfe |
| `ausgewogenheit.mjs` v1/v2 mit Regler aus | Meuchler x0,63 / x0,64 — der Stand nach #249 |

Die neue Probe („laesst einen Meuchler unter meuchlerZielwahl den Schuetzen
statt der naeheren Wache angreifen"): Klingentänzerin gegen eine Wache
genau gegenüber (Abstand 3) und einen Astschützen eine Reihe dahinter am Rand
(Abstand 4). Mit dem Standard geht ihr erster Hieb auf die Wache, mit
`'fernkaempfer'` auf den Schützen. Beide Hälften stecken in derselben Probe:
Wer den Standard umstellt, bekommt sie rot.

## Befehle

```bash
npm run build --workspace @brauweg/game-api
npm run build --workspace @brauweg/game-tafelrunde
# Markentabelle, je Saat aus und an
node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150 --saat ausgewogenheit-v1
node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150 --saat ausgewogenheit-v1 --meuchlerziel fernkaempfer
node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150 --saat ausgewogenheit-v2
node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150 --saat ausgewogenheit-v2 --meuchlerziel fernkaempfer
# Kampfbild, je Saat aus und an
node packages/game-tafelrunde/werkzeug/meuchler-kampfbild.mjs --partien 3000 --saat meuchler-kampfbild-v1
node packages/game-tafelrunde/werkzeug/meuchler-kampfbild.mjs --partien 3000 --saat meuchler-kampfbild-v1 --meuchlerziel fernkaempfer
node packages/game-tafelrunde/werkzeug/meuchler-kampfbild.mjs --partien 3000 --saat meuchler-kampfbild-v2
node packages/game-tafelrunde/werkzeug/meuchler-kampfbild.mjs --partien 3000 --saat meuchler-kampfbild-v2 --meuchlerziel fernkaempfer
```

Ausgewogenheit rund 115 s je Lauf, Kampfbild rund 70 s.

**Der Bot kennt den Schalter nicht.** Er kauft Meuchler und stellt sie auf, als
griffen sie den Nächsten an (`src/bot.ts` ist nicht angefasst). Die Zahlen
unten zeigen also, was die Zielwahl bei **unverändertem** Bot bewirkt.

## Markentabelle: aus gegen an

5.000 Partien zu viert, `--mindest 150`. „zum Schnitt" = Siegquote geteilt
durch den Schnitt der gezählten Zeilen; „gleiche Kostensumme" = Siege je
erwartetem Sieg gegen gleich teure Bretter.

| Marke | v1 aus | v1 an | v1 gleiche Kosten aus → an | v2 aus | v2 an | v2 gleiche Kosten aus → an |
|---|---|---|---|---|---|---|
| Wächter | x1,57 | x1,45 | x1,53 → x1,43 | x1,57 | x1,46 | x1,53 → x1,43 |
| Krieger | x1,50 | x1,42 | x1,47 → x1,40 | x1,51 | x1,42 | x1,49 → x1,41 |
| Untot | x0,98 | x0,91 | x1,06 → x0,99 | x1,01 | x0,90 | x1,10 → x0,98 |
| Naturwesen | x0,81 | x0,84 | x0,97 → x0,98 | x0,79 | x0,81 | x0,96 → x0,95 |
| Elementar | x0,77 | x0,78 | x0,83 → x0,84 | x0,75 | x0,79 | x0,80 → x0,83 |
| Drache | x0,75 | x0,74 | x0,89 → x0,89 | x0,72 | x0,73 | x0,87 → x0,88 |
| **Meuchler** | **x0,63** | **x0,86** | **x0,64 → x0,81** | **x0,64** | **x0,88** | **x0,66 → x0,82** |

Antritte der Marke Meuchler: v1 5.061 → 4.979, v2 5.099 → 4.956. Siegquote
roh: v1 17,8 % → 24,2 %, v2 18,3 % → 24,7 %. Schnitt der gezählten Zeilen: v1
28,3 % → 28,0 %, v2 28,6 % → 28,0 %.

Nebenwirkungen auf die Partie (v1 aus → an; v2 in Klammern):

| | aus | an |
|---|---|---|
| vorzeitig einseitig | 28,2 % (27,8 %) | 31,1 % (31,3 %) |
| Spielzeit im Median | 5:50 (5:48) | 5:44 (5:46) |
| einzelner Kampf im Median | 14,6 s (14,5 s) | 14,0 s (13,8 s) |
| Kämpfe an der Höchstdauer | 1,7 % (1,7 %) | 1,6 % (1,6 %) |

Einzeleinheiten mit Marke Meuchler, gegen Bretter gleicher Kostensumme (v1):
Gassendieb x0,58 → x0,75, Schattenklinge x0,59 → x0,72, Nachtpfeil (Schütze)
x0,61 → x0,71, Knochenspäher x0,65 → x0,65, Klingentänzerin x1,38 → x1,40.

## Kampfbild: aus gegen an

`meuchler-kampfbild.mjs`, 3.000 Partien zu viert. v1: 52.551 → 51.982
Kämpfe, v2: 52.366 → 51.847. Werte als **v1 aus → an** (v2 aus → an).

### Zielwahl der vier Meuchler

| Einheit | Hiebe auf Reihe 0 | Hiebe auf Fernkämpfer | 1. Hieb auf Fern (wenn da) |
|---|---|---|---|
| Gassendieb | 64,9 → 55,8 % (64,0 → 54,8) | 14,0 → 27,8 % (14,3 → 28,4) | **6,6 → 54,4 %** (6,3 → 54,8) |
| Schattenklinge | 73,7 → 52,6 % (70,6 → 51,2) | 16,1 → 39,2 % (17,4 → 39,9) | **3,5 → 58,3 %** (4,0 → 59,3) |
| Knochenspäher | 61,8 → 52,0 % (66,5 → 57,5) | 22,6 → 37,8 % (20,7 → 35,9) | **9,1 → 45,9 %** (8,6 → 40,1) |
| Klingentänzerin | 65,3 → 52,1 % (62,3 → 51,1) | 23,0 → 39,1 % (24,5 → 39,9) | **12,8 → 53,0 %** (11,8 → 52,9) |

Auch mit Schalter geht noch rund die Hälfte der Hiebe auf Reihe 0.
**Vermutet, nicht gezählt:** Das sind vor allem Ersatzhiebe aus der Lage
„eingekeilt" (die vordere Reihe versperrt den Weg, und der Meuchler schlägt
die Wache neben sich) sowie Hiebe, nachdem alle Fernkämpfer gefallen sind. Das
Kampfbild-Werkzeug unterscheidet die beiden Fälle nicht.

### Anmarsch, Wirkung, Lebensdauer

| Einheit | 1. Hieb Median | Schritte bis Hieb | nie gehauen | Schaden je Gold | Schaden je s | stirbt | Tod Median |
|---|---|---|---|---|---|---|---|
| Gassendieb | 0,4 → 0,6 s | 2,0 → 2,4 | 0,1 → 0,1 % | 223 → 250 (222 → 249) | 90 → 96 | 70,1 → 60,3 % | 6,0 → 6,7 s |
| Schattenklinge | 0,4 → 0,7 s | 2,0 → 2,7 | 0,2 → 0,1 % | 211 → 216 (208 → 212) | 100 → 114 | 76,9 → 70,7 % | 6,7 → 5,3 s |
| Knochenspäher | 0,7 → 1,0 s | 2,3 → 2,7 | 2,1 → 0,7 % | 172 → 184 (186 → 203) | 65 → 76 | 67,4 → 67,3 % | 8,6 → 8,1 s |
| Klingentänzerin | 0,4 → 0,8 s | 2,3 → 2,7 | 3,6 → 2,1 % | 282 → 283 (285 → 285) | 63 → 73 | 58,6 → 57,9 % | 8,3 → 6,7 s |

Die Gegenseite (v1):

| Einheit | Schaden je Gold | stirbt | Tod Median | getötet von Meuchler |
|---|---|---|---|---|
| Astschütze | 338 → 304 | 70,7 → 75,4 % | 12,3 → 10,1 s | 16,4 → 32,7 % |
| Bogenmeisterin | 344 → 324 | 39,5 → 44,1 % | 14,5 → 12,3 s | 11,3 → 26,0 % |
| Drachenkind | 356 → 325 | 44,2 → 47,3 % | 12,4 → 10,9 s | 10,6 → 21,0 % |
| Nachtpfeil | 288 → 266 | 58,7 → 61,5 % | 10,8 → 9,5 s | 8,7 → 27,9 % |
| Dorfwache | 222 → 228 | 62,1 → 61,7 % | 12,9 → 13,5 s | 25,6 → 25,6 % |
| Wurzelriese | 192 → 196 | 55,1 → 52,7 % | 11,1 → 12,1 s | 13,6 → 12,4 % |

## Was die Zahlen sagen

1. **Die Zielwahl ist der Hebel, den das Kampfbild vermutet hat.** Allein der
   Schalter hebt die Marke Meuchler von x0,63/x0,64 auf x0,86/x0,88, gegen
   gleich teure Bretter von x0,64/x0,66 auf x0,81/x0,82. Beide Saaten zeigen
   dasselbe, an keinem Wert und keinem Bot wurde gedreht. Meuchler ist damit
   nicht mehr die unterste Marke, sondern liegt zwischen Untot und Naturwesen.
2. **x1,0 erreicht sie nicht.** Rund die Hälfte der Hiebe geht weiter auf die
   Front, und der Bot stellt Meuchler unverändert auf
   (Reihe 1, Rand).
3. **Das Geld kommt von oben.** Wächter und Krieger verlieren je rund 0,1,
   Untot rund 0,07–0,11. Die drei schwachen Marken (Naturwesen, Elementar,
   Drache) bleiben stehen. Die Spanne der Marken schrumpft von x0,63–x1,57 auf
   x0,74–x1,45 (v1).
4. **Die Fernkämpfer bezahlen es.** Der Astschütze stirbt in 75 statt 71 %
   der Kämpfe und zwei Sekunden früher. Schaden je Gold fällt bei allen vier
   Schützen der Tabelle um 6–10 %. Wachen merken fast nichts.
5. **Die Partie wird ein wenig einseitiger und kürzer:** +3 Prozentpunkte
   „vorzeitig einseitig", Kampf 0,6 s kürzer, Spielzeit 4–6 s kürzer.

## Was diese Messung nicht sagt

- Was ein Bot aus der Regel macht, der sie kennt (Meuchler anders bewerten,
  weiter vorn oder in der Mitte aufstellen). `src/bot.ts` ist nicht angefasst.
- Ob der Ersatzhieb richtig ist oder ob ein eingekeilter Meuchler lieber
  seitwärts laufen sollte. Das wäre eine zweite Regeländerung, und zwar an
  `schrittZiel`, das alle Einheiten benutzen.
- Ob die Anzeige damit klarkommt. Sie spielt das Protokoll nur ab
  (`packages/client` ist nicht angefasst), ein Meuchler, der an der Front
  vorbeiläuft, ist dort aber nie gezeigt worden.
- Die Schwellen in `test/ausgewogenheit.test.ts` sind nicht angefasst. Die
  Probe dort misst den Standard, und der ist unverändert.
