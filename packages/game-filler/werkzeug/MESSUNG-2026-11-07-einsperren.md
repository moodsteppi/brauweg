# Messung 07.11.2026 — Ist das Einsperren unfair?

Frage Niklas (06.11.2026): Der Bot mit Wegterm (Zweig
`aufgabe/farbduell-regelfix-extreme-faire-startec-0b7b4573`, Stand
`311eceaf`) sperrt den Gegner in 66,5 % (Extreme) bzw. 54 % (Build) der
Partien ein (MESSUNG-2026-11-06-bot-mauert.md). Ist das ein Sitzvorteil —
oder nur "aufpassen, nicht in die Pfanne laufen"?

Gemessen auf diesem Zweig (Stand 311eceaf hineingeführt, `src/` unverändert) mit

    npm run build --workspace @brauweg/game-api
    npm run build --workspace @brauweg/game-filler
    node packages/game-filler/werkzeug/einsperren.mjs --build 200 --extreme 200 --faeden 15

Saaten 0–199 (`saatHex`, wie simulation.mjs und bot-duell.mjs). Die Wanduhr
lag bei 1148 s für alle drei Teile auf 15 Fäden (16 Kerne, Windows), Teil 2
allein bei rund __T2__ s. „Rechenzeit“ in den Tabellen ist die Summe
über alle Fäden.

**Eingesperrt** heißt wie in simulation.mjs: Beim ersten Mal, wenn kein freies Feld
mehr für beide erreichbar ist, liegen mindestens zehn freie Felder auf dem Brett,
und einer erreicht davon höchstens ein Viertel. Teil 1 trifft die Zahlen der
Messung vom 06.11. genau (54,0 / 66,5 %, 108 bzw. 133 Eingesperrte, Sieg
Sitz 0 53,5 / 60,5 %). Das Skript zählt also dasselbe.

## 1. Bot gegen Bot: wer wird eingesperrt

| Spielart | Partien | eingesperrt | davon Sitz 0 / Sitz 1 | Sieg S0 / S1 / remis (alle) | mit Einsperren: Sieg S0 / S1 | ohne Einsperren: Sieg S0 / S1 / remis | Punkte S0 / S1 | Rechenzeit |
|---|---|---|---|---|---|---|---|---|
| build | 200 | 54.0 % | 54 / 54 | 53.5 % / 44.0 % / 2.5 % | 50.0 % / 50.0 % | 57.6 % / 37.0 % / 5.4 % | 28.9 / 27.1 | 207 s |
|  | davon gewinnt der Eingesperrte | 0 von 108 |  |  |  |  |  |  |
| extreme | 200 | 66.5 % | 53 / 80 | 60.5 % / 37.0 % / 2.5 % | 59.4 % / 39.8 % | 62.7 % / 31.3 % / 6.0 % | 77.4 / 62.6 | 3178 s |
|  | davon gewinnt der Eingesperrte | 2 von 133 |  |  |  |  |  |  |

Das Einsperren selbst verschiebt nichts zwischen den Sitzen. In Build trifft es
beide Sitze gleich oft (54 : 54). In Extreme trifft es Sitz 1 öfter (80 : 53),
aber Sitz 0 gewinnt OHNE Einsperren sogar häufiger (62,7 %) als mit (59,4 %).
Der Vorsprung von Sitz 0 ist also der Anzug, nicht die Falle: Er steckt in
beiden Hälften. Eingesperrt zu werden entscheidet die Partie dagegen fast
immer: 0 von 108 bzw. 2 von 133 Eingesperrten gewinnen.

## 2. Vorsichtig gegen Bot (jede Saat auf beiden Sitzen)

Der Vorsichtige spielt den Zug des Bots (Mauern, dann Farbe), es sei denn, der
Gegner könnte ihn danach mit höchstens einer Mauer und einem Farbzug
einsperren. Dann nimmt er der Reihe nach: dieselben Mauern mit einer anderen
Farbe (die beste zuerst), danach ohne Mauer jede Farbe (die beste zuerst).
Gibt es keinen sicheren Zug, spielt er doch den des Bots (**ausweglos**).

__TEIL2__

Zum Vergleich: Bot gegen Bot wird ein Sitz in Build in 27 % der Partien
eingesperrt (108 von 400 Sitz-Partien), in Extreme in 33 % (133 von 400).

## 3. Vorsichtig gegen vorsichtig

| Spielart | Partien | eingesperrt | davon Sitz 0 / Sitz 1 | Sieg S0 / S1 / remis | Punkte S0 / S1 | weicht ab je Partie | ausweglos je Partie | Rechenzeit |
|---|---|---|---|---|---|---|---|---|
| build | 200 | 48.5 % | 45 / 52 | 53.0 % / 44.0 % / 3.0 % | 28.6 / 26.6 | 0.77 | 0.51 | 462 s |
| extreme | 200 | 55.5 % | 46 / 65 | 60.0 % / 36.5 % / 3.5 % | 73.8 / 60.2 | 1.31 | 0.60 | 6236 s |

## Urteil

__URTEIL__

## Grenzen der Messung

- Der Vorsichtige schaut **einen** gegnerischen Zug voraus und rechnet mit
  **einer** gegnerischen Mauer. Extreme erlaubt zwei je Zug. Mit beiden wären
  es je Prüfung rund 150 × 150 × 6 Stellungen, und der Lauf dauerte Tage. Was
  er in Extreme trotzdem abbekommt, ist deshalb eine obere Schranke dessen, was
  Aufpassen nicht verhindert.
- Er weicht nur auf andere Farben und auf den Verzicht auf Mauern aus. Eine
  eigene **Abwehrmauer** probiert er nicht. Ein Mensch, der weiter vorausdenkt
  oder selbst gegenmauert, kann mehr vermeiden. Ob er die Falle **dauerhaft**
  vermeiden kann, sagt diese Messung nicht.
- Er entscheidet auf dem wahren Zustand. In Build und Extreme liegt das Brett
  offen, er sieht also nicht mehr als ein aufmerksamer Mensch.
