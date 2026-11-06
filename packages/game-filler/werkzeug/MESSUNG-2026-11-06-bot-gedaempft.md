# Messung 06.11.2026 — Bot gedämpft: keine Mauer, nach der ein Farbzug einsperrt

Auftrag (Issueboard): Der Bot verengt den Weg mit Mauern und schließt ihn
dann mit einem Farbzug. Eingesperrt wird in 54 % (Build) bzw. 66,5 % (Extreme)
der Bot-Partien (MESSUNG-2026-11-06-bot-mauert.md,
MESSUNG-2026-11-07-einsperren.md). Er soll jede Mauer meiden, nach der ein
einziger Farbzug — seiner oder der des Gegners im nächsten Zug — den Gegner
einsperren kann.

**Die Änderung** (`bot.ts`, „Die Daempfung“ in `waendeAuf`): Die Wände werden
wie bisher bewertet und dann vom höchsten Wert abwärts geprüft. Eine Wand über
der Schwelle fällt durch, wenn danach

- einer der erlaubten Farbzüge des Bots den Gegner einsperrt, oder
- nach der Farbe, die der Bot nach der Wand **wirklich** zieht (`besteFarbe`,
  dieselbe Wahl wie in `botZug`), einer der erlaubten Farbzüge des Gegners
  ihn selbst einsperrt.

Dann wird die nächste Wand geprüft. **Eingesperrt** ist dieselbe Schwelle wie
beim Vorsichtigen in `einsperren.mjs`: Kein freies Feld ist mehr für beide
erreichbar, mindestens zehn freie Felder liegen auf dem Brett, und der Gegner
erreicht davon höchstens ein Viertel. Sie steht jetzt als `istEingesperrt`
in `bot.ts`, und `einsperren.mjs` liest sie von dort. Regeln (`regeln.ts`,
`partie.ts`) sind unverändert.

Die erste Fassung prüfte den Gegnerzug auf dem Brett **vor** dem Farbzug des
Bots. Damit gingen genau die Fallen durch, die das Opfer gleich nach Wand und
Farbe selbst zuzieht: 12 von 105 in Build, die Gesamtrate fiel nur auf
52,5 / 62,5 %. Die Zahlen unten gelten für die zweite Fassung.

## Kurz: offene Entscheidung vor der Freigabe

Das Ziel des Auftrags wird **kaum erreicht**, und in Extreme wird der Bot
**schwächer**:

| | Build | Extreme |
|---|---|---|
| eingesperrt vorher → nachher | 54,0 → 52,5 % (SE ≈ 3,5) | 66,5 → 62,0 % (SE ≈ 3,4) |
| gedämpft gegen alt (400 Partien) | 46,3 : 51,3 % — z ≈ −1,0, Rauschen | 42,0 : 55,5 % — z ≈ −2,7, p ≈ 0,006 |

Beide Rückgänge liegen innerhalb eines Standardfehlers. Gesichert ist nur:
Unmittelbar nach einer Mauer schnappt keine Falle mehr zu (12 → 0 von 105
in Build). Die Fallen verlagern sich nach hinten, und in rund der Hälfte
läuft das Opfer mit dem eigenen Farbzug hinein (Befund unten).

Ob dieser Stand trotzdem nach `staging` soll, ist **nicht** durch die
Messung entschieden, sondern gehört zur Freigabe. Die Wege:

- **Übernehmen.** Die gemeinsame Schwelle `istEingesperrt`, der Prüftest und
  die Werkzeugspalte kommen mit; Preis ist der schwächere Bot in Extreme.
- **Nicht übernehmen, Zweig als Messung behalten.** Der Bot bleibt, wie er
  ist; als nächster Schritt eine Farbwahl, die sich nicht selbst einsperrt
  (eigene Karte), und erst mit ihr zusammen erneut messen.
- **Nur für Build.** Dort kostet die Dämpfung keine messbare Stärke, bringt
  aber auch keinen messbaren Nutzen — also kaum ein Grund dafür.

## Messaufbau

Saaten 0–199 je Spielart (`saatHex`, wie simulation.mjs). „Vorher“ ist der
Stand 2757014f (staging nach #375), als Kopie von `dist/src` außerhalb des
Repos; „nachher“ ist dieser Zweig (9f9f010b). Gemessen auf 15 Fäden
(16 Kerne, Windows):

    node packages/game-filler/werkzeug/einsperren.mjs --build 200 --extreme 200 --teil 1
    node packages/game-filler/werkzeug/bot-duell.mjs --alt <kopie-von-2757014f/dist/src> --build 200 --extreme 200

Für „vorher“ lief `einsperren.mjs` dieses Zweigs auf der alten Kopie, mit der
Schwelle als Zahl statt aus `bot.js` (dort gibt es `istEingesperrt` noch
nicht). Teil 1 trifft die Zahlen vom 07.11. genau (54,0 / 66,5 %, 54 : 54 bzw.
53 : 80). Das Skript zählt also dasselbe wie vorher.

Standardfehler: Anteile √(p(1−p)/n) mit n = 200 Partien; Mauern je Partie
aus der Stichprobenvarianz. Vorher und nachher laufen auf denselben Saaten
und sind deshalb nicht unabhängig — der echte Fehler des Unterschieds ist
kleiner als die beiden Fehler zusammen.

## 1. Bot gegen Bot

| Spielart | | eingesperrt (± SE) | Sitz 0 : Sitz 1 | Sieg S0 / S1 / remis (S0 ± 3,5) | Mauern je Partie, beide Sitze (± SE) | Eingesperrter gewinnt |
|---|---|---|---|---|---|---|
| build | vorher | 54,0 % ± 3,5 | 54 : 54 | 53,5 / 44,0 / 2,5 % | 18,92 ± 0,10 | 0 von 108 |
| build | nachher | 52,5 % ± 3,5 | 50 : 55 | 54,5 / 43,0 / 2,5 % | 18,79 ± 0,10 | 0 von 105 |
| extreme | vorher | 66,5 % ± 3,3 | 53 : 80 | 60,5 / 37,0 / 2,5 % | 42,63 ± 0,31 | 2 von 133 |
| extreme | nachher | 62,0 % ± 3,4 | 50 : 74 | 60,0 / 37,5 / 2,5 % | 43,40 ± 0,29 | 2 von 124 |

## 2. Gedämpfter Bot gegen alten Bot (bot-duell.mjs)

Jede Saat zweimal, neu auf Sitz 0 und auf Sitz 1 — 400 Partien je Spielart.
50 % hieße gleich stark.

| Spielart | Siege neu | Siege alt | remis | Punkte neu / alt | Mauern je Partie und Sitz neu / alt |
|---|---|---|---|---|---|
| build | 46,3 % | 51,3 % | 2,5 % | 27,3 / 28,8 | 9,46 / 9,40 |
| extreme | 42,0 % | 55,5 % | 2,5 % | 64,9 / 75,1 | 21,68 / 21,18 |

Unter den entschiedenen Partien gewinnt der gedämpfte Bot in Build 185 von
390 (47,4 % ± 2,5, z ≈ −1,0: im Rauschen), in Extreme 168 von 390
(43,1 % ± 2,5, z ≈ −2,7, p ≈ 0,006: schwächer). Die Paare teilen eine Saat,
der Fehler ist deshalb eher unter- als überschätzt.

## Befund: Die Dämpfung trifft nur einen kleinen Teil der Fallen

Der Anteil eingesperrter Partien sinkt um 1,5 (Build) bzw. 4,5
Prozentpunkte (Extreme) — weniger als ein bzw. gut ein Standardfehler. Die
Mauern je Partie bleiben gleich. Gemieden wird selten: In 30 Build-Partien
(Zahlensaaten 0–29) baut der Bot 562 Mauern und meidet 8 Wände. Keine gebaute Mauer öffnet eine
Ein-Zug-Falle — das prüft `barrieren.test.ts` auf dem wahren Zustand nach
(Saaten 9, 16, 26).

Wie die Fallen zuschnappen, wurde für Build über alle 200 Saaten
nachgezählt (Hilfsskript außerhalb des Repos, Zählung wie Teil 1;
„Züge“ zählt die Farbzüge beider Sitze):

| Build, Eingesperrte | vorher (1. Fassung) | nachher |
|---|---|---|
| alle | 105 | 105 |
| das Opfer schließt die Falle mit dem **eigenen** Farbzug | 60 | 51 |
| der Gegner schließt sie | 45 | 54 |
| letzte Mauer des Täters im Zug direkt davor | 12 | **0** |
| … 2 bis 3 Züge davor | 26 | 27 |
| … 4 bis 6 Züge davor | 35 | 43 |
| … mehr als 6 Züge davor | 32 | 35 |

Extreme nachher, aus Zeitgründen nur Saaten 0–79 (50 Eingesperrte): Das
Opfer schließt 27-mal selbst, der Gegner 23-mal; die letzte Mauer des Täters
lag nie im Zug direkt davor, 13-mal 2 bis 3, 11-mal 4 bis 6 und 26-mal mehr
als 6 Züge davor.

Die Dämpfung tut, was sie soll: Keine Falle schnappt mehr unmittelbar nach
einer Mauer zu. Aber die Partien verlagern die Falle nur nach hinten. Sie
entsteht über mehrere Züge, und in rund der Hälfte der Fälle läuft das Opfer
mit seinem gierigen Farbzug selbst hinein: Es nimmt die Farbe, die jetzt am
meisten bringt, und trennt sich damit von der großen Fläche ab. Das kann eine
Mauerregel des Bots nicht verhindern. Dafür müsste die **Farbwahl** prüfen,
ob sie den Bot selbst einsperrt (oder die Wandprüfung zwei Züge tief
schauen). Beides gehört nicht zu diesem Auftrag und ist als eigene Karte
vorgeschlagen.

Dass der gedämpfte Bot in Extreme gegen den alten verliert, passt dazu: Er
verzichtet auf Wände, die der alte weiter baut, und bleibt genauso anfällig
dafür, selbst eingesperrt zu werden.

## Fingerabdrücke

`abdruck-schichten.mjs` auf vorher und nachher: Von 36 Zeilen ändern sich
zwei, beide in der Schicht „Echter Bot“:

- `eroeffnung extreme/1`: 9887fd71c933322f → 7d4e1bff70299002. Der Bot meidet
  dort einmal eine Wand (nachgezählt über `gemieden`).
- `gross-ende build/1`: 7a26d141e9121b74 → e8a9e8464c30a8cf. Kam erst mit der
  zweiten Fassung (Gegnerzug nach der wirklichen Farbe) dazu.

Die Schichten „Ohne Mauern“ und „Baumeister“ sind unverändert. Nachgezogen
in `test/eroeffnung-aufgeben.test.ts` (VORHER und eine vierte Spalte in
GESCHICHTE) und `test/extreme-gross.test.ts` (VORHER build/1, Herkunft im
Kommentar).
