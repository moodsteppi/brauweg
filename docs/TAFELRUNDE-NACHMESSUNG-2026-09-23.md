# Tafelrunde — Nachmessung der vier Messkarten vom 06.09.2026

Stand: 23.09.2026. **Nur gemessen, nichts umgebaut** — an `src/`, `test/` und
`werkzeug/` ist nichts geändert. Gemessen auf `origin/staging` = `c007ec1`
(„Tafelrunde: das Ziehen mit dem Finger fehlt auf /probe/ruestkammer (#245)"),
Node 24.16.0, Windows. Alle Läufe sind bestimmt: dieselben Schalter ergeben auf
jedem Rechner dieselbe Tabelle.

Vorher gebaut:

```bash
npm run build --workspace @brauweg/game-api
npm run build --workspace @brauweg/game-tafelrunde
```

Die vollen Kartentexte waren beim Messen nicht lesbar (`board.mjs offen` kürzt
sie auf 200 Zeichen, der MCP-Server `broweg` antwortete mit „crypto is not
defined"). Wo die Karte Partienzahl oder Saatbasis nicht im lesbaren Anfang
nennt, steht unten, woher der Wert stammt.

| Karte | Aussage | alt (06.09.) | neu (23.09., c007ec1) | Urteil |
|---|---|---|---|---|
| 08828981 | Bot nutzt die mittleren Reihen nie | nur R0 und R3 | R0 36,3 · **R1 24,9 · R2 38,6** · R3 0,2 % | a — überholt |
| f9e6adad | Untot ist die dünnste Marke der Probe | 123 Antritte | **105** Antritte, weiter die dünnste | b — gilt weiter |
| c3b764a9 | Meuchler fällt auf x0,67 | x0,67 | **x0,64** (v1) / **x0,67** (v2), unterste Zeile | b — gilt weiter |
| 2303677b | `staerke` sagt die Kampf-Rangfolge nicht vorher | Beispiele Astschütze/Irrlicht, Dorfwache/Steinschleuderer | Spearman nackt **−0,21** über 22 Einheiten | b — gilt weiter |

---

## 08828981 — der Bot benutzt die beiden mittleren Reihen nie

Karte: 300 Partien zu viert, 26.395 aufgestellte Einheiten, „ausschließlich
Reihe 0 und Reihe 3". Saatbasis im lesbaren Teil nicht genannt — genommen ist
die Vorgabe des Werkzeugs, `laufwege-v1`.

```bash
node packages/game-tafelrunde/werkzeug/laufwege.mjs --partien 300
node packages/game-tafelrunde/werkzeug/laufwege.mjs --partien 2000
```

300 Partien zu 4, laufwege-v1, 5.243 Kämpfe, 27.513 aufgestellte Einheiten:

```
Reihen (0 = vorn)  R0 36.3 %  R1 24.9 %  R2 38.6 %  R3 0.2 %
wache           9979   Reihen 100%
meuchler        6860          0% 100%
beistand         694          0%   0% 100%
schuetze        5994          0%   0% 100%
magier          3986          0%   0%  98%   2%
Markenspanne x0.673 bis x1.439 (6 Marken ab 100 Antritten)
Bewegungen je Kampf Median 11, Schnitt 11.13
```

2.000 Partien zu 4, laufwege-v1, 34.938 Kämpfe:

```
Reihen (0 = vorn)  R0 36.8 %  R1 24.7 %  R2 38.1 %  R3 0.4 %
magier         27262          0%   0%  97%   3%
Markenspanne x0.652 bis x1.537 (7 Marken ab 100 Antritten)
Bewegungen je Kampf Median 11, Schnitt 11.08
```

**Urteil a.** Die mittleren Reihen sind belegt (R1 = Meuchler, R2 = Beistand,
Schützen, Magier; `wunschreihe` in `packages/game-tafelrunde/src/bot.ts:698`).
Das Bild hat sich umgedreht: Jetzt ist die **hinterste** Reihe fast leer
(0,2–0,4 %, nur Magier mit Reichweite 4). Das ist ein anderer Befund als der
der Karte und keine Aussage darüber, ob er ein Fehler ist.

Nebenbefund zum Kommentar `bot.ts:614–617`: Die Reihenzahlen dort
(36,8 / 24,9 / 37,8 / 0,4 %) liegen nah an der Messung, die Markenspanne dort
(x0,542 bis x1,600) nicht mehr — gemessen sind x0,652 bis x1,537. Der
Kommentar ist nicht angefasst.

## f9e6adad — Untot ist die dünnste Marke der Probe

Karte: 400-Partien-Probe aus `test/ausgewogenheit.test.ts`, 123 Antritte.
Befehl wörtlich aus dem Kopf dieser Probe (`test/ausgewogenheit.test.ts:84`):

```bash
node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 400 --sitze 4 --saat ausgewogenheit-probe --mindest 100
```

```
SIEGQUOTE JE MARKE (Schnitt der gezaehlten Zeilen: 29.3 %)
  Marke       Antritte  Siege   Quote  zum Schnitt
  Wächter          594    259  43.6 %        x1.49
  Krieger          599    247  41.2 %        x1.41
  Untot            105     36  34.3 %        x1.17
  Drache           317     74  23.3 %        x0.80
  Elementar        428     96  22.4 %        x0.77
  Naturwesen       376     76  20.2 %        x0.69
  Meuchler         418     84  20.1 %        x0.69
```

**Urteil b.** Untot ist mit 105 Antritten weiter die dünnste Zeile, jetzt
fünf über der Zählschwelle 100 (`MINDEST_ANTRITTE`). Die sieben Zahlen
stimmen genau mit dem Kommentar `test/ausgewogenheit.test.ts:69–71`
(„Stand 18.09.2026") überein — seitdem hat sich an dem, was der Bot kauft,
nichts verschoben.

## c3b764a9 — Meuchler fällt nach der Nachbarordnung auf x0,67

Karte: 5.000 Partien zu viert, `--mindest 150`, beide Saatbasen. Die beiden
Basen sind die aus `docs/spiele/auto-battler-konzept.md` (Tabelle „v1 / v2"):

```bash
node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150 --saat ausgewogenheit-v1
node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150 --saat ausgewogenheit-v2
```

| Marke | v1 Antritte | v1 zum Schnitt | v1 gleiche Kostensumme | v2 Antritte | v2 zum Schnitt | v2 gleiche Kostensumme |
|---|---|---|---|---|---|---|
| Wächter | 7.419 | x1,54 | x1,55 | 7.343 | x1,55 | x1,54 |
| Krieger | 7.490 | x1,48 | x1,49 | 7.496 | x1,50 | x1,50 |
| Untot | 1.355 | x1,03 | x1,11 | 1.269 | x0,98 | x1,06 |
| Naturwesen | 4.643 | x0,80 | x0,96 | 4.579 | x0,81 | x0,96 |
| Elementar | 5.385 | x0,77 | x0,82 | 5.406 | x0,75 | x0,81 |
| Drache | 3.970 | x0,75 | x0,89 | 3.971 | x0,73 | x0,87 |
| **Meuchler** | 5.202 | **x0,64** | **x0,65** | 5.268 | **x0,67** | **x0,68** |

Schnitt der gezählten Zeilen: 28,6 % (v1), 28,4 % (v2). Rechenzeit je Lauf
rund 115 s.

**Urteil b.** Meuchler ist auf beiden Basen die unterste Zeile, roh und gegen
gleich teure Bretter. Die Karte nennt x0,67; v1 liegt heute bei x0,64.

## 2303677b — `staerke` sagt die Rangfolge im Kampf nicht vorher

Karte (Anfang) und `docs/spiele/auto-battler-konzept.md`, Befund 6:
Monokultur-Turnier, „Astschütze (x1,01 der Stufe) gewinnt 28,6 %, Irrlicht
(x0,74) dagegen 42,9 %; Dorfwache (x1,05) gewinnt 89,3 %, Steinschleuderer
(x0,98) nur 57,1 %". Welche Saatenzahl das war, steht nicht im lesbaren Teil;
gemessen ist mit der Vorgabe (3), zur Gegenprobe mit 2 und 10 — die Quoten
ändern sich dabei höchstens um wenige Prozentpunkte, die Rangfolge nicht.

```bash
node packages/game-tafelrunde/werkzeug/turnier.mjs                     # Tabelle
node packages/game-tafelrunde/werkzeug/turnier.mjs --saaten 2  --json
node packages/game-tafelrunde/werkzeug/turnier.mjs --saaten 3  --json
node packages/game-tafelrunde/werkzeug/turnier.mjs --saaten 10 --json
```

`staerke` ist nicht exportiert. Um die echte Funktion zu messen, ohne das
Modul zu ändern, ist `dist/` **außerhalb des Repos** kopiert und dort in
`src/bot.js` eine Zeile `export { staerke as __staerke, VOLLE_DECKUNG as
__VOLL, KEINE_DECKUNG as __KEINE };` angehängt (dieselbe Idee wie
`laufwege-variante.mjs`). Eine Wegwerf-Auswertung stellt `staerke` bei
Sternstufe 1 neben die Turnierquote, einmal ohne Deckung (so bewertet der Bot
eine Einheit allein und ein Heer ohne Vorderreihe — also genau die
Monokultur eines Schützen) und einmal mit voller Deckung. „x Stufe" ist
`staerke` geteilt durch den Schnitt der Kostenstufe.

Turnier `--saaten 3`, Saatbasis turnier-v1, 3 Kopien, Sternstufe 1:

| Gold | Einheit | Rolle | Quote | staerke nackt | x Stufe | volle Deckung | x Stufe |
|---|---|---|---|---|---|---|---|
| 1 | Funkenlehrling | magier | 100,0 % | 201 | x0,95 | 302 | x1,18 |
| 1 | Dorfwache | wache | 71,4 % | 211 | x1,00 | 211 | x0,83 |
| 1 | Steinschleuderer | schuetze | 71,4 % | 197 | x0,93 | 295 | x1,16 |
| 1 | Astschütze | schuetze | 57,1 % | 203 | x0,96 | 305 | x1,20 |
| 1 | Moosheiler | beistand | 42,9 % | 191 | x0,90 | 239 | x0,94 |
| 1 | Schildknappe | wache | 28,6 % | 203 | x0,96 | 203 | x0,80 |
| 1 | Gassendieb | meuchler | 28,6 % | 279 | **x1,32** | 279 | x1,09 |
| 1 | Irrlicht | wache | 0,0 % | 205 | x0,97 | 205 | x0,80 |
| 2 | Bogenmeisterin | schuetze | 100,0 % | 408 | x0,97 | 613 | x1,21 |
| 2 | Nachtpfeil | schuetze | 85,7 % | 367 | x0,87 | 551 | x1,09 |
| 2 | Frostweberin | magier | 71,4 % | 390 | x0,92 | 585 | x1,15 |
| 2 | Schattenklinge | meuchler | 52,4 % | 528 | **x1,25** | 528 | x1,04 |
| 2 | Runenpriester | beistand | 42,9 % | 383 | x0,91 | 479 | x0,94 |
| 2 | Hainwächterin | wache | 33,3 % | 422 | x1,00 | 422 | x0,83 |
| 2 | Knochenspäher | meuchler | 14,3 % | 473 | x1,12 | 473 | x0,93 |
| 2 | Grimmbart | wache | 0,0 % | 405 | x0,96 | 405 | x0,80 |
| 3 | Sturmrufer | magier | 96,7 % | 676 | x0,95 | 1183 | x1,28 |
| 3 | Drachenkind | schuetze | 83,3 % | 672 | x0,94 | 1009 | x1,09 |
| 3 | Klingentänzerin | meuchler | 60,0 % | 971 | **x1,36** | 971 | x1,05 |
| 3 | Lichtwahrerin | beistand | 40,0 % | 675 | x0,95 | 844 | x0,92 |
| 3 | Wurzelriese | wache | 20,0 % | 800 | x1,12 | 800 | x0,87 |
| 3 | Grabfürstin | magier | 0,0 % | 485 | x0,68 | 727 | x0,79 |

Rangkorrelation (Spearman) Quote gegen `staerke`:

| | 1 Gold (n=8) | 2 Gold (n=8) | 3 Gold (n=6) | alle, je Stufe normiert (n=22) |
|---|---|---|---|---|
| nackt | −0,38 | −0,31 | +0,26 | **−0,21** |
| volle Deckung | +0,61 | +0,95 | +1,00 | +0,79 |

`--saaten 2` und `--saaten 10` ergeben dieselben Korrelationen auf zwei
Stellen.

**Urteil b.** Ohne Deckung — so bewertet der Bot beim Kauf eine einzelne
Einheit — sagt `staerke` die Rangfolge nicht vorher, im Gegenteil: Die drei
Meuchler, die der Bot am höchsten ansetzt (Gassendieb x1,32, Schattenklinge
x1,25, Klingentänzerin x1,36), stehen im Turnier im Mittelfeld oder darunter.
Erst mit voller Deckung passt die Rangfolge, und die bekommt ein Schütze nur
hinter einer Vorderreihe. Die Beispielpaare der Karte haben sich verschoben:
Irrlicht gewinnt heute 0,0 % statt 42,9 %, Astschütze 57,1 % statt 28,6 %,
Dorfwache und Steinschleuderer stehen gleich (71,4 %). Die Erklärung der
Karte („Zähigkeit ist mehr wert, als das Produkt hergibt") trägt damit nicht
mehr: In diesem Turnier gewinnen die Wachen als Rolle am seltensten (25,8 %).
Ist-Stand: `staerke` in `packages/game-tafelrunde/src/bot.ts:482`.

Was das Turnier nicht sagt: ob der Bot damit schlechte **Bretter** baut. Drei
Kopien derselben Einheit baut niemand (Kopf von `werkzeug/turnier.mjs`).
