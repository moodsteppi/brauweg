# Tafelrunde: wie lange eine Partie dauert

**Stand: 05.09.2026.** Robins Vorgabe: Das Vorbild (Merge Tactics) dauert 5 bis
6 Minuten, unser Ziel ist „durchschnittlich 8 Minuten maximum".

> **DIE EMPFEHLUNG IST EINGEBAUT (05.09.2026).** `zeitraffer: 2` steht in
> `STANDARD_REGLER` (`kampf.ts`) und `startLeben: 12` in `DEFAULT_REGELN`
> (`regeln.ts`). Die Kopie `REGELSATZ` im Client, die es damals ein zweites
> Mal brauchte, gibt es **seit dem 05.09.2026 nicht mehr**: Der Bildschirm
> lässt `config` weg, der Server setzt `defaultConfig()` ein. Wer heute an
> diesen Zahlen dreht, fasst nur noch das Modul an.
>
> **DER HEUTIGE STAND STEHT NICHT MEHR IN DIESER DATEI**, sondern in
> `docs/spiele/auto-battler-konzept.md` unter „Gemessen: Ausgewogenheit
> (sechste Messung)". Diese Datei hält die Untersuchung fest, die zu der
> Entscheidung geführt hat, und die Zwischenstände danach — sie ist die
> Vorgeschichte und keine Beschreibung von heute.
>
> Was seitdem passiert ist, in zwei Sätzen: Am Abend des 05.09.2026 hat der
> Bot ein echtes Markengewicht bekommen (`heerStaerke` in `bot.ts`), und weil
> er seitdem stärkere Bretter baut, die länger kämpfen, wuchs die Partie von
> 7:27 auf 8:25. Zurückgeholt hat das Robins Entscheidung, die Startleben von
> 14 auf **12** zu senken: **7:23 im Median bei 9 Runden**, einzelner Kampf
> 20,2 s, 9,5 % der Kämpfe von der Uhr entschieden.
>
> Zum Weiterlesen in dieser Datei: Abschnitt 6 ist der Stand mit 14 Leben und
> allen vier Zahlen des Vormittags (7:34 bei 10 Runden, 17,6 s, 4,6 %),
> Abschnitt 5 der Zwischenschritt davor (7:25 bei 11 Runden, 1,8 %), alles
> darüber beschreibt den Stand mit 20 Leben.

Diese Datei beantwortet zwei Fragen, und die Reihenfolge ist wichtig:
**woraus** die Spielzeit besteht, und **welche Stellschraube wie viel bringt**.
Ohne die erste Antwort dreht man an der falschen Schraube.

Nachrechnen:

```bash
npm run build --workspace @brauweg/game-tafelrunde
node packages/game-tafelrunde/werkzeug/spielzeit.mjs --partien 500
```

Alle Zahlen in den Abschnitten 1 bis 4 stammen aus genau diesem Aufruf
(Saatbasis `spielzeit-v1`, 500 Partien je Zeile, zu viert, Besetzung
`normal`) — **vor** dem Einbau der Empfehlung. Wer ihn heute startet,
bekommt die Tabelle aus Abschnitt 6, weil „wie gebaut" inzwischen die
Empfehlung samt Ladenregel ist. Jede Zeile rechnet dieselben 500 Saaten — ein Unterschied zwischen zwei Zeilen ist die Wirkung
der Schraube und nicht die Wirkung anderer Würfel.

---

## 1. Woraus die Spielzeit bestand

Der Stand **vor** der Änderung — die Zerlegung, aus der die Empfehlung folgt:

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
  Sekunden Grundzeit plus 1,5 Sekunden je Handgriff, gedeckelt bei der
  Rundenfrist des Regelsatzes (`vorbereitungMs`, 45 s — bis zum 06.09.2026
  stand dort die Zugzeit der Plattform, 60 s, weil es keine eigene Frist gab).
  Am gemessenen Ergebnis ändert der neue Deckel nichts: Die längste
  Vorbereitung im Bestand sind 39,5 s, er greift also in keiner einzigen
  gemessenen Runde. Sie **kann** nicht gemessen werden — im Messstand
  sitzen nur Bots, und die sind sofort bereit. Die Phase endet, wenn der
  **letzte** Sitz „Bereit" tippt, deshalb zählt der fleißigste und nicht der
  Durchschnitt. Über die 6 Handgriffe, die der fleißigste Sitz im Median macht
  (Mittel 5,9, Höchstwert 19), ergibt das rund 14 Sekunden je Runde.

### Der Kampf dauerte doppelt so lange, wie im Code stand

Der wichtigste Nebenbefund — und der Grund, warum die Wahl am Ende auf den
Zeitraffer fiel. `HOECHSTDAUER_MS` in `kampf.ts` trug die Begründung: „Median
17 s, bei 45 s werden rund 2 bis 4 Prozent abgeschnitten." Auf Brettern aus
**echten** Partien stimmte beides nicht:

| | zufällig besetzte Bretter | Bretter aus echten Partien |
| --- | --- | --- |
| Kampf im Median | 17 s | **35,2 s** |
| an der Höchstdauer abgeschnitten | 2–4 % | **27,7 %** |

Der Grund ist die Messung, nicht das Spiel: Die Probe in `test/kampf.test.ts`
besetzt die Bretter gleichverteilt aus dem Katalog, fast alles Stufe 1, keine
Marken, die zusammenpassen. Ein Bot kauft aber das Beste, verschmilzt auf Stufe
2 und 3 und sammelt Marken, deren Boni Leben und Rüstung dazulegen. Solche
Bretter halten einander doppelt so lange aus.

Damit entschied **jeder dritte Kampf** nicht am Brett, sondern in
`entscheideNachZeit`. Das war ein eigener Befund, unabhängig von der Spielzeit:
Die Abbruchgrenze war vom Rettungsseil zum Regelfall geworden. `test/spielzeit.test.ts`
misst den Anteil auf echten Brettern seitdem mit; die Probe in `kampf.test.ts`
steht daneben und sagt dazu, worüber sie **nicht** aussagt.

**Erledigt ist das mit dem Zeitraffer**, nicht mit einer neuen Grenze: erst
1,8 % statt 27,7 % (Abschnitt 5), mit der Ladenregel dazu 4,6 % (Abschnitt 6).
Die Begründung an `HOECHSTDAUER_MS` sagt
seitdem ausdrücklich, dass ihre 17 Sekunden am Zeitraffer hängen — wer ihn auf
1 zurückstellt, holt den alten Zustand mit zurück.

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
ausgebautes Brett, die mittlere Marken-Schwelle wird noch seltener erreicht
als heute (die Schwellen liegen seit dem 05.09.2026 bei 2/3/5, siehe
`synergien.ts`), und
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
messbar wirkungslos. Dazu kam damals: **Diesen Countdown gibt es gar nicht.**
Die Plattform kannte nur `turnTimeoutMs` (60 s), und Tafelrunde hatte keine
eigene Vorbereitungsfrist. Die Schraube kostete also Arbeit in Server und
Client und zahlte am wenigsten zurück.

> **Nachtrag 06.09.2026:** Die Frist ist inzwischen gebaut — `vorbereitungMs`
> im Regelsatz, getragen von `phaseMs` / `advancePhase` in `GameModule`. Sie
> steht auf **45 s** und ist damit ausdrücklich **keine** Zeitschraube: Sie
> liegt über der längsten gemessenen Vorbereitung (39,5 s) und schneidet
> deshalb nichts ab. Gebaut wurde sie, weil am Bildschirm keine Restzeit stand
> und ein Tisch auf jemanden warten konnte, der nicht mehr hinsieht. Wer sie
> als Zeitschraube benutzen will, hat mit dieser Tabelle die Zahlen dafür —
> und nimmt jemandem den Kauf weg, den er gerade tippt.

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

## 4. Empfehlung — von Robin angenommen

> Historisch. Die Empfehlung wurde am 05.09.2026 vormittags angenommen und
> eingebaut; am Abend desselben Tages sind die Startleben noch einmal von 14
> auf **12** gesenkt worden (Begründung im Kasten ganz oben). Der Zeitraffer
> steht unverändert auf 2.

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
(Sie ist es seit dem 06.09.2026, aber als Deckel über der längsten Runde und
nicht als Zeitschraube — siehe den Nachtrag in Abschnitt 4.)

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

### Was hier nicht mitentschieden wurde

Der **Kampfregler bleibt Werkzeug** und wird nicht Teil von `TafelrundeRegeln`.
Geändert hat sich nur sein Standardwert. Der Regelsatz kommt als JSON von außen
an den Tisch; stünde der Zeitraffer darin, könnte sich ein selbstgebauter Tisch
eine 10 einstellen und säße vor einem Kampf, den niemand sehen kann.

---

## 5. Was eingebaut wurde — und was danach herauskam

> **Dieser Abschnitt beschreibt den Stand vom 05.09.2026 mittags, also VOR der
> Ladenregel** (kostenloses Neu-Würfeln, ein Kauf zieht den ganzen Laden neu).
> Beides ist am selben Tag entstanden, auf zwei getrennten Zweigen, und war
> beim Zusammenführen zum ersten Mal gleichzeitig aktiv. Die Zahlen für den
> heutigen Stand stehen in **Abschnitt 6**; die hier sind der Zwischenschritt
> und bleiben stehen, weil sie zeigen, was der Zeitraffer allein bewirkt hat.

Am 05.09.2026 übernommen, drei Zeilen:

| Datei | Zeile | vorher | nachher |
| --- | --- | --- | --- |
| `packages/game-tafelrunde/src/kampf.ts` | `STANDARD_REGLER.zeitraffer` | 1 | **2** |
| `packages/game-tafelrunde/src/regeln.ts` | `DEFAULT_REGELN.startLeben` | 20 | **14** |
| `packages/client/src/screens/Tafelrunde.tsx` | `REGELSATZ.startLeben` | 20 | **14** |

Die dritte war keine Kosmetik: `REGELSATZ` war eine ausgeschriebene Kopie von
`DEFAULT_REGELN` und wurde als `config` an `createTable` **mitgeschickt**.
Wäre sie auf 20 stehen geblieben, hätte jeder über den Bildschirm eröffnete
Tisch weiter mit 20 Leben gespielt, und die Änderung wäre nur in den
Messwerkzeugen angekommen.

**Diese Zeile gibt es nicht mehr** (noch am 05.09.2026): Der Bildschirm
schickt keine `config` mehr, und der Server setzt dann `defaultConfig()` des
Moduls ein (`packages/server/src/tables/service.ts`). Eine Änderung an
`DEFAULT_REGELN` erreicht damit jeden Tisch von selbst; die Tabelle oben
hätte heute zwei Zeilen statt drei.

### Spielzeit, gemessen

`node packages/game-tafelrunde/werkzeug/spielzeit.mjs --partien 500`, dieselbe
Saatbasis `spielzeit-v1` wie oben:

| | vorher | nachher | Vorhersage aus Abschnitt 3 |
| --- | --- | --- | --- |
| Spielzeit im Median | 13:31 | **7:25** | 7:25 |
| Runden im Median | 15 | **11** | 11 |
| einzelner Kampf im Median | 35,2 s | **17,3 s** | 17,3 s |
| von der Uhr entschieden | 27,7 % | **1,8 %** | 1,8 % |
| Markenspanne | ×0,74–1,09 | **×0,71–1,30** | ×0,71–1,30 |
| Partien mit eindeutigem Sieger | 100 % | **100 %** | 100 % |

Die Vorhersage traf auf die Sekunde — sie musste, denn die Zeile „Zeitraffer x2
+ Startleben 14" aus Abschnitt 3 rechnet dieselben 500 Saaten mit denselben
Werten. Die Zeile ist damit keine Bestätigung, sondern eine Gegenprobe darauf,
dass die Werte auch wirklich dort angekommen sind, wo die Partie sie liest.

Die Zerlegung verschiebt sich mit:

| Stück | vorher | nachher |
| --- | --- | --- |
| Vorbereitung (geschätzt) | 3:25 (25,2 %) | 2:44 (36,5 %) |
| Kampf (gemessen) | 9:33 (70,3 %) | **4:18 (57,4 %)** |
| Nachlauf (gemessen) | 0:37 (4,5 %) | 0:28 (6,2 %) |

Der Kampf bleibt der größte Posten, aber knapper. **Die Aussage „an der
Vorbereitung lohnt sich keine Arbeit" gilt damit weniger deutlich als vorher**:
Ihr Anteil ist von einem Viertel auf gut ein Drittel gestiegen, weil der andere
Posten kleiner wurde und nicht, weil sie länger geworden wäre. Ein harter
Countdown von 10 Sekunden bringt jetzt 13 % statt 8 %. Eine Frist gibt es seit
dem 06.09.2026 (`vorbereitungMs`), aber mit 45 s über jeder gemessenen Runde —
als harter Countdown müsste sie erst kurz gestellt werden.

### Ausgewogenheit, gemessen

**Hier stehen zwei Läufe, und lange stand nur einer davon da.** Die Tabelle
kommt aus 1.500 Partien, die beiden Nebenbefunde darunter aus 5.000 — beide
Angaben stimmen, keine ist ein Tippfehler. Die Gegenprobe dazu steht unter den
Nebenbefunden.

Der Lauf zur Tabelle:
`node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 1500
--sitze 4`, Saatbasis `ausgewogenheit-v1`, gegen denselben Lauf mit
`--leben 20 --zeitraffer 1`:

| Marke | vorher | nachher |
| --- | --- | --- |
| Krieger | ×1,12 | **×1,30** |
| Wächter | ×1,07 | ×1,17 |
| Naturwesen | ×1,09 | ×0,94 |
| Meuchler | ×0,78 | ×0,81 |
| Elementar | ×0,78 | ×0,78 |
| Drache | ×1,16 (111 Antritte) | zu dünn (59) |
| Untot | zu dünn (17) | zu dünn (7) |

**Die Spanne bleibt mit ×0,78 bis ×1,30 innerhalb der Schranke ×0,5 bis ×2 —
deshalb wurde am Katalog nichts geändert.** Der Krieger zieht wie vorhergesagt
an, und aus dem vorhergesagten Grund: Wo vorher jeder dritte Kampf an der Uhr
entschieden wurde, gewinnt jetzt das Brett, das sonst auf Zeit gespielt hätte.
Die Vorhersage aus Abschnitt 4 lautete ×1,34 für den Krieger, gemessen sind es
×1,30; sie stammte aus einem Lauf mit anderer Grundlage und liegt entsprechend
leicht daneben.

> **Welche Grundlage das war, steht hier nicht mehr richtig (06.09.2026).**
> Bis heute stand an dieser Stelle „vor dem kostenlosen Neu-Würfeln". Das kann
> es nicht sein: Die Ladenregel kam mit `625f626` und damit **nach** beiden
> Läufen — die Vorhersage steht schon in `fcae0fd`, und die ×1,30 dieser
> Tabelle sind auf genau demselben `fcae0fd` Zeile für Zeile nachgestellt
> worden. Beide Zahlen sind also vor der Ladenregel gemessen. Woran die vier
> Hundertstel wirklich liegen, ist offen und steht als Karte auf dem Board;
> geraten wird es hier nicht.

Zwei Nebenbefunde, beide **nicht** durch diese Änderung verursacht, aber durch
sie sichtbar geworden. Sie stammen aus dem **zweiten, größeren Lauf** —
`--partien 5000 --sitze 4 --mindest 150`, sonst alles gleich —, und deshalb
nennen sie andere Antrittszahlen als die Tabelle oben. Der große Lauf war
nötig, weil genau diese Zeilen im kleinen zu dünn bleiben: Über 1.500 Partien
tritt der Drache 59-mal an, der Untote 7-mal, und der Moosheiler kommt in der
Vorher-Spalte auf 60 — Zahlen, aus denen sich keine Quote ablesen lässt:

* **Drache und Untot sind noch dünner geworden** (204 bzw. 32 Antritte über
  5.000 Partien, vorher 394 und 65). Beide haben dafür schon eine Karte auf dem
  Board; die kürzere Partie macht es schlimmer, nicht anders.
* **Der Moosheiler steht jetzt über der Mindestzahl und liegt bei ×0,15**
  (541 Antritte über 5.000 Partien, vorher 237 und ×0,25). Er wird häufiger
  aufgestellt, weil in elf Runden seltener ein ausgebautes Brett steht — und
  gewinnt praktisch nie. Die Ursache ist bekannt und unverändert: Heilen gibt
  es in `kampf.ts` noch gar nicht.

**Nachgerechnet am 06.09.2026** (Karte „TAFELRUNDE-SPIELZEIT.md Abschnitt 5:
Aufruf und zitierte Zahlen passen nicht zusammen"). Beide Läufe wurden mit
beiden Partienzahlen wiederholt; sie treffen ihre Zeile jeweils auf den
Antritt:

| | 1.500 Partien | 5.000 Partien |
| --- | --- | --- |
| Drache | 111 → 59 *(Tabelle)* | 394 → 204 *(Nebenbefund)* |
| Untot | 17 → 7 *(Tabelle)* | 65 → 32 *(Nebenbefund)* |
| Moosheiler | 60 → 156 | 237 (×0,25) → 541 (×0,15) *(Nebenbefund)* |

Die ×0,25 des Moosheilers gibt es dabei nur mit `--mindest 150`; mit der
Vorgabe 100 stünde dort ×0,24. **Nachstellen lässt sich das nur auf dem Stand
dieses Abschnitts** — Zweigbasis `fcae0fd` mit `--leben 14 --zeitraffer 2` für
die Nachher-Spalte und ohne Schalter für die Vorher-Spalte. Auf `bdb50c1`,
also nach dem Zusammenführen mit der Ladenregel, wirft derselbe Aufruf ganz
andere Antritte aus (Drache 8, Untot 9 über 1.500 Partien), und auf dem
heutigen Bot erst recht. Das ist kein Widerspruch, sondern der Grund für
Abschnitt 6.

### Was die Änderung an den Proben geändert hat

Fünf Proben in `game-tafelrunde` hingen am alten Standard und mussten
nachgezogen werden. Vier davon rechnen seitdem gegen einen ausdrücklich
ungerafften Regler (`UNGERAFFT` in `kampf.test.ts` und `spielzeit.test.ts`) —
sie prüfen die **Wirkung** des Reglers, und die ist gegen den Standard nicht
mehr messbar, wenn der Standard selbst x2 ist.

Die fünfte ist ein Befund und keine Anpassung: **Die Gangart `hart` schlägt
`normal` nicht mehr.** Über 400 Partien zu viert steht es 77 : 107,7 gegen den
harten Sitz (vorher 119 : 94 für ihn); gegen `sanft` kommt `hart` auf 223 : 59,
`normal` dagegen auf 267 : 44. Der aggressive Ausbau von `hart` braucht Runden,
die es nicht mehr gibt — derselbe Effekt, der beim Wechsel von 100 auf 20 Leben
schon das Duell zu zweit gekippt hat. Die Probe in `bot.test.ts` behauptete
daraufhin keine Reihenfolge mehr, sondern hielt nur noch fest, dass der Abstand
kein Absturz ist; repariert war nichts, es ging als eigene Karte auf das Board.

**Diese Erklärung war falsch, und Abschnitt 6 sagt, warum** — es lag nicht an
den fehlenden Runden, sondern an der Ladenregel, die auf diesem Stand noch die
alte war. Der Absatz bleibt trotzdem stehen: Er ist das, was an diesem Tag
gemessen und geschlossen wurde.

---

## 6. Nachgemessen, als die Ladenregel dazukam

Der Zweig mit Zeitraffer und 14 Startleben wartete auf die Freigabe, während
auf `staging` eine zweite Änderung landete: **Neu-Würfeln kostet nichts mehr,
und ein Kauf zieht den ganzen Laden neu** (`neuwuerfelnKosten` auf 0,
`fuelleLaden` in `partie.ts`). Beide Seiten waren gemessen, aber jede nur für
sich: der Zeitraffer mit dem alten Laden, die Ladenregel ohne Zeitraffer und
mit 20 Leben. Seit dem Zusammenführen sind alle vier Zahlen gleichzeitig aktiv,
und **dieser Zustand ist von keiner der beiden Messungen abgedeckt**. Deshalb
hier derselbe Lauf noch einmal.

`node packages/game-tafelrunde/werkzeug/spielzeit.mjs --partien 500`, dieselbe
Saatbasis `spielzeit-v1` wie in allen Abschnitten davor:

| | vor allem (20 Leben, x1) | nur Zeitraffer + 14 Leben | **jetzt (alle vier)** |
| --- | --- | --- | --- |
| Spielzeit im Median | 13:31 | 7:25 | **7:34** |
| Runden im Median | 15 | 11 | **10** |
| einzelner Kampf im Median | 35,2 s | 17,3 s | **17,6 s** |
| von der Uhr entschieden | 27,7 % | 1,8 % | **4,6 %** |
| Markenspanne | ×0,74–1,09 | ×0,71–1,30 | **×0,85–1,26** |
| Partien mit eindeutigem Sieger | 100 % | 100 % | **100 %** |

**Die Spielzeit bleibt bei rund siebeneinhalb Minuten und damit unter Robins
Ziel von acht.** Neun Sekunden mehr als vorhergesagt, dafür eine Runde weniger:
Die Ladenregel kürzt die Partie (ein Brett steht schneller, wenn der Laden
nichts kostet und bei jedem Kauf frisch ist), verlängert aber den einzelnen
Kampf, weil die Bretter besser besetzt sind. Beides zusammen hebt sich fast
auf.

**Die Zeile, die wirklich gewandert ist, ist die vierte.** Von der Uhr
entschiedene Kämpfe steigen von 1,8 % auf 4,6 % — immer noch weit weg von den
27,7 %, die den Zeitraffer überhaupt ausgelöst haben, aber die Richtung ist die
falsche, und die Ursache ist verstanden: Zwei starke Bretter brauchen länger
als zwei schwache. Wer die Bretter noch einmal stärker macht, sieht hier
zuerst, was es kostet.

Die Markenspanne ist **enger** geworden (×0,85–1,26 statt ×0,71–1,30), aber die
Zeile darunter ist es nicht: Der Krieger steht in der großen Messung über 5.000
Partien auf **×1,32** und auf einer zweiten Saatbasis auf ×1,37 — dichter an
der Kante von ×1,4 als je zuvor. Die Spanne dieser Tabelle stammt aus 500
Partien und ist die schwächere Stichprobe; maßgeblich ist die Tabelle in
`docs/spiele/auto-battler-konzept.md`.

### Die Zerlegung

| Stück | vor allem | nur Zeitraffer | **jetzt** |
| --- | --- | --- | --- |
| Vorbereitung (geschätzt) | 3:25 (25,2 %) | 2:44 (36,5 %) | **2:43 (35,8 %)** |
| Kampf (gemessen) | 9:33 (70,3 %) | 4:18 (57,4 %) | **4:27 (58,4 %)** |
| Nachlauf (gemessen) | 0:37 (4,5 %) | 0:28 (6,2 %) | **0:27 (5,9 %)** |
| zusammen | — | — | **7:37** |

Die 7:37 dieser Tabelle und die 7:34 der Tabelle darüber sind derselbe Lauf:
Die Zerlegung rechnet im **Mittel** je Partie, die Zeile oben ist der **Median**.

Die Aussage aus Abschnitt 4 gilt unverändert: **An der Vorbereitung lohnt sich
weiterhin keine Arbeit** — ein harter Countdown von 10 Sekunden bringt 12,5 %,
ein feinerer `TAKT_MS` von 100 auf 25 ms 3,5 %, und die Vorbereitungsfrist
liegt mit 45 s bewusst über jeder gemessenen Runde.

### Jede Schraube einzeln, auf dem heutigen Stand

Die Tabelle aus Abschnitt 2 noch einmal, damit ein späterer Eingriff nicht
gegen alte Zahlen rechnet. 500 Partien je Zeile, zu viert, Besetzung `normal`,
Saatbasis `spielzeit-v1`. „zu heute" ist der Abstand zur ersten Zeile.

| Stellschraube | Wert | Spielzeit | zu heute | Runden | Kampf | von der Uhr |
| --- | --- | --- | --- | --- | --- | --- |
| **wie gebaut** | — | **7:34** | ±0 | **10** | **17,6 s** | **4,6 %** |
| Startleben | 16 | 8:18 | +9,7 % | 12 | 17,8 s | 4,4 % |
| Startleben | 12 | 6:34 | −13,2 % | 9 | 17,3 s | 4,3 % |
| Startleben | 10 | 5:43 | −24,4 % | 8 | 16,6 s | 4,2 % |
| Schadensteiler | 2 | 6:50 | −9,6 % | 9 | 17,6 s | 4,6 % |
| Schadensteiler | 1 | 5:04 | −33,2 % | 7 | 16,2 s | 3,8 % |
| Vorbereitung höchstens | 15 s | 7:14 | −4,5 % | 10 | 17,6 s | 4,6 % |
| Vorbereitung höchstens | 10 s | 6:38 | −12,5 % | 10 | 17,6 s | 4,6 % |
| Takt | 50 ms | 7:23 | −2,4 % | 10 | 16,9 s | 4,2 % |
| Takt | 25 ms | 7:18 | −3,5 % | 10 | 16,3 s | 2,7 % |
| Zeitraffer | x1,25 | 9:09 | +20,7 % | 11 | 26,9 s | 20,2 % |
| Zeitraffer | x1,5 | 8:37 | +13,7 % | 11 | 23,5 s | 14,7 % |

**Der Zeitraffer bleibt die stärkste Schraube**, und die Zeile x1,25 zeigt
warum: Ohne ihn wäre die Partie nicht nur länger, sondern jeder fünfte Kampf
ginge wieder an die Uhr. Die Startleben sind weiterhin der Feinregler daneben —
zwei Leben weniger sind eine Runde weniger und rund eine Minute.

### Was am Code nachgezogen wurde

Nichts an den Regeln — die vier Zahlen bleiben, wie sie sind. Nachgezogen
wurden nur Zahlen in Kommentaren, die den Zustand vor dem Zusammenführen
beschrieben: die Begründung an `HOECHSTDAUER_MS` (aus 1,8 % sind 4,6 %
geworden), die an `SCHADEN_STUFEN_TEILER` (aus 11 Runden sind 10 geworden) und
die Erklärung an der Gangart-Probe in `bot.test.ts`.

**Die Gangart `hart` schlägt `normal` wieder** — der Befund aus Abschnitt 5 ist
auf diesem Stand nicht mehr nachstellbar. Über 400 Partien zu viert (`imFeld`
in `bot.test.ts`) steht es **140 : 86,7** für den harten Sitz; nach dem
Zeitraffer allein stand dieselbe Zahl bei 77 : 107,7. Der neue Laden nützt den
ausbauenden Gangarten mehr als der sparsamen: `hart` gegen drei sanfte
341 : 19,7 (vorher 223 : 59), `normal` gegen drei sanfte 359 : 13,7 (vorher
267 : 44).

**Die Probe behauptet die Reihenfolge seitdem wieder** (`hart > normal`). Sie
hatte sie zwischenzeitlich aufgegeben, weil sie an einem einzigen Tag zweimal
gekippt war — richtig, solange niemand wusste, warum. Inzwischen ist das
eingekreist (`werkzeug/gangarten.mjs`, Befund 7 in
`docs/spiele/auto-battler-konzept.md`): Gekippt ist sie beide Male am **Laden**
und nicht an der Partielänge. Der Zeitraffer allein bewegt die Zahl bei 20
Leben von 110 auf 114, der Würfelpreis gar in die andere Richtung (174 : 75,3
mit wieder eingeschaltetem Preis); was `hart` in der kurzen Partie umwarf, war
die alte Regel „ein Kauf leert nur seinen Platz" — mit gezähmtem Aufstieg stand
es auf demselben Stand 112 : 96,0 statt 77 : 107,7. Die Aussage ruht heute auf
vier Messungen über zwei Saatbasen (140 : 86,7 · 139 : 87,0 beim gebauten
Stand, 169 : 77,0 · 147 : 84,3 bei 20 Leben) plus einem Kontrolllauf mit
gleichen Gangarten (102 : 99,3). Fallen darf sie wieder bei der nächsten
Änderung am Laden — die misst man mit.

**Nachtrag 06.09.2026.** Die Zahlen dieses Abschnitts beschreiben den Stand von
damals. `hart` verlangt beim Aufstieg seitdem wieder ein volles Brett und hält
nur noch zwei Gold zurück, weil die alte Schraube nachgemessen kein Nullwert
war, sondern ein Minus; die Paarung steht damit bei **212 : 62,7** statt
140 : 86,7, und die Probe misst wieder über eine Saatbasis statt über drei. Der
Kontrolllauf ist über sechs Basen neutral (98,7). Zerlegung und Begründung
stehen bei `GANGARTEN` in `bot.ts`, nachzustellen mit
`werkzeug/gangarten.mjs --schraube …`.
