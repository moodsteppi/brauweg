# Filler: Nachmessung nach f2 und f3 (09.11.2026)

Gegenstück zu `MESSUNG-2026-11-07.md` (f1, Stand ad851d5). Dasselbe Skript
(`werkzeug/simulation.mjs`, Stand dieses Commits), dieselben Saaten
(`saatHex(i)`, extreme #0–999, klar und build #0–199), alle Vorgaben. Im
Code ist nichts geändert, diese Datei ist das einzige Ergebnis.

Stand: `origin/staging` 93aba5a2 (Abschnitte 1–5) bzw. e92b2c46
(Abschnitt 6; dazwischen nur Übersetzungen, `packages/game-filler` ist
unverändert). Darin: der Regelfix f2 (#375: faire Ecken, Mauerregeln, dazu
der Bot „b+“, der wieder mauert) und der Ausgleich für Sitz 1 (#383: Klar +2
Punkte, Build +1 Mauer, Extreme +2 Mauern). Dazu kommt #364 (Extreme auf
12 × 11 mit 20 Mauern und Sternen), das f1 noch nicht enthielt. **Der
Bot-Umbau f3 (fc53df78, #386) wurde auf Niklas' Entscheidung nicht gebaut**;
`src/bot.ts` steht auf dem Stand von #375. Gemessen ist also die Wirkung
der Regeln mit dem Bot, der mit ihnen kam — nicht die eines neuen Bots.

    npm ci
    npm run build --workspace @brauweg/game-api
    npm run build --workspace @brauweg/game-filler
    node packages/game-filler/werkzeug/simulation.mjs --ohne-ausbeuter --faeden 16   # Abschnitte 1–5, 43 min
    node packages/game-filler/werkzeug/simulation.mjs --extreme 300 --klar 0 --build 0 --faeden 20   # Abschnitt 6 Extreme, 43,5 min
    node packages/game-filler/werkzeug/simulation.mjs --extreme 0 --faeden 20                        # Abschnitt 6 Klar/Build, 2,5 min

**Laufzeit:** f1 brauchte für alles 32 Minuten auf 6 Fäden. Jetzt kostet
eine Extreme-Partie rund das Zehnfache (12 × 11 statt 8 × 7, rund 104 statt
29 Züge, 44 Mauern je Partie, und der Bot bewertet jede erlaubte Kante).
Schon die Abschnitte 1–5 brauchten 43 Minuten auf 16 Fäden (Windows, 22
Kerne, Rechner nebenher belegt); die Gegenproben über alle 1000
Extreme-Saaten hätten hochgerechnet rund zweieinhalb Stunden auf 20 Fäden
gedauert (300 Saaten: 2612 s). **Abschnitt 6 läuft deshalb für Extreme nur
auf #0–299** (Vorgabe des Auftrags für den Fall „länger als 50 Minuten“; der
volle Lauf über 1000 wurde wegen dieser Hochrechnung gar nicht erst
gestartet). Die Spalte „Bot-Bot“ dort gehört zu genau diesen 300 Saaten,
nicht zu den 1000 aus Abschnitt 3. Klar und Build laufen in Abschnitt 6 auf
allen Saaten #0–199; ihre Abschnitte 1–5 kamen dabei Zahl für Zahl gleich
heraus wie in Lauf 1 (das Skript ist deterministisch).

**Vergleichbarkeit:** Klar ist dasselbe Brett mit demselben Bot. Build hat
dasselbe Brett, aber neue Mauerregeln, einen anderen Bot und eine Mauer mehr
für Sitz 1. **Extreme ist ein anderes Spiel** (12 × 11 mit faire Ecken statt
8 × 7); dort zeigt die Spalte „vorher“ nur die Richtung, Zeile gegen Zeile ist
sie nicht vergleichbar.

Standardfehler: bei n = 1000 und p um 50 % ±1,6 Punkte, bei n = 300 ±2,9,
bei n = 200 ±3,5.

## Vorher / nachher

| Messgröße | Extreme f1 | Extreme jetzt | Klar f1 | Klar jetzt | Build f1 | Build jetzt |
|---|---|---|---|---|---|---|
| **1. Eröffnung** | | | | | | |
| Ecke Sitz 1: beide Nachbarn gleichfarbig | 19.5 % | 0.0 % | 28.0 % | 28.0 % | 28.0 % | 28.0 % |
| Ecke Sitz 0: beide Nachbarn gleichfarbig | 20.0 % | 0.0 % | 22.0 % | 22.0 % | 22.0 % | 22.0 % |
| Eckfarbe 0 = beide Nachbarn 1 | 2.5 % | 0.0 % | 5.0 % | 5.0 % | 5.0 % | 5.0 % |
| Sitz 0 könnte Sitz 1 mit Zug 1 sperren | 19.5 % | 0.0 % | 28.0 % | 28.0 % | 28.0 % | 28.0 % |
| ohne nutzbare Farbe nach Zug 1 | 4.3 % | 0.0 % | 5.5 % | 5.5 % | 5.5 % | 5.5 % |
| ohne nutzbare Farbe nach Zug 2 | 0.2 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| ohne nutzbare Farbe nach Zug 3 | 0.3 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| ohne nutzbare Farbe nach Zug 1 oder 2 | 4.5 % | 0.0 % | 5.5 % | 5.5 % | 5.5 % | 5.5 % |
| Partien mit mind. einem Zug ohne nutzbare Farbe | 20.6 % | **95.4 %** | 21.0 % | 21.0 % | 21.5 % | **88.0 %** |
| solche Züge je Partie | 0.22 | **6.27** | 0.21 | 0.21 | 0.25 | **2.69** |
| **2. Abgetrennt / eingeschlossen** | | | | | | |
| Fronten zu (kein freies Feld für beide) | 89.4 % | 95.1 % | 61.0 % | 61.0 % | 88.0 % | 91.0 % |
| ab Zug / freie Felder dann | 24.0 / 4.8 | 64.5 / 44.0 | 23.7 / 2.3 | 23.7 / 2.3 | 22.2 / 4.8 | 30.8 / 16.5 |
| davon direkt durch eine Mauer | 19.3 % | 0.0 % | 0.0 % | 0.0 % | 24.0 % | 0.0 % |
| davon mit >= 10 freien Feldern | 7.8 % | **75.5 %** | 0.0 % | 0.0 % | 9.5 % | **57.5 %** |
| **EINGESPERRT** (>= 10 frei, einer <= 1/4) | 3.2 % | **71.5 %** | 0.0 % | 0.0 % | 4.5 % | **55.0 %** |
| davon gewinnt der Eingesperrte nicht | 31 von 32 | 701 von 715 | – | – | 8 von 9 | 110 von 110 |
| Sitze ohne erreichbares Feld (von 2n) | 44.7 % | 47.5 % | 30.5 % | 30.5 % | 44.0 % | 45.5 % |
| davon mit >= 10 freien Feldern | 6 | **705** | 0 | 0 | 2 | **110** |
| davon direkt durch eine Mauer | 0 | 0 | 0 | 0 | 0 | 0 |
| Ende über Leerzug-Deckel mit freien Feldern | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| **3. Anzug** | | | | | | |
| Sieg Sitz 0 (zieht zuerst) | 61.8 % | **49.2 %** | 52.0 % | **35.0 %** | 56.5 % | **47.0 %** |
| Sieg Sitz 1 | 38.2 % | **50.0 %** | 36.0 % | **48.0 %** | 31.5 % | **46.5 %** |
| Unentschieden | 0.0 % | 0.8 % | 12.0 % | 17.0 % | 12.0 % | 6.5 % |
| Punkte Sitz 0 / Sitz 1 (Brett, ohne Zuschlag) | 30.6 / 28.4 | 72.3 / 67.7 | 28.8 / 27.2 | 28.8 / 27.2 | 29.0 / 27.0 | 28.3 / 27.7 |
| Züge je Partie | 29.3 | 103.7 | 26.2 | 26.2 | 27.3 | 51.0 |
| Sitz 1 nach Zug 1 gesperrt: Partien / davon Sieg 0 | 43 / 62.8 % | 0 / – | 11 / 72.7 % | 11 / 54.5 % | 11 / 81.8 % | 11 / 63.6 % |
| **4. Mauern des Bots** | | | | | | |
| Mauern je Partie (beide Sitze) | 3.89 | **44.14** | – | – | 3.65 | **19.67** |
| Partien mit mind. einer Mauer | 99.4 % | 100.0 % | – | – | 99.0 % | 100.0 % |
| Zuganfänge mit Kandidaten | 26336 | 97777 | – | – | 4853 | 6542 |
| bester Wandwert Mittel / höchstens | 0.88 / 14.00 | 2.52 / 9.00 | – | – | 0.87 / 11.00 | 2.28 / 7.00 |
| bester Wert < 0 | 0.0 % | 0.1 % | – | – | 0.0 % | 0.0 % |
| bester Wert = 0 | 33.2 % | 1.4 % | – | – | 32.1 % | 25.6 % |
| bester Wert 0,5 | 14.6 % | 13.9 % | – | – | 16.7 % | 3.2 % |
| bester Wert 1 bis 1,5 | 37.4 % | 25.5 % | – | – | 36.1 % | 11.1 % |
| bester Wert >= 2 | 14.8 % | 59.1 % | – | – | 15.0 % | 60.1 % |
| beste Wand ohne Gebietsanteil ¹ | 49.5 % | 100.0 % | – | – | 48.8 % | 100.0 % |
| Grund: Eröffnung (mauerfrei) | 3000 | 3000 | – | – | 600 | 600 |
| Grund: Vorrat leer ² | – | 29134 | – | – | – | 3349 |
| Grund: beste Wand 0 < x < Schwelle | 13703 | 52130 | – | – | 2566 | 933 |
| Grund: beste Wand < 0 ² | – | 114 | – | – | – | 0 |
| Grund: beste Wand = 0 | 8739 | 1389 | – | – | 1558 | 1675 |
| Grund: gebaut | 3894 | 44144 | – | – | 729 | 3934 |
| Grund: keine erlaubte Kante ² | – | 17898 | – | – | – | 3637 |
| beste Wand: Weg- / Platzterm im Mittel ² | – | 2.41 / 0.02 | – | – | – | 2.17 / 0.00 |
| Abweichung gegen botZug (muss 0 sein) | 0 | 0 | – | – | 0 | 0 |
| **5. Farbwahl des Bots** | | | | | | |
| Farbentscheidungen (>= 2 erlaubte Farben) | 29336 | 103665 | 5240 | 5240 | 5453 | 10194 |
| Sperre verpasst (Züge / Partien) | 1102 / 76.2 % | 16461 / **100.0 %** | 143 / 58.0 % | 143 / 58.0 % | 224 / 73.0 % | 1355 / **99.0 %** |
| sich sperrbar gemacht, sichere Farbe da (Züge / Partien) | 160 / 15.7 % | 683 / **50.9 %** | 54 / 24.5 % | 54 / 24.5 % | 46 / 20.5 % | 114 / **45.5 %** |
| 2-Zug-Verlust >= 3 Punkte (Züge / Partien) | 104 / 10.1 % | 451 / 34.2 % | 14 / 7.0 % | 14 / 7.0 % | 15 / 7.5 % | 16 / 7.0 % |
| Verlust im Mittel | 3.2 | 3.2 | 3.4 | 3.4 | 3.5 | 3.1 |
| Gleichstand beim Gewinn (kleinste Nummer gewinnt) | 12929 | 49682 | 2045 | 2045 | 2198 | 5206 |
| davon 2-Zug-Wert >= 2 schlechter | 420 | 2166 | 80 | 80 | 78 | 138 |

¹ f1: „nur Zugterm“; jetzt „Zug-, Weg-, Platzterm“ — die Wandrechnung hat
seit #375 andere Bestandteile, und das Gebiet geht nicht mehr ein, weil
Abtrennen verboten ist.
² Zeile gibt es erst seit #375 im Skript.

Mehr Züge und mehr Farbentscheidungen blähen in Extreme und Build alle
Zählzeilen (Abschnitt 4 und 5) auf; aussagekräftig sind dort die
Partie-Anteile.

## Gegenproben (Abschnitt 6)

Gewinnquote des Abweichlers gegen den echten Bot. Δ = Abweichler minus
Bot-Bot desselben Laufs; liegt Δ deutlich über 0, ist die Schwäche teuer.

| Gegenprobe | Sitz | f1: Bot-Bot → Abweichler (Δ) | jetzt: Bot-Bot → Abweichler (Δ) |
|---|---|---|---|
| **Extreme** (f1 #0–999, jetzt #0–299) | | | |
| eroeffnungssperre | 0 | 61.8 → 61.6 % (−0.2) | 52.0 → 52.0 % (±0, nie abgewichen) |
| | 1 | 38.2 → 38.2 % (±0) | 47.0 → 47.0 % (±0, nie abgewichen) |
| sperrer | 0 | 61.8 → 61.8 % (±0) | 52.0 → **41.7 %** (**−10.3**) |
| | 1 | 38.2 → 38.3 % (+0.1) | 47.0 → 45.0 % (−2.0) |
| zweizug | 0 | 61.8 → 69.9 % (+8.1) | 52.0 → 59.3 % (**+7.3**) |
| | 1 | 38.2 → 44.5 % (+6.3) | 47.0 → 60.0 % (**+13.0**) |
| mauerer (ab Wandwert 0,5) | 0 | 61.8 → 79.3 % (+17.5) | 52.0 → **35.7 %** (**−16.3**) |
| | 1 | 38.2 → 64.1 % (+25.9) | 47.0 → **29.7 %** (**−17.3**) |
| **Klar** (#0–199) | | | |
| eroeffnungssperre | 0 | 52.0 → 55.5 % (+3.5) | 35.0 → 38.5 % (+3.5) |
| | 1 | 36.0 → 36.0 % (±0) | 48.0 → 48.0 % (±0) |
| sperrer | 0 | 52.0 → 55.5 % (+3.5) | 35.0 → 38.5 % (+3.5) |
| | 1 | 36.0 → 36.5 % (+0.5) | 48.0 → 48.5 % (+0.5) |
| zweizug | 0 | 52.0 → 66.0 % (+14.0) | 35.0 → 50.0 % (**+15.0**) |
| | 1 | 36.0 → 44.0 % (+8.0) | 48.0 → 58.0 % (**+10.0**) |
| **Build** (#0–199) | | | |
| eroeffnungssperre | 0 | 56.5 → 59.5 % (+3.0) | 47.0 → 51.5 % (+4.5) |
| | 1 | 31.5 → 31.5 % (±0) | 46.5 → 47.0 % (+0.5) |
| sperrer | 0 | 56.5 → 58.5 % (+2.0) | 47.0 → 45.0 % (−2.0) |
| | 1 | 31.5 → 31.5 % (±0) | 46.5 → 49.5 % (+3.0) |
| zweizug | 0 | 56.5 → 66.0 % (+9.5) | 47.0 → 57.0 % (**+10.0**) |
| | 1 | 31.5 → 38.0 % (+6.5) | 46.5 → 54.5 % (**+8.0**) |
| mauerer (ab Wandwert 0,5) | 0 | 56.5 → 74.0 % (+17.5) | 47.0 → 50.5 % (+3.5) |
| | 1 | 31.5 → 53.0 % (+21.5) | 46.5 → 47.0 % (+0.5) |

Partien mit Abweichung (Sitz 0 / Sitz 1), jetzt gegen f1: Extreme
eroeffnungssperre 0.0 / 0.0 % (f1 12.7 / 0.2 %), sperrer 98.7 / 97.7 %
(53.5 / 46.9 %), zweizug 95.7 / 98.0 % (79.9 / 81.9 %), mauerer 87.7 /
87.0 % (100 / 100 %). Klar unverändert (17.5 / 1.0, 40.0 / 25.5, 78.5 /
78.5 %). Build eroeffnungssperre 17.5 / 1.0 % (gleich), sperrer 92.0 /
92.0 % (52.5 / 45.0 %), zweizug 83.0 / 88.0 % (81.0 / 81.5 %), mauerer
76.0 / 86.0 % (100 / 100 %).

Zur Einordnung der Extreme-Teilmenge: Bot-Bot auf #0–299 ergibt 52.0 / 47.0 %
für Sitz 0 / 1, auf #0–999 49.2 / 50.0 % — der Unterschied liegt im
Standardfehler (±2,9). Auch die übrigen Kennzahlen der Teilmenge liegen nah
an den 1000 (eingesperrt 68.7 statt 71.5 %, Mauern 44.27 statt 44.14).

## Was die Zahlen sagen

**Was der Regelfix erreicht hat**

1. **Eröffnung in Extreme ist fair.** Kein Brett mehr mit gleichfarbigen
   Ecknachbarn, keine Sperre in Zug 1, kein Sitz ohne Farbe nach Zug 1–3
   (f1: 19.5 % / 4.5 %). Die Gegenprobe „eroeffnungssperre“ weicht in 300
   Partien kein einziges Mal ab — es gibt nichts mehr zu sperren.
2. **Der Anzugsvorteil ist in Extreme und Build weg.** Extreme 49.2 : 50.0 %
   (f1 61.8 : 38.2), Build 47.0 : 46.5 % (f1 56.5 : 31.5). Beides liegt im
   Standardfehler.
3. **Die Mauerschwelle des Bots stimmt jetzt.** In f1 gewann „mauerer“
   (baut schon ab 0,5) 17–26 Punkte dazu — der Bot mauerte zu wenig. Jetzt
   verliert dieselbe Abweichung in Extreme 16–17 Punkte und ist in Build
   neutral (+3.5 / +0.5). Der Bot baut 44 Mauern je Extreme-Partie (f1: 3.9);
   früher Bauen verschwendet den Vorrat.
4. **Keine Front schließt sich mehr direkt durch eine Mauer** (Extreme
   19.3 % → 0 %, Build 24.0 % → 0 %). Der Leerzug-Deckel greift nie.

**Was offen ist oder neu auffällt**

5. **Klar ist überkompensiert.** Ohne Ausgleich lag Sitz 0 vorn (52 : 36 %),
   mit +2 Punkten liegt nun Sitz 1 vorn (35 : 48 %, 17 % Remis). Der Abstand
   von 13 Punkten ist größer als der Standardfehler der Differenz (rund ±5).
   Brett und Farbwahl des Bots sind in Klar unverändert (Abschnitte 1, 2 und
   5 Zahl für Zahl gleich f1) — die Verschiebung kommt allein vom Zuschlag.
6. **Klar und Build haben die alte Eröffnung behalten.** 28 % der Bretter
   lassen Sitz 0 in Zug 1 sperren, 5.5 % lassen Sitz 1 nach Zug 1 ohne Farbe
   — gleich wie f1. Die fairen Ecken wirken nur in Extreme. Die Gegenprobe
   „eroeffnungssperre“ bringt Sitz 0 dort weiter +3.5 (Klar) bzw. +4.5
   (Build) Punkte.
7. **Einsperren ist in Extreme und Build zum Normalfall geworden.** Mit
   ≥ 10 freien Feldern hat einer höchstens ein Viertel davon: Extreme 3.2 %
   → **71.5 %**, Build 4.5 % → **55.0 %**; der Eingesperrte gewinnt fast nie
   (701 von 715 bzw. 110 von 110 verlieren). Fronten schließen sich in
   Extreme im Mittel bei Zug 64,5 mit 44 freien Feldern. Keine dieser
   Schließungen ist eine einzelne Mauer — aber das Skript misst nur die
   letzte Kante, nicht, wie viele der 44 Mauern den Kessel vorher gebaut
   haben. Ob es an den neuen Mauerregeln, am mauernden Bot oder am größeren
   Brett liegt, trennt diese Messung nicht.
8. **Partien mit einem Zug ohne nutzbare Farbe:** Extreme 20.6 % → 95.4 %
   (6.3 solche Züge je Partie), Build 21.5 % → 88.0 %. Das ist die Folge
   von Punkt 7 (Eingesperrte haben keine Farbe mehr), kein Eröffnungsproblem.
9. **Die Farbwahl des Bots ist die größte verbliebene Schwäche.** „zweizug“
   (eigener Gewinn minus beste Antwort) schlägt den Bot überall: Extreme
   +7 / +13, Klar +15 / +10, Build +10 / +8 Punkte — so viel wie in f1.
   Die Regeländerungen haben daran nichts geändert; genau das war der Zweck
   des nicht gebauten Bot-Umbaus f3.
10. **Gieriges Sperren schadet jetzt.** „sperrer“ war in f1 neutral, kostet
    in Extreme als Sitz 0 nun 10 Punkte. Die Kennzahl „Sperre verpasst“
    (Extreme 100 % der Partien) ist darum kein Fehler des Bots, sondern eine
    Gelegenheit, die sich meist nicht lohnt.

**Vorschläge (nur Vorschlag, nichts davon ist gebaut)**

- **Klar-Ausgleich auf +1 Punkt** prüfen: mit `werkzeug/ausgleich-messung.mjs`
  auf denselben Saaten #0–199 die Quote bei +1 messen, bevor die Regel
  geändert wird (Punkt 5).
- **Faire Ecken auch für Klar und Build** entscheiden — oder bewusst lassen
  und in der Regelbeschreibung nennen (Punkt 6).
- **Einsperren aufschlüsseln** (Punkt 7): eine Zusatzmessung, die je
  geschlossener Front zählt, wie viele Mauern auf ihrem Rand liegen, und
  denselben Lauf einmal mit einem Bot ohne Mauern auf dem Extreme-Brett.
  Erst dann ist klar, ob Mauerregeln oder Brett nachgeschärft gehören.
- **Bot-Umbau f3 erneut abwägen** (Punkt 9): Die Gegenprobe „zweizug“ zeigt
  8–15 Punkte Spielraum in jeder Spielart. Gegen Menschen heißt das: Der Bot
  ist schlagbar, aber nicht wegen der Regeln.
- **Skriptkopf nachziehen** (eigene Aufgabe, hier war Code verboten): Die
  Laufzeitangabe „32 Minuten auf 6 Fäden“ gilt seit #364 nicht mehr; ein
  voller Lauf mit Gegenproben über 1000 Extreme-Saaten dauert jetzt rund
  zweieinhalb Stunden auf 20 Fäden. Vorschlag: Vorgabe `--extreme 300` oder
  ein eigener Schalter für die Saaten der Gegenproben.

## Rohausgabe

Die vollständigen Ausgaben beider Läufe, samt Beispielsaaten (Abschnitt 7),
stehen unten unverändert.

### Lauf 1: `--ohne-ausbeuter --faeden 16` (Abschnitte 1–5, 7)

#### 1. Eroeffnung: Sitz ohne nutzbare Farbe

| Messgroesse                                               | extreme (#0–999, n=1000) | klar (#0–199, n=200) | build (#0–199, n=200) |
|-----------------------------------------------------------|--------------------------|----------------------|-----------------------|
| Ecke Sitz 1: beide Nachbarn gleichfarbig                  | 0.0 %                    | 28.0 %               | 28.0 %                |
| Ecke Sitz 0: beide Nachbarn gleichfarbig                  | 0.0 %                    | 22.0 %               | 22.0 %                |
| Eckfarbe 0 = beide Nachbarn 1 (harmlos: 0 muss umfaerben) | 0.0 %                    | 5.0 %                | 5.0 %                 |
| Sitz 0 KOENNTE Sitz 1 mit Zug 1 sperren                   | 0.0 %                    | 28.0 %               | 28.0 %                |
| ohne nutzbare Farbe nach Zug 1 (Sitz 1 am Zug)            | 0.0 %                    | 5.5 %                | 5.5 %                 |
| ohne nutzbare Farbe nach Zug 2 (Sitz 0 am Zug)            | 0.0 %                    | 0.0 %                | 0.0 %                 |
| ohne nutzbare Farbe nach Zug 3 (Sitz 1 am Zug)            | 0.0 %                    | 0.0 %                | 0.0 %                 |
| ohne nutzbare Farbe nach Zug 1 oder 2                     | 0.0 %                    | 5.5 %                | 5.5 %                 |
| Partien mit mind. einem Zug ohne nutzbare Farbe           | 95.4 %                   | 21.0 %               | 88.0 %                |
| solche Zuege je Partie                                    | 6.27                     | 0.21                 | 2.69                  |

#### 2. Abgetrennt und eingeschlossen (solange noch freie Felder liegen)

| Messgroesse                                                 | extreme (#0–999, n=1000) | klar (#0–199, n=200) | build (#0–199, n=200) |
|-------------------------------------------------------------|--------------------------|----------------------|-----------------------|
| Partien: kein freies Feld mehr fuer beide (Fronten zu)      | 95.1 %                   | 61.0 %               | 91.0 %                |
|   ab Zug / freie Felder dann (Mittel)                       | 64.5 / 44.0              | 23.7 / 2.3           | 30.8 / 16.5           |
|   davon direkt durch eine Mauer                             | 0.0 %                    | 0.0 %                | 0.0 %                 |
|   davon mit >= 10 freien Feldern                            | 75.5 %                   | 0.0 %                | 57.5 %                |
| EINGESPERRT: >= 10 frei, einer hat <= 1/4 davon             | 71.5 %                   | 0.0 %                | 55.0 %                |
|   davon gewinnt der Eingesperrte nicht                      | 701 von 715              | 0 von 0              | 110 von 110           |
| Sitze ohne erreichbares Feld (von 2n), Endspiel mitgezaehlt | 47.5 %                   | 30.5 %               | 45.5 %                |
|   davon mit >= 10 freien Feldern auf dem Brett              | 705                      | 0                    | 110                   |
|   davon direkt durch eine Mauer                             | 0                        | 0                    | 0                     |
| Ende ueber Leerzug-Deckel mit freien Feldern                | 0.0 %                    | 0.0 %                | 0.0 %                 |

#### 3. Anzug: Sitz 0 gegen Sitz 1

| Messgroesse                                        | extreme (#0–999, n=1000) | klar (#0–199, n=200) | build (#0–199, n=200) |
|----------------------------------------------------|--------------------------|----------------------|-----------------------|
| Sieg Sitz 0 (zieht zuerst)                         | 49.2 %                   | 35.0 %               | 47.0 %                |
| Sieg Sitz 1                                        | 50.0 %                   | 48.0 %               | 46.5 %                |
| Unentschieden                                      | 0.8 %                    | 17.0 %               | 6.5 %                 |
| Punkte Sitz 0 / Sitz 1 im Mittel                   | 72.3 / 67.7              | 28.8 / 27.2          | 28.3 / 27.7           |
| Zuege je Partie                                    | 103.7                    | 26.2                 | 51.0                  |
| Sitz 1 nach Zug 1 gesperrt: Partien / davon Sieg 0 | 0 / –                    | 11 / 54.5 %          | 11 / 63.6 %           |

#### 4. Mauern des Bots

| Messgroesse                                           | extreme (n=1000) | build (n=200) |
|-------------------------------------------------------|------------------|---------------|
| Mauern je Partie (beide Sitze)                        | 44.14            | 19.67         |
| Partien mit mind. einer Mauer                         | 100.0 %          | 100.0 %       |
| Zuganfaenge mit Kandidaten                            | 97777            | 6542          |
| bester Wandwert im Mittel / hoechstens                | 2.52 / 9.00      | 2.28 / 7.00   |
|   bester Wert < 0                                     | 0.1 %            | 0.0 %         |
|   bester Wert = 0                                     | 1.4 %            | 25.6 %        |
|   bester Wert 0,5                                     | 13.9 %           | 3.2 %         |
|   bester Wert 1 bis 1,5                               | 25.5 %           | 11.1 %        |
|   bester Wert >= 2                                    | 59.1 %           | 60.1 %        |
| beste Wand ohne Gebietsanteil (Zug-, Weg-, Platzterm) | 100.0 %          | 100.0 %       |
| Grund: Eroeffnung (mauerfrei)                         | 3000             | 600           |
| Grund: Vorrat leer                                    | 29134            | 3349          |
| Grund: beste Wand 0 < x < Schwelle                    | 52130            | 933           |
| Grund: beste Wand < 0                                 | 114              | 0             |
| Grund: beste Wand = 0                                 | 1389             | 1675          |
| Grund: gebaut                                         | 44144            | 3934          |
| Grund: keine erlaubte Kante                           | 17898            | 3637          |
| beste Wand: Weg- / Platzterm im Mittel                | 2.41 / 0.02      | 2.17 / 0.00   |
| Abweichung bewerteWaende gegen botZug (muss 0 sein)   | 0                | 0             |

#### 5. Farbwahl des Bots gegen Alternativen

| Messgroesse                                               | extreme (#0–999, n=1000) | klar (#0–199, n=200) | build (#0–199, n=200) |
|-----------------------------------------------------------|--------------------------|----------------------|-----------------------|
| Farbentscheidungen (>= 2 erlaubte Farben)                 | 103665                   | 5240                 | 10194                 |
| Sperre verpasst (Zuege / Partien)                         | 16461 / 100.0 %          | 143 / 58.0 %         | 1355 / 99.0 %         |
| sich sperrbar gemacht, sichere Farbe da (Zuege / Partien) | 683 / 50.9 %             | 54 / 24.5 %          | 114 / 45.5 %          |
| 2-Zug-Verlust >= 3 Punkte (Zuege / Partien)               | 451 / 34.2 %             | 14 / 7.0 %           | 16 / 7.0 %            |
|   Verlust im Mittel                                       | 3.2                      | 3.4                  | 3.1                   |
| Gleichstand beim Gewinn (kleinste Nummer gewinnt)         | 49682                    | 2045                 | 5206                  |
|   davon 2-Zug-Wert >= 2 schlechter                        | 2166                     | 80                   | 138                   |

#### 7. Beispiel-Saaten (Saatindex; nachspielen mit --zeige <spielart>:<index>)

##### extreme
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: —
- Eckfarbe 0 = beide Nachbarn 1: —
- ohne nutzbare Farbe nach Zug 1/2: —
- Fronten zu: 0 (ab Zug 49, frei 64:0); 1 (ab Zug 62, frei 15:31); 2 (ab Zug 52, frei 68:0); 3 (ab Zug 79, frei 23:0); 4 (ab Zug 89, frei 1:1)
- eingesperrt (>= 10 frei, <= 1/4): 0 (ab Zug 49, frei 64:0, Sieger 0); 2 (ab Zug 52, frei 68:0, Sieger 0); 3 (ab Zug 79, frei 23:0, Sieger 0); 5 (ab Zug 60, frei 0:72, Sieger 1); 6 (ab Zug 37, frei 94:0, Sieger 0)
- Sitz eingeschlossen: 0 (Sitz 1 ab Zug 49); 1 (Sitz 0 ab Zug 85); 2 (Sitz 1 ab Zug 52); 3 (Sitz 1 ab Zug 79); 4 (Sitz 0 ab Zug 91)
- Partie mit Mauer: 0 (Zug 6, 7, 8, 9, 10, 11, 11, 12, 12, 15, 15, 16, 16, 19, 19, 20, 20, 23, 24, 25, 26, 27, 27, 28, 30, 31, 32, 34, 35, 36, 36, 37, 40, 40, 41, 43, 44, 46, 47, 48, 51, 51, 57, 59, 63, 65); 1 (Zug 6, 7, 8, 9, 9, 10, 12, 13, 14, 15, 15, 16, 18, 19, 19, 20, 23, 24, 25, 26, 27, 29, 29, 30, 33, 34, 35, 35, 36, 38, 39, 39, 42, 42, 43, 43, 46, 46, 47, 47, 50, 50, 51, 54, 58, 63, 68, 80); 2 (Zug 6, 6, 7, 9, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 21, 23, 25, 26, 27, 27, 28, 30, 31, 32, 33, 33, 34, 36, 36, 37, 37, 40, 41, 43, 44, 45, 45, 49, 51); 3 (Zug 6, 6, 7, 9, 10, 11, 11, 12, 14, 15, 16, 17, 17, 18, 18, 21, 21, 22, 24, 25, 26, 27, 28, 29, 31, 33, 34, 36, 37, 38, 39, 40, 42, 43, 45, 46, 50, 53, 54, 55, 57, 58, 59, 60, 63, 68, 81); 4 (Zug 6, 7, 8, 9, 10, 11, 12, 12, 13, 15, 16, 17, 17, 18, 18, 21, 21, 22, 22, 25, 25, 26, 28, 29, 30, 31, 32, 33, 33, 34, 34, 37, 38, 39, 40, 41, 44, 47, 48, 49, 50, 51, 52, 53, 55, 59, 63, 67, 72)
- Wand knapp unter Schwelle: 0 (20 Zuege mit Wert 1–1,5); 1 (18 Zuege mit Wert 1–1,5); 2 (28 Zuege mit Wert 1–1,5); 3 (29 Zuege mit Wert 1–1,5); 4 (15 Zuege mit Wert 1–1,5)
- Sperre verpasst: 0 (Zug 14 Sitz 0: gewaehlt 4, sperrend 3); 1 (Zug 24 Sitz 0: gewaehlt 4, sperrend 6); 2 (Zug 20 Sitz 0: gewaehlt 5, sperrend 6); 3 (Zug 14 Sitz 0: gewaehlt 4, sperrend 6); 4 (Zug 14 Sitz 0: gewaehlt 6, sperrend 5)
- sich sperrbar gemacht: 0 (Zug 13 Sitz 1: gewaehlt 2, sicher 3); 3 (Zug 50 Sitz 0: gewaehlt 0, sicher 4); 4 (Zug 13 Sitz 1: gewaehlt 3, sicher 5); 7 (Zug 32 Sitz 0: gewaehlt 5, sicher 6); 9 (Zug 23 Sitz 1: gewaehlt 0, sicher 6)
- groesster 2-Zug-Verlust: 754 (Zug 75 Sitz 1: gewaehlt 2, besser 6, verlust 8); 29 (Zug 63 Sitz 1: gewaehlt 1, besser 5, verlust 6); 583 (Zug 84 Sitz 0: gewaehlt 0, besser 6, verlust 6); 60 (Zug 103 Sitz 1: gewaehlt 0, besser 3, verlust 5); 154 (Zug 74 Sitz 0: gewaehlt 0, besser 6, verlust 5)

##### klar
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: 1; 8; 16; 18; 22
- Eckfarbe 0 = beide Nachbarn 1: 1; 27; 36; 42; 55
- ohne nutzbare Farbe nach Zug 1/2: 23 (nach Zug 1: Sitz 1); 66 (nach Zug 1: Sitz 1); 123 (nach Zug 1: Sitz 1); 124 (nach Zug 1: Sitz 1); 128 (nach Zug 1: Sitz 1)
- Fronten zu: 3 (ab Zug 25, frei 1:0); 4 (ab Zug 24, frei 1:0); 5 (ab Zug 24, frei 3:0); 6 (ab Zug 21, frei 1:0); 7 (ab Zug 25, frei 1:0)
- eingesperrt (>= 10 frei, <= 1/4): —
- Sitz eingeschlossen: 3 (Sitz 1 ab Zug 25); 4 (Sitz 1 ab Zug 24); 5 (Sitz 1 ab Zug 24); 6 (Sitz 1 ab Zug 21); 7 (Sitz 1 ab Zug 25)
- Sperre verpasst: 1 (Zug 22 Sitz 0: gewaehlt 0, sperrend 2); 2 (Zug 24 Sitz 0: gewaehlt 1, sperrend 3); 5 (Zug 27 Sitz 1: gewaehlt 0, sperrend 5); 6 (Zug 21 Sitz 1: gewaehlt 1, sperrend 4); 7 (Zug 25 Sitz 1: gewaehlt 0, sperrend 4)
- sich sperrbar gemacht: 1 (Zug 21 Sitz 1: gewaehlt 1, sicher 2); 2 (Zug 23 Sitz 1: gewaehlt 2, sicher 3); 8 (Zug 25 Sitz 1: gewaehlt 2, sicher 3); 17 (Zug 24 Sitz 0: gewaehlt 4, sicher 5); 21 (Zug 26 Sitz 0: gewaehlt 3, sicher 4)
- groesster 2-Zug-Verlust: 118 (Zug 10 Sitz 0: gewaehlt 4, besser 5, verlust 6); 61 (Zug 14 Sitz 0: gewaehlt 1, besser 3, verlust 4); 161 (Zug 8 Sitz 0: gewaehlt 3, besser 4, verlust 4); 21 (Zug 20 Sitz 0: gewaehlt 2, besser 4, verlust 3); 43 (Zug 14 Sitz 0: gewaehlt 2, besser 3, verlust 3)

##### build
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: 1; 8; 16; 18; 22
- Eckfarbe 0 = beide Nachbarn 1: 1; 27; 36; 42; 55
- ohne nutzbare Farbe nach Zug 1/2: 23 (nach Zug 1: Sitz 1); 66 (nach Zug 1: Sitz 1); 123 (nach Zug 1: Sitz 1); 124 (nach Zug 1: Sitz 1); 128 (nach Zug 1: Sitz 1)
- Fronten zu: 0 (ab Zug 34, frei 0:15); 1 (ab Zug 31, frei 2:15); 2 (ab Zug 23, frei 29:0); 3 (ab Zug 25, frei 0:21); 4 (ab Zug 27, frei 1:15)
- eingesperrt (>= 10 frei, <= 1/4): 0 (ab Zug 34, frei 0:15, Sieger 1); 1 (ab Zug 31, frei 2:15, Sieger 1); 2 (ab Zug 23, frei 29:0, Sieger 0); 3 (ab Zug 25, frei 0:21, Sieger 1); 4 (ab Zug 27, frei 1:15, Sieger 1)
- Sitz eingeschlossen: 0 (Sitz 0 ab Zug 34); 1 (Sitz 0 ab Zug 35); 2 (Sitz 1 ab Zug 23); 3 (Sitz 0 ab Zug 25); 4 (Sitz 0 ab Zug 29)
- Partie mit Mauer: 0 (Zug 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 25, 29); 1 (Zug 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25); 2 (Zug 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 21, 25, 27); 3 (Zug 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 22, 28); 4 (Zug 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 21, 22, 24, 28)
- Wand knapp unter Schwelle: 0 (3 Zuege mit Wert 1–1,5); 1 (2 Zuege mit Wert 1–1,5); 2 (3 Zuege mit Wert 1–1,5); 3 (4 Zuege mit Wert 1–1,5); 4 (5 Zuege mit Wert 1–1,5)
- Sperre verpasst: 0 (Zug 11 Sitz 1: gewaehlt 5, sperrend 4); 1 (Zug 16 Sitz 0: gewaehlt 5, sperrend 2); 2 (Zug 7 Sitz 1: gewaehlt 0, sperrend 4); 3 (Zug 9 Sitz 1: gewaehlt 4, sperrend 2); 4 (Zug 16 Sitz 0: gewaehlt 4, sperrend 2)
- sich sperrbar gemacht: 7 (Zug 34 Sitz 0: gewaehlt 3, sicher 5); 8 (Zug 21 Sitz 1: gewaehlt 2, sicher 5); 19 (Zug 13 Sitz 1: gewaehlt 4, sicher 5); 20 (Zug 45 Sitz 1: gewaehlt 2, sicher 3); 24 (Zug 9 Sitz 1: gewaehlt 4, sicher 5)
- groesster 2-Zug-Verlust: 85 (Zug 45 Sitz 1: gewaehlt 2, besser 5, verlust 4); 86 (Zug 39 Sitz 1: gewaehlt 0, besser 5, verlust 4); 15 (Zug 41 Sitz 1: gewaehlt 2, besser 3, verlust 3); 15 (Zug 45 Sitz 1: gewaehlt 2, besser 5, verlust 3); 24 (Zug 42 Sitz 0: gewaehlt 0, besser 5, verlust 3)

### Lauf 2: `--extreme 300 --klar 0 --build 0 --faeden 20` (mit Gegenproben, 2612 s)

# Filler: Bot gegen Bot (Saat i = saatHex(i), Mauerschwelle 2)

#### 1. Eroeffnung: Sitz ohne nutzbare Farbe

| Messgroesse                                               | extreme (#0–299, n=300) |
|-----------------------------------------------------------|-------------------------|
| Ecke Sitz 1: beide Nachbarn gleichfarbig                  | 0.0 %                   |
| Ecke Sitz 0: beide Nachbarn gleichfarbig                  | 0.0 %                   |
| Eckfarbe 0 = beide Nachbarn 1 (harmlos: 0 muss umfaerben) | 0.0 %                   |
| Sitz 0 KOENNTE Sitz 1 mit Zug 1 sperren                   | 0.0 %                   |
| ohne nutzbare Farbe nach Zug 1 (Sitz 1 am Zug)            | 0.0 %                   |
| ohne nutzbare Farbe nach Zug 2 (Sitz 0 am Zug)            | 0.0 %                   |
| ohne nutzbare Farbe nach Zug 3 (Sitz 1 am Zug)            | 0.0 %                   |
| ohne nutzbare Farbe nach Zug 1 oder 2                     | 0.0 %                   |
| Partien mit mind. einem Zug ohne nutzbare Farbe           | 95.0 %                  |
| solche Zuege je Partie                                    | 6.12                    |

#### 2. Abgetrennt und eingeschlossen (solange noch freie Felder liegen)

| Messgroesse                                                 | extreme (#0–299, n=300) |
|-------------------------------------------------------------|-------------------------|
| Partien: kein freies Feld mehr fuer beide (Fronten zu)      | 95.7 %                  |
|   ab Zug / freie Felder dann (Mittel)                       | 65.2 / 42.7             |
|   davon direkt durch eine Mauer                             | 0.0 %                   |
|   davon mit >= 10 freien Feldern                            | 74.0 %                  |
| EINGESPERRT: >= 10 frei, einer hat <= 1/4 davon             | 68.7 %                  |
|   davon gewinnt der Eingesperrte nicht                      | 202 von 206             |
| Sitze ohne erreichbares Feld (von 2n), Endspiel mitgezaehlt | 47.8 %                  |
|   davon mit >= 10 freien Feldern auf dem Brett              | 205                     |
|   davon direkt durch eine Mauer                             | 0                       |
| Ende ueber Leerzug-Deckel mit freien Feldern                | 0.0 %                   |

#### 3. Anzug: Sitz 0 gegen Sitz 1

| Messgroesse                                        | extreme (#0–299, n=300) |
|----------------------------------------------------|-------------------------|
| Sieg Sitz 0 (zieht zuerst)                         | 52.0 %                  |
| Sieg Sitz 1                                        | 47.0 %                  |
| Unentschieden                                      | 1.0 %                   |
| Punkte Sitz 0 / Sitz 1 im Mittel                   | 74.1 / 65.9             |
| Zuege je Partie                                    | 103.7                   |
| Sitz 1 nach Zug 1 gesperrt: Partien / davon Sieg 0 | 0 / –                   |

#### 4. Mauern des Bots

| Messgroesse                                           | extreme (n=300) |
|-------------------------------------------------------|-----------------|
| Mauern je Partie (beide Sitze)                        | 44.27           |
| Partien mit mind. einer Mauer                         | 100.0 %         |
| Zuganfaenge mit Kandidaten                            | 29236           |
| bester Wandwert im Mittel / hoechstens                | 2.53 / 8.50     |
|   bester Wert < 0                                     | 0.1 %           |
|   bester Wert = 0                                     | 1.4 %           |
|   bester Wert 0,5                                     | 13.8 %          |
|   bester Wert 1 bis 1,5                               | 25.3 %          |
|   bester Wert >= 2                                    | 59.4 %          |
| beste Wand ohne Gebietsanteil (Zug-, Weg-, Platzterm) | 100.0 %         |
| Grund: Eroeffnung (mauerfrei)                         | 900             |
| Grund: Vorrat leer                                    | 8790            |
| Grund: beste Wand 0 < x < Schwelle                    | 15498           |
| Grund: beste Wand < 0                                 | 35              |
| Grund: beste Wand = 0                                 | 421             |
| Grund: gebaut                                         | 13282           |
| Grund: keine erlaubte Kante                           | 5454            |
| beste Wand: Weg- / Platzterm im Mittel                | 2.42 / 0.02     |
| Abweichung bewerteWaende gegen botZug (muss 0 sein)   | 0               |

#### 5. Farbwahl des Bots gegen Alternativen

| Messgroesse                                               | extreme (#0–299, n=300) |
|-----------------------------------------------------------|-------------------------|
| Farbentscheidungen (>= 2 erlaubte Farben)                 | 31098                   |
| Sperre verpasst (Zuege / Partien)                         | 4901 / 100.0 %          |
| sich sperrbar gemacht, sichere Farbe da (Zuege / Partien) | 206 / 53.7 %            |
| 2-Zug-Verlust >= 3 Punkte (Zuege / Partien)               | 132 / 32.7 %            |
|   Verlust im Mittel                                       | 3.2                     |
| Gleichstand beim Gewinn (kleinste Nummer gewinnt)         | 14897                   |
|   davon 2-Zug-Wert >= 2 schlechter                        | 662                     |

#### 6. Gegenproben: eine geaenderte Entscheidung gegen den Bot (gleiche Saaten)

| extreme (#0–299)  | als Sitz 0 (Bot-Bot 52.0 %) | als Sitz 1 (Bot-Bot 47.0 %) | Partien mit Abweichung 0 / 1 | gewonnene Saaten (Bsp.) |
|-------------------|-----------------------------|-----------------------------|------------------------------|-------------------------|
| eroeffnungssperre | 52.0 % (+0 −0)              | 47.0 % (+0 −0)              | 0.0 % / 0.0 %                |                         |
| sperrer           | 41.7 % (+38 −69)            | 45.0 % (+42 −48)            | 98.7 % / 97.7 %              | 9@0 17@0 18@0 6@1 12@1  |
| zweizug           | 59.3 % (+63 −41)            | 60.0 % (+81 −42)            | 95.7 % / 98.0 %              | 7@0 8@0 13@0 0@1 6@1    |
| mauerer           | 35.7 % (+39 −88)            | 29.7 % (+43 −95)            | 87.7 % / 87.0 %              | 7@0 14@0 17@0 0@1 20@1  |

#### 7. Beispiel-Saaten (Saatindex; nachspielen mit --zeige <spielart>:<index>)

##### extreme
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: —
- Eckfarbe 0 = beide Nachbarn 1: —
- ohne nutzbare Farbe nach Zug 1/2: —
- Fronten zu: 0 (ab Zug 49, frei 64:0); 1 (ab Zug 62, frei 15:31); 2 (ab Zug 52, frei 68:0); 3 (ab Zug 79, frei 23:0); 4 (ab Zug 89, frei 1:1)
- eingesperrt (>= 10 frei, <= 1/4): 0 (ab Zug 49, frei 64:0, Sieger 0); 2 (ab Zug 52, frei 68:0, Sieger 0); 3 (ab Zug 79, frei 23:0, Sieger 0); 5 (ab Zug 60, frei 0:72, Sieger 1); 6 (ab Zug 37, frei 94:0, Sieger 0)
- Sitz eingeschlossen: 0 (Sitz 1 ab Zug 49); 1 (Sitz 0 ab Zug 85); 2 (Sitz 1 ab Zug 52); 3 (Sitz 1 ab Zug 79); 4 (Sitz 0 ab Zug 91)
- Partie mit Mauer: 0 (Zug 6, 7, 8, 9, 10, 11, 11, 12, 12, 15, 15, 16, 16, 19, 19, 20, 20, 23, 24, 25, 26, 27, 27, 28, 30, 31, 32, 34, 35, 36, 36, 37, 40, 40, 41, 43, 44, 46, 47, 48, 51, 51, 57, 59, 63, 65); 1 (Zug 6, 7, 8, 9, 9, 10, 12, 13, 14, 15, 15, 16, 18, 19, 19, 20, 23, 24, 25, 26, 27, 29, 29, 30, 33, 34, 35, 35, 36, 38, 39, 39, 42, 42, 43, 43, 46, 46, 47, 47, 50, 50, 51, 54, 58, 63, 68, 80); 2 (Zug 6, 6, 7, 9, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 21, 23, 25, 26, 27, 27, 28, 30, 31, 32, 33, 33, 34, 36, 36, 37, 37, 40, 41, 43, 44, 45, 45, 49, 51); 3 (Zug 6, 6, 7, 9, 10, 11, 11, 12, 14, 15, 16, 17, 17, 18, 18, 21, 21, 22, 24, 25, 26, 27, 28, 29, 31, 33, 34, 36, 37, 38, 39, 40, 42, 43, 45, 46, 50, 53, 54, 55, 57, 58, 59, 60, 63, 68, 81); 4 (Zug 6, 7, 8, 9, 10, 11, 12, 12, 13, 15, 16, 17, 17, 18, 18, 21, 21, 22, 22, 25, 25, 26, 28, 29, 30, 31, 32, 33, 33, 34, 34, 37, 38, 39, 40, 41, 44, 47, 48, 49, 50, 51, 52, 53, 55, 59, 63, 67, 72)
- Wand knapp unter Schwelle: 0 (20 Zuege mit Wert 1–1,5); 1 (18 Zuege mit Wert 1–1,5); 2 (28 Zuege mit Wert 1–1,5); 3 (29 Zuege mit Wert 1–1,5); 4 (15 Zuege mit Wert 1–1,5)
- Sperre verpasst: 0 (Zug 14 Sitz 0: gewaehlt 4, sperrend 3); 1 (Zug 24 Sitz 0: gewaehlt 4, sperrend 6); 2 (Zug 20 Sitz 0: gewaehlt 5, sperrend 6); 3 (Zug 14 Sitz 0: gewaehlt 4, sperrend 6); 4 (Zug 14 Sitz 0: gewaehlt 6, sperrend 5)
- sich sperrbar gemacht: 0 (Zug 13 Sitz 1: gewaehlt 2, sicher 3); 3 (Zug 50 Sitz 0: gewaehlt 0, sicher 4); 4 (Zug 13 Sitz 1: gewaehlt 3, sicher 5); 7 (Zug 32 Sitz 0: gewaehlt 5, sicher 6); 9 (Zug 23 Sitz 1: gewaehlt 0, sicher 6)
- groesster 2-Zug-Verlust: 29 (Zug 63 Sitz 1: gewaehlt 1, besser 5, verlust 6); 60 (Zug 103 Sitz 1: gewaehlt 0, besser 3, verlust 5); 154 (Zug 74 Sitz 0: gewaehlt 0, besser 6, verlust 5); 213 (Zug 93 Sitz 1: gewaehlt 0, besser 4, verlust 5); 1 (Zug 60 Sitz 0: gewaehlt 1, besser 6, verlust 4)

### Lauf 3: `--extreme 0 --klar 200 --build 200 --faeden 20` (Gegenproben Klar/Build, 152 s)

Abschnitte 1–5 und 7 dieses Laufs sind Zahl für Zahl gleich Lauf 1 und
stehen deshalb nicht noch einmal da.

#### 6. Gegenproben: eine geaenderte Entscheidung gegen den Bot (gleiche Saaten)

| klar (#0–199)     | als Sitz 0 (Bot-Bot 35.0 %) | als Sitz 1 (Bot-Bot 48.0 %) | Partien mit Abweichung 0 / 1 | gewonnene Saaten (Bsp.) |
|-------------------|-----------------------------|-----------------------------|------------------------------|-------------------------|
| eroeffnungssperre | 38.5 % (+7 −0)              | 48.0 % (+0 −0)              | 17.5 % / 1.0 %               | 28@0 62@0 143@0         |
| sperrer           | 38.5 % (+7 −0)              | 48.5 % (+1 −0)              | 40.0 % / 25.5 %              | 28@0 62@0 143@0 140@1   |
| zweizug           | 50.0 % (+43 −13)            | 58.0 % (+39 −19)            | 78.5 % / 78.5 %              | 1@0 8@0 11@0 1@1 3@1    |

| build (#0–199)    | als Sitz 0 (Bot-Bot 47.0 %) | als Sitz 1 (Bot-Bot 46.5 %) | Partien mit Abweichung 0 / 1 | gewonnene Saaten (Bsp.)  |
|-------------------|-----------------------------|-----------------------------|------------------------------|--------------------------|
| eroeffnungssperre | 51.5 % (+11 −2)             | 47.0 % (+1 −0)              | 17.5 % / 1.0 %               | 8@0 16@0 18@0 194@1      |
| sperrer           | 45.0 % (+25 −29)            | 49.5 % (+27 −21)            | 92.0 % / 92.0 %              | 16@0 24@0 28@0 2@1 14@1  |
| zweizug           | 57.0 % (+35 −15)            | 54.5 % (+32 −16)            | 83.0 % / 88.0 %              | 5@0 16@0 18@0 9@1 10@1   |
| mauerer           | 50.5 % (+14 −7)             | 47.0 % (+15 −14)            | 76.0 % / 86.0 %              | 13@0 22@0 33@0 32@1 35@1 |
