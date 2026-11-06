# Messung 07.11.2026 — Warum gewinnt Sitz 0 (zieht zuerst) öfter?

Frage von Niklas (06.11.2026): Bot gegen Bot gewinnt Sitz 0 in Extreme
60 % zu 34,5 %, in Build und Klar 52 % zu 36 %
(`MESSUNG-2026-11-06-bot-mauert.md`). Warum, und was gleicht das aus?

Stand: Zweig 0b7b4573 (311eceaf) per Merge auf staging 3f63653b, `src/`
unverändert. Alles hier stammt aus `werkzeug/anzug.mjs`, gepaart auf den
Saaten `saatHex(0..199)` — dieselben wie `simulation.mjs` und
`bot-duell.mjs`. Die Grundregel trifft die bekannten Zahlen genau:
Klar 52,0 / 36,0 / 12,0, Build 53,5 / 44,0 / 2,5, Extreme 60,5 / 37,0 / 2,5.

    npm run build --workspace @brauweg/game-api
    npm run build --workspace @brauweg/game-filler
    node packages/game-filler/werkzeug/anzug.mjs --n 200 --nur klar,build --faeden 15     # ~6 min
    node packages/game-filler/werkzeug/anzug.mjs --n 200 --nur extreme --faeden 15        # ~40 min, wenn ein zweiter Lauf die Kerne teilt
    # Nachträge:
    node packages/game-filler/werkzeug/anzug.mjs --n 200 --nur klar --kandidaten basis,farben7
    node packages/game-filler/werkzeug/anzug.mjs --n 200 --nur build,extreme --kandidaten basis,mauer2

Rauschen: Bei n = 200 liegt der Standardfehler einer Quote um 50 % bei 3,5
Prozentpunkten. Unterschiede unter etwa 7 Punkten sind nicht belastbar. Die
Spalte „+/−“ zählt, auf wie vielen Saaten Sitz 0 gegenüber der Grundregel
einen Sieg dazugewinnt bzw. verliert. Ein sauberer Ausgleich verschiebt nur
in eine Richtung, zum Beispiel +4 −24. Bei „+45 −46“ würfelt die Variante nur
das Brett neu.

## Kurz: die Ursache

Es ist der **Anzug selbst, nicht die Ecke und nicht das Brett**. Lässt man
auf demselben Brett Sitz 1 anfangen, gewinnt wieder der Anfänger, und zwar
gleich oft: Klar 52,0 → 53,5 %, Extreme 60,5 → 60,5 %. Die Ecken sind
ausgeglichen: „Ecke unten links gewinnt beide“ steht in Extreme bei 25,0 %,
„oben rechts“ bei 24,5 %.

Der Vorteil entsteht **nicht in der Eröffnung**. Weil kein Feld einen
gleichfarbigen Nachbarn hat, holt jeder Farbzug nur die angrenzenden Felder
einer Farbe, nie eine Kette. Der erste Zug bringt deshalb 1,0 bis 1,1 Felder,
nach Zug 2 steht es im Mittel 0,0. Er entsteht aus dem **halben Zug mehr bis
zum Schluss**: Wer den letzten Farbzug macht, gewinnt in Klar 70,8 %, in Build
88,5 % und in Extreme 89,9 % der Partien.

In **Extreme** kommt die **erste Mauer** dazu. Bei sechs mauerfreien Zügen
setzt sie in 98 % der Partien Sitz 0, in seinem vierten Zug (Zug 6). Weil dort
das Einsperren die Partie entscheidet (Endvorsprung zwischen −78 und +88,
Median +18), schlägt das voll durch. Verschiebt man das auf sieben mauerfreie
Züge, fällt Sitz 0 auf 53,5 %.

## 1. Ursache: Hypothesen mit Zahlen

### 1a. Vorsprung nach Zug k (Sitz 0 minus Sitz 1, Punkte, Mittel)

| Spielart | Zug 1 | Zug 2 | Zug 5 | Zug 10 | Zug 20 | Ende | Ende, gleich viele Züge | S0 zieht zuletzt: Anteil / Sieg S0 dann / sonst |
|---|---|---|---|---|---|---|---|---|
| klar    | 1,1 | 0,0 | 1,6 | −0,2 | 0,7 | 1,6  | 1,1  | 48,0 % / 70,8 % / 34,6 % |
| build   | 1,1 | 0,0 | 1,1 | −0,1 | −0,2 | 1,9 | 1,3  | 52,0 % / 88,5 % / 15,6 % |
| extreme | 1,0 | 0,0 | 1,7 | 0,9  | 2,9 | 14,8 | 14,2 | 59,5 % / 89,9 % / 17,3 % |

Nach ungeraden Zügen ist Sitz 0 einen Zug voraus, also gut ein Feld. Nach
geraden Zügen steht es fast gleich. In Klar und Build bleibt das bis zum Ende
so; dort entscheiden ein bis zwei Felder, deshalb die 12 % Remis in Klar
(56 Felder, die Differenz ist immer gerade). In Extreme wächst der Vorsprung
über die ganze Partie: 4,2 nach einem Viertel, 6,2 zur Hälfte, 14,8 am Ende.

### 1b. Anzug oder Ecke? (dasselbe Brett, einmal beginnt Sitz 1)

| Spielart | Anfänger gewinnt (S0 zuerst / S1 zuerst) | Anfänger gewinnt beide | Ecke u. l. gewinnt beide | Ecke o. r. gewinnt beide | sonst |
|---|---|---|---|---|---|
| klar    | 52,0 / 53,5 % | 23,5 % | 19,0 % | 25,0 % | 32,5 % |
| build   | 53,5 / 45,0 % | 21,0 % | 28,5 % | 23,0 % | 27,5 % |
| extreme | 60,5 / 60,5 % | 34,5 % | 25,0 % | 24,5 % | 16,0 % |

**Hypothese „Ecke / Brettaufbau begünstigt Sitz 0“: verworfen.** In Build
bleibt ein kleiner Rest für die Ecke unten links (28,5 zu 23,0 %), das liegt
im Rauschen.

### 1c. Entscheidet der erste Zug? (jede erlaubte erste Farbe von Sitz 0 durchgespielt)

| Spielart | Farben | S0 gewinnt mit jeder | mit keiner | hängt an der Farbe | S0 mit bester Farbe | mit Bot-Farbe |
|---|---|---|---|---|---|---|
| klar    | 4 | 12,0 % | 28,0 % | 71,0 % | 72,0 % | 52,0 % |
| build   | 4 | 13,5 % | 18,5 % | 70,5 % | 81,5 % | 53,5 % |
| extreme | 5 | 15,5 % | 13,5 % | 72,0 % | 86,5 % | 60,5 % |

Auf gut 70 % der Bretter kippt das Ergebnis mit der ersten Farbe, obwohl sie
nur ein Feld bringt. Die Partie ist chaotisch, und wer zuerst zieht, sucht
sich einen der Wege aus. Ein sicherer Sieg nur durch die Eröffnung ist
selten (12 bis 15,5 %).

### 1d. Nimmt der erste Zug dem Nachzieher etwas weg (Startfarbe)?

| Spielart | bester 1. Zug S0 / S1 auf leerem Brett | S1 beste Antwort nach Zug 1 | S1 verliert durch Zug 1 | Sieg S0 dann / sonst |
|---|---|---|---|---|
| klar    | 1,13 / 1,18 | 1,17 | 5,5 % | 72,7 % / 50,8 % |
| build   | 1,13 / 1,18 | 1,17 | 5,5 % | 72,7 % / 52,4 % |
| extreme | 1,00 / 1,00 | 1,00 | 0,0 % | – / 60,5 % |

**Hypothese „Startfarbe / Wegnehmen“: als Hauptursache verworfen.** In
Extreme kommt es dank der fairen Ecken gar nicht vor. In Klar und Build
betrifft es 5,5 % der Bretter und erklärt dort höchstens einen Punkt.
Schaltet man die fairen Ecken um (Klar und Build an, Extreme aus), wird es
nicht ausgeglichener: Klar 61,0 %, Build 61,0 %, Extreme 63,0 %.

### 1e. Sterne, Mauern, Brettgröße, Farbzahl

| Diagnose | Sieg S0 / S1 / remis | +/− |
|---|---|---|
| Extreme ohne Sterne                         | 60,0 / 40,0 / 0,0  | +45 −46 |
| Extreme ohne Mauern (auch keine aus Sternen) | 60,0 / 34,5 / 5,5  | +44 −45 |
| Extreme auf 8 x 7 (10 Mauern, 2 Sternpaare)  | 60,5 / 35,5 / 4,0  | +56 −56 |
| Build ohne Mauern                            | 52,0 / 36,0 / 12,0 | +41 −44 |
| Build auf 12 x 11 (20 Mauern)                | 58,0 / 41,5 / 0,5  | +53 −44 |
| Klar auf 10 x 9 / 12 x 11                    | 56,0 / 33,5 / 10,5 · 54,0 / 37,5 / 8,5 | +53 −45 · +49 −45 |
| Klar mit sieben Farben                       | 55,0 / 34,5 / 10,5 | +48 −42 |

- **Sterne: Folge, nicht Ursache.** In Extreme holt Sitz 0 im Mittel
  4,43 Sterne gegen 3,56, den ersten in 68 % der Partien, und wer mehr Sterne
  hat, gewinnt zu 98 %. Ohne Sterne gewinnt Sitz 0 aber genauso oft
  (60,0 %): Wer vorne liegt, sammelt die Sterne, nicht umgekehrt.
- **Mauervorrat: an sich keine Ursache.** Ohne Mauern bleibt es bei 60 %
  (Extreme) bzw. 52 % (Build). **Wer zuerst mauern darf, ist aber ein
  Hebel**, siehe 2: Extreme mit 7 mauerfreien Zügen 53,5 %. Build mit 4
  mauerfreien Zügen (Sitz 0 mauert zuerst statt Sitz 1) steigt auf 71,0 %.
  Dass Build heute nur bei 53,5 % liegt, verdankt es also schon den drei
  mauerfreien Zügen: Dort setzt Sitz 1 die erste Mauer (97,5 %).
- **Brettgröße: verworfen.** Alle Größen liegen im Rauschen der jeweiligen
  Spielart.
- **Sieben Farben: nicht belegt.** Klar mit 7 Farben 55 % statt 52 %, das
  liegt im Rauschen. Warum Extreme ohne Mauern und ohne Sterne bei 60 % liegt
  und Klar bei 52 %, ist damit **offen**. Keine einzelne der gemessenen Größen
  erklärt die 8 Punkte; vermutlich die Kombination aus großem Brett,
  7 Farben und Sternen.

## 2. Ausgleich: Kandidaten, gepaart auf denselben Saaten

Alles nur im Skript, keine Regel in `src/`. Punkteausgleich und Tauschregel
ändern keinen Botzug und werden aus den Grundpartien bzw. dem Fächer
gerechnet (siehe Kopf von `anzug.mjs`). Die Tauschregel braucht ein Modell
der Menschen: Sitz 1 tauscht, wenn „Vorsprung des ersten Zugs minus meine
beste Antwort“ erfahrungsgemäß mehr als 50 % für Sitz 0 bedeutet. Sitz 0
wählt die erste Farbe so, dass sich das Tauschen gerade nicht lohnt. Gelernt
wird über Kreuz (gerade/ungerade Saaten), gezählt aus Sicht der Menschen
(Anziehender / Nachziehender).

### Extreme

| Variante | Sieg S0 | Sieg S1 | remis | Farbzüge | +/− |
|---|---|---|---|---|---|
| Grundregel                                  | 60,5 % | 37,0 % | 2,5 % | 100,0 | |
| **Sitz 1 +3 Mauern (23 statt 20)**          | **50,5 %** | **49,5 %** | 0,0 % | 103,8 | +4 −24 |
| Sitz 1 +2 Mauern                            | 51,5 % | 47,0 % | 1,5 % | 102,9 | +4 −22 |
| Sitz 1 +1 Mauer                             | 57,0 % | 41,5 % | 1,5 % | 101,6 | +3 −10 |
| Sitz 1 startet mit einem Stern (+1 Punkt, +1 Mauer) | 57,0 % | 43,0 % | 0,0 % | 101,6 | +3 −10 |
| mauerfreie Eröffnung 7 statt 6              | 53,5 % | 45,0 % | 1,5 % | 99,8  | +35 −49 |
| Sitz 1 startet mit 2 Feldern                | 52,0 % | 46,0 % | 2,0 % | 97,8  | +37 −54 |
| Sitz 1 färbt im ersten Zug zweimal          | 41,0 % | 57,5 % | 1,5 % | 102,0 | +31 −70 |
| Tauschregel (50 % getauscht)                | 51,0 % | 46,5 % | 2,5 % | 101,5 | |
| Sitz 1 +1 Punkt (Gleichstand → Sitz 1)      | 60,5 % | 39,5 % | 0,0 % | 100,0 | |
| Sitz 1 +10,5 Punkte (bester Punkteausgleich) | 53,5 % | 46,5 % | 0,0 % | 100,0 | |

Der Punkteausgleich taugt hier nicht. Die Endstände streuen von −78 bis +88,
erst ab 10,5 Punkten bewegt sich etwas, und auch dann nur bis 53,5 %.

### Build

| Variante | Sieg S0 | Sieg S1 | remis | Farbzüge | +/− |
|---|---|---|---|---|---|
| Grundregel                                  | 53,5 % | 44,0 % | 2,5 % | 50,0 | |
| **Sitz 1 +1 Mauer (11 statt 10)**           | **47,0 %** | **46,5 %** | 6,5 % | 51,0 | +3 −16 |
| Sitz 1 startet mit einem Stern (+1 Punkt, +1 Mauer) | 47,0 % | 53,0 % | 0,0 % | 51,0 | +3 −16 |
| Sitz 1 +2 Mauern                            | 42,0 % | 52,0 % | 6,0 % | 52,1 | +2 −25 |
| Sitz 1 +3 Mauern                            | 41,5 % | 56,5 % | 2,0 % | 52,9 | +2 −26 |
| Sitz 1 +2 Punkte am Ende                    | 46,5 % | 46,5 % | 7,0 % | 50,0 | |
| Sitz 1 +1 Punkt (Gleichstand → Sitz 1)      | 53,5 % | 46,5 % | 0,0 % | 50,0 | |
| mauerfreie Eröffnung 4 statt 3              | 71,0 % | 24,5 % | 4,5 % | 50,2 | +53 −18 |
| Sitz 1 startet mit 2 Feldern                | 30,0 % | 64,5 % | 5,5 % | 48,6 | +19 −66 |
| Sitz 1 färbt im ersten Zug zweimal          | 50,0 % | 44,5 % | 5,5 % | 50,6 | +34 −41 |
| Tauschregel (41 % getauscht)                | 37,5 % | 57,5 % | 5,0 % | 51,9 | |

### Klar (keine Mauern, keine Sterne)

| Variante | Sieg S0 | Sieg S1 | remis | Farbzüge | +/− |
|---|---|---|---|---|---|
| Grundregel                                  | 52,0 % | 36,0 % | 12,0 % | 26,2 | |
| **Gleichstand zählt für Sitz 1 (= +1 Punkt)** | **52,0 %** | **48,0 %** | 0,0 % | 26,2 | |
| Sitz 1 +2 Punkte am Ende                    | 35,0 % | 48,0 % | 17,0 % | 26,2 | |
| Sitz 1 färbt im ersten Zug zweimal          | 35,5 % | 49,5 % | 15,0 % | 26,6 | +20 −53 |
| Tauschregel (41 % getauscht)                | 37,5 % | 48,0 % | 14,5 % | 26,8 | |
| Sitz 1 startet mit 2 Feldern                | 23,5 % | 63,5 % | 13,0 % | 25,1 | +16 −73 |

Weil fast immer alle 56 Felder vergeben werden, ist die Differenz gerade:
+0,5, +1 und +1,5 Punkte wirken gleich (Remis → Sitz 1), +2 ist schon
deutlich zu viel.

Nicht gemessen, weil wirkungslos: „Sitz 0 schluckt im ersten Zug weniger“.
Der erste Zug holt ohnehin nur die Nachbarn der Ecke (siehe Kurzfassung);
die Probe war Saat für Saat dieselbe Partie. Ebenso wirkungslos ist „Sitz 0
darf im ersten Zug nicht mauern“: Die Eröffnung ist in Build und Extreme
schon mauerfrei.

## 3. Empfehlung

| Spielart | Kandidat | Sieg S0 / S1 / remis | was er am Spielgefühl ändert |
|---|---|---|---|
| Extreme | **Sitz 1 bekommt 3 Mauern mehr (23 statt 20)** | 50,5 / 49,5 / 0,0 | Keine neue Regel zum Lernen, nur ein ungleicher Vorrat, den man am Zähler sieht. Die Partie wird ~4 Farbzüge länger. Er verschiebt sauber (+4 −24), statt die Bretter neu zu würfeln. +2 Mauern (51,5 / 47,0) ist die vorsichtigere Stufe. |
| Build   | **Sitz 1 bekommt 1 Mauer mehr (11 statt 10)** | 47,0 / 46,5 / 6,5 | Wie oben, eine Mauer, sauber (+3 −16). Gleich gut ist Sitz 1 +2 Punkte am Ende (46,5 / 46,5 / 7,0), das ist aber eine unsichtbare Regel, die man erklären muss. |
| Klar    | **Gleichstand zählt für Sitz 1**             | 52,0 / 48,0 / 0,0 | Remis entfällt (heute 12 %). Mehr geht nicht: Jeder stärkere Ausgleich (Doppelzug, Tausch, Startfeld, +2 Punkte) kippt auf 35 bis 37 % für Sitz 0. |

Die Tauschregel kommt in Extreme fast genauso nah heran (51,0 / 46,5). Sie
hängt aber am Modell, wie gut Menschen eine Lage nach einem Zug einschätzen,
und überzieht in Klar und Build deutlich (37,5 % für den Anziehenden). Als
Regel ist sie außerdem schwerer zu erklären als ein größerer Vorrat.

Eine Regel ist damit **nicht** eingebaut. Wer „Sitz 1 + n Mauern“ als Regel
will, braucht ein neues Feld im Regelsatz (etwa ein Mauerzuschlag für den
Nachzieher in `SpielartAufbau`) samt Snapshot-Verträglichkeit. Danach wird
mit `simulation.mjs` auf denselben Saaten nachgemessen, mit dem echten Bot
auf beiden Seiten.

Einschränkung: Gemessen ist Bot gegen Bot. Der Bot zieht gierig und kennt
keine der Varianten; ein Mensch nutzt drei Extramauern womöglich besser oder
schlechter. Die Richtung ist belastbar, der genaue Prozentwert nicht.
