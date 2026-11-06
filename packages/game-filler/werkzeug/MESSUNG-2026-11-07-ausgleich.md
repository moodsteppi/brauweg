# Messung 07.11.2026 — der Ausgleich für Sitz 1, auf neuen Saaten

Folgt auf `MESSUNG-2026-11-07-anzug.md`. Dort ergab sich auf den Saaten
`saatHex(0..199)`: Build +1 Mauer, Extreme +3 Mauern, Klar „Gleichstand für
Sitz 1“ gleicht den Anzug aus. Hier wird dieselbe Regel nachgemessen — mit
**neuen Saaten** (`saatHex(1000..1999)`, n = 1000 je Spielart), damit die
Auswahl nicht an den Saaten hängt, auf denen sie gefunden wurde, und mit dem
Bot, wie er heute auf `staging` steht (`src/bot.ts` unverändert, der
gedämpfte Bot d435ee73 ist verworfen).

„Vorher“ ist `staging` 2a45a58e, „nachher“ dieser Zweig (ac5bd8c3). Beide
als eigene Kopie gebaut, damit sie sich die `dist/` nicht teilen:

    npm run build --workspace @brauweg/game-api
    npm run build --workspace @brauweg/game-filler
    node packages/game-filler/werkzeug/simulation.mjs --n 1000 --start 1000 --ohne-ausbeuter --json

`--ohne-ausbeuter`, weil nur Bot gegen Bot gemessen wird (Sitz 0 gegen
Sitz 1); ein Lauf über drei Spielarten dauert unter paralleler Last rund
50 Minuten.

Standardfehler: √(p·(1−p)/n) in Prozentpunkten. Bei n = 1000 und p um 50 %
sind das 1,6 Punkte; Unterschiede unter etwa 3 Punkten sind nicht belastbar.

## Ergebnis

| Spielart | | Sitz 0 | Sitz 1 | remis | Punkte S0 : S1 | Züge |
|---|---|---|---|---|---|---|
| Klar    | vorher  | 57,6 ± 1,6 | 29,4 ± 1,4 | 13,0 ± 1,1 | | |
| Klar    | nachher | 57,6 ± 1,6 | 42,4 ± 1,6 |  0,0       | unverändert | unverändert |
| Build   | vorher  | 51,9 ± 1,6 | 44,3 ± 1,6 |  3,8 ± 0,6 | | 51,0 |
| Build   | nachher | 47,2 ± 1,6 | 48,4 ± 1,6 |  4,4 ± 0,6 | 28,2 : 27,8 | 52,1 |
| Extreme | vorher  | 59,4 ± 1,6 | 39,5 ± 1,5 |  1,1 ± 0,3 | 75,9 : 64,1 | 101 |
| Extreme | nachher | 46,7 ± 1,6 | 52,6 ± 1,6 |  0,7 ± 0,3 | 69,8 : 70,2 | 105 |

Mauern je Partie in Build: 18,8 → 19,5.

- **Build +1** sitzt: 47,2 zu 48,4 liegt innerhalb eines Standardfehlers.
- **Extreme +3** schießt über: Sitz 1 gewinnt jetzt rund 6 Punkte öfter
  als Sitz 0. Vorher waren es 20 Punkte für Sitz 0 — also deutlich näher an
  ausgeglichen als vorher, aber nicht ausgeglichen. Die Punktzahl selbst
  liegt mit 69,8 : 70,2 genau in der Mitte; die Siegquote kippt trotzdem.
  Zusatzmessung mit +2: siehe unten.
- **Klar** bleibt einseitig. Auf den alten Saaten ergab der Gleichstand
  52 : 48, auf den neuen nur 57,6 : 42,4. Klar hat keine Mauern, also sind
  es dieselben Partien wie vorher — der Gleichstand macht nur aus jedem
  Remis einen Sieg von Sitz 1. Der Abstand von 15 Punkten ist größer als die
  13 % Remis, die er umverteilen kann.

## Zusatz: Klar, andere Ausgleiche (aus den Punktdifferenzen)

Weil in Klar nichts die Partie selbst verändert, lassen sich Punktausgleiche
ohne neues Spielen aus der Verteilung von `punkte0 − punkte1` derselben 1000
Partien ablesen (eigener Lauf reproduziert 57,6 / 29,4 / 13,0 genau):

| Ausgleich für Sitz 1 | Sitz 0 | Sitz 1 | remis |
|---|---|---|---|
| keiner (vorher)              | 57,6 | 29,4 | 13,0 |
| Gleichstand (eingebaut)      | 57,6 | 42,4 |  0,0 |
| +2 Punkte                    | 44,1 | 42,4 | 13,5 |
| +2 Punkte und Gleichstand    | 44,1 | 55,9 |  0,0 |
| +4 Punkte                    | 32,1 | 55,9 | 12,0 |

„+2 Punkte“ wäre auf diesen Saaten der beste Ausgleich. Das ist eine neue
Regel (ein Punktzuschlag statt Gleichstand) und deshalb hier nicht
eingebaut — der Auftrag nennt den Gleichstand.

## Zusatz: Extreme +2

Derselbe Saatbereich 1000..1999, ein eigener Läufer über `erstellePartie` und `botZug` mit
`ausgleichJeSpielart: { extreme: { barrierenZuschlagSitz1: 2 } }`.
Er nimmt dieselben Partien wie `simulation.mjs` (gleiche `saatHex`, gleicher Bot).

| Extreme | Sitz 0 | Sitz 1 | remis | mittl. Punktdifferenz S0 − S1 |
|---|---|---|---|---|
| +0 (vorher)  | 59,4 ± 1,6 | 39,5 ± 1,5 | 1,1 ± 0,3 | +11,8 |
| +2           | 51,2 ± 1,6 | 47,9 ± 1,6 | 0,9 ± 0,3 | +4,2 |
| +3 (eingebaut) | 46,7 ± 1,6 | 52,6 ± 1,6 | 0,7 ± 0,3 | −0,4 |

+2 liegt mit 3,3 Punkten Abstand näher an ausgeglichen als +3 mit 5,9. Der
Standardfehler der Differenz liegt bei etwa 3 Punkten, deshalb ist das kein
harter Befund, aber eine Richtung. Die Punktdifferenz hat bei +3 die bessere
Mitte; zählen tut aber, wer gewinnt. Eingebaut bleibt +3, wie es der Auftrag
verlangt. Für eine Umstellung auf +2 genügt eine Zahl in
`AUSGLEICH_JE_SPIELART` (src/regeln.ts) und die Abdrücke in
`test/ausgleich.test.ts`.

## Was die Regel kostet

- Nebel hat keinen Eintrag: Dafür gibt es keine Messung.
- Der Bildschirm erklärt keine der beiden Regeln. Sitz 1 sieht seinen
  größeren Mauervorrat (`barrierenUebrig`), aber nicht, warum; bei 28 : 28
  in Klar steht bei Sitz 0 „Verloren“.

## Weg B (Entscheidung Niklas, 06.11.2026)

Die Abschnitte oben beschreiben den ersten Stand des Zweigs (Klar
„Gleichstand für Sitz 1“, Extreme +3). Nach der Nachmessung hat Niklas
Weg B gewählt:

- **Klar:** statt des Gleichstands **+2 Punkte für Sitz 1** in der Wertung
  (`punkteZuschlagSitz1`, Grenzen 0..5). Ein Gleichstand nach dem Zuschlag
  bleibt ein Remis. `gleichstandFuerSitz1` ist entfernt — es war nie auf
  `staging`, also trägt es kein offener Tisch.
- **Extreme:** **+2 Mauern** statt +3.
- **Build:** bleibt bei +1 Mauer, nicht neu gemessen (die Regel dort hat
  sich nicht geändert; Zahlen aus „Ergebnis“ oben).

Gemessen mit dem Läufer `werkzeug/ausgleich-messung.mjs`, der jetzt im Repo
liegt, auf dem gebauten Stand dieses Zweigs (Commit f1fdc02f), dieselben
Saaten 1000..1999, n = 1000, derselbe Bot wie auf `staging`:

    npm run build      (im Wurzelverzeichnis)
    node packages/game-filler/werkzeug/ausgleich-messung.mjs --variante klar --punkte 0
    node packages/game-filler/werkzeug/ausgleich-messung.mjs --variante klar
    node packages/game-filler/werkzeug/ausgleich-messung.mjs --variante extreme

(`--n 1000 --start 1000` sind die Vorgaben; ohne `--punkte`/`--mauern` gilt
der Ausgleich aus der Vorgabe, also Klar +2 Punkte, Extreme +2 Mauern.)

**Klar** hat keine Mauern, und der Bot liest keine Punkte — die Partien
sind mit und ohne Zuschlag dieselben (geprüft in `test/ausgleich.test.ts`,
„der Bot spielt in Klar mit und ohne Zuschlag dieselbe Partie“). Der Läufer
rechnet die Punktzuschläge deshalb aus `punkte[0] − punkte[1]` und prüft
dabei, dass die Wertung des Moduls für den eingebauten Zuschlag genau
dieselbe Zeile ergibt. Mit `--punkte 0` reproduziert er 57,6 / 29,4 / 13,0
aus `simulation.mjs` auf die Partie genau.

**Extreme +2** ist eine echte Bot-Partie je Saat (571 s auf 14 Fäden). Sie
reproduziert den Zusatz „Extreme +2“ oben exakt.

| Spielart | | Sitz 0 | Sitz 1 | remis | Punkte S0 : S1 |
|---|---|---|---|---|---|
| Klar    | vorher (staging)          | 57,6 ± 1,6 | 29,4 ± 1,4 | 13,0 ± 1,1 | 29,2 : 26,8 (Brett) |
| Klar    | erster Stand: Gleichstand | 57,6 ± 1,6 | 42,4 ± 1,6 |  0,0       | |
| Klar    | **Weg B: +2 Punkte**      | 44,1 ± 1,6 | 42,4 ± 1,6 | 13,5 ± 1,1 | 29,2 : 28,8 (Wertung) |
| Build   | vorher (staging)          | 51,9 ± 1,6 | 44,3 ± 1,6 |  3,8 ± 0,6 | |
| Build   | **+1 Mauer** (unverändert) | 47,2 ± 1,6 | 48,4 ± 1,6 |  4,4 ± 0,6 | 28,2 : 27,8 |
| Extreme | vorher (staging)          | 59,4 ± 1,6 | 39,5 ± 1,5 |  1,1 ± 0,3 | 75,9 : 64,1 |
| Extreme | erster Stand: +3 Mauern   | 46,7 ± 1,6 | 52,6 ± 1,6 |  0,7 ± 0,3 | 69,8 : 70,2 |
| Extreme | **Weg B: +2 Mauern**      | 51,2 ± 1,6 | 47,9 ± 1,6 |  0,9 ± 0,3 | 72,1 : 67,9 |

Standardfehler des Abstands Sitz 0 − Sitz 1 (gepaart, aus denselben
Partien): √((p₀ + p₁ − (p₀ − p₁)²)/n), bei diesen Werten rund 3 Punkte.

- **Klar +2:** Abstand 1,7 Punkte (vorher 28,2) — innerhalb eines
  Standardfehlers. Die Remis bleiben bei 13,5 %: Auf 56 Feldern ist die
  Brettdifferenz fast immer gerade, und ein gerader Zuschlag lässt sie
  gerade. Ein ungerader (+1, +3) würde die Remis abschaffen, kippt aber
  jeweils zu einer Seite (+1: 57,6 : 42,4; +3: 44,1 : 55,9).
- **Extreme +2:** Abstand 3,3 Punkte (vorher 19,9, mit +3 −5,9) — gut ein
  Standardfehler, nicht belastbar von null verschieden. +3 lag mit fast zwei
  Standardfehlern auf der anderen Seite.
- **Build +1:** Abstand −1,2 Punkte, wie oben.

Alle drei Spielarten liegen damit innerhalb von etwa einem Standardfehler
um den Gleichstand. Der Nebel hat weiter keinen Eintrag (keine Messung).

Weiter offen wie oben: Der Bildschirm erklärt den Ausgleich nicht. Die Sicht
nennt den Punktzuschlag jetzt als Zahl (`punkteZuschlagSitz1`), damit der
Client ihn zeigen kann; das ist eine eigene Karte.
