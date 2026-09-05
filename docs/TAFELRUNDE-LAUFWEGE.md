# Tafelrunde: warum im Kampf kaum gelaufen wird

**Stand: 06.09.2026.** Anlass ist Robins Beobachtung beim Zusehen: In der
aufgezeichneten Probe (`/probe/kampf`, Runde 10, acht Einheiten auf Stufe 2
und 3) stehen 168 Ereignisse — **155 Treffer, 6 Bewegungen**, 6 Tode, 1 Ende.
Die Einheiten stehen sich gegenüber und schlagen; gelaufen wird praktisch nie.
Für ein Spiel, dessen Figuren seit dem 06.09.2026 vorgerenderte Laufzyklen
haben, ist das schade.

> **HIER IST NICHTS EINGEBAUT.** Diese Datei ist die Messung und die
> Empfehlung — Brettgröße, Reihenzahl, Reichweiten und Startabstand sind
> Spielentscheidungen und werden nach dieser Tabelle getroffen, nicht in ihr.
> Startleben (12), Zeitraffer (2), Schwellen und Boni sind unangetastet.

Nachrechnen:

```bash
npm run build --workspace @brauweg/game-tafelrunde
node packages/game-tafelrunde/werkzeug/laufwege.mjs --partien 2000

# eine Variante, ohne das Spiel zu ändern (siehe Abschnitt 4):
node packages/game-tafelrunde/werkzeug/laufwege-variante.mjs abstand2 --luecke 2
node packages/game-tafelrunde/werkzeug/laufwege.mjs \
     --dist packages/game-tafelrunde/tmp-varianten/abstand2 --partien 2000
```

Alle Zahlen stammen aus **2.000 Partien je Zeile, zu viert, Besetzung
`normal`, Saatbasis `laufwege-v1`** — rund 34.600 echte Kämpfe und 180.000
angetretene Einheiten je Zeile. Gemessen wird an Brettern aus **laufenden
Partien** und nicht an zufällig besetzten: Der Unterschied ist groß und in
`docs/TAFELRUNDE-SPIELZEIT.md` nachgerechnet — ein Bot kauft nicht zufällig,
er verschmilzt, sammelt Marken und stellt nach Rolle auf, und genau die
Aufstellung entscheidet, wer laufen muss.

---

## 1. Die Beobachtung stimmt, und sie ist kein Einzelfall

| Zahl | heute |
| --- | --- |
| Bewegungen je Kampf, Median | **4** |
| Bewegungen je Kampf, Mittel | 3,52 |
| Verteilung (P10 / P90) | 2 / 6 |
| Kämpfe ganz ohne einen Schritt | 3,6 % |
| **Bewegungen je Treffer** | **0,030** |
| Einheiten, die überhaupt einmal laufen | 46,6 % |
| Einheiten, die schon im Start in Reichweite stehen | **68,4 %** |
| Schritte bis zum ersten eigenen Treffer, Median | **0** |

Robins Probe hatte 6 Bewegungen auf 155 Treffer, also 0,039 — der Messwert
über 34.600 Kämpfe ist 0,030. **Die aufgezeichnete Probe ist ein ganz
normaler Kampf**, kein Ausreißer.

## 2. Woran es liegt: an der Geometrie, nicht am Laufcode

Die Arena ist 5 Spalten mal 4 Reihen (zwei je Seite, `arena.ts`). Rechnet man
die Abstände über alle 100 Feldpaare aus, kommt heraus:

- Jedes Feld der **vorderen** Reihe liegt **1 Feld** vom nächsten
  gegnerischen Feld entfernt — Kopf an Kopf über die Mittellinie.
- Jedes Feld der **hinteren** Reihe liegt **2 Felder** entfernt.
- 75 der 100 Feldpaare liegen höchstens 3 Felder auseinander.

Die Reichweiten im Katalog sind 1 (Wache, Meuchler), 2 (Beistand), 3
(Schütze, Magier) und 4 (Sturmrufer). **Damit steht ein Schütze in seiner
eigenen hinteren Reihe von Anfang an im Ziel — egal, wo der Gegner steht.**
Für Wache, Beistand, Schütze und Magier war der größte über alle 34.600
Kämpfe gemessene Startabstand **3**; nur der Meuchler kam auf 5, und zwar
genau deshalb, weil der Bot ihn ausdrücklich an den Rand stellt.

Aufgeschlüsselt nach Rolle (heutiger Stand, 179.665 Einheiten):

| Rolle | Einheiten | läuft je einmal | Schritte, Median | Schritte, Mittel | bis 1. Treffer | sofort in Reichweite | Startabstand |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Wache | 97.715 | 49,3 % | 0 | 0,59 | 0 | 70,9 % | 1 |
| Meuchler | 51.729 | 68,3 % | 1 | 1,24 | 1 | 45,6 % | 2 |
| Beistand | 761 | 23,5 % | 0 | 0,26 | 0 | 87,3 % | 2 |
| **Schütze** | 14.862 | **0,10 %** | 0 | 0,00 | 0 | **100,0 %** | 2 |
| **Magier** | 14.598 | **0,06 %** | 0 | 0,00 | 0 | **100,0 %** | 2 |

Ausgezählt statt gerundet: Von **14.862 Schützen sind 15** je einen Schritt
gelaufen (16 Schritte zusammen), von **14.598 Magiern 9** (9 Schritte). Das
sind nicht „wenige" Bewegungen, sondern über 29.460 Einheiten **25 Schritte
insgesamt**.

**Ein Fehler ist das nicht.** Die Zugschleife in `kampf.ts` ist richtig: Wer
in Reichweite steht, schlägt; wer nicht, geht ein Feld näher, wenn eines frei
ist. Geprüft wurde auch der naheliegende Verdacht — eine Einheit, die
festhängt, statt zu laufen: Von 179.665 Einheiten kamen **196 (0,11 %)** nie
zum ersten Schlag, und das sind ausschließlich Einheiten, die vorher fielen
(Wache 68, Meuchler 128, bei den drei anderen Rollen keine einzige). **Die
Fernkämpfer laufen nicht, weil sie nicht müssen.**

## 3. Und wie viel Bildschirmzeit hängt daran?

Das ist die Zahl, die man beim Zusehen wirklich sieht, und sie fällt anders
aus als „vier Bewegungen je Kampf" vermuten lässt. Ein Schritt dauert
`schrittdauer(STANDARD_REGLER)` = **300 ms**, ein Kampf **17,0 s** im Median.

| | heute |
| --- | --- |
| Schritte je Einheit und Kampf | 0,68 |
| **Anteil der Kampfzeit mit Laufbild** | **1,2 %** |
| Median des letzten Schritts im Kampf | 10,9 s |

**Eine Figur zeigt ihren Laufzyklus in gut einem Prozent der Kampfzeit**, und
die wenigen Schritte fallen über den ganzen Kampf verteilt (der letzte im
Median erst nach 10,9 s, wenn Lücken durch Tote aufgehen) — nicht gebündelt
als sichtbarer Anlauf.

---

## 4. Jede Stellschraube einzeln

Jede Zeile rechnet **dieselben Saaten** wie die erste; ein Unterschied
zwischen zwei Zeilen ist die Wirkung der Schraube und nicht die Wirkung
anderer Würfel.

**Wie gemessen wurde, ohne das Spiel zu ändern:** Brettbreite, Reihenzahl,
Reichweiten und Startabstand stehen als Konstanten im Modul — anders als
Zeitraffer und Startleben lassen sie sich nicht von außen drehen. Statt sie
durch Partie, Bot und Sicht durchzureichen (ein Eingriff in genau das, worüber
erst entschieden wird) oder den Kampf im Messstand nachzubauen (dann misst man
seine eigene Kopie), kopiert `werkzeug/laufwege-variante.mjs` das übersetzte
`dist/`, ersetzt dort **genau eine Zahl** und misst die Kopie. Am Spiel ändert
sich nichts.

| Zeile | Beweg. Median | Beweg. Mittel | P90 | ohne Beweg. | läuft je einmal | sofort in RW | Schritte/Einheit | Laufbild-Anteil | Kampf | von der Uhr | Partie | Runden | Markenspanne |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **heute (5×2)** | 4 | 3,52 | 6 | 3,6 % | 46,6 % | 68,4 % | 0,68 | 1,2 % | 17,0 s | 6,0 % | 6,9 min | 9 | x0,78–x1,31 |
| 6 Spalten | 5 | 4,51 | 7 | 3,3 % | 52,1 % | 58,5 % | 0,87 | 1,5 % | 17,3 s | 5,9 % | 7,0 min | 9 | x0,69–x1,27 |
| 7 Spalten | 5 | 5,02 | 8 | 3,6 % | 52,8 % | 56,6 % | 0,97 | 1,7 % | 17,0 s | 6,0 % | 7,0 min | 9 | x0,82–x1,18 |
| 3 Reihen je Seite ⚠ | 3 | 3,86 | 8 | 6,5 % | 42,5 % | 72,6 % | 0,74 | 1,3 % | 16,9 s | 4,4 % | 6,9 min | 9 | x0,88–x1,20 |
| 4 Reihen je Seite | 4 | 5,62 | 11 | 3,2 % | 60,7 % | 51,4 % | 1,08 | 1,8 % | 17,8 s | 6,5 % | **7,5 min** | **10** | x0,75–x1,24 |
| Reichweiten −1 | 4 | 3,72 | 6 | 3,3 % | 50,1 % | 66,0 % | 0,72 | 1,3 % | 17,0 s | 6,0 % | 7,0 min | 9 | x0,80–x1,33 |
| **Startabstand +2** | **8** | **7,81** | 12 | **0,0 %** | **93,1 %** | **0,2 %** | **1,50** | **2,5 %** | 17,7 s | **4,5 %** | 6,9 min | 9 | x0,82–x1,25 |

⚠ **„3 Reihen je Seite" ist indikativ und keine Entscheidungsgrundlage.** Die
Punktspiegelung in `arena.ts` ist nur abstandstreu, wenn die Reihen je Seite
gerade sind — bei drei Reihen sind die Nachbarschaften der beiden Hälften
nicht mehr dieselben, und der Kampf wäre nicht fair. Nachgerechnet: bei drei
Reihen weichen 160 von 450 geprüften Feldpaaren ab, bei zwei und vier keines.
Wer mehr Tiefe will, nimmt die Zeile **4 Reihen** — deshalb steht sie mit in
der Tabelle, obwohl die Aufgabe sie nicht nennt.

### Was jede Schraube wirklich tut

- **Breite (6, 7 Spalten)** verteilt die Front, mehr nicht. Die vordere Reihe
  steht weiter Kopf an Kopf; gewonnen wird an den Rändern, wo der Meuchler
  jetzt vorbeiläuft (79,6 % laufen bei 7 Spalten statt 68,3 %). Für Schütze
  und Magier ändert sich fast nichts (3–4 % statt 0,1 %). Kostenlos in Zeit
  und Ausgewogenheit — aber es löst das Problem nicht.
- **Tiefe (4 Reihen)** wirkt dort, wo die Breite nicht hinkommt: Der Bot
  stellt seine Fernkämpfer in die neue hinterste Reihe, ihr Startabstand
  steigt auf 4, und **84,8 % der Schützen und 79,8 % der Magier laufen**. Das
  ist die zweitbeste Zeile — sie kostet aber eine ganze Runde und
  **0,6 Minuten Spielzeit**, und die 8-Minuten-Vorgabe aus
  `docs/TAFELRUNDE-SPIELZEIT.md` ist keine, von der viel Luft übrig ist.
- **Reichweiten −1** (Untergrenze 1, damit niemand ohne Angriff dasteht) ist
  die Schraube, die man zuerst vermutet und die am wenigsten bringt: Von 3,52
  auf 3,72 Bewegungen. Der Grund steht in Abschnitt 2 — bindend ist nicht die
  Reichweite, sondern **dass der Gegner ohnehin 1 bis 2 Felder entfernt
  steht**. Wer die Reichweite senkt, verschiebt nur, welche Einheit als
  erste zuschlägt, und zieht die Markenspanne mit x0,80–x1,33 leicht
  auseinander statt zusammen.
- **Startabstand +2** (zwei leere Reihen zwischen den Hälften, Arena 5×6)
  trifft die Ursache direkt. Der kleinste Startabstand steigt von 1 auf 3,
  **kein Kampf beginnt mehr in Kontakt**, und praktisch jede Einheit läuft:

  | Rolle | läuft je einmal | Schritte, Median | bis 1. Treffer | sofort in RW | Startabstand |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | Wache | 100,0 % | 1 | 1 | 0,0 % | 3 |
  | Meuchler | 100,0 % | 2 | 1 | 0,0 % | 3 |
  | Beistand | 99,9 % | 1 | 1 | 0,0 % | 4 |
  | Schütze | 61,6 % | 1 | 1 | 0,0 % | 4 |
  | Magier | 56,2 % | 1 | 1 | 2,2 % | 4 |

  Bezahlt wird das mit **0,7 s je Kampf** und keiner einzigen Minute Partie
  (6,9 min bei 9 Runden, unverändert). Der Anteil der von der Uhr
  entschiedenen Kämpfe **sinkt** sogar von 6,0 % auf 4,5 %, und die
  Markenspanne bleibt mit x0,82–x1,25 enger als heute.

  **Die Lücke muss gerade sein.** Eine Lücke von 1 macht die Spiegelung
  unfair (nachgerechnet, gleiche Rechnung wie bei den drei Reihen); 2 ist die
  kleinste, die geht.

---

## 5. Empfehlung

**Den Startabstand um zwei Reihen vergrößern (Arena 5×6 statt 5×4, die beiden
mittleren Reihen bleiben leer) und sonst nichts anfassen.** Sie ist die
einzige gemessene Schraube, die die Ursache trifft statt ihrer Nebenwirkungen:
Bewegungen je Kampf 3,52 → 7,81, Einheiten die laufen 46,6 % → 93,1 %, Kämpfe
die in Kontakt beginnen 68,4 % → 0,2 % — und das für 0,7 Sekunden je Kampf,
bei unveränderter Partielänge, weniger Uhr-Entscheidungen und einer eher
engeren Markenspanne. Wer zusätzlich Breite will, nimmt 6 Spalten dazu (auch
kostenlos); die Reichweiten sollten unangetastet bleiben, weil sie nachweislich
nicht die bindende Größe sind.

### Was der Einbau kosten würde (nicht gemacht, nur benannt)

- `ARENA_REIHEN` und `nachArena` in `arena.ts` bekämen die Lücke — zwei
  Zeilen. `haelfteVon`/`vonArena` bräuchten einen dritten Fall, weil eine
  Arenareihe dann zu keiner Seite gehört (im Kampf selbst werden beide nicht
  benutzt, wohl aber in der Anzeige).
- Der Bildschirm (`packages/client/src/minispiele/tafelrunde/`, `Buehne.tsx`)
  und die beiden Proben unter `/probe/arena-2d` und `/probe/arena-3d` zeichnen
  über `ARENA_REIHEN` und ziehen automatisch mit; die **Höhe** der Arena
  wächst aber um die Hälfte, und das ist am schmalen Gerät anzusehen (es gibt
  dazu schon eine offene Karte, dass der Aufbau nie an einem Gerät geprüft
  wurde).
- `arena.test.ts` prüft heute ausdrücklich „vorderste Reihen stehen Kopf an
  Kopf" (`arenaAbstand(vorn0, vorn1) === 1`) — die Zeile wäre nachzuziehen,
  und zwar mit dem neuen Sollwert 3.

---

## 6. Ist weniger Laufen überhaupt ein Fehler?

Die ehrliche Antwort ist **zweigeteilt**.

**Nein, der Kampf ist nicht kaputt.** Ein Auto-Battler, in dem zwei Reihen
aufeinanderprallen und dann stehen bleiben, ist eine legitime Form; das ist
das Bild, das das Genre prägt. Und ganz stillgestellt ist heute auch nichts:
Fast die Hälfte aller Einheiten macht mindestens einen Schritt, der Median
liegt bei vier Bewegungen je Kampf. Die Regel, die dahintersteht — nur ein
strikt näheres, freies Feld —, ist bewusst so gebaut und richtig.

**Ja, an einer Stelle ist es einer, und die ist nicht ästhetisch.** Zwei der
fünf Rollen laufen praktisch **nie**: Schütze und Magier, 29.460 Einheiten,
25 Schritte insgesamt. Damit fehlt die Aufstellungsentscheidung
„vorne/hinten" für den halben Katalog ihre Konsequenz im Kampf, weil hinten
und vorne beide von Anfang an im Ziel stehen. Das ist ein Spielinhalt, der
verpufft, und kein Anzeigeproblem.

**Und die Anzeige löst es nicht.** Es liegt nahe, die Antwort dort zu suchen —
sie liegt dort nicht, und die Zahl aus Abschnitt 3 sagt warum: Ein Schritt
dauert 300 ms, ein Kampf 17 Sekunden. Selbst die beste gemessene Zeile bringt
das Laufbild nur von 1,2 % auf 2,5 % der Kampfzeit. **Wer die vorgerenderten
Laufzyklen sehen will, bekommt sie nicht über die Menge der Schritte, sondern
über ihre Bündelung**: Mit +2 Startabstand laufen *alle* Figuren in der ersten
Sekunde gleichzeitig los — ein sichtbarer Anlauf zu Beginn jedes Kampfes statt
vereinzelter Schritte nach zehn Sekunden, wenn Lücken durch Tote aufgehen. Das
ist der eigentliche Gewinn dieser Zeile, und er steht in keiner der Zahlen,
die die Aufgabe verlangt hat.

Der Rest — dass die Figuren die übrigen 97 % der Zeit stehen und schlagen —
ist keine Panne, sondern das Spiel.
