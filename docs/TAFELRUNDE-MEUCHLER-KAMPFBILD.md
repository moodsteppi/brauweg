# Tafelrunde — was Meuchler im Kampf ausrichten

Stand: 23.09.2026. **Reine Messung, nichts umgebaut** — kein Wert, keine Regel,
nichts in `src/` oder `test/` angefasst. Anlass ist das Urteil in
`docs/TAFELRUNDE-NACHMESSUNG-2026-09-23.md`, Abschnitt „Nachmessung nach
#249": Meuchler bleibt die unterste Marke (x0,63 v1 / x0,64 v2 / x0,64 Probe),
obwohl der Bot sie seit #249 seltener kauft — die Ursache sitze also nicht darin,
**wie oft** der Bot sie kauft, sondern darin, **was sie auf dem Brett
ausrichten**. Diese Datei beantwortet die zweite Frage.

Gemessen auf `origin/staging` = `91099b9` („Tafelrunde: Meuchler-Marke
nachmessen, nachdem der Bot Meuchler anders bewertet (#250)"), Node 24,
Windows. Seit `9e14a85` hat sich an Tafelrunde nur Dokumentation geändert.

## Befehle

```bash
npm run build --workspace @brauweg/game-api
npm run build --workspace @brauweg/game-tafelrunde
node packages/game-tafelrunde/werkzeug/meuchler-kampfbild.mjs --partien 3000 --saat meuchler-kampfbild-v1
node packages/game-tafelrunde/werkzeug/meuchler-kampfbild.mjs --partien 3000 --saat meuchler-kampfbild-v2
node packages/game-tafelrunde/werkzeug/meuchler-kampfbild.mjs --partien 3000 --saat meuchler-kampfbild-v1 --stufe 1
```

Je Lauf rund 65 s. Das Werkzeug spielt echte Partien zu viert mit dem gebauten
Bot (`botZug`, Besetzung `normal`) und liest jeden Kampfbericht aus
(`start` + Ablaufprotokoll) — es baut keine Zeile von `kampf.ts` nach. v1: 52.551
Kämpfe, v2: 52.366 Kämpfe. Die beiden Saaten weichen in keiner Kerngröße um mehr
als ein, zwei Prozentpunkte voneinander ab; die Tabellen unten sind v1, die
Abweichungen von v2 stehen unter der Tabelle.

**Warum echte Partien und nicht das Monokultur-Turnier** (`werkzeug/turnier.mjs`):
Die Markenquote x0,63 entsteht in der Partie, zwischen Wachen, Schützen und
Heilern, aufgestellt nach `wunschreihe` (Reihe 1, am Rand). Drei gegen drei
derselben Einheit hat weder eine Front noch eine hintere Reihe, und die Frage
„wen trifft er" hätte dort nur eine Antwort.

### Was die Spalten heißen

- **Auftritt** = eine Einheit in einem Kampf. Stufen gemischt, wie der Bot sie
  aufstellt; „Stufe" ist der Schnitt. Nur Stufe 1: Abschnitt unten.
- **1. Hieb** = Zeitpunkt des ersten eigenen `treffer` in Kampfzeit (Zeitraffer 2
  schon eingerechnet). **Schritte bis Hieb** = `bewegung`-Ereignisse davor.
- **tot vor 1. Hieb** = `tod`, ohne je getroffen zu haben. **nie gehauen** =
  dasselbe plus die, die bis Kampfende nicht herankamen.
- **Hiebe / Schaden** = je Auftritt bis zum eigenen Tod (bzw. Kampfende).
  Schaden ist **wirksamer** Schaden: ein Treffer auf ein Ziel mit 20 Leben zählt
  20, nicht 68 (Differenz zum Leben davor, über Treffer und Heilungen
  mitgeführt).
- **je Gold** = geteilt durch `gesamtkosten(id, stufe)`. **je s** = geteilt durch
  die Zeit, die die Einheit im Kampf stand.
- **eingesteckt** = wirksamer Schaden, den die Einheit selbst genommen hat.
- **Reihe 0** = das Ziel stand beim Kampfbeginn in der vordersten Reihe seines
  Bretts. **Fernkämpfer** = Ziel mit Reichweite ≥ 2 (Schütze, Magier,
  Beistand).

## Die Messung (v1, alle Stufen)

### Anmarsch und Wirkung

| Einheit | Auftritte | Stufe | Startreihe | am Rand | 1. Hieb Median | 1. Hieb P10–P90 | Schritte bis Hieb | tot vor 1. Hieb | nie gehauen | Hiebe | Schaden | Schaden je Gold | Schaden je s | eingesteckt je Gold |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Gassendieb** (Meuchler, 1) | 61.248 | 2,0 | 1,0 | 99,4 % | 0,4 s | 0,3–0,7 s | 2,0 | **0,0 %** | 0,1 % | 14,5 | 764 | 223 | **90** | 267 |
| Dorfwache (Wache, 1) | 57.311 | 1,9 | 0,0 | 0,1 % | 0,1 s | 0,1–0,4 s | 1,3 | 0,0 % | 0,1 % | 21,1 | 725 | 222 | 42 | 356 |
| Astschütze (Schütze, 1) | 26.035 | 1,9 | 2,0 | 0,0 % | 0,1 s | 0,1–0,4 s | 1,2 | 0,0 % | 0,0 % | 20,6 | 1.001 | **338** | 70 | 244 |
| **Schattenklinge** (Meuchler, 2) | 2.995 | 1,5 | 1,0 | 80,1 % | 0,4 s | 0,3–0,7 s | 2,0 | **0,0 %** | 0,2 % | 16,6 | 857 | 211 | **100** | 206 |
| **Knochenspäher** (Meuchler, 2) | 1.027 | 1,9 | 1,0 | 90,7 % | 0,7 s | 0,3–13,5 s | 2,3 | **0,0 %** | 2,1 % | 15,2 | 947 | 172 | 65 | 180 |
| Nachtpfeil (Schütze, 2, Marke Meuchler) | 2.746 | 1,5 | 2,0 | 0,0 % | 0,1 s | 0,1–0,4 s | 1,1 | 0,0 % | 0,0 % | 22,1 | 1.148 | 288 | 94 | 138 |
| Grimmbart (Wache, 2) | 1.027 | 1,9 | 0,0 | 4,4 % | 0,1 s | 0,1–0,4 s | 1,3 | 0,0 % | 0,4 % | 15,3 | 697 | 128 | 48 | 253 |
| Bogenmeisterin (Schütze, 2) | 4.574 | 1,6 | 2,0 | 0,0 % | 0,1 s | 0,1–0,4 s | 1,2 | 0,0 % | 0,0 % | 28,7 | 1.543 | **344** | 88 | 108 |
| **Klingentänzerin** (Meuchler, 3) | 2.624 | 1,0 | 1,0 | 87,4 % | 0,4 s | 0,3–13,8 s | 2,3 | **0,0 %** | 3,6 % | 17,9 | 899 | 282 | 63 | 199 |
| Wurzelriese (Wache, 3) | 1.792 | 1,0 | 0,0 | 1,6 % | 0,1 s | 0,1–0,4 s | 1,3 | 0,0 % | 0,2 % | 17,7 | 613 | 192 | 36 | 394 |
| Drachenkind (Schütze, 3) | 1.409 | 1,0 | 2,0 | 0,1 % | 0,1 s | 0,1–0,4 s | 1,1 | 0,0 % | 0,0 % | 18,5 | 1.161 | **356** | 89 | 132 |

### Lebensdauer

| Einheit | stirbt | Tod Median (nur Tote) | Lebensdauer Schnitt | eingesteckt je s | getötet von |
|---|---|---|---|---|---|
| **Gassendieb** | 70,1 % | **6,0 s** | **8,5 s** | **108** | Schütze 33 %, Wache 24 %, Magier 22 %, Meuchler 21 % |
| Dorfwache | 62,1 % | 12,9 s | 17,5 s | 66 | Schütze 29 %, Meuchler 26 %, Magier 24 %, Wache 21 % |
| Astschütze | 70,7 % | 12,3 s | 14,4 s | 50 | Schütze 32 %, Magier 28 %, Wache 24 %, Meuchler 16 % |
| **Schattenklinge** | 76,9 % | **6,7 s** | **8,6 s** | **97** | Schütze 32 %, Magier 28 %, Wache 26 %, Meuchler 14 % |
| **Knochenspäher** | 67,4 % | 8,6 s | 14,5 s | 69 | Schütze 35 %, Magier 33 %, Wache 19 %, Meuchler 13 % |
| Nachtpfeil | 58,7 % | 10,8 s | 12,2 s | 45 | Schütze 36 %, Magier 30 %, Wache 25 %, Meuchler 9 % |
| Grimmbart | 69,1 % | 9,4 s | 14,6 s | 94 | Schütze 35 %, Magier 31 %, Wache 18 %, Meuchler 16 % |
| Bogenmeisterin | 39,5 % | 14,5 s | 17,6 s | 28 | Schütze 37 %, Magier 30 %, Wache 21 %, Meuchler 11 % |
| **Klingentänzerin** | 58,6 % | **8,3 s** | 14,3 s | 44 | Schütze 36 %, Magier 31 %, Wache 20 %, Meuchler 12 % |
| Wurzelriese | 55,1 % | 11,1 s | 17,2 s | 73 | Schütze 34 %, Magier 33 %, Wache 20 %, Meuchler 14 % |
| Drachenkind | 44,2 % | 12,4 s | 13,0 s | 33 | Schütze 43 %, Magier 26 %, Wache 20 %, Meuchler 11 % |

### Zielwahl (Anteil der eigenen Hiebe)

| Einheit | auf Reihe 0 | auf Fernkämpfer | Gegner hat Fernkämpfer | davon: 1. Hieb auf Fern | davon: Hiebe auf Fern | nach Rolle |
|---|---|---|---|---|---|---|
| **Gassendieb** | **64,9 %** | 14,0 % | 70,5 % | **6,6 %** | 23,1 % | Wache 65 %, Meuchler 21 %, Schütze 8 %, Magier 5 %, Beistand 1 % |
| Dorfwache | 59,5 % | 18,0 % | 77,3 % | 1,5 % | 25,0 % | Wache 60 %, Meuchler 23 %, Schütze 10 %, Magier 7 %, Beistand 1 % |
| Astschütze | 60,6 % | 21,5 % | 80,5 % | 0,7 % | 28,4 % | Wache 61 %, Meuchler 18 %, Schütze 12 %, Magier 9 %, Beistand 1 % |
| **Schattenklinge** | **73,7 %** | 16,1 % | 91,9 % | **3,5 %** | 18,3 % | Wache 74 %, Meuchler 10 %, Schütze 9 %, Magier 7 %, Beistand 1 % |
| **Knochenspäher** | **61,8 %** | 22,6 % | 93,9 % | **9,1 %** | 25,0 % | Wache 62 %, Meuchler 16 %, Schütze 12 %, Magier 10 %, Beistand 1 % |
| Nachtpfeil | 66,7 % | 21,9 % | 91,3 % | 0,0 % | 25,0 % | Wache 67 %, Meuchler 11 %, Magier 11 %, Schütze 10 %, Beistand 1 % |
| Grimmbart | 61,9 % | 19,7 % | 92,8 % | 2,1 % | 22,0 % | Wache 62 %, Meuchler 18 %, Schütze 10 %, Magier 9 %, Beistand 1 % |
| Bogenmeisterin | 60,6 % | 25,0 % | 92,5 % | 0,0 % | 27,9 % | Wache 61 %, Meuchler 14 %, Schütze 13 %, Magier 11 %, Beistand 1 % |
| **Klingentänzerin** | **65,3 %** | 23,0 % | 91,4 % | **12,8 %** | 26,1 % | Wache 65 %, Meuchler 12 %, Magier 11 %, Schütze 11 %, Beistand 1 % |
| Wurzelriese | 64,0 % | 21,1 % | 92,2 % | 3,1 % | 23,6 % | Wache 64 %, Meuchler 15 %, Schütze 12 %, Magier 9 %, Beistand 1 % |
| Drachenkind | 62,0 % | 24,5 % | 92,3 % | 0,0 % | 27,5 % | Wache 62 %, Meuchler 14 %, Schütze 13 %, Magier 10 %, Beistand 2 % |

**v2 dagegen** (`meuchler-kampfbild-v2`, 52.366 Kämpfe): Gassendieb Tod Median
6,0 s, Schaden je Gold 222, Reihe 0 64,0 %; Schattenklinge 6,5 s / 208 / 70,6 %;
Knochenspäher 10,5 s / 186 / 66,5 %; Klingentänzerin 8,4 s / 285 / 62,3 %;
tot vor dem ersten Hieb bei allen 0,0 %. Kein Befund hängt an der Saat.

### Nur Stufe 1 (`--stufe 1`, v1)

Die Stufenmischung ist nicht gleich (Gassendieb im Schnitt 2,0, Klingentänzerin
1,0). Auf Stufe 1 allein bleibt das Bild:

| Einheit | Auftritte | Schaden je Gold | Schaden je s | eingesteckt je s | Tod Median | Reihe 0 | 1. Hieb auf Fern (wenn da) |
|---|---|---|---|---|---|---|---|
| Gassendieb | 10.744 | 520 | 55 | 51 | 7,8 s | 60,4 % | 14,7 % |
| Dorfwache | 8.372 | 419 | 25 | 40 | 13,5 s | 61,9 % | 7,5 % |
| Astschütze | 2.497 | 523 | 42 | 28 | 11,6 s | 56,5 % | 1,5 % |
| Schattenklinge | 1.450 | 309 | 76 | 76 | 6,8 s | 75,8 % | 3,5 % |
| Nachtpfeil | 1.386 | 387 | 71 | 36 | 10,3 s | 67,1 % | 0,0 % |
| Bogenmeisterin | 1.728 | 559 | 61 | 16 | 15,3 s | 57,8 % | 0,0 % |
| Klingentänzerin | 2.541 | 291 | 61 | 44 | 8,3 s | 65,4 % | 12,7 % |
| Drachenkind | 1.347 | 373 | 86 | 33 | 12,5 s | 61,9 % | 0,0 % |

Der Gassendieb kommt auf Stufe 1 an den Astschützen heran (520 gegen 523 je
Gold) — dort ist das Brett klein, und er trifft vor allem andere Meuchler (49 %
seiner Tode durch Meuchler). Ab Kostenstufe 2 liegt jeder Meuchler klar unter
dem Schützen seiner Stufe.

## Was die Zahlen sagen

1. **Der Anmarsch kostet in der Partie so gut wie nichts.** Erster Hieb nach
   0,4 s (Median, alle vier), gegenüber 0,1 s bei Wache und Schütze — zwei
   Schritte statt gut einem. **Kein einziger** Meuchler stirbt, bevor er
   zuschlägt (0,0 % in beiden Saaten). Nur Knochenspäher und Klingentänzerin
   bleiben in 2–4 % der Kämpfe ganz ohne Hieb (P90 bei 13–14 s: eingekeilt).
   Die 1,7–2,9 s aus dem Kopf von `ANMARSCH_SEKUNDEN` (`src/bot.ts`)
   stammen aus dem Monokultur-Turnier und gelten auf echten Brettern nicht.
2. **Wenn er steht, schlägt er — am meisten von allen.** Schaden je Sekunde:
   Gassendieb 90, Schattenklinge 100, gegen 42/48 der Wachen und 70/88 der
   Schützen. An der Schlagkraft fehlt es ihm nicht.
3. **Er stirbt doppelt so schnell.** Tod im Median nach 6,0–8,6 s, Wachen und
   Schützen nach 11–15 s. Er nimmt je Sekunde **mehr** Schaden als die Wache
   neben ihm (Gassendieb 108 gegen Dorfwache 66, Schattenklinge 97 gegen
   Grimmbart 94) — er steht also in derselben Front und wird genauso
   angegriffen, mit Schützenleben (Gassendieb 520 Leben / 15 Rüstung ≈ 612
   wirksam; Dorfwache 650 / 40 ≈ 1.083). Getötet wird er zu 55–68 % von
   Schützen und Magiern.
4. **Unterm Strich: Er teilt aus wie eine Wache und hält aus wie ein Schütze.**
   Schaden je Gold: Gassendieb 223 = Dorfwache 222, Astschütze 338;
   Schattenklinge 211 / Knochenspäher 172 gegen Bogenmeisterin 344;
   Klingentänzerin 282 gegen Drachenkind 356. Eingesteckt je Gold (was er dem
   Heer an Schaden abnimmt): 267 / 206 / 180 / 199 gegen 356 / 253 / 394 der
   Wachen. Er ist in keiner der beiden Aufgaben so gut wie die Einheit, die
   dafür da ist.
5. **Er trifft die Front, nicht die hintere Reihe.** 62–74 % seiner Hiebe gehen
   auf die gegnerische Reihe 0, fast alle davon auf Wachen — dasselbe Bild wie
   bei Wache und Schütze (60–67 %). Obwohl der Gegner in über 90 % der Kämpfe
   (Kostenstufe 2 und 3) Fernkämpfer hat, geht der **erste** Hieb nur in 3,5–13 %
   auf einen. Die 21 % Hiebe des Gassendiebs auf Meuchler sind ein Nebeneffekt
   des Randes: Beide Bots stellen ihre Meuchler an den Rand, die
   Punktspiegelung legt diese Ränder in dieselbe Arenaspalte, und dort treffen
   die Meuchler aufeinander.

## Am Code belegt: welche Fähigkeit im Kampf greift

**Keine.** Die Rolle `meuchler` wird im Kampf nicht gelesen. Im Einzelnen:

| Stelle | Was dort steht | Was das für den Meuchler heißt |
|---|---|---|
| `packages/game-tafelrunde/src/kampf.ts:19-26` | Kopfkommentar: „Wache, Schütze, Magier und Meuchler unterscheiden sich weiterhin allein über ihre Werte und ihre `reichweite`" — ein Meuchler mit Sonderwirkung „wäre eine neue Regel" | Absicht, kein Versehen: es gibt keinen Sprung, keine Zielwahl hinten, keinen Krit. |
| `src/kampf.ts:998` | `if (wer.rolle === 'beistand' && …)` — die **einzige** Stelle im Kampf, an der `rolle` gelesen wird | Der Meuchler läuft durch dieselben Zeilen wie jede Wache. |
| `src/kampf.ts:754-770` (`sucheZiel`), aufgerufen `:972` in **jedem** Takt | Das nächstgelegene lebende Ziel, Gleichstand nach Rang | Ziel ist immer der Nächste — und das ist die gegnerische Front. Hier verliert er die Rolle. |
| `src/kampf.ts:1020` | Geschlagen wird nur bei `arenaAbstand ≤ reichweite` | Reichweite 1: er muss an den Nächsten heran und steht dann selbst vorn. |
| `src/kampf.ts:1041-1042` mit `:841-857` (`schrittZiel`, nur **strikt** näher, `:851`) | Geht er auf das nächste Ziel zu; ist kein freies Nachbarfeld näher, bleibt er stehen | Kein Vorbeilaufen an der Front: der Randplatz aus `platzStrafe` (`src/bot.ts:860`) führt nicht in die hintere Reihe, weil der Schritt immer auf den **Nächsten** zielt. Stehen bleiben erklärt die 2–4 % „nie gehauen". |
| `src/kampf.ts:1022` → `schadenNach` `:637-638` | Schaden = Angriff × (100 − Rüstung) / 100, kein Würfel, kein Zielaufschlag | Kein Krit, kein Bonus gegen Fernkämpfer. Gegen die Wachen, die er trifft (35–50 Rüstung), verliert er 35–50 % seines Angriffs. |
| `src/synergien.ts:186-194` | Markenbonus Meuchler: `tempoProzent` 15/25/40 | Der Bonus macht ihn **schneller**, nicht zäher — er verstärkt Punkt 2 (Schaden je s), nicht die Schwäche aus Punkt 3 (Lebensdauer). |
| `src/bot.ts:797-810` (`wunschreihe`, `case 'meuchler'` `:803`) und `:860` | Aufstellung Reihe 1, am Rand | Wirkt wie gedacht beim Start (Startreihe 1,0, 80–99 % am Rand), ändert am Ziel aber nichts, siehe `schrittZiel`. |

## Welcher Hebel die Zahlen am ehesten erklärt (Vorschlag, nicht gebaut)

Am ehesten erklärt die **Zielwahl** die Zahlen: Weil `sucheZiel`
(`src/kampf.ts:754`) jedem Meuchler den Nächsten gibt, schlägt er mit seinem
Spitzenschaden auf die gepanzerte Wache (62–74 % der Hiebe) und steht dabei
mit Schützenleben mitten in der Front, wo er nach 6–8 s fällt. Anmarsch (0,3 s
Mehrweg, 0 % tot vor dem ersten Hieb) und Aufstellung (Reihe 1, Rand, beides
greift) erklären es nicht, und mehr Tempo aus den Werten oder der Marke gäbe
nur noch mehr Schaden auf dieselbe Wache.

## Was diese Messung nicht sagt

- Ob eine andere Zielwahl die Marke tatsächlich auf x1,0 hebt. Dafür müsste
  man die Regel bauen und mit `werkzeug/ausgewogenheit.mjs` nachmessen — nicht
  Teil dieses Auftrags.
- Wie viel „Hiebe auf Fernkämpfer" genug wäre. Die Spalte zeigt nur, dass
  Meuchler sich darin nicht von Wachen unterscheiden.
- Ob `ANMARSCH_SEKUNDEN = 4` im Bot falsch ist (seit 24.09.2026 nachgemessen:
  nein, siehe letzter Abschnitt). Der Wert bewertet Einheiten
  **ohne Deckung**, und die Turnierzahlen, aus denen er stammt, sind richtig
  gemessen — nur nicht auf echten Brettern. Siehe Punkt 1.

## Nachmessung ANMARSCH_SEKUNDEN (24.09.2026)

Die letzte offene Frage oben: Soll `ANMARSCH_SEKUNDEN` (`src/bot.ts`) bei 4
bleiben, wenn der Anmarsch, den die Zahl bewertet, in der Partie kaum
vorkommt? **Ja — sie ändert am Spiel nichts Messbares, und sie ist die
einzige der geprüften Zahlen, die die Probe in `test/anmarsch.test.ts` hält.**
Geändert wurde nur der Kommentar über ihr.

Gemessen auf `d55e6dd` (= `origin/staging`), Node 24, Windows. Je Variante
eine Kopie von `dist/` und `werkzeug/` mit der geänderten Zahl in
`dist/src/bot.js`; `src/` blieb unberührt.

### Marke Meuchler (`ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150`)

| ANMARSCH_SEKUNDEN | Antritte v1 | roh v1 | roh v2 | gl. Kosten v1 | gl. Kosten v2 |
|---|---|---|---|---|---|
| 0 (= vor #249) | 5.202 | x0,64 | x0,67 | x0,65 | x0,68 |
| 1 | 5.152 | x0,64 | x0,67 | x0,65 | x0,68 |
| 2 | 5.173 | x0,63 | x0,64 | x0,64 | x0,66 |
| **4 (Stand)** | 5.061 | x0,63 | x0,64 | x0,64 | x0,66 |

Die Zeile 0 ergibt Zahl für Zahl den Stand `c007ec1` aus
`TAFELRUNDE-NACHMESSUNG-2026-09-23.md` — der Umbau ist also genau diese eine
Zahl. Wächter und Krieger bewegen sich um höchstens 0,03, Untot (die
dünnste Zeile, rund 1.300 Antritte) zwischen x0,95 und x1,03 ohne Richtung.

### Spielstärke (Sitzduell, 4 Sitze, Besetzung `normal`)

Ein Sitz mit Variante X, drei mit B, der X-Sitz geht reihum. Je Zeile zwei
Saatbasen à 2.400 Partien. Erwartet sind 1.200 Siege, Standardfehler rund 30.
Wegwerf-Skript über `erstellePartie`/`fuehreAus`/`botZug` aus zwei gebauten
Kopien, wie im Kommentar zu `ANMARSCH_SEKUNDEN` beim ersten Duell — kein
Werkzeug im Repo.

| X gegen 3 × B | Siege von 4.800 |
|---|---|
| 4 gegen 4 (Kontrolle) | 1.200 |
| 0 gegen 4 | 1.220 |
| 1 gegen 4 | 1.216 |
| 2 gegen 4 | 1.212 |
| 4 gegen 0 | 1.174 |
| 4 gegen 1 | 1.183 |

Die Richtung spräche leicht für eine kleinere Zahl, der Abstand liegt aber
bei einem Standardfehler.

### Die Probe (`test/anmarsch.test.ts`, Rangkorrelation zum Turnier)

| ANMARSCH_SEKUNDEN | 0 | 1 | 2 | 3 | **4** | 5 | 6 |
|---|---|---|---|---|---|---|---|
| Spearman nackt | −0,21 | 0,01 | 0,16 | 0,26 | **0,40** | 0,50 | 0,58 |

Mit 2 oder weniger fällt die Probe (Schwelle 0,2), mit 0 zusätzlich die drei
„Meuchler vor Wache"-Proben. Dass die Korrelation über 4 hinaus weiter steigt,
zeigt: Die 4 ist aus der Turnierzeit gemessen und nicht auf die Probe
eingepasst.

### Urteil

Die Zahl wirkt nur bei `KEINE_DECKUNG` voll, also dort, wo `kandidaten` eine
Einheit ohne ihr Heer bewertet. Genau das misst das Turnier, und dort stimmt
sie. In der Partie zählt, welche Einheit das Heer am Ende hält, und dafür ist
sie stumm. Senken hieße: Probe verloren, am Brett nichts gewonnen. Der Hebel
für die Marke bleibt die Zielwahl (Abschnitt oben).
