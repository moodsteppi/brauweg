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
allein bei rund 670 s. „Rechenzeit“ in den Tabellen ist die Summe
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

**Build:** Das Einsperren trifft beide Sitze gleich oft (54 : 54, je Sitz
27 %, 95-%-Intervall 21,3–33,5 %).

**Extreme: Sitz 1 wird häufiger eingesperrt (offener Befund).** 80 der 133
Eingesperrten sitzen auf Sitz 1. Je Sitz sind das 40,0 % (95-%-Intervall
33,5–46,9 %) gegen 26,5 % (20,9–33,0 %). Bei fairer Verteilung (je 50 %)
käme eine so schiefe Teilung mit p ≈ 0,024 vor (exakter Binomialtest,
zweiseitig, n = 133). Das ist bei n = 200 Saaten ein deutlicher Hinweis, aber
kein harter Beleg. Teil 3 zeigt dieselbe Richtung (65 : 46, p ≈ 0,087).

Der Siegvorsprung von Sitz 0 in Extreme (121 : 74 Siege ohne Remis,
p ≈ 0,001) ist ein **eigener** Befund. Er besteht auch in den Partien ohne
Einsperren (62,7 % gegen 31,3 %) und erklärt deshalb nicht, warum Sitz 1 öfter
eingesperrt wird. Ob beides dieselbe Ursache hat (Anzug, Startfelder, Sterne)
oder ob Sitz 1 in Extreme schlechter gegen Fallen steht, trennt diese
Messung nicht. In Build ist der Siegvorsprung (107 : 88) nicht signifikant
(p ≈ 0,20).

Eingesperrt zu werden entscheidet die Partie fast immer: 0 von 108 bzw. 2
von 133 Eingesperrten gewinnen.

*Rechenweg:* exakter Binomialtest gegen 0,5 auf der Zahl der Eingesperrten
(bzw. der Siege ohne Remis): p = 2 · Σ_{i ≥ max(k, n−k)} C(n, i) / 2ⁿ.
Intervalle nach Wilson mit z = 1,96: (p̂ + z²/2n ± z·√(p̂(1−p̂)/n + z²/4n²))
/ (1 + z²/n). Der Vergleich Vorsicht gegen Bot-Duell (Abschnitt 2) ist ein
z-Test für zwei Anteile mit gepoolter Varianz. Die Saaten sind nicht unabhängig von den Sitzen
gewählt (dieselbe Saat stellt beiden Sitzen dasselbe Brett), der Test prüft
also nur, ob die Teilung je Brett gleich ausfällt.

## 2. Vorsichtig gegen Bot (jede Saat auf beiden Sitzen)

Der Vorsichtige spielt den Zug des Bots (Mauern, dann Farbe), es sei denn, der
Gegner könnte ihn danach mit höchstens einer Mauer und einem Farbzug
einsperren. Dann nimmt er der Reihe nach: dieselben Mauern mit einer anderen
Farbe (die beste zuerst), danach ohne Mauer jede Farbe (die beste zuerst).
Gibt es keinen sicheren Zug, spielt er doch den des Bots (**ausweglos**).

Jede Falle, die einen Vorsichtigen trifft, ordnet das Skript zeitlich ein
(`falleNach` in einsperren.mjs). Maßgeblich ist seine LETZTE Entscheidung vor
der Trennung:

- **direkt**: Sie war ausweglos, und die Falle schnappte in seinem eigenen Zug
  oder im Zug des Gegners gleich danach zu. Seine Prüfung hatte diese Falle
  also vorhergesagt, und der Gegner hat sie auch gestellt.
- **ohne Warnung**: Er hielt den Zug für sicher, und die Falle kam trotzdem
  gleich danach. Das ist eine Falle, die die Ein-Mauer-Prüfung nicht sieht.
- **später**: Die Trennung kam nicht im nächsten Zug.

„Warnzüge davor“ zählt seine Entscheidungen unmittelbar vor der Falle, in
denen die Prüfung schon gewarnt hatte (ausgewichen oder ausweglos, die
letzte mitgezählt).

| Spielart | Partien | V eingesperrt | davon direkt nach ausweglosem Zug / ohne Warnung / spaeter | Warnzuege davor (Mittel) | Bot eingesperrt | V Sieg als S0 | V Sieg als S1 | V Sieg gesamt / remis | Punkte V / Bot | Punkte V als S0 / S1 (Bot dort in Teil 1) | V weicht ab je Partie | ausweglos je Partie | Rechenzeit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| build | 400 | 93/400 (23.3 %) | 93 / 0 / 0 | 1.85 | 117/400 (29.3 %) | 56.0 % | 46.0 % | 51.0 % / 2.5 % | 28.5 / 27.5 | 29.5 / 27.6 | 0.34 | 0.24 | 668 s |
| extreme | 400 | 103/400 (25.8 %) | 102 / 1 / 0 | 2.00 | 155/400 (38.8 %) | 65.0 % | 43.0 % | 54.0 % / 2.5 % | 74.2 / 65.8 | 81.4 / 67.1 | 0.52 | 0.28 | 9353 s |

„Punkte V als S0 / S1“ sind zu vergleichen mit dem Bot auf demselben Sitz in
Teil 1: Build 28,9 / 27,1, Extreme 77,4 / 62,6. Die Rechenzeit von Extreme
schwankt mit der Last auf dem Rechner (im ersten Gesamtlauf 6453 s, in
den beiden Läufen mit Teil 2 allein bzw. Teil 2 und 3 9387 s bzw. 9353 s).
Die Ergebnisse sind Zug für Zug gleich, weil nichts zufällig ist.

**Was Vorsicht kostet: nichts.** Der Vorsichtige holt auf beiden Sitzen
mehr Punkte als der Bot auf demselben Sitz (Build +0,6 / +0,5, Extreme
+4,0 / +4,5) und gewinnt das Duell knapp (51 % / 54 %).

**Was sie bringt: wenig.** Er wird in 23,3 % (Build, 95-%-Intervall
19,4–27,6 %) bzw. 25,8 % (Extreme, 21,7–30,3 %) seiner Partien eingesperrt.
Bot gegen Bot sind es je Sitz-Partie 27,0 % (108 von 400; 22,9–31,6 %) bzw.
33,3 % (133 von 400; 28,8–38,0 %). Der Abstand ist in Build nicht
signifikant (z ≈ 1,2), in Extreme knapp (z ≈ 2,3). Beide z-Werte sind grob:
Es sind dieselben Saaten, die Stichproben also nicht unabhängig.

**Die Spalte „direkt nach ausweglosem Zug“ ist kein Beleg für
Unvermeidbarkeit.** Sie ist nahezu tautologisch: Eine Falle zählt dort, wenn
die Ein-Zug-Prüfung sie einen Zug vorher gesehen und keinen sicheren Zug
gefunden hat. Dass das fast immer zutrifft (93 von 93, 102 von 103), zeigt nur,
dass die Prüfung Fallen dieser Tiefe vollständig erkennt. Das Einzige, was
die Spalte darüber hinaus zeigt: Nur eine Falle (Extreme) kam ohne Warnung,
die Ein-Mauer-Annahme verfehlt also fast nichts. Ob die Falle zwei oder drei
Züge früher noch offen war und mit einer Abwehrmauer oder tieferem
Vorausdenken zu verhindern gewesen wäre, prüft das Skript nicht (siehe
Grenzen).

## 3. Vorsichtig gegen vorsichtig

| Spielart | Partien | eingesperrt | davon Sitz 0 / Sitz 1 | davon direkt nach ausweglosem Zug / ohne Warnung / spaeter | Warnzuege davor (Mittel) | Sieg S0 / S1 / remis | Punkte S0 / S1 | weicht ab je Partie | ausweglos je Partie | Rechenzeit |
|---|---|---|---|---|---|---|---|---|---|---|
| build | 200 | 48.5 % | 45 / 52 | 97 / 0 / 0 | 1.84 | 53.0 % / 44.0 % / 3.0 % | 28.6 / 26.6 | 0.77 | 0.51 | 462 s |
| extreme | 200 | 55.5 % | 46 / 65 | 110 / 1 / 0 | 1.98 | 60.0 % / 36.5 % / 3.5 % | 73.8 / 60.2 | 1.31 | 0.60 | 6207 s |

## Urteil

**Ein-Zug-Vorsicht (eine gegnerische Mauer plus ein Farbzug voraus, keine
Abwehrmauer) senkt die Einsperrquote nur von 27 % auf 23 % (Build) bzw. von
33 % auf 26 % (Extreme); ob weitere Vorsicht das Einsperren vermeidbar macht,
ist nicht gemessen. In Extreme wird Sitz 1 häufiger eingesperrt als Sitz 0
(80 : 53, p ≈ 0,024), die Ursache ist offen.**

Zur Einordnung: In Build trifft das Einsperren beide Sitze gleich oft. Den
Siegvorsprung von Sitz 0 (Extreme 60,5 % gegen 37 %) gibt es auch in den
Partien ohne Einsperren. Er ist also nicht allein durch die Falle zu
erklären, die Trefferungleichheit aber auch nicht allein durch ihn (siehe
Abschnitt 1). Beides gehört zur Anzug-Frage, an der `werkzeug/anzug.mjs`
arbeitet. Die naheliegende nächste Messung für die Vermeidbarkeit wäre ein
Vorsichtiger mit Abwehrmauer und zwei Zügen Vorausschau.

## Grenzen der Messung

- Der Vorsichtige schaut **einen** gegnerischen Zug voraus und rechnet mit
  **einer** gegnerischen Mauer. Extreme erlaubt zwei je Zug. Mit beiden wären
  es je Prüfung rund 150 × 150 × 6 Stellungen, und der Lauf dauerte Tage. Im
  Lauf blieb genau eine Extreme-Falle ohne Warnung. Diese Lücke ist hier also
  klein. Die Prüfung schaut aber nur **einen** Zug voraus: Fallen, die sich
  zwei Züge vorher noch hätten verhindern lassen, erkennt sie erst, wenn es zu
  spät ist.
- Er weicht nur auf andere Farben und auf den Verzicht auf Mauern aus. Eine
  eigene **Abwehrmauer** probiert er nicht. Ein Spieler, der weiter vorausdenkt
  oder selbst gegenmauert, könnte mehr vermeiden. Ob er die Falle **dauerhaft**
  vermeiden kann, sagt diese Messung nicht.
- Er entscheidet auf dem wahren Zustand. In Build und Extreme liegt das Brett
  offen, er sieht also nicht mehr als ein aufmerksamer Mensch.
