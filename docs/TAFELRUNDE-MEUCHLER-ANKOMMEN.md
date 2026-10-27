# Tafelrunde — braucht der Meuchler etwas, das sein Ankommen bezahlt?

Stand: 23.09.2026. **Reine Messung, nichts umgebaut.** Kein Wert, keine Regel,
nichts in `src/` oder `test/` angefasst. Jede Variante unten war ein
vorübergehender Eingriff in eine Kopie des gebauten Pakets. Der Stand auf dem
Zweig ist der von `origin/staging`.

Anlass ist die Karte vom 06.09.2026 (Nachtrag „jede Seite bricht den
Gleichstand jetzt in ihrer eigenen Ordnung" in
`docs/spiele/auto-battler-konzept.md`). Seit der Spiegeläquivarianz schieben
sich die Hälften eher aneinander vorbei, und der Meuchler fiel von x0,79 auf
x0,67. Die Karte fragt, ob die Rolle **mehr Tempo, einen Startvorsprung oder
eine Rollenwirkung** braucht, damit sich ihr Ankommen lohnt.

**Kurz: Am Ankommen liegt es nicht.** Wer dem Meuchler das Ankommen
erleichtert, macht ihn **schwächer**. Zwei Hebel heben ihn: mehr Leben (ein
Katalogwert) oder die Zielwahl „Fernkämpfer" (eine neue Regel, als Schalter
schon gebaut). Beide wären eine Entscheidung am Spiel. Die trifft ein Mensch,
diese Datei liefert nur die Zahlen dafür.

Gemessen auf `origin/staging` = `65a04a5` (#255), Node 24, Windows.

## Wie gemessen wurde

`werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150`, je
Variante auf den Saatbasen `ausgewogenheit-v1` und `ausgewogenheit-v2`. Für
jede Variante wurde `src/` per `perl` gepatcht, das Paket gebaut, `dist/` und
`werkzeug/` in einen eigenen Ordner kopiert und `src/` sofort zurückgesetzt.
So konnten alle 18 Läufe gleichzeitig laufen (rund 135 s zusammen statt einer
halben Stunde nacheinander). Der Basislauf ergibt Zahl für Zahl dieselbe
Tabelle wie in `TAFELRUNDE-MEUCHLER-ZIELWAHL-PROBE.md`.

| Variante | Eingriff | beantwortet |
|---|---|---|
| **Basis** | keiner | — |
| **Schritt halb** | `kampf.ts`, Schrittpause für `rolle === 'meuchler'` halbiert | „mehr Tempo" fürs Ankommen |
| **Schritt null** | dieselbe Stelle, Schrittpause = ein Takt (100 ms): Der Meuchler geht jeden Takt einen Schritt | Obergrenze für **jeden** Hebel, der nur das Ankommen verkürzt |
| **Vorsprung** | alle Nicht-Meuchler starten mit `angriffFreiAb = schrittFreiAb = 1000` ms Kampfzeit | „Startvorsprung": Der Meuchler geht und schlägt eine Sekunde allein |
| **Markentempo** | Markenbonus Meuchler `tempoProzent` 15/25/40 → 30/50/80 | „mehr Tempo" im heutigen Sinn (Angriffe je Sekunde) |
| **Zielwahl** | `--meuchlerziel fernkaempfer` (der Schalter aus #253) | „Rollenwirkung" |
| **Leben +12,5 %** | Gassendieb 520→585, Schattenklinge 660→745, Knochenspäher 700→790, Klingentänzerin 860→970 | der Hebel, auf den das Kampfbild zeigt |
| **Leben +25 %** | 650 / 825 / 875 / 1075 | dasselbe, stärker |
| **Leben +25 % ohne KT** | wie oben, Klingentänzerin bleibt bei 860 | sie steht schon bei x1,38 |

Die Schrittweite hängt heute für alle Einheiten an derselben Zahl
(`SCHRITT_MS`, `src/kampf.ts:81`). Das `tempo` im Katalog zählt nur Angriffe
(`angriffstakt`, `:636`). „Mehr Tempo fürs Ankommen" wäre also eine neue
Regel, kein Katalogwert.

## Marke Meuchler

„roh" = Siegquote zum Schnitt der gezählten Zeilen. „gl. Kosten" = gegen
Bretter gleicher Kostensumme. Antritte der Marke aus v1.

| Variante | roh v1 | roh v2 | gl. Kosten v1 | gl. Kosten v2 | Antritte | vorzeitig einseitig v1 |
|---|---|---|---|---|---|---|
| Basis | x0,63 | x0,64 | x0,64 | x0,66 | 5.061 | 28,2 % |
| Schritt halb | **x0,55** | **x0,56** | x0,60 | x0,59 | 5.152 | 28,0 % |
| Schritt null | **x0,55** | **x0,56** | x0,59 | x0,59 | 5.172 | 28,0 % |
| Vorsprung 1 s | x0,60 | x0,63 | x0,61 | x0,63 | 5.073 | 26,4 % |
| Markentempo ×2 | x0,65 | x0,67 | x0,72 | x0,74 | 8.662 | 29,7 % |
| Zielwahl | x0,86 | x0,88 | x0,81 | x0,82 | 4.979 | 31,1 % |
| Leben +12,5 % | x0,89 | x0,88 | x0,87 | x0,89 | 7.047 | 30,5 % |
| Leben +25 % | **x1,06** | **x1,03** | **x1,01** | **x1,00** | 8.548 | 34,4 % |
| Leben +25 % ohne KT | x1,03 | x1,01 | x0,99 | x0,99 | 8.503 | 34,4 % |

## Die ganze Spanne (gegen gleich teure Bretter, v1 / v2)

| Variante | Wächter | Krieger | Untot | Naturwesen | Drache | Elementar | Meuchler | Spanne v1 |
|---|---|---|---|---|---|---|---|---|
| Basis | 1,53 / 1,53 | 1,47 / 1,49 | 1,06 / 1,10 | 0,97 / 0,96 | 0,89 / 0,87 | 0,83 / 0,80 | 0,64 / 0,66 | 0,64–1,53 |
| Schritt null | 1,54 / 1,56 | 1,50 / 1,52 | 1,10 / 1,09 | 0,95 / 0,95 | 0,87 / 0,87 | 0,81 / 0,80 | 0,59 / 0,59 | 0,59–1,54 |
| Vorsprung 1 s | 1,52 / 1,53 | 1,46 / 1,48 | 1,13 / 1,09 | 0,96 / 0,98 | 0,94 / 0,89 | 0,87 / 0,82 | 0,61 / 0,63 | 0,61–1,52 |
| Markentempo ×2 | 1,56 / 1,57 | 1,54 / 1,54 | 1,13 / 1,14 | 1,13 / 1,13 | 0,93 / 0,89 | 0,86 / 0,86 | 0,72 / 0,74 | 0,72–1,56 |
| Zielwahl | 1,43 / 1,43 | 1,40 / 1,41 | 0,99 / 0,98 | 0,98 / 0,95 | 0,89 / 0,88 | 0,84 / 0,83 | 0,81 / 0,82 | 0,81–1,43 |
| Leben +12,5 % | 1,39 / 1,41 | 1,36 / 1,37 | 0,93 / 1,00 | 1,04 / 1,02 | 0,96 / 0,91 | 0,91 / 0,87 | 0,87 / 0,89 | 0,87–1,39 |
| Leben +25 % | 1,28 / 1,29 | 1,29 / 1,29 | 0,90 / 0,93 | 1,04 / 0,99 | 0,95 / 0,97 | 0,92 / 0,90 | 1,01 / 1,00 | 0,90–1,29 |
| Leben +25 % ohne KT | 1,29 / 1,30 | 1,28 / 1,29 | 0,93 / 0,91 | 1,05 / 1,00 | 0,97 / 0,99 | 0,94 / 0,92 | 0,99 / 0,99 | 0,93–1,29 |

Einzelne Meuchler gegen gleich teure Bretter (v1):

| Variante | Gassendieb | Schattenklinge | Knochenspäher | Klingentänzerin |
|---|---|---|---|---|
| Basis | x0,58 | x0,59 | x0,65 | x1,38 |
| Schritt null | x0,53 | x0,56 | x0,65 | x1,41 |
| Vorsprung 1 s | x0,58 | x0,56 | x0,70 | x1,30 |
| Markentempo ×2 | x0,68 | x0,71 | x0,76 | x1,42 |
| Zielwahl | x0,75 | x0,72 | x0,65 | x1,40 |
| Leben +12,5 % | x0,84 | x0,77 | x0,70 | x1,42 |
| Leben +25 % | x0,95 | x0,92 | x0,78 | **x1,51** |
| Leben +25 % ohne KT | x0,95 | x0,92 | x0,80 | x1,44 |

**Die Probe hält überall.** `test/ausgewogenheit.test.ts` aus jeder
Variantenkopie: 10/10 grün (Basis, Markentempo und alle drei Lebensvarianten).

## Was die Zahlen sagen

1. **Schnelleres Ankommen schadet dem Meuchler.** Halber Schritt und
   Schritt null drücken ihn auf beiden Basen von x0,63/x0,64 auf x0,55/x0,56.
   Die beiden liegen gleichauf: Schon ein halber Schritt holt heraus, was sich
   beim Ankommen überhaupt holen lässt. Das passt zum Kampfbild
   (`TAFELRUNDE-MEUCHLER-KAMPFBILD.md`): Der erste Hieb kommt nach 0,4 s, kein
   Meuchler stirbt vor seinem ersten Hieb, und er fällt nach 6–8 s, weil er mit
   Schützenleben in der Front steht. Wer früher ankommt, steht früher
   **allein** in der Front und wird als Erster zusammengeschlagen.
2. **Der Startvorsprung bringt nichts.** Eine Sekunde, in der nur Meuchler
   gehen und schlagen, ergibt x0,60/x0,63 (v1 schlechter, v2 gleich). Seine
   Nebenwirkung ist eine andere: Kampf 15,5 statt 14,6 s, Partie 12 s länger.
3. **Mehr Angriffstempo hilft wenig, und nur über die Kostenspalte.** Ein
   doppelter Markenbonus hebt die Marke gegen gleich teure Bretter auf
   x0,72/x0,74, roh kaum (x0,65/x0,67). Der Bot kauft dafür 70 % mehr
   Meuchler (5.061 → 8.662 Antritte), und Naturwesen und Untot steigen mit.
   Die Spanne wird nicht enger (0,72–1,56).
4. **Mehr Leben ist der Hebel, der trägt.** Schon +12,5 % heben die Marke auf
   x0,87–0,89, +25 % auf x1,00–1,06, auf beiden Basen und in beiden Spalten.
   Gleichzeitig zieht sich die ganze Spanne zusammen, von 0,64–1,53 auf
   0,90–1,29. Das Geld kommt vor allem von Wächter und Krieger (−0,20 bis
   −0,25), dazu von Untot (1,06 → 0,90). Naturwesen, Drache und Elementar
   steigen leicht. Das ist genau der Befund aus dem
   Kampfbild: Schaden je Sekunde hatte der Meuchler schon am meisten, es fehlt
   ihm an Leben.
5. **Zielwahl und Leben unterscheiden sich im Preis.** Die Zielwahl kostet die
   Schützen (siehe `TAFELRUNDE-MEUCHLER-ZIELWAHL-PROBE.md`, Astschütze stirbt
   zwei Sekunden früher) und ist eine neue Regel mit eigener Anzeigefrage. Das
   Leben ist eine Zahl je Katalogzeile. Es verschiebt aber mehr: „vorzeitig
   einseitig" steigt von 28 auf 34 %, der Kampf wird eine Sekunde kürzer, und
   der Bot kauft 70 % mehr Meuchler.
6. **Die Klingentänzerin gehört nicht mit hinein.** Sie steht schon heute bei
   x1,38 und ginge mit +25 % auf x1,51. Ohne sie fällt die Marke nur von
   x1,01/x1,00 auf x0,99/x0,99. Ein Eingriff beträfe also Gassendieb,
   Schattenklinge und Knochenspäher (Letzterer trägt die Marke Untot, nicht
   Meuchler, und hebt Untot nicht: x0,93/x0,91).

## Was das für die Karte heißt

Die Erklärung im Nachtrag vom 06.09. („dessen ganze Rechnung am schnellen
Ankommen hängt") trägt nicht. Der Nachtrag hat richtig gemessen, dass die
Spiegeläquivarianz den Meuchler um 0,12 gedrückt hat. Die Ursache ist aber
nicht, dass er später ankommt. Schnelleres Ankommen drückt ihn weiter. Die
Marke hat ein Lebensproblem, das es schon vor dem 06.09. gab (x0,79 war auch
damals die unterste Zeile außer Naturwesen).

**Offen und zu entscheiden:**

- **A — Leben +25 % für Gassendieb, Schattenklinge, Knochenspäher** (650 / 825
  / 875), Klingentänzerin bleibt. Meuchler x0,99, Spanne 0,93–1,29. Nur
  Katalog, nichts am Kampf. Folgen: mehr einseitige Partien (34 %), der Bot
  kauft deutlich mehr Meuchler, und wer die Zahl umsetzt, muss die Schwellen
  und Antrittszahlen in `test/ausgewogenheit.test.ts` nachmessen.
- **A′ — dasselbe halb so stark** (+12,5 %): Meuchler x0,87–0,89, Spanne
  0,87–1,39, weniger Nebenwirkung. Nicht ohne Klingentänzerin gemessen.
- **B — Zielwahl einschalten** (`STANDARD_REGLER.meuchlerZielwahl =
  'fernkaempfer'`): Meuchler x0,81–0,88, eine neue Regel, der Bot kennt sie
  nicht, die Anzeige hat sie nie gezeigt.
- **Kein** Tempo, **kein** Startvorsprung: gemessen, schaden oder bringen
  nichts.

A und B schließen sich nicht aus, gemessen ist die Kombination aber nicht.

## Was diese Messung nicht sagt

- Ob sich der Bot nach einer Lebensänderung sinnvoll verhält. Er kauft mehr
  Meuchler, weil seine Stärkeschätzung Leben zählt. Ob er damit **besser**
  spielt, zeigt nur ein Duell alter gegen neuer Stand
  (`werkzeug/aufstellungsduell.mjs` bzw. zwei `dist`-Kopien).
- Die Tauschprobe (`werkzeug/tauschprobe.mjs`) für die geänderten Einheiten.
  Die Spalte „gleiche Kostensumme" rechnet die Auswahl des Bots nicht heraus.
- Acht Sitze. Gemessen ist nur zu viert, wie auf der Karte.
