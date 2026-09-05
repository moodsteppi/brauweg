# Tafelrunde: wie lange eine Partie dauert

**Stand: 05.09.2026.** Robins Vorgabe: Das Vorbild (Merge Tactics) dauert 5 bis
6 Minuten, unser Ziel ist „durchschnittlich 8 Minuten maximum".

Diese Datei beantwortet zwei Fragen, und die Reihenfolge ist wichtig:
**woraus** die Spielzeit besteht, und **welche Stellschraube wie viel bringt**.
Ohne die erste Antwort dreht man an der falschen Schraube.

Nachrechnen:

```bash
npm run build --workspace @brauweg/game-tafelrunde
node packages/game-tafelrunde/werkzeug/spielzeit.mjs --partien 500
```

Alle Zahlen unten stammen aus genau diesem Aufruf (Saatbasis `spielzeit-v1`,
500 Partien je Zeile, zu viert, Besetzung `normal`). Jede Zeile rechnet
dieselben 500 Saaten — ein Unterschied zwischen zwei Zeilen ist die Wirkung
der Schraube und nicht die Wirkung anderer Würfel.

---

## 1. Woraus die Spielzeit besteht

| Stück | Zeit je Partie | Anteil |
| --- | --- | --- |
| Vorbereitung (geschätzt) | 3:25 | 25,2 % |
| **Kampf (gemessen)** | **9:33** | **70,3 %** |
| Nachlauf (gemessen) | 0:37 | 4,5 % |
| zusammen | 13:35 | 100 % |

Median über die Partien: **13:31** bei 15 Runden.

**Der Kampf ist der ganze Kuchen.** Wer an der Vorbereitung dreht, dreht an
einem Viertel; wer den Kampf halbiert, spart mehr als ein Drittel der Partie.

### Was gemessen ist und was geschätzt

* **Kampf und Nachlauf sind Zahlen, keine Annahmen.** Die Kampfphase dauert so
  lange wie der längste Kampf der Runde (`kampfdauer` in `partie.ts`), und
  genau so lange läuft die Schaupause der Plattform (`interludeMs` im
  Adapter). Der Nachlauf sind die 2,5 Sekunden aus `KAMPF_NACHLAUF_MS`.
* **Die Vorbereitung ist ein Modell** (`Zeitmodell` in `test/messen.ts`): 5
  Sekunden Grundzeit plus 1,5 Sekunden je Handgriff, gedeckelt bei der Zugzeit
  der Plattform (60 s). Sie **kann** nicht gemessen werden — im Messstand
  sitzen nur Bots, und die sind sofort bereit. Die Phase endet, wenn der
  **letzte** Sitz „Bereit" tippt, deshalb zählt der fleißigste und nicht der
  Durchschnitt. Über die 6 Handgriffe, die der fleißigste Sitz im Median macht
  (Mittel 5,9, Höchstwert 19), ergibt das rund 14 Sekunden je Runde.

### Der Kampf dauert doppelt so lange, wie im Code steht

Der wichtigste Nebenbefund. `HOECHSTDAUER_MS` in `kampf.ts` trug bis heute die
Begründung: „Median 17 s, bei 45 s werden rund 2 bis 4 Prozent abgeschnitten."
Auf Brettern aus **echten** Partien stimmt beides nicht:

| | zufällig besetzte Bretter | Bretter aus echten Partien |
| --- | --- | --- |
| Kampf im Median | 17 s | **35,2 s** |
| an der Höchstdauer abgeschnitten | 2–4 % | **27,7 %** |

Der Grund ist die Messung, nicht das Spiel: Die Probe in `test/kampf.test.ts`
besetzt die Bretter gleichverteilt aus dem Katalog, fast alles Stufe 1, keine
Marken, die zusammenpassen. Ein Bot kauft aber das Beste, verschmilzt auf Stufe
2 und 3 und sammelt Marken, deren Boni Leben und Rüstung dazulegen. Solche
Bretter halten einander doppelt so lange aus.

Damit entscheidet heute **jeder dritte Kampf** nicht am Brett, sondern in
`entscheideNachZeit`. Das ist ein eigener Befund, unabhängig von der Spielzeit:
Die Abbruchgrenze ist vom Rettungsseil zum Regelfall geworden. Seit heute misst
`test/spielzeit.test.ts` den Anteil auf echten Brettern mit; die Probe in
`kampf.test.ts` bleibt daneben stehen und sagt jetzt dazu, worüber sie
**nicht** aussagt.

---

## 2. Jede Stellschraube einzeln

Gemessen wurde jede für sich, ausgehend vom gebauten Stand. „Marken" ist die
Spanne der Siegquoten-Faktoren zum Schnitt (nur Marken mit mindestens 100
Antritten); die Schranke, ab der es kaputt wäre, liegt bei x0,5 bis x2.

| Stellschraube | Wert | Spielzeit | zu heute | Runden | Kampf | Abbruch | Sieger | Marken |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **wie gebaut** | – | **13:31** | – | 15 | 35,2 s | 27,7 % | 100 % | x0,74–1,09 |
| Startleben | 16 | 11:16 | −16,7 % | 12 | 33,9 s | 25,9 % | 100 % | x0,74–1,22 |
| Startleben | 14 | 10:09 | −24,9 % | 11 | 32,6 s | 24,6 % | 100 % | x0,73–1,22 |
| Startleben | 12 | 8:53 | −34,3 % | 10 | 32,2 s | 22,5 % | 100 % | x0,74–1,18 |
| Startleben | 10 | **7:33** | −44,1 % | 8 | 30,7 s | 20,8 % | 100 % | x0,70–1,34 |
| Schadensteiler | 2 | 12:20 | −8,8 % | 13 | 34,1 s | 26,8 % | 100 % | x0,75–1,12 |
| Schadensteiler | 1 | 8:47 | −35,0 % | 10 | 31,7 s | 21,6 % | 100 % | x0,68–1,28 |
| Vorbereitung höchstens | 25 s | 13:31 | −0,0 % | 15 | 35,2 s | 27,7 % | 100 % | x0,74–1,09 |
| Vorbereitung höchstens | 20 s | 13:27 | −0,5 % | 15 | 35,2 s | 27,7 % | 100 % | x0,74–1,09 |
| Vorbereitung höchstens | 15 s | 13:12 | −2,4 % | 15 | 35,2 s | 27,7 % | 100 % | x0,74–1,09 |
| Vorbereitung höchstens | 10 s | 12:27 | −8,0 % | 15 | 35,2 s | 27,7 % | 100 % | x0,74–1,09 |
| Takt | 50 ms | 13:27 | −0,5 % | 15 | 34,0 s | 26,2 % | 100 % | x0,78–1,11 |
| Takt | 25 ms | 13:24 | −0,9 % | 15 | 33,8 s | 26,1 % | 100 % | x0,74–1,10 |
| Zeitraffer | x1,25 | 12:32 | −7,3 % | 15 | 28,1 s | 14,5 % | 100 % | x0,80–1,14 |
| Zeitraffer | x1,5 | 11:30 | −14,9 % | 15 | 24,2 s | 8,0 % | 100 % | x0,77–1,13 |
| Zeitraffer | x2 | 9:58 | −26,3 % | 15 | 18,3 s | 1,6 % | 100 % | x0,79–1,13 |

**Sieger und Ausgewogenheit halten überall.** Keine der Zeilen verliert einen
eindeutigen Sieger, keine Partie endet an der Rundengrenze oder vor Runde
fünf, und keine Marke verlässt die Spanne x0,5 bis x2.

### Was jede Schraube wirklich tut

**1. Weniger Startleben** wirkt am direktesten und ist die einzige Schraube,
die das Ziel allein erreicht (10 Leben → 7:33). Sie kauft die Zeit aber
ausschließlich über die Rundenzahl: acht Runden sind das, was Robin und die
Regeldatei bisher als zu wenig angesehen haben — vor Runde 10 steht kein
ausgebautes Brett, die Schwelle 4 wird noch seltener erreicht als heute, und
die Markenspanne wird mit x0,70–1,34 spürbar unruhiger, weil weniger Antritte
zusammenkommen. Bei 14 bis 16 Leben ist der Effekt sauber und die Partie
bleibt ausgebaut.

**2. Mehr Schaden je Niederlage** (`SCHADEN_STUFEN_TEILER`) wirkt genauso über
die Rundenzahl, aber weniger fein: Zwischen Teiler 3 (15 Runden) und Teiler 2
(13) liegen nur 9 %, zwischen 2 und 1 dagegen 26 %. Die Schraube hat drei
brauchbare Stellungen, und die mittlere bringt kaum etwas. Für ein Feintuning
ist sie zu grob.

**3. Kürzere Vorbereitung bringt fast nichts** — und das ist die Erkenntnis,
die am meisten Arbeit spart. Selbst ein harter Countdown von 10 Sekunden
schneidet nur 8 % der Spielzeit ab, weil die Vorbereitung schon heute im
Median bei rund 14 Sekunden liegt; ein Deckel von 25 oder 20 Sekunden ist
messbar wirkungslos. Dazu kommt: **Diesen Countdown gibt es gar nicht.** Die
Plattform kennt nur `turnTimeoutMs` (60 s), und Tafelrunde hat keine eigene
Vorbereitungsfrist. Die Schraube kostet also Arbeit in Server und Client und
zahlt am wenigsten zurück.

**4a. Ein feinerer Takt bringt nichts** (−0,5 % bei 50 ms, −0,9 % bei 25 ms).
`TAKT_MS` ist die Auflösung der Rechnung, nicht das Tempo: Ein feinerer Takt
lässt einen Angriff ein paar Millisekunden früher fällig werden und sonst
nichts. Wer den Kampf beschleunigen will, muss am Tempo drehen, nicht an der
Auflösung.

**4b. Der Zeitraffer** ist genau diese Schraube und die interessanteste der
vier: `Kampfregler.zeitraffer` beschleunigt Angriffstempo **und** Schrittweite
zusammen. Er kürzt nicht nur die Partie (x2 → −26 %), sondern repariert
nebenbei den Befund von oben: Der Kampf fällt von 35,2 s auf 18,3 s — genau in
die 15 bis 20 Sekunden, die das Konzept nennt — und der Anteil der
abgeschnittenen Kämpfe von 27,7 % auf 1,6 %. Die Abbruchgrenze wird wieder
das, was sie sein soll.

**Achtung, der Zeitraffer ändert die Anzeige mit.** Die Oberfläche spielt das
Ablaufprotokoll in Echtzeit ab; bei x2 laufen und schlagen die Figuren am
Bildschirm doppelt so schnell. Das ist gewollt — aber es ist eine Frage, die
man ansehen muss und nicht nur ausrechnen kann.

---

## 3. Kombinationen

Keine einzelne Schraube erreicht die acht Minuten, ohne etwas anderes zu
opfern. Diese Zeilen drehen deshalb an zweien gleichzeitig — sie sind
ausdrücklich als Kombination gekennzeichnet und ersetzen die Tabelle oben
nicht.

| Kombination | Spielzeit | zu heute | Runden | Kampf | Abbruch | Sieger | Marken |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Zeitraffer x1,5 + Teiler 2 | 10:28 | −22,6 % | 14 | 24,1 s | 8,4 % | 100 % | x0,77–1,15 |
| Zeitraffer x2 + Teiler 2 | 9:00 | −33,4 % | 14 | 18,3 s | 1,8 % | 100 % | x0,77–1,16 |
| Zeitraffer x1,5 + Startleben 14 | 8:36 | −36,4 % | 11 | 22,9 s | 8,2 % | 100 % | x0,66–1,28 |
| Zeitraffer x1,5 + Startleben 12 | 7:42 | −43,0 % | 10 | 22,6 s | 8,0 % | 100 % | x0,69–1,29 |
| **Zeitraffer x2 + Startleben 16** | **8:13** | −39,2 % | 12 | 17,7 s | 1,8 % | 100 % | x0,77–1,27 |
| **Zeitraffer x2 + Startleben 14** | **7:25** | −45,1 % | 11 | 17,3 s | 1,8 % | 100 % | x0,71–1,30 |

**Gegenprobe mit einer zweiten Saatbasis** (`--saat spielzeit-v2`, wieder 500
Partien je Zeile): 13:24 statt 13:31 für den gebauten Stand, **7:23** statt
7:25 für die letzte Zeile. Die Tabelle hängt also nicht an diesen 500 Würfen.

---

## 4. Empfehlung

**Zeitraffer x2 und Startleben 14.** Das ergibt 7:25 im Median bei 11 Runden,
lässt jede Partie mit einem eindeutigen Sieger enden und hält jede Marke
zwischen dem 0,71- und 1,30-fachen des Schnitts. Der einzelne Kampf landet bei
17,3 Sekunden und damit erstmals in der Spanne, die das Konzept nennt; der
Anteil der von der Uhr entschiedenen Kämpfe fällt von 27,7 % auf 1,8 %.

Der Zeitraffer ist dabei die Schraube, an der man zuerst drehen sollte, weil
er als einziger **keine Runde streicht**: Man baut weiterhin ein Brett auf, es
fällt nur die Zeit weg, in der man zusieht, wie zwei Wachen einander nicht
umbringen. Die Startleben sind der Feinregler daneben. **An der Vorbereitung
und an `TAKT_MS` sollte niemand Arbeit investieren** — zusammen bringen sie
unter einem Zehntel, und die Vorbereitungsfrist müsste erst gebaut werden.

Wer x2 am Bildschirm zu hektisch findet, nimmt x1,5 und dafür 12 Startleben:
7:42 bei 10 Runden, gemessen. Das kostet aber zwei Dinge — eine Runde weniger
als die Empfehlung, und 8 % der Kämpfe laufen weiter in die Uhr statt 1,8 %.

### Eine Warnung dazu: das Balancing verschiebt sich

Volle Ausgewogenheits-Tabelle für die Empfehlung, 1500 Partien zu viert
(`node werkzeug/ausgewogenheit.mjs --partien 1500 --sitze 4 --zeitraffer 2
--leben 14`), gegen denselben Lauf ohne Schalter:

| Marke | heute | mit der Empfehlung |
| --- | --- | --- |
| Krieger | x1,10 | **x1,34** |
| Wächter | x1,02 | x1,13 |
| Naturwesen | x1,12 | x0,99 |
| Meuchler | x0,80 | x0,78 |
| Elementar | x0,87 | x0,76 |
| Drache / Untot | zu dünn | zu dünn |

Alles bleibt innerhalb der Schranken, aber der **Krieger zieht an**, und das ist
kein Zufall: Wenn 27 % der Kämpfe nicht mehr von der Uhr entschieden werden,
gewinnt das Brett, das sonst auf Zeit gespielt hätte, jetzt richtig. Die
Empfehlung ist damit keine reine Zeitänderung — wer sie einbaut, misst danach
den Katalog neu. Der bereits offene Punkt „die Schwellen 4 und 6 sind praktisch
unerreichbar" wird durch die kürzere Partie außerdem **schlechter**: Bei 11
statt 15 Runden kommt noch seltener jemand auf Level 6.

### Was hier NICHT entschieden ist

Diese Aufgabe hat gemessen, nicht umgebaut. Im Code steht weiterhin der alte
Stand: `startLeben: 20` in `regeln.ts`, `zeitraffer: 1` in `STANDARD_REGLER`.
Der `Kampfregler` ist ausschließlich das Werkzeug, mit dem man die Tabellen
oben rechnet — er ist bewusst **kein** Teil von `TafelrundeRegeln`, weil der
Regelsatz als JSON von außen kommt und ein selbstgebauter Tisch sich sonst
einen Zeitraffer von 10 einstellen könnte.

Wer die Empfehlung übernimmt, hat es kurz: `zeitraffer: 2` in
`STANDARD_REGLER` (kampf.ts) und `startLeben: 14` in `DEFAULT_REGELN`
(regeln.ts). Der Regler steckt bereits überall dort, wo die Konstanten früher
standen; ihn auf einen anderen Standardwert zu setzen ist deshalb eine Zeile
und kein Umbau. Danach beide Werkzeuge laufen lassen:
`werkzeug/spielzeit.mjs` für die Zeit und `werkzeug/ausgewogenheit.mjs` für
die Siegquoten. Letzteres nimmt dieselben Stellschrauben als Schalter
(`--leben`, `--teiler`, `--zeitraffer`, `--takt`), damit man einen Vorschlag
ansehen kann, bevor man ihn einbaut.
