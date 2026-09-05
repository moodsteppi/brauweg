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

## Gemessen: Ausgewogenheit (05.09.2026)

Die 22 Einheiten, ihre Kosten, die Marken-Boni bei 2/4/6 und die Bot-Stärke
waren gesetzt, aber nie gemessen. Das ist jetzt nachgeholt. **Am Katalog wurde
nichts geändert** — dieser Abschnitt hält nur fest, was herauskam.

### Wie gemessen wurde

`packages/game-tafelrunde/test/messen.ts` spielt vollständige Partien mit Bots
durch, ohne Oberfläche, alles aus dem Seed. Zwei Aufrufer benutzen ihn:

- **Das Werkzeug** `packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs` —
  von Hand zu starten, mit der großen Zahl. Es druckt die Tabellen dieses
  Abschnitts:

  ```
  npm run build --workspace @brauweg/game-tafelrunde
  node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 500
  ```

  Schalter: `--partien`, `--sitze` (2–8), `--besetzung`
  (`normal`/`sanft`/`hart`/`gemischt`), `--saat`, `--mindest`, `--json`.

- **Die Probe** `test/ausgewogenheit.test.ts` — 80 Partien, rund vier
  Sekunden, läuft bei jedem Testlauf mit. Sie hält nur fest, was wirklich
  kaputt wäre, und ist keine Abnahme des Katalogs.

Die Grundmessung sind **500 Partien zu acht**, alle Sitze mit der Gangart
`normal` besetzt (sonst misst man die Gangarten und nicht den Katalog). Zwei
Gegenproben bestätigen sie: eine zweite Saatbasis über 400 Partien und eine
gemischte Besetzung (reihum sanft/normal/hart) über 400 Partien.

**Was diese Zahlen nicht sind:** eine Aussage über die beste Strategie.
Gemessen ist das Spiel, wie die **Bots** es spielen. Alles, was der Bot nicht
tut — gezielt auf eine Schwelle hinspielen, den Vorrat mitzählen, zwischen
zwei Runden umbauen —, fällt heraus.

### Wie lange eine Partie dauert

Je 400 Partien, zu acht 500. Rundengrenze ist 30.

| Sitze | Runden ⌀ | an der Grenze geendet | erstes Ausscheiden | zur Halbzeit entschieden |
|---|---|---|---|---|
| 2 | 21,3 | 2,3 % | Runde 21,1 | 50,7 % |
| 4 | 26,7 | 18,0 % | Runde 19,7 | 43,0 % |
| 6 | 28,8 | 47,8 % | Runde 19,1 | 43,5 % |
| 8 | 29,6 | 72,6 % | Runde 18,5 | 46,0 % |

„Zur Halbzeit entschieden" heißt: Der spätere Sieger lag spätestens ab der
halben Partie ununterbrochen beim meisten Leben.

### Siegquote je Marke

500 Partien zu acht. Gezählt wird ein Sitz, dessen **letztes** Brett die Marke
mindestens zweimal trug (erste Schwelle) — nicht der Endzustand, denn wer
ausscheidet, gibt sein Brett vollständig in den Vorrat zurück.

| Marke | Antritte | Siege | Quote | zum Schnitt |
|---|---|---|---|---|
| Drache | 173 | 59 | 34,1 % | ×1,86 |
| Elementar | 793 | 138 | 17,4 % | ×0,95 |
| Naturwesen | 1831 | 288 | 15,7 % | ×0,86 |
| Krieger | 2849 | 439 | 15,4 % | ×0,84 |
| Wächter | 3151 | 470 | 14,9 % | ×0,81 |
| Meuchler | 2903 | 360 | 12,4 % | ×0,68 |
| Untot | 66 | 6 | 9,1 % | zu dünn |

Schnitt der gezählten Zeilen: 18,3 %. Der Schnitt ist nicht 1/8 — ein Brett
trägt in der Regel drei bis fünf Marken gleichzeitig, die Quoten summieren
sich deshalb nicht auf 100 %.

### Siegquote je Einheit auf dem letzten Brett

500 Partien zu acht, Schnitt der gezählten Zeilen 15,0 %. Gekürzt auf die
Ränder; die volle Tabelle druckt das Werkzeug.

| Einheit | Gold | Antritte | Quote | zum Schnitt |
|---|---|---|---|---|
| Lichtwahrerin | 3 | 161 | 27,3 % | ×1,82 |
| Nachtpfeil | 2 | 653 | 21,7 % | ×1,45 |
| Bogenmeisterin | 2 | 865 | 21,2 % | ×1,41 |
| Drachenkind | 3 | 1601 | 18,7 % | ×1,25 |
| Wurzelriese | 3 | 1794 | 18,7 % | ×1,25 |
| … | | | | |
| Astschütze | 1 | 2048 | 10,2 % | ×0,68 |
| Steinschleuderer | 1 | 1477 | 9,4 % | ×0,63 |
| Gassendieb | 1 | 3177 | 9,0 % | ×0,60 |
| Irrlicht | 1 | 394 | 5,1 % | ×0,34 |
| Funkenlehrling | 1 | 505 | 4,2 % | ×0,28 |
| Moosheiler | 1 | 29 | 3,4 % | zu dünn |

### Wie oft eine Schwelle überhaupt stand

99.391 Antritte (je Runde ein Eintrag für jeden lebenden Sitz). Gezählt werden
(Antritt, Marke)-Paare — ein Brett kann mehrere Schwellen gleichzeitig halten.

| Marke | ab 2 | ab 4 | ab 6 | Träger im Katalog |
|---|---|---|---|---|
| Krieger | 40.617 | 3.738 | 23 | 5 |
| Elementar | 9.369 | 109 | 0 | 5 |
| Meuchler | 36.385 | 2.772 | 27 | 4 |
| Wächter | 49.276 | 7.279 | 135 | 6 |
| Naturwesen | 23.725 | 656 | 2 | 5 |
| Untot | 441 | 0 | 0 | 2 |
| Drache | 2.025 | 1 | 0 | 1 |
| **zusammen** | **161.838 (162,8 %)** | **14.555 (14,6 %)** | **187 (0,2 %)** | |

---

### Was auffiel — und was daraus folgen sollte

**1. Die Rundengrenze ist zu acht der Normalausgang, nicht die Ausnahme.**
72,6 % der Partien zu acht enden an Runde 30, ohne dass jemand gewonnen hat.
Der Grund steht in derselben Tabelle: Das erste Ausscheiden fällt im Mittel in
Runde 18,5 — mit 100 Startleben und rund 5 Punkten Schaden je Niederlage
braucht ein Ausscheiden zwanzig verlorene Kämpfe, und die gibt es in dreißig
Runden nicht. Die Zahl korrigiert nebenbei eine frühere Schätzung aus 20
Partien („zu viert die Hälfte, zu acht jede"): Zu viert sind es 18 %, zu acht
73 %, zu zweit 2 %. **Folgerung:** mehr Schaden je Niederlage, nicht mehr
Runden — eine Runde dauert schon jetzt bis zu anderthalb Minuten. Steht als
eigener Punkt auf dem Board.

**2. Die Schwelle 6 ist praktisch tot, die Schwelle 4 selten.** Zwei von
tausend Antritten halten irgendeine Marke sechsfach, jeder siebte hält
irgendeine vierfach. Vier der sieben Marken erreichen die Sechs nie. Dahinter
stecken zwei Ursachen, die man auseinanderhalten muss: Sechs Träger brauchen
mindestens Level 6, und der Bot spielt gar nicht auf Marken hin — sein
Marken-Zuschlag ist 25 gegen Einheitenstärken von 130 bis 970
(`MARKEN_GEWICHT` in `bot.ts`). **Folgerung:** Erst dem Bot ein echtes
Markengewicht geben und neu messen. Bleibt die Sechs auch dann leer, sind die
Schwellen zu hoch angesetzt (2/3/5 statt 2/4/6) — vorher ist das nicht
entscheidbar.

**3. Drache ist der einzige Ausreißer, aber die Zahl misst nicht die
Synergie.** ×1,86 über 500 Partien, reproduziert über eine zweite Saatbasis
(33,6 %) und bei gemischter Besetzung (29,1 %). Nur **eine** Einheit trägt die
Marke, das Drachenkind für 3 Gold — „zwei Drachen auf dem Brett" heißt also
„zwei Drachenkinder", und die Quote misst zur Hälfte, wer sich zwei
3-Gold-Einheiten leisten konnte. **Folgerung:** mehr Träger für die Marke,
dann neu messen. Am Bonus zu drehen, bevor die Marke mehr als einen Träger
hat, würde die falsche Schraube treffen.

**4. Untot ist zu dünn für eine Aussage.** 66 Antritte in 500 Partien, zwei
Träger im Katalog, die Schwelle 4 nie erreicht. Wie bei Drache: erst Träger,
dann messen.

**5. Die beiden Ein-Gold-Magier sind die schwächsten Einheiten des Katalogs.**
Funkenlehrling 4,2 % (×0,28, 505 Antritte), Irrlicht 5,1 % (×0,34, 394) — die
Stichprobe trägt das. Beide haben 450 bzw. 430 Leben und 10 Rüstung; sie
sterben, bevor sie zweimal geschossen haben. Auch der Gassendieb liegt mit
9,0 % über 3.177 Antritten deutlich unten, obwohl der Bot ihn für die stärkste
Ein-Gold-Einheit hält. **Folgerung:** Die Bewertung `staerke` in `bot.ts`
überschätzt Nahkämpfer ohne Reichweite — sie rechnet Leben × Rüstung ×
Schaden und lässt die Reichweite weg. Das ist ein Befund über den **Bot**,
nicht über den Katalog, und der billigere der beiden Eingriffe.

**6. Der Moosheiler wird praktisch nie aufgestellt** (29 von 99.391
Antritten). Das ist kein Katalogfehler: Heilen gibt es in `kampf.ts` noch gar
nicht (Fähigkeiten und Mana sind ein eigener Auftrag), und ohne Fähigkeit ist
eine Beistand-Einheit nur eine schwache Wache. **Folgerung:** nichts, bis es
Fähigkeiten gibt — dann erneut messen.

**7. Fast die Hälfte der Partien steht zur Halbzeit fest** (46 % zu acht,
50,7 % zu zweit). Das ist für einen Auto-Battler nicht ungewöhnlich — wer früh
gewinnt, hat mehr Gold —, sollte aber im Auge behalten werden, wenn der
Schaden je Niederlage steigt: Beides zieht in dieselbe Richtung.

**Was NICHT auffiel:** Keine Partie endete vor Runde fünf (die kürzeste zu
acht lief 24 Runden), jede der 22 Einheiten wurde aufgestellt, und jede der
sieben Marken erreichte ihre erste Schwelle. Genau diese drei Punkte hält die
Probe fest.
