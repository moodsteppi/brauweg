# Auto-Battler mit Merge-Mechanik — Konzept für ein neuntes Spiel

Vorlage ist ein ausführlicher Entwurf von Robin (04.09.2026), inspiriert vom
Genre „Auto Chess / Merge Tactics". Eigenständiges Konzept mit eigenen Namen
und Grafiken — **keine** Assets, Figuren oder Markennamen von Supercell oder
aus Clash Royale.

---

## Zuerst: was aus der Vorlage NICHT gilt

Der Entwurf empfahl einen eigenen Technik-Stapel — React, PixiJS, Colyseus,
Socket.io, ein eigenes Monorepo mit `/apps/client` und `/apps/server`. **Davon
gilt hier nichts.** Brauweg ist bereits eine Plattform mit acht Spielen, einem
Server, einer Lobby und einem Client. Ein neues Spiel ist hier ein **Paket**,
kein Projekt.

Wer den Entwurf liest, überspringt seine Abschnitte 3 (Tech-Stack) und 4
(Projektstruktur) vollständig. Alles andere — Mechanik, Datenmodelle,
Balancing, Bildschirme, Phasen — ist die Vorgabe.

Was stattdessen gilt, steht in `packages/game-api/src/index.ts`:

1. Ein Spielmodul ist eine **reine Logikbibliothek**. Kein Netzwerk, keine
   Datenbank, keine Uhr, kein Zufall außer dem übergebenen Seed. Gleicher
   Zustand plus gleiche Aktion ergibt immer dasselbe Ergebnis.
2. Sichtbarkeit entsteht **ausschließlich in `viewFor`**. Der Client bekommt
   nie den vollen Zustand und blendet nichts selbst aus.
3. Trophäen sind **nicht** Teil des Moduls. Es liefert Platzierungen, die
   Plattform rechnet die Wertung — deshalb gilt dieselbe Rangliste über alle
   Spiele.
4. Der Regelsatz enthält **niemals** Einsatz, Topf oder Preise.

Der erste Grundsatz trifft sich glücklich mit der Vorlage: Sie verlangt
ohnehin eine deterministische Kampfsimulation („gleicher Seed = gleiches
Ergebnis"), damit der Client nur abspielt. Genau so ist die Plattform gebaut.

---

## Das Spiel

Rundenbasiert, acht Spieler in einer Lobby. Die Kämpfe laufen **automatisch**
ab; entschieden wird zwischen den Runden.

### Spielfeld

Hexagonales Raster, etwa 4 Reihen zu 5 Spalten, versetzt. Eigene Hälfte zum
Platzieren, das gegnerische Brett wird für die Vorschau gespiegelt. Unterhalb
eine Reservebank mit 5–9 Plätzen.

### Einheiten und Verschmelzen

Einheiten haben **Stufe 1 bis 3** (Sterne). Drei gleiche Einheiten derselben
Stufe verschmelzen automatisch zur nächsten. Jede Einheit trägt: Typ
(Wache, Schütze, Magier, Meuchler, Beistand), Kosten 1–5 Gold, Grundwerte
(Leben, Angriff, Angriffstempo, Reichweite, Rüstung) und eine Fähigkeit, die
sich über Mana auflädt.

Zum Start reichen 15 Einheiten über drei Kostenstufen; für eine
Veröffentlichung sind 30–40 über fünf Stufen gedacht.

### Synergien

Jede Einheit trägt ein bis zwei Klassen-Marken (etwa Krieger, Elementar,
Meuchler, Wächter, Naturwesen). Je mehr Einheiten einer Marke gleichzeitig auf
dem Feld stehen, desto stärker der Bonus — Schwellen bei 2, 4 und 6. Die
aktiven Boni gehören **sichtbar** in die Oberfläche.

### Wirtschaft

Gold je Runde: Grundeinkommen, Zins (1 Gold je 10 auf der Hand, höchstens 5),
Bonus bei Sieges- oder Niederlagenserie. Der Laden zeigt fünf zufällige
Einheiten; die Wahrscheinlichkeit teurer Einheiten steigt mit dem Spielerlevel.
Neu würfeln kostet Gold. Level steigern kostet Gold und bringt Feldplätze.

### Rundenablauf

1. **Vorbereitung** (ca. 30 s): kaufen, setzen, verschmelzen.
2. **Kampf** (ca. 15–20 s): läuft automatisch, wird nur zugesehen.
   Gemessen 17,3 s — erreicht wird das über den Zeitraffer, siehe unten.
3. **Ergebnis**: Schaden am Verlierer nach verbliebenen Gegnereinheiten.
4. Bei 0 Leben scheidet ein Spieler aus. Der Letzte gewinnt.

Dazwischen alle paar Runden neutrale Monsterrunden für Bonusgold.

### Balancing — Startwerte, ausdrücklich zum Nachjustieren

| Kosten | Typen | Leben (⭐1) | Angriff (⭐1) | Kopien im Vorrat |
|---|---|---|---|---|
| 1 Gold | 8 | 550 | 40 | 30 |
| 2 Gold | 8 | 700 | 55 | 25 |
| 3 Gold | 6 | 900 | 70 | 18 |
| 4 Gold | 5 | 1100 | 90 | 12 |
| 5 Gold | 3 | 1400 | 120 | 8 |

Verschmelzen skaliert **nicht linear**: Stufe 2 etwa 1,8-fach, Stufe 3 etwa
3,2-fach — sonst lohnt es sich nicht.

Diese Startwerte sind inzwischen **gemessen** worden; geändert wurde an ihnen
nichts. Die Zahlen und die Befunde stehen unten unter „Gemessen:
Ausgewogenheit".

### Bildschirme

Spielfeld mittig mit Ziehen und Ablegen, Bank darunter, Ladenleiste unten mit
Neu-Würfeln und Level-Auf. Kopfzeile mit eigenem Leben, Gold, Runde, Uhr und
einer Übersicht der sieben Gegner. Seitlich die Synergien mit Fortschritt.

**Der Auftritt folgt der bestehenden App.** Startbildschirm, Spielauswahl,
Farben, Schriften und Abstände wie bei den acht vorhandenen Spielen — das neue
Spiel soll sich nicht wie ein Fremdkörper anfühlen. Vorlage sind die
vorhandenen Bildschirme unter `packages/client/src/screens/`.

---

## Zuschnitt für den ersten Schritt

Die Vorlage nennt fünf Phasen. Gebaut wird **zuerst Phase 1**, und zwar
vollständig lauffähig:

- Hex-Brett mit Platzieren per Ziehen und Ablegen
- Laden mit fünf zufälligen Einheiten aus mindestens 15, drei Kostenstufen
- Verschmelzen (drei gleiche → nächste Stufe)
- Gold mit Kaufen, Neu-Würfeln, Level-Auf
- Reservebank

Noch **nicht** in Phase 1: Kampfsimulation, Synergie-Boni, Mehrspieler.
Die Kampfphasen 2 bis 5 folgen als eigene Aufträge.

Auch in Phase 1 gilt der Determinismus: Der Ladeninhalt kommt aus dem Seed,
nicht aus `Math.random()`. Sonst ist die Simulation später nicht nachbaubar
und keine Probe reproduzierbar.

---

## Woran sich der Bau hält

- **Neues Paket** `packages/game-<name>`, aufgebaut wie die vorhandenen:
  `src/index.ts` (Modul), `adapter.ts`, `partie.ts`, `regeln.ts`, `sicht.ts`,
  `bot.ts`, dazu Proben unter `test/`.
- **Client**: ein Bildschirm unter `packages/client/src/screens/`, eingetragen
  in `App.tsx`, `GameSelect.tsx`, `i18n.ts` und `protocol.ts` — genau wie
  `Filler.tsx` es vormacht.
- **Alles auf Deutsch**: Bezeichner, Kommentare, Commit-Nachrichten,
  Oberflächentexte (CLAUDE.md, Regel 2).
- **Gegen `staging`**, nie direkt nach `main` (Regel 1).
- Kommentare erklären das **Warum**, nicht das Was.

---

## Gemessen: Ausgewogenheit (Stand 05.09.2026, dritte Messung)

**Was zuletzt geändert wurde:** Der Kampf läuft im **Zeitraffer x2**
(`STANDARD_REGLER.zeitraffer` in `kampf.ts`), und der Lebensvorrat ist von 20
auf **14** gefallen (`DEFAULT_REGELN.startLeben` in `regeln.ts`). Anlass war
Robins Ziel „durchschnittlich 8 Minuten maximum": Eine Partie dauerte 13:31 im
Median, jetzt 7:25. Welche Stellschraube wie viel bringt und warum es diese
beiden wurden, steht in **`docs/TAFELRUNDE-SPIELZEIT.md`**.

**Davor** war der Lebensvorrat von 100 auf 20 gefallen, der Schaden je
Niederlage wird seitdem durch drei geteilt (`SCHADEN_STUFEN_TEILER`), die Marke
**Drache** hat mit dem Funkenlehrling einen zweiten Träger bekommen und ihr
Bonus wurde halbiert, und das **Drachenkind** ist von Tempo 0,85 auf 0,75
heruntergesetzt (Robin: „stell auf 4 Spieler um, das reicht völlig, und
reduzier auf 20 Leben — es soll ja ein kurzes Handyspiel sein").

Die Zahlen unten sind die Messung **nach** dem Zeitraffer; die Spalte „vorher"
ist derselbe Lauf mit 20 Leben und ohne Zeitraffer
(`--leben 20 --zeitraffer 1`), also der Stand der zweiten Messung.

Der **Normalfall sind vier Sitze**. Der Bildschirm sucht ausschließlich Tische
zu viert, gemessen wird deshalb zu viert. Die übrigen Sitzzahlen bleiben
erlaubt und sind mitgemessen.

### Wie gemessen wurde

`packages/game-tafelrunde/test/messen.ts` spielt vollständige Partien mit Bots
durch, ohne Oberfläche, alles aus dem Seed. Zwei Aufrufer benutzen ihn:

- **Das Werkzeug** `packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs` —
  von Hand zu starten, mit der großen Zahl. Es druckt die Tabellen dieses
  Abschnitts:

  ```
  npm run build --workspace @brauweg/game-tafelrunde
  node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 150
  ```

  Schalter: `--partien`, `--sitze` (2–8), `--besetzung`
  (`normal`/`sanft`/`hart`/`gemischt`), `--saat`, `--mindest`, `--json`.

- **Die Probe** `test/ausgewogenheit.test.ts` — 400 Partien zu viert, rund
  anderthalb Sekunden, läuft bei jedem Testlauf mit. Sie hält nur fest, was
  wirklich kaputt wäre, und ist keine Abnahme des Katalogs.

Die Grundmessung sind **5.000 Partien zu viert**, alle Sitze mit der Gangart
`normal` besetzt (sonst misst man die Gangarten und nicht den Katalog). Fünf-
statt fünfhundert Tausend, weil eine Partie zu viert seit der Umstellung 1,8
statt 20 Millisekunden kostet — und weil die dünnen Marken sonst gar keine
Aussage hergeben. Zwei Gegenproben bestätigen sie: eine zweite Saatbasis über
5.000 Partien und eine gemischte Besetzung (reihum sanft/normal/hart) über
5.000 Partien.

**Was diese Zahlen nicht sind:** eine Aussage über die beste Strategie.
Gemessen ist das Spiel, wie die **Bots** es spielen. Alles, was der Bot nicht
tut — gezielt auf eine Schwelle hinspielen, den Vorrat mitzählen, zwischen
zwei Runden umbauen —, fällt heraus.

### Wie lange eine Partie dauert

Rundengrenze ist 30. Zu viert 5.000 Partien, zu zweit und zu dritt je 1.000,
zu sechst und zu acht je 500.

| Sitze | Runden ⌀ | Median | Spielzeit (Median) | an der Grenze geendet | erstes Ausscheiden | zur Halbzeit entschieden |
|---|---|---|---|---|---|---|
| 2 | 8,4 | 8 | 4:47 | 0,0 % | Runde 8,4 | 31,5 % |
| 3 | 10,1 | 10 | 6:27 | 0,0 % | Runde 8,1 | 32,2 % |
| **4** | **11,1** | **11** | **7:21** | **0,0 %** | **Runde 7,8** | **30,6 %** |
| 6 | 12,8 | 13 | 8:56 | 0,0 % | Runde 7,4 | 25,0 % |
| 8 | 13,8 | 14 | 10:05 | 0,0 % | Runde 7,3 | 23,2 % |

Die Rundenzahlen davor, jeweils derselbe Lauf: mit 20 Leben zu viert 14,7
(Median 15) bei 13:26 Spielzeit; mit 100 Leben zu viert 26,5 Runden bei 18,5 %
an der Grenze, zu zweit 21,3 bei 2,3 %, zu sechst 28,8 bei 47,8 %, zu acht 29,6
bei 72,6 %.

**Die Spielzeit ist jetzt die Zielgröße, nicht die Rundenzahl.** Die früher
angesteuerte Spanne von 14 bis 20 Runden zu viert ist bewusst aufgegeben
worden: Sie kam aus der Überlegung, dass eine Runde bis zu anderthalb Minuten
dauert, und genau das stimmt seit dem Zeitraffer nicht mehr — eine Runde zu
viert ist im Median 21 Sekunden Kampf plus geschätzte 14 Sekunden Vorbereitung.
Elf Runden sind deshalb keine kürzere Partie im alten Sinn, sondern dieselbe
Partie mit weniger Leerlauf.

Was die untere Kante angeht, gilt die alte Begründung unverändert: **Vor Runde
10 steht kein ausgebautes Brett.** Mit 11 Runden im Median liegt das Spiel
knapp darüber und damit an der Kante — wer die Partie noch einmal kürzen will,
streicht das ausgebaute Brett. Die kürzeste von 5.000 Partien lief 8 Runden,
die längste 17.

„Zur Halbzeit entschieden" heißt: Der spätere Sieger lag spätestens ab der
halben Partie ununterbrochen beim meisten Leben.

### Siegquote je Marke

5.000 Partien zu viert. Gezählt wird ein Sitz, dessen **letztes** Brett die
Marke mindestens zweimal trug (erste Schwelle) — nicht der Endzustand, denn wer
ausscheidet, gibt sein Brett vollständig in den Vorrat zurück.

| Marke | Antritte | Siege | Quote | zum Schnitt | vorher (20 Leben, x1) |
|---|---|---|---|---|---|
| Krieger | 6.972 | 3.037 | 43,6 % | ×1,27 | ×1,13 |
| Wächter | 11.208 | 4.345 | 38,8 % | ×1,13 | ×1,07 |
| Drache | 204 | 79 | 38,7 % | ×1,13 | ×1,15 |
| Naturwesen | 3.116 | 983 | 31,5 % | ×0,92 | ×1,06 |
| Elementar | 924 | 246 | 26,6 % | ×0,78 | ×0,80 |
| Meuchler | 6.107 | 1.610 | 26,4 % | ×0,77 | ×0,79 |
| Untot | 32 | 7 | 21,9 % | zu dünn | zu dünn (65) |

Die Spalte „vorher" ist derselbe Lauf mit 20 Leben und ohne Zeitraffer, also
dieselben 5.000 Saaten mit den Werten der zweiten Messung. Untot war schon dort
zu dünn und ist es jetzt noch deutlicher (32 statt 65 Antritte): Wer eine Marke
sammeln will, hat elf Runden Zeit statt fünfzehn.

Schnitt der gezählten Zeilen: 34,3 %. Der Schnitt ist nicht 1/4 — ein Brett
trägt in der Regel drei bis fünf Marken gleichzeitig, die Quoten summieren sich
deshalb nicht auf 100 %.

**Das Ziel war: keine gezählte Marke über ×1,4 und keine unter ×0,7.** Der
gemessene Bereich ist ×1,27 bis ×0,77 und bleibt damit innerhalb — der Krieger
ist mit ×1,27 aber die Zeile, die man beim nächsten Mal zuerst ansieht. Er
zieht durch den Zeitraffer an, und zwar aus einem verstandenen Grund: Wo vorher
jeder dritte Kampf an der Uhr entschieden wurde (`entscheideNachZeit`), gewinnt
jetzt das Brett, das sonst auf Zeit gespielt hätte. Geändert wurde deshalb
nichts am Katalog.

### Siegquote je Einheit auf dem letzten Brett

5.000 Partien zu viert, Schnitt der gezählten Zeilen 30,6 %. Gekürzt auf die
Ränder; die volle Tabelle druckt das Werkzeug.

| Einheit | Gold | Antritte | Quote | zum Schnitt | vorher |
|---|---|---|---|---|---|
| Bogenmeisterin | 2 | 748 | 51,7 % | ×1,57 | ×1,72 |
| Nachtpfeil | 2 | 523 | 50,9 % | ×1,54 | ×1,61 |
| Wurzelriese | 3 | 1.956 | 49,3 % | ×1,49 | ×1,34 |
| Klingentänzerin | 3 | 2.084 | 45,9 % | ×1,39 | ×1,29 |
| … | | | | | |
| Astschütze | 1 | 9.277 | 24,7 % | ×0,75 | ×0,77 |
| Schattenklinge | 2 | 3.560 | 23,0 % | ×0,70 | ×0,81 |
| Gassendieb | 1 | 15.074 | 20,3 % | ×0,62 | ×0,68 |
| Funkenlehrling | 1 | 2.652 | 18,2 % | ×0,55 | ×0,51 |
| Irrlicht | 1 | 2.028 | 17,8 % | ×0,54 | ×0,57 |
| Moosheiler | 1 | 541 | 5,0 % | ×0,15 | ×0,25 |

Schnitt der gezählten Zeilen 33,0 %. Das Drachenkind steht bei ×1,35 (vorher
×1,08): Es ist die Einheit, die vom Zeitraffer am meisten profitiert, weil sein
gesenktes Tempo in einem Kampf, der nicht mehr an der Uhr endet, wieder zum
Tragen kommt. Die Spitze der Tabelle rückt insgesamt zusammen — die drei
teuren Einheiten holen gegenüber den zwei Bogenschützinnen auf.

### Wie oft eine Schwelle überhaupt stand

196.314 Antritte (je Runde ein Eintrag für jeden lebenden Sitz). Gezählt werden
(Antritt, Marke)-Paare — ein Brett kann mehrere Schwellen gleichzeitig halten.

| Marke | ab 2 | ab 4 | ab 6 | Träger im Katalog |
|---|---|---|---|---|
| Krieger | 34.791 | 198 | 0 | 5 |
| Elementar | 4.507 | 6 | 0 | 5 |
| Meuchler | 31.461 | 139 | 0 | 4 |
| Wächter | 62.704 | 873 | 0 | 6 |
| Naturwesen | 15.689 | 28 | 0 | 5 |
| Untot | 125 | 0 | 0 | 2 |
| Drache | 786 | 0 | 0 | 2 |
| **zusammen** | **150.063 (76,4 %)** | **1.244 (0,6 %)** | **0 (0,0 %)** | |

Vorher (20 Leben, ohne Zeitraffer, 261.233 Antritte): 101,8 % / 2,2 % / 0,0 %
mit sieben Sechser-Schwellen. Die kürzere Partie drückt beides weiter herunter
— dazu Befund 2.

---

### Was auffiel — und was daraus folgen sollte

**1. Die Rundengrenze ist keine Ausgangstür mehr.** In 5.000 Partien zu viert
endete keine einzige an Runde 30, und auch zu sechst und zu acht keine von je
500 (die längste lief 17). Mit 100 Leben waren es zu viert 18 % und zu acht
73 %. Der Grund ist nicht die Grenze, sondern die Uhr davor: 14 Leben und zwei
bis fünf Punkte Schaden je Niederlage machen aus einem Ausscheiden fünf bis
sieben verlorene Kämpfe statt zwanzig. Die Zahl 30 bleibt trotzdem stehen — sie
ist wieder das Rettungsseil, als das sie gedacht war.

**2. Die Schwelle 6 ist tot, die Schwelle 4 auf dem Weg dorthin.** Von 196.314
Antritten hält **kein einziger** irgendeine Marke sechsfach (mit 20 Leben waren
es 7, mit 100 Leben 0,1 %), und die Vier steht in 0,6 % statt 2,2 % und 13,7 %.
Das ist die **Kehrseite der kürzeren Partie**, und sie ist mit dem Zeitraffer
schlimmer geworden: Sechs Träger brauchen mindestens Level 6, und dorthin kommt
in elf Runden niemand mehr. Dazu kommt die schon bekannte Ursache — der Bot
spielt gar nicht auf Marken hin (`MARKEN_GEWICHT` in `bot.ts` ist 25 gegen
Einheitenstärken von 130 bis 970). **Folgerung:** unverändert — erst dem Bot ein
echtes Markengewicht geben und neu messen; bleibt die Sechs auch dann leer, sind
die Schwellen zu hoch angesetzt (2/3/5 statt 2/4/6). Steht als eigener Punkt auf
dem Board, und die Entscheidung ist dringlicher geworden. Die Probe prüft die
Sechs nicht mehr — sie käme in 400 Partien nicht ein einziges Mal vor.

**3. Untot ist zu dünn für eine Aussage, und Drache rutscht hinterher** — 32
bzw. 204 Antritte in 5.000 Partien (mit 20 Leben 65 und 394, mit 100 Leben 256
und 1.966). Beide haben zwei Träger im Katalog und erreichen die Schwelle 4 nie.
**Folgerung:** unverändert — ein dritter Träger, dann messen. Am Bonus zu
drehen, solange die Marke nur über zwei Kopien derselben Einheit zu haben ist,
misst nicht die Marke. Beide stehen als eigene Karten auf dem Board; die
kürzere Partie hat sie nicht verursacht, macht sie aber schlechter messbar.

**4. Was bei Drache wirklich half, war der zweite Träger, nicht der Bonus.**
Der Weg in Zahlen, jeweils 5.000 Partien zu viert und alle nach der
Lebensumstellung: Ausgangslage ×1,83 (70,3 %), nach dem halbierten Bonus ×1,59, ein erster, zu harter
Griff ans Drachenkind (Tempo 0,65 statt 0,85) ließ nur noch 27 Antritte übrig —
der Bot stellte die Einheit kaum noch auf, und Elementar fiel mit ihr auf
×0,66 — erst der Funkenlehrling
als zweiter Träger brachte ×1,15 bei 394 Antritten. Die Gegenprobe erklärt,
warum: Mit dem Drachen-Bonus auf **null** stand die Marke immer noch bei ×1,37.
Gemessen wurde also gar nicht die Synergie, sondern „ein Brett, auf dem zwei
teure Einheiten stehen".

**5. Der Funkenlehrling ist immer noch die zweitschwächste Einheit** (×0,55),
und der Irrlicht daneben (×0,54) — beide Ein-Gold-Magier mit 430 bis 450 Leben
und 10 Rüstung. Sie sterben, bevor sie zweimal geschossen haben. Der
Gassendieb liegt mit ×0,62 über 15.074 Antritten ebenfalls unten, obwohl der
Bot ihn für die stärkste Ein-Gold-Einheit hält. **Folgerung:** unverändert —
die Bewertung `staerke` in `bot.ts` rechnet Leben × Rüstung × Schaden und lässt
die Reichweite weg. Befund über den **Bot**, nicht über den Katalog; steht auf
dem Board.

**6. Der Moosheiler ist die schwächste Einheit im Feld** — und seit dem
Zeitraffer die auffälligste Zahl der ganzen Tabelle: 541 Antritte (vorher 237)
bei ×0,15 (vorher ×0,25). Er wird **häufiger** aufgestellt und gewinnt
**seltener**, weil in elf Runden öfter ein halb ausgebautes Brett antritt, auf
dem eine Ein-Gold-Beistandseinheit stehen bleibt. Kein Katalogfehler: Heilen
gibt es in `kampf.ts` noch gar nicht, und ohne Fähigkeit ist eine
Beistand-Einheit nur eine schwache Wache. **Folgerung:** nichts, bis es
Fähigkeiten gibt — aber er steht ab jetzt als eigene Karte auf dem Board, weil
5 % Siegquote keine schwache Einheit mehr ist, sondern eine tote.

**7. Die Gangart `hart` schlägt `normal` nicht mehr — auch zu viert nicht.**
Der Effekt war schon bei 20 Leben da, aber nur im Duell: Dort schlug `hart` den
normalen Gegner mit 100 Leben noch 125:75 und danach nur noch 96:104. Zu viert
hielt die Reihenfolge damals (119 : 94). **Mit 14 Leben und Zeitraffer x2 kippt
sie auch dort: 77 : 107,7 über 400 Partien.** Gegen `sanft` kommt `hart` auf
223 : 59, `normal` dagegen auf 267 : 44 — die oberste Sprosse der Leiter steht
unter der mittleren. Der aggressive Ausbau von `hart` braucht Runden, die es
nicht mehr gibt. **Folgerung:** Die Gangart muss neu gedacht und gemessen
werden; steht als eigene Karte auf dem Board. Die Probe in `bot.test.ts`
behauptet zwischen `hart` und `normal` deshalb keine Reihenfolge mehr, sondern
hält nur noch fest, dass der Abstand kein Absturz ist.

**8. Nicht ganz jede dritte Partie steht zur Halbzeit fest** (30,6 % zu viert,
mit 20 Leben 36,7 %, mit 100 Leben 43,0 %). Für einen Auto-Battler nicht
ungewöhnlich — wer früh gewinnt, hat mehr Gold —, und mit jeder Verkürzung ist
es nicht schlimmer geworden, sondern besser: Ein Vorsprung hat weniger Zeit,
sich zu einer Vorentscheidung auszuwachsen.

**Was NICHT auffiel:** Keine Partie endete vor Runde fünf (die kürzeste lief
8 Runden), keine an der Rundengrenze, jede der 5.000 hatte einen eindeutigen
Sieger, jede der 22 Einheiten wurde aufgestellt, und jede der sieben Marken
erreichte ihre erste Schwelle. Genau diese Punkte hält die Probe fest.
