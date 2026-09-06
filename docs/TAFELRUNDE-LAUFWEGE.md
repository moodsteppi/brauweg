# Tafelrunde: warum im Kampf kaum gelaufen wird

**Stand: 06.09.2026.** Anlass war Robins Beobachtung beim Zusehen: In der
aufgezeichneten Probe (`/probe/kampf`, Runde 10, acht Einheiten auf Stufe 2
und 3) standen 168 Ereignisse — **155 Treffer, 6 Bewegungen**, 6 Tode, 1 Ende.
Die Einheiten standen sich gegenüber und schlugen; gelaufen wurde praktisch
nie. Für ein Spiel, dessen Figuren vorgerenderte Laufzyklen haben, war das
schade.

> **DIE EMPFEHLUNG IST EINGEBAUT (06.09.2026, PR #93).** Robin hat nach dieser
> Messung entschieden — und beide wirksamen Schrauben zusammen genommen statt
> nur einer: Aus der Arena 5×4 wurde **5×10**, vier Reihen je Bretthälfte und
> zwei leere dazwischen (`ARENA_LUECKE` in `arena.ts`).
>
> **DIE ZAHLEN IN DEN ABSCHNITTEN 2 BIS 5 SIND AUF DEM ALTEN BRETT GEMESSEN**
> (5 Spalten × 2 Reihen je Seite, ohne Lücke) und beschreiben **nicht** den
> gebauten Stand. Sie stehen weiter hier, weil sie die Herleitung sind: Ohne
> sie ist die Entscheidung eine Geschmacksfrage. Was heute gilt, steht in
> Abschnitt 1 — nachgemessen mit demselben Werkzeug und derselben Saatbasis,
> nicht aus dem Umbau-Commit abgeschrieben.
>
> Startleben (12), Zeitraffer (2), Schwellen und Boni sind unangetastet.

Nachrechnen:

```bash
npm run build                      # im Wurzelverzeichnis
node packages/game-tafelrunde/werkzeug/laufwege.mjs --partien 2000

# das alte Brett noch einmal, ohne das Spiel zu ändern (siehe Abschnitt 5):
node packages/game-tafelrunde/werkzeug/laufwege-variante.mjs alt5x2 --reihen 2 --luecke 0
node packages/game-tafelrunde/werkzeug/laufwege.mjs \
     --dist packages/game-tafelrunde/tmp-varianten/alt5x2 --partien 2000
```

Alle Zahlen stammen aus **2.000 Partien je Zeile, zu viert, Besetzung
`normal`, Saatbasis `laufwege-v1`** — 34.600 bis 35.300 echte Kämpfe und rund
180.000 angetretene Einheiten je Zeile. Gemessen wird an Brettern aus
**laufenden Partien** und nicht an zufällig besetzten: Der Unterschied ist
groß und in `docs/TAFELRUNDE-SPIELZEIT.md` nachgerechnet — ein Bot kauft nicht
zufällig, er verschmilzt, sammelt Marken und stellt nach Rolle auf, und genau
die Aufstellung entscheidet, wer laufen muss.

---

## 1. Der gebaute Stand: Arena 5×10

Nachgemessen am 06.09.2026 auf dem zusammengeführten Stand — 2.000 Partien,
**35.287 Kämpfe, 184.956 angetretene Einheiten**:

| Zahl | vorher (5×2) | **gebaut (5×4, Lücke 2)** |
| --- | ---: | ---: |
| Bewegungen je Kampf, Median | 4 | **9** |
| Bewegungen je Kampf, Mittel | 3,52 | **10,04** |
| Verteilung (P10 / P90) | 2 / 6 | 4 / 17 |
| Einheiten, die überhaupt einmal laufen | 46,6 % | **99,98 %** |
| Einheiten, die schon im Start in Reichweite stehen | 68,4 % | **0,0 %** |
| **Anteil der Kampfzeit mit Laufbild** | 1,2 % | **3,2 %** |
| Schritte je Einheit und Kampf | 0,68 | 1,92 |
| Schritte bis zum ersten eigenen Treffer, Median | 0 | 1 |
| Kämpfe ganz ohne einen Schritt | 3,6 % | 0,0 % |
| Bewegungen je Treffer | 0,030 | 0,085 |
| Kampfdauer, Median | 17,0 s | 18,0 s |
| von der Uhr entschiedene Kämpfe | 6,0 % | 4,4 % |
| Partie / Runden | 6,9 min / 9 | 6,7 min / 10 |
| Markenspanne | x0,78–x1,31 | x0,73–x1,35 |

**Die beiden Zahlen aus dem Umbau-Commit sind bestätigt**, mit einer
Genauigkeit mehr: 10,04 Bewegungen je Kampf stimmen auf die Stelle, und die
„100 % laufende Einheiten" sind gerundet — ausgezählt laufen **42 von 184.956
Einheiten nicht** (0,023 %), alles Wachen und Meuchler, die fielen, bevor sie
losgehen konnten.

Eine Zahl weicht ab, und zwar nachvollziehbar: Der Umbau-Commit nennt eine
Partie von **7,5 min**, gemessen werden jetzt **6,7 min**. Dazwischen liegt
PR #90 („das längste Warten war der Bot-Takt der Plattform"), der nach #93 auf
`staging` kam und das Zeitmodell in `test/messen.ts` geändert hat. Die
Laufweg-Zahlen sind davon unberührt.

Je Rolle:

| Rolle | Einheiten | läuft je einmal | Schritte, Median | bis 1. Treffer | sofort in RW | Startabstand |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Wache | 98.532 | 100,0 % | 1 | 1 | 0,0 % | 3 |
| Meuchler | 54.138 | 100,0 % | 2 | 1 | 0,0 % | 3 |
| Beistand | 866 | 100,0 % | 3 | 2 | 0,0 % | 6 |
| **Schütze** | 15.428 | **100,0 %** | 2 | 2 | 0,0 % | 6 |
| **Magier** | 15.992 | **100,0 %** | 2 | 2 | 0,0 % | 6 |

Der eigentliche Befund der ganzen Untersuchung ist damit erledigt: Schütze und
Magier liefen vorher in 0,10 % bzw. 0,06 % der Fälle, jetzt ausnahmslos. Ihr
Startabstand ist von 2 auf 6 gestiegen, und **kein einziger Kampf beginnt mehr
in Kontakt**.

### Nachtrag vom selben Tag: die Aufstellung des Bots

Die Tabelle oben ist mit der damaligen Bot-Aufstellung gemessen — Wachen und
Meuchler in Reihe 0, alles andere in Reihe 3. **Genau diese Aufstellung ist am
06.09.2026 ersetzt worden** (`STANDARD_TIEFEN` in `bot.ts`, Werkzeug
`werkzeug/aufstellung.mjs`): Der Bot stellt jetzt einen geschlossenen Block in
die beiden **mittleren** Reihen — Wachen in Reihe 1, alles andere in Reihe 2.
Der Grund steht bei `STANDARD_TIEFEN` und hat mit Laufwegen nichts zu tun;
das Auseinanderziehen über die ganze Tiefe kostete Kämpfe.

Für diese Untersuchung ist wichtig, dass es **nichts zurücknimmt**. Beide
Zeilen sind mit derselben Saatbasis und demselben Werkzeug gemessen, je 2.000
Partien zu viert und rund 35.000 Kämpfe:

| Zahl | alte Aufstellung | **neue Aufstellung** |
| --- | ---: | ---: |
| Bewegungen je Kampf, Mittel | 13,00 | **14,17** |
| Bewegungen je Treffer | 0,135 | **0,149** |
| Schritte je Einheit und Kampf | 2,47 | **2,70** |
| Einheiten, die überhaupt einmal laufen | 100,0 % | **100,0 %** |
| Einheiten, die schon im Start in Reichweite stehen | 0,0 % | **0,0 %** |
| Kampfdauer, Median | 14,9 s | 14,9 s |
| von der Uhr entschiedene Kämpfe | 1,8 % | **2,9 %** |

Es wird also eher **mehr** gelaufen als vorher. Der Startabstand der
Fernkämpfer bleibt bei 6, weil der Block eine Reihe zurückgesetzt steht; die
Wachen laufen mit Startabstand 5 statt 3 sogar deutlich weiter (Median 3
Schritte statt 1).

**Eine Zahl geht in die falsche Richtung**, und sie steht hier, damit sie
nicht verlorengeht: Von der Uhr entschiedene Kämpfe steigen von 1,8 % auf
2,9 % (mit der Saatbasis der Ausgewogenheitsmessung 1,7 % auf 2,7 % — dieselbe
Größenordnung). Ein längerer Anmarsch heißt eben auch, dass ein zäher Kampf
öfter in `HOECHSTDAUER_MS` läuft. Das ist der Preis, und ob er zu hoch ist,
hängt an einer Entscheidung, die ohnehin offen ist (Board-Karte
„HOECHSTDAUER_MS von 45 s auf 30 s senken?").

---

## 2. Die Beobachtung, die dazu geführt hat

> Ab hier bis Abschnitt 5: gemessen auf dem **alten** Brett (5 Spalten × 2
> Reihen je Seite, keine Lücke), also auf dem Stand vor dem 06.09.2026.

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

## 3. Woran es lag: an der Geometrie, nicht am Laufcode

Die Arena war 5 Spalten mal 4 Reihen (zwei je Seite, ohne Lücke). Rechnet
man die Abstände über alle 100 Feldpaare aus, kommt heraus:

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

Aufgeschlüsselt nach Rolle (damaliger Stand, 179.665 Einheiten):

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

## 4. Und wie viel Bildschirmzeit hing daran?

Das ist die Zahl, die man beim Zusehen wirklich sieht, und sie fällt anders
aus als „vier Bewegungen je Kampf" vermuten lässt. Ein Schritt dauert
`schrittdauer(STANDARD_REGLER)` = **300 ms**, ein Kampf **17,0 s** im Median.

| | damals (5×2) |
| --- | --- |
| Schritte je Einheit und Kampf | 0,68 |
| **Anteil der Kampfzeit mit Laufbild** | **1,2 %** |
| Median des letzten Schritts im Kampf | 10,9 s |

**Eine Figur zeigte ihren Laufzyklus in gut einem Prozent der Kampfzeit**,
und die wenigen Schritte fielen über den ganzen Kampf verteilt (der letzte
im Median erst nach 10,9 s, wenn Lücken durch Tote aufgehen) — nicht
gebündelt als sichtbarer Anlauf. Das ist die Zahl, die der Umbau am
deutlichsten bewegt hat, und trotzdem nur auf 3,2 % (Abschnitt 1): Ein
Kampf ist eben 18 Sekunden lang und ein Schritt drei Zehntel davon.

---

## 5. Jede Stellschraube einzeln — die Herleitung

**Diese Tabelle ist der Grund, aus dem der Umbau so aussieht, wie er
aussieht.** Sie vergleicht sieben Bretter, die es damals alle noch nicht
gab; die Ausgangszeile „heute (5×2)" ist der Stand vor dem 06.09.2026, und
keine Zeile beschreibt den gebauten. Gebaut wurden am Ende die beiden
untersten Zeilen **zusammen** — siehe Abschnitt 1.

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
  auf 3,72 Bewegungen. Der Grund steht in Abschnitt 3 — bindend ist nicht die
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

## 6. Die Empfehlung — und was daraus wurde

**Empfohlen war:** den Startabstand um zwei Reihen vergrößern (Arena 5×6
statt 5×4, die beiden mittleren Reihen bleiben leer) und sonst nichts
anfassen. Sie war die einzige gemessene Schraube, die die Ursache trifft
statt ihrer Nebenwirkungen: Bewegungen je Kampf 3,52 → 7,81, Einheiten die
laufen 46,6 % → 93,1 %, Kämpfe die in Kontakt beginnen 68,4 % → 0,2 % — und
das für 0,7 Sekunden je Kampf, bei unveränderter Partielänge, weniger
Uhr-Entscheidungen und einer eher engeren Markenspanne. Die Reichweiten
sollten unangetastet bleiben, weil sie nachweislich nicht die bindende Größe
sind.

**Entschieden hat Robin am 06.09.2026 mehr als das:** Lücke 2 **und** vier
Reihen je Seite, also die beiden wirksamen Zeilen zusammen (PR #93). Die
Kombination stand in dieser Tabelle nicht — sie ist vor dem Bauen eigens
gemessen worden und steht jetzt in Abschnitt 1. Sie bringt mehr als jede
Einzelzeile (10,04 Bewegungen statt 7,81) und kostet dafür die Runde, die
die Vier-Reihen-Zeile schon angekündigt hatte. Nicht genommen wurden die
sechs Spalten; die Reichweiten sind unangetastet geblieben.

### Was der Einbau tatsächlich gekostet hat

Die Vorhersage von hier, daneben das, was PR #93 wirklich anfassen musste:

- **Getroffen:** `arena.ts` bekam die Lücke — als eigene Konstante
  `ARENA_LUECKE`, nicht als zwei verstreute Rechnungen. `haelfteVon` gibt
  jetzt `Seite | null` zurück und `vonArena` wirft dort, weil zwei
  Arenareihen zu keiner Seite gehören.
- **Getroffen:** `arena.test.ts` prüfte „vorderste Reihen stehen Kopf an
  Kopf" mit dem Sollwert 1. Er ist jetzt `ARENA_LUECKE + 1`, also aus der
  Geometrie gerechnet statt eingetragen.
- **Übersehen:** Der Bildschirm zieht **nicht** von allein mit. Er rechnete
  `brettReihen * 2` — das ergäbe acht Reihen statt zehn und ließe die untere
  Hälfte samt Figuren aus dem Raster fallen. Die Sicht führt seitdem
  `arenaReihen`/`arenaSpalten` selbst (CLAUDE.md: was das Modul weiß,
  schreibt der Client nicht ab).
- **Übersehen:** `vorbereitungMs` musste von 45 s auf 75 s. Mehr Felder
  heißen mehr Handgriffe, und der Schwanz der Vorbereitung wurde länger,
  auch wenn der Median bei sieben Handgriffen blieb.

Offen ist die dritte Vorhersage: Die **Höhe** der Arena ist um mehr als die
Hälfte gewachsen, und ob das am schmalen Gerät trägt, hat noch niemand
angesehen — dafür gibt es weiterhin eine eigene Karte.

---

## 7. War weniger Laufen überhaupt ein Fehler?

Die Frage stand vor der Entscheidung, und die Antwort war **zweigeteilt**.
Sie steht hier unverändert, weil sie erklärt, warum überhaupt etwas geändert
wurde — und weil der zweite Teil auch nach dem Umbau gilt.

**Nein, der Kampf war nicht kaputt.** Ein Auto-Battler, in dem zwei Reihen
aufeinanderprallen und dann stehen bleiben, ist eine legitime Form; das ist
das Bild, das das Genre prägt. Ganz stillgestellt war auch damals nichts:
Fast die Hälfte aller Einheiten machte mindestens einen Schritt, der Median
lag bei vier Bewegungen je Kampf. Die Regel, die dahintersteht — nur ein
strikt näheres, freies Feld —, ist bewusst so gebaut, richtig, und **beim
Umbau nicht angefasst worden**. Geändert wurde die Geometrie, nicht der
Kampf.

**Ja, an einer Stelle war es einer, und die war nicht ästhetisch.** Zwei der
fünf Rollen liefen praktisch **nie**: Schütze und Magier, 29.460 Einheiten,
25 Schritte insgesamt. Damit fehlte der Aufstellungsentscheidung
„vorne/hinten" für den halben Katalog ihre Konsequenz im Kampf, weil hinten
und vorne beide von Anfang an im Ziel standen. Das war ein Spielinhalt, der
verpuffte, und kein Anzeigeproblem. **Genau das ist behoben:** Beide Rollen
laufen jetzt ausnahmslos, ihr Startabstand ist 6 statt 2.

**Und die Anzeige löst es nicht** — der Satz gilt weiter, und die
gemessenen 3,2 % belegen ihn. Es liegt nahe, die Antwort dort zu suchen;
sie liegt dort nicht, und die Zahl aus Abschnitt 4 sagt warum: Ein Schritt
dauert 300 ms, ein Kampf 18 Sekunden. Der Umbau hat die Bewegungen
verdreifacht und das Laufbild trotzdem nur von 1,2 % auf **3,2 %** der
Kampfzeit gebracht. **Wer die vorgerenderten Laufzyklen sehen will, bekommt
sie nicht über die Menge der Schritte, sondern über ihre Bündelung**: Seit
der Lücke laufen *alle* Figuren zu Beginn gleichzeitig los — ein sichtbarer
Anlauf am Anfang jedes Kampfes statt vereinzelter Schritte nach zehn
Sekunden, wenn Lücken durch Tote aufgehen. Das ist der eigentliche Gewinn,
und er steht in keiner der Zahlen, die die Aufgabe verlangt hatte.

Der Rest — dass die Figuren die übrigen knapp 97 % der Zeit stehen und
schlagen — ist keine Panne, sondern das Spiel. Wer daran noch etwas ändern
will, dreht nicht mehr am Brett: Dort ist die Luft raus, wie Abschnitt 1
zeigt.
