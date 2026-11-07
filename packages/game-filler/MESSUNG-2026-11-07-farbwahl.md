# Messung 07.11.2026 — Farbwahl ohne Selbsteinsperren, Mauerprüfung zwei Züge

**Bot-Änderung wegen verfehltem Ziel zurückgenommen (Revert), Code im Verlauf: 941e5d08.**

Umbau auf diesem Zweig: `941e5d08` (bot.ts: Farbwahl in Stufen — selbst
eingesperrt / Gegner sperrt in 1 bzw. 2 Farbzügen ein / sicher, gierig nur
innerhalb der besten Stufe; Mauern über der Schwelle werden gemieden, wenn sie
eine Falle öffnen, die ohne sie zu wäre: meine Farbe, seine Antwort, mein
Folgezug) und `9f2c8402` (Fingerabdrücke). Gemessen wurde nur — `src/` und
`test/` sind in diesem Lauf unverändert.

**Vorher** ist `origin/staging` `8fad9ead` (Filler dort gleich dem
Ausgangsstand `081cda1e` dieses Zweigs, also mit dem Ausgleich aus der
Vorgängerkarte), in einem eigenen Worktree gebaut; dessen `dist/src` geht
als `--dist` bzw. `--alt` in dieselben Skripte dieses Zweigs.

    npm run build -w @brauweg/game-api && npm run build -w @brauweg/game-filler
    node packages/game-filler/werkzeug/einsperren.mjs --teil 1 --start 1000 --klar 200 --build 200 --extreme 200 --faeden 4 [--dist <alt>/dist/src]
    node packages/game-filler/werkzeug/bot-duell.mjs --alt <alt>/dist/src --start 1000 --klar 200 --build 200 --extreme 200

Saaten 1000–1199 (neu, an keiner davon wurde eingestellt). Linux, 8 Kerne.
Nur Teil 1 von einsperren.mjs (Bot gegen sich selbst) — Teil 2/3 messen den
„Vorsichtigen" des Skripts, nicht den Bot.

## 1. Eingesperrt (Bot gegen sich selbst)

| Spielart | eingesperrt vorher | eingesperrt nachher | Differenz (SE der Differenz) | Sieg S0 / S1 / remis vorher | nachher | ms je Botzug (Mittel / max) vorher | nachher |
|---|---|---|---|---|---|---|---|
| Klar | 0,0 % (0/200) | 0,0 % (0/200) | 0 | 41,5 / 46,5 / 12,0 % | 41,5 / 46,5 / 12,0 % | 0,1 / 3 | 2,3 / 10 |
| Build | 54,0 ± 3,5 % (108) | 47,0 ± 3,5 % (94) | −7,0 Pkt. (±4,9 → 1,4 SE) | 48,5 / 47,5 / 4,0 % | 51,0 / 44,5 / 4,5 % | 2,4 / 34 | 3,3 / 16 |
| Extreme | 66,5 ± 3,3 % (133) | 49,0 ± 3,5 % (98) | −17,5 Pkt. (±4,8 → 3,6 SE) | 52,0 / 46,5 / 1,5 % | 55,0 / 43,0 / 2,0 % | 18,8 / 123 | 33,8 / 152 |

SE = sqrt(p(1−p)/n); SE der Differenz = Wurzel der Quadratsumme beider
(ungepaart gerechnet, obwohl dieselben Saaten — das Skript gibt keine
Einzelpartien aus; gepaart wäre der Fehler eher kleiner).

- **Extreme:** Ziel erreicht — deutlich mehr als zwei Standardfehler.
- **Build:** Ziel NICHT erreicht — 7 Punkte weniger sind genau zwei
  Einzel-Standardfehler, aber nur 1,4 Standardfehler der Differenz.
- **Klar:** in jeder Spalte gleich. Auf diesen 200 Saaten wird in Klar
  niemand eingesperrt (Schwelle aus simulation.mjs), und die Farbwahl in
  Stufen fällt nie anders aus als die gierige. Der Bot rechnet dafür ~20×
  länger (2,3 statt 0,1 ms, unkritisch).
- Laufzeit: Extreme im Mittel 1,8× (18,8 → 33,8 ms), Spitze 123 → 152 ms.
  Gemessen bei 8 Fäden auf 8 Kernen (zwei Läufe parallel), also eher zu hoch.
- Mauern je Partie praktisch gleich (Build 19,57 → 19,55, Extreme
  44,33 → 45,22).

Rohausgabe nachher:

| Spielart | Partien | eingesperrt | davon Sitz 0 / Sitz 1 | Sieg S0 / S1 / remis (alle) | mit Einsperren: Sieg S0 / S1 | ohne Einsperren: Sieg S0 / S1 / remis | Punkte S0 / S1 | Mauern je Partie | ms je Botzug (Mittel / max) | Rechenzeit |
|---|---|---|---|---|---|---|---|---|---|---|
| klar | 200 | 0.0 ± 0.0 % | 0 / 0 | 41.5 % / 46.5 % / 12.0 % | – / – | 41.5 % / 46.5 % / 12.0 % | 29.1 / 26.9 | 0.00 | 2.3 / 10 | 12 s |
|  | davon gewinnt der Eingesperrte | 0 von 0 |  |  |  |  |  |  |  |  |
| build | 200 | 47.0 ± 3.5 % | 42 / 52 | 51.0 % / 44.5 % / 4.5 % | 55.3 % / 44.7 % | 47.2 % / 44.3 % / 8.5 % | 28.8 / 27.2 | 19.55 | 3.3 / 16 | 81 s |
|  | davon gewinnt der Eingesperrte | 0 von 94 |  |  |  |  |  |  |  |  |
| extreme | 200 | 49.0 ± 3.5 % | 48 / 50 | 55.0 % / 43.0 % / 2.0 % | 50.0 % / 50.0 % | 59.8 % / 36.3 % / 3.9 % | 74.4 / 65.6 | 45.22 | 33.8 / 152 | 1873 s |
|  | davon gewinnt der Eingesperrte | 3 von 98 |  |  |  |  |  |  |  |  |

Rohausgabe vorher:

| Spielart | Partien | eingesperrt | davon Sitz 0 / Sitz 1 | Sieg S0 / S1 / remis (alle) | mit Einsperren: Sieg S0 / S1 | ohne Einsperren: Sieg S0 / S1 / remis | Punkte S0 / S1 | Mauern je Partie | ms je Botzug (Mittel / max) | Rechenzeit |
|---|---|---|---|---|---|---|---|---|---|---|
| klar | 200 | 0.0 ± 0.0 % | 0 / 0 | 41.5 % / 46.5 % / 12.0 % | – / – | 41.5 % / 46.5 % / 12.0 % | 29.1 / 26.9 | 0.00 | 0.1 / 3 | 1 s |
|  | davon gewinnt der Eingesperrte | 0 von 0 |  |  |  |  |  |  |  |  |
| build | 200 | 54.0 ± 3.5 % | 55 / 53 | 48.5 % / 47.5 % / 4.0 % | 49.1 % / 50.9 % | 47.8 % / 43.5 % / 8.7 % | 27.9 / 28.1 | 19.57 | 2.4 / 34 | 96 s |
|  | davon gewinnt der Eingesperrte | 0 von 108 |  |  |  |  |  |  |  |  |
| extreme | 200 | 66.5 ± 3.3 % | 67 / 66 | 52.0 % / 46.5 % / 1.5 % | 48.9 % / 51.1 % | 58.2 % / 37.3 % / 4.5 % | 71.7 / 68.3 | 44.33 | 18.8 / 123 | 1521 s |
|  | davon gewinnt der Eingesperrte | 5 von 133 |  |  |  |  |  |  |  |  |

## 2. Neu gegen alt

Jede Saat zweimal (neu auf Sitz 0, dann auf Sitz 1), also 400 Partien je
Spielart; p = exakter zweiseitiger Vorzeichentest, Remis fallen heraus.
Wanduhr rund 7 min auf 8 Fäden.

| Spielart | Partien | Siege neu | Siege alt | remis | p (Vorzeichentest) | Punkte neu/alt | Mauern je Partie neu/alt |
|---|---|---|---|---|---|---|---|
| klar | 400 | 44.0 % | 44.0 % | 12.0 % | 1.000 | 28.0 / 28.0 | 0.00 / 0.00 |
| build | 400 | 44.5 % | 51.3 % | 4.3 % | 0.184 | 26.7 / 29.3 | 9.84 / 9.71 |
| extreme | 400 | 43.3 % | 55.0 % | 1.8 % | 0.020 | 64.5 / 75.5 | 22.65 / 22.07 |

- **Extreme:** Der neue Bot ist **signifikant schwächer** (43,3 : 55,0 %,
  p = 0,020; 64,5 : 75,5 Punkte). Derselbe Befund wie beim verworfenen
  Versuch d435ee73 (42 : 55,5 %, p = 0,006), nur etwas schwächer.
- **Build:** neu 44,5 : 51,3 %, p = 0,18 — nicht signifikant, aber dieselbe
  Richtung (26,7 : 29,3 Punkte).
- **Klar:** jede Partie gleich (siehe Abschnitt 1: Die Farbwahl in Stufen
  greift in Klar auf diesen Saaten nie).

## Ergebnis: Ziel nicht erreicht

| Spielart | eingesperrt vorher → nachher | Abstand | neu : alt | p |
|---|---|---|---|---|
| Klar | 0,0 → 0,0 % | – | 44,0 : 44,0 % | 1,000 |
| Build | 54,0 ± 3,5 → 47,0 ± 3,5 % | 1,4 SE | 44,5 : 51,3 % | 0,184 |
| Extreme | 66,5 ± 3,3 → 49,0 ± 3,5 % | 3,6 SE | 43,3 : 55,0 % | 0,020 |

Beide Bedingungen zugleich erfüllt keine Spielart mit Mauern: In Extreme
sinkt das Einsperren deutlich, aber der Bot verliert signifikant gegen den
heutigen; in Build ist er nicht signifikant schwächer, sinkt aber auch nicht
deutlich genug. Nach Auftrag nicht weitergebastelt.

Lesart (nicht gemessen, nur Vermutung): Der Bot zahlt die Vorsicht mit
Fläche — er meidet Farben und Mauern, die eine Falle öffnen, auch wenn der
heutige Bot diese Falle als Gegner gar nicht zuschnappen ließe. Gegen sich
selbst sinkt das Einsperren, gegen den gierigen alten verliert er Punkte
(−11 in Extreme).

## Fingerabdrücke (9f2c8402)

Schicht „Ohne Mauern" (abdruck-schichten.mjs) blieb **unverändert** — auf den
vier Prüfbrettern entsteht ohne Mauern keine Falle, die Farbwahl in Stufen
wählt also dieselben Farben (passt zu Klar oben). Neu sind:

- echter Bot in Build und Extreme (ausgleich.test.ts, eroeffnung-aufgeben.test.ts
  Schicht 3, extreme-gross.test.ts Build): Der Bot wählt andere Farben und
  lässt Mauern weg, die eine Falle öffnen — also eine andere Partie.
- vier Baumeister-Werte (Build/2, Extreme/1, Extreme/42, gross-ende Build/2):
  Der Baumeister mauert nach festem Plan, färbt aber mit der Farbwahl des Bots.

Regeln, Ausgleich und Klar sind unverändert. Die Testkommentare verweisen auf
`MESSUNG-2026-11-07-bot-fallen.md`; diese Datei hier ist gemeint (der Name
kam mit dem zweiten Anlauf, Tests waren für diesen Lauf gesperrt).
