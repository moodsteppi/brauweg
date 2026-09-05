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
Neu würfeln ist seit dem 05.09.2026 **kostenlos** (Robin: „wir wollen nicht
mehr, dass man fürs Rollen Geld ausgeben soll"), und **ein Kauf zieht den
ganzen Laden neu** — nicht nur den gekauften Platz (Robin: „Nicht nur der
gekaufte, dein ganzer Shop aktualisiert sich wenn du etwas kaufst, du musst
dich also immer entscheiden. Es darf dann auch weniger Optionen geben."). Zwei
Einheiten aus demselben Laden zu holen geht damit nicht mehr: Wer kauft, gibt
die übrigen Angebote auf. Der Laden ist danach wieder voll, solange der Vorrat
reicht — reicht er nicht, bleibt er kleiner. Gold gibt man nur noch für
Einheiten und Aufstiege aus; was das Nachziehen begrenzt, ist allein der
Vorrat. Das Feld `neuwuerfelnKosten` steht weiterhin im Regelsatz, damit ein
selbstgebauter Tisch den Preis wieder setzen kann. Level steigern kostet Gold
und bringt Feldplätze.

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

## Gemessen: Ausgewogenheit (Stand 05.09.2026, vierte Messung — der gültige Stand)

**Was geändert wurde:** `neuwuerfelnKosten` steht auf **0**, und **ein Kauf
zieht den ganzen Laden neu** (`fuelleLaden` in `partie.ts`, Fall `kaufen`).
Sonst nichts — Zins, Serienbonus, Leveln, Katalog und Schwellen sind
unangetastet. Gemessen mit demselben Werkzeug und derselben Saatbasis wie die
Messungen davor, **5.000 Partien zu viert, Besetzung `normal`,
`--mindest 100`**.

Drei Spalten, weil zwischendurch eine dritte Fassung gemessen wurde:

- **jetzt** — ein Kauf zieht den ganzen Laden neu.
- **nur der Platz** — Zwischenstand: kostenloses Würfeln, aber nur der
  gekaufte Ladenplatz wurde nachbesetzt. Diese Fassung stand kurz auf dem
  Aufgabenzweig und setzte die Regel falsch um; sie steht hier als Vergleich.
- **staging** — der Stand vor beiden Änderungen (Würfeln kostet 2 Gold, ein
  gekaufter Platz bleibt bis zum nächsten Wurf leer). Das ist die zweite
  Messung weiter unten.

### Wie lange eine Partie dauert

| | jetzt | nur der Platz | staging |
|---|---|---|---|
| Runden ⌀ | 14,1 | 14,2 | 14,7 |
| Median | 14 | 14 | 15 |
| kürzeste / längste | 10 / 21 | 10 / 21 | 11 / 22 |
| an der Grenze geendet | 0,0 % | 0,0 % | 0,0 % |
| erstes Ausscheiden | Runde 10,1 | Runde 10,2 | Runde 10,5 |
| zur Halbzeit entschieden | **47,3 %** | 44,0 % | 36,7 % |
| Antritte insgesamt | 250.329 | 252.843 | 261.233 |

Die Dauer bewegt sich kaum noch — die halbe Runde hat schon das kostenlose
Würfeln gebracht. Weiter gewandert ist die vorletzte Zeile: **Fast jede zweite
Partie steht zur Halbzeit fest** (47,3 % gegen 36,7 % auf `staging`). Wer den
Laden ohnehin bei jedem Kauf neu sieht, holt einen Rückstand schwerer auf.

### Siegquote je Marke

Schnitt der gezählten Zeilen: 35,3 % (nur der Platz: 32,9 %, staging: 31,9 %).

| Marke | Antritte | Siege | Quote | zum Schnitt | nur der Platz | staging |
|---|---|---|---|---|---|---|
| Untot | 128 | 64 | 50,0 % | **×1,42** | zu dünn | zu dünn |
| Naturwesen | 2.304 | 888 | 38,5 % | ×1,09 | ×1,04 | ×1,06 |
| Krieger | 7.274 | 2.672 | 36,7 % | ×1,04 | ×1,10 | ×1,13 |
| Drache | 63 | 22 | 34,9 % | zu dünn | ×1,27 | ×1,15 |
| Elementar | 156 | 51 | 32,7 % | ×0,93 | ×0,93 | ×0,80 |
| Meuchler | 13.019 | 3.532 | 27,1 % | ×0,77 | ×0,79 | ×0,79 |
| Wächter | 12.001 | 3.221 | 26,8 % | ×0,76 | ×0,86 | ×1,07 |

Der Zielrahmen — keine gezählte Marke über ×1,4, keine unter ×0,7 — ist
**oben knapp gerissen**: Untot steht auf ×1,42. Siehe Befund 1.

### Siegquote je Einheit, die Ränder

Schnitt 33,5 % (nur der Platz: 34,3 %, staging: 31,1 %). „—" heißt: Die
älteren Tabellen führen nur die Ränder, diese Zeile lag damals in der Mitte
und wurde nicht mitgeschrieben.

| Einheit | Gold | Antritte | Quote | zum Schnitt | nur der Platz | staging |
|---|---|---|---|---|---|---|
| Grabfürstin | 3 | 125 | 60,0 % | ×1,79 | ×1,48 | ×0,88 |
| Sturmrufer | 3 | 225 | 53,8 % | ×1,60 | — | — |
| Lichtwahrerin | 3 | 140 | 52,9 % | ×1,58 | ×1,64 | ×1,31 |
| Nachtpfeil | 2 | 2.317 | 43,2 % | ×1,29 | ×1,39 | ×1,59 |
| … | | | | | | |
| Gassendieb | 1 | 17.149 | 22,8 % | ×0,68 | ×0,63 | ×0,67 |
| Schildknappe | 1 | 12.061 | 21,7 % | ×0,65 | ×0,73 | ×0,93 |
| Astschütze | 1 | 2.831 | 17,1 % | ×0,51 | ×0,59 | ×0,76 |
| Irrlicht | 1 | 253 | 16,6 % | ×0,50 | ×0,50 | ×0,56 |
| Funkenlehrling | 1 | 208 | 12,0 % | ×0,36 | ×0,39 | ×0,51 |

### Wie oft eine Schwelle überhaupt stand

250.329 Antritte.

| Marke | ab 2 | ab 4 | ab 6 | Träger im Katalog |
|---|---|---|---|---|
| Krieger | 46.115 | 914 | 0 | 5 |
| Elementar | 1.132 | 1 | 0 | 5 |
| Meuchler | 97.374 | 3.475 | 7 | 4 |
| Wächter | 96.573 | 3.790 | 4 | 6 |
| Naturwesen | 13.248 | 88 | 0 | 5 |
| Untot | 460 | 0 | 0 | 2 |
| Drache | 367 | 0 | 0 | 2 |
| **zusammen** | **255.269 (102,0 %)** | **8.268 (3,3 %)** | **11 (0,0 %)** | |

### Was auffällt — zum Nachrechnen, nicht nachjustiert

Robin rechnet das Balancing selbst durch; hier steht nur, was die Zahlen sagen.

1. **Untot steht mit ×1,42 knapp über dem Zielrahmen** — und zählt überhaupt
   erst zum ersten Mal mit, weil die Antritte von 45 auf 128 gestiegen sind.
   128 ist gerade eben über der Zählschwelle von 100; eine Marke mit zwei
   Trägern schwankt bei so wenigen Antritten stark. Die Zahl ist ein Hinweis,
   keine Aussage (eigene Karte zu Untot liegt auf dem Board).
2. **Wächter fällt weiter und ist jetzt die schwächste Marke:** ×1,07
   (staging) → ×0,86 (nur der Platz) → ×0,76. Meuchler steht mit ×0,77 direkt
   daneben. Beide liegen noch über der unteren Grenze von ×0,7, aber die
   Bewegung geht in dieselbe Richtung wie beim Zwischenstand: Wer sich
   aussuchen kann, was er kauft, greift seltener zur häufigsten Marke.
3. **Die dünnen Marken bewegen sich in beide Richtungen.** Drache 394 → 129 →
   **63** Antritte (fällt jetzt unter die Zählschwelle und sagt gar nichts
   mehr), Elementar 1.260 → 373 → **156** (zählt gerade noch), Untot 65 → 45 →
   **128** (siehe Befund 1). Zwei der sieben Marken sind damit praktisch nicht
   mehr messbar.
4. **Der Preisgraben wird tiefer.** Die 3-Gold-Einheiten stehen ganz oben
   (Grabfürstin ×1,79, Sturmrufer ×1,60, Lichtwahrerin ×1,58), die
   1-Gold-Einheiten ganz unten (Funkenlehrling ×0,36, Irrlicht ×0,50,
   Astschütze ×0,51). Schildknappe ist von ×0,93 auf ×0,65 gefallen. Wer bei
   jedem Kauf einen frischen Laden sieht, wartet eher auf die teure Karte,
   statt die billige mitzunehmen.
5. **Die Schwelle 4 steht seltener als im Zwischenstand** (3,3 % gegen 3,5 %),
   aber immer noch häufiger als auf `staging` (2,2 %). Die Schwelle 6 kam auf
   11 Fälle von 250.329 — unverändert unerreichbar (eigene Karte auf dem
   Board).

---

## Gemessen: Ausgewogenheit (Stand 05.09.2026, zweite Messung)

> **Überholt.** Diese Messung ist der Stand VOR dem kostenlosen Würfeln und
> dem Neuziehen des Ladens beim Kauf; sie steht als Vergleichsgrundlage der
> vierten Messung hier (Spalte „staging").

**Was geändert wurde:** Der Lebensvorrat ist von 100 auf **20** gefallen, der
Schaden je Niederlage wird dafür durch drei geteilt (`SCHADEN_STUFEN_TEILER`
in `kampf.ts`), die Marke **Drache** hat mit dem Funkenlehrling einen zweiten
Träger bekommen und ihr Bonus wurde halbiert, und das **Drachenkind** ist von
Tempo 0,85 auf 0,75 heruntergesetzt. Anlass war Robins Vorgabe („stell auf 4
Spieler um, das reicht völlig, und reduzier auf 20 Leben — es soll ja ein
kurzes Handyspiel sein"). Die Zahlen unten sind die Messung **nach** diesen
Änderungen; die alten stehen jeweils daneben.

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

| Sitze | Runden ⌀ | Median | an der Grenze geendet | erstes Ausscheiden | zur Halbzeit entschieden |
|---|---|---|---|---|---|
| 2 | 11,3 | 11 | 0,0 % | Runde 11,3 | 40,0 % |
| 3 | 13,3 | 13 | 0,0 % | Runde 10,8 | 38,1 % |
| **4** | **14,7** | **15** | **0,0 %** | **Runde 10,5** | **36,7 %** |
| 6 | 16,6 | 16 | 0,0 % | Runde 10,1 | 34,2 % |
| 8 | 18,0 | 18 | 0,0 % | Runde 9,8 | 29,6 % |

Vorher (100 Leben): zu viert 26,5 Runden bei 18,5 % an der Grenze (5.000
Partien, derselbe Lauf mit dem alten Stand), zu zweit 21,3 bei 2,3 %, zu sechst
28,8 bei 47,8 %, zu acht 29,6 bei 72,6 %.

**Die angesteuerte Spanne war 14 bis 20 Runden zu viert.** Nach unten begrenzt
sie das Spiel selbst: Vor Runde 10 steht kein ausgebautes Brett, wer da
ausscheidet, hat nicht verloren, sondern nicht gespielt. Nach oben begrenzt sie
das Handy — eine Runde ist Vorbereitung plus Kampf und dauert bis zu anderthalb
Minuten, zwanzig Runden sind also schon eine gute Viertelstunde. Getroffen
wurde 15 im Median, 11 bis 22 in den Rändern.

„Zur Halbzeit entschieden" heißt: Der spätere Sieger lag spätestens ab der
halben Partie ununterbrochen beim meisten Leben.

### Siegquote je Marke

5.000 Partien zu viert. Gezählt wird ein Sitz, dessen **letztes** Brett die
Marke mindestens zweimal trug (erste Schwelle) — nicht der Endzustand, denn wer
ausscheidet, gibt sein Brett vollständig in den Vorrat zurück.

| Marke | Antritte | Siege | Quote | zum Schnitt | vorher |
|---|---|---|---|---|---|
| Drache | 394 | 145 | 36,8 % | ×1,15 | ×1,65 |
| Krieger | 9.624 | 3.471 | 36,1 % | ×1,13 | ×0,87 |
| Wächter | 13.458 | 4.585 | 34,1 % | ×1,07 | ×0,87 |
| Naturwesen | 4.304 | 1.464 | 34,0 % | ×1,06 | ×0,94 |
| Elementar | 1.260 | 320 | 25,4 % | ×0,80 | ×1,02 |
| Meuchler | 9.097 | 2.302 | 25,3 % | ×0,79 | ×0,72 |
| Untot | 65 | 11 | 16,9 % | zu dünn | ×0,93 |

Die Spalte „vorher" ist derselbe Lauf mit dem alten Stand (5.000 Partien zu
viert, 100 Startleben) und nicht die alte Grundmessung zu acht — sonst
verglichen sich zwei verschiedene Besetzungen. Untot hatte dort 256 Antritte
und fällt heute unter die Mindestzahl, weil die Partie kürzer ist: Wer eine
Marke sammeln will, hat fünfzehn Runden Zeit statt siebenundzwanzig.

Schnitt der gezählten Zeilen: 31,9 %. Der Schnitt ist nicht 1/4 — ein Brett
trägt in der Regel drei bis fünf Marken gleichzeitig, die Quoten summieren sich
deshalb nicht auf 100 %.

**Das Ziel war: keine gezählte Marke über ×1,4 und keine unter ×0,7.** Der
gemessene Bereich ist ×1,15 bis ×0,79. Beide Gegenproben bestätigen ihn:
zweite Saatbasis ×1,16 bis ×0,80, gemischte Besetzung ×1,21 bis ×0,77 (dort
kommt Untot auf 314 Antritte und ×0,64 — die einzige Zahl außerhalb, siehe
Befund 3).

### Siegquote je Einheit auf dem letzten Brett

5.000 Partien zu viert, Schnitt der gezählten Zeilen 30,6 %. Gekürzt auf die
Ränder; die volle Tabelle druckt das Werkzeug.

| Einheit | Gold | Antritte | Quote | zum Schnitt |
|---|---|---|---|---|
| Bogenmeisterin | 2 | 1.439 | 52,6 % | ×1,72 |
| Nachtpfeil | 2 | 1.117 | 49,2 % | ×1,61 |
| Hainwächterin | 2 | 2.033 | 42,5 % | ×1,39 |
| Wurzelriese | 3 | 3.829 | 41,0 % | ×1,34 |
| … | | | | |
| Astschütze | 1 | 9.630 | 23,5 % | ×0,77 |
| Gassendieb | 1 | 15.920 | 20,9 % | ×0,68 |
| Irrlicht | 1 | 1.633 | 17,5 % | ×0,57 |
| Funkenlehrling | 1 | 2.339 | 15,7 % | ×0,51 |
| Moosheiler | 1 | 237 | 7,6 % | ×0,25 |

Das Drachenkind steht nach der Tempo-Senkung bei ×1,08 (vorher ×1,17).

### Wie oft eine Schwelle überhaupt stand

261.233 Antritte (je Runde ein Eintrag für jeden lebenden Sitz). Gezählt werden
(Antritt, Marke)-Paare — ein Brett kann mehrere Schwellen gleichzeitig halten.

| Marke | ab 2 | ab 4 | ab 6 | Träger im Katalog |
|---|---|---|---|---|
| Krieger | 64.703 | 1.090 | 1 | 5 |
| Elementar | 8.285 | 18 | 0 | 5 |
| Meuchler | 57.114 | 846 | 0 | 4 |
| Wächter | 104.772 | 3.772 | 6 | 6 |
| Naturwesen | 28.722 | 100 | 0 | 5 |
| Untot | 284 | 0 | 0 | 2 |
| Drache | 1.966 | 0 | 0 | 2 |
| **zusammen** | **265.846 (101,8 %)** | **5.826 (2,2 %)** | **7 (0,0 %)** | |

---

### Was auffiel — und was daraus folgen sollte

**1. Die Rundengrenze ist keine Ausgangstür mehr.** In 5.000 Partien zu viert
endete keine einzige an Runde 30, und auch zu sechst und zu acht keine von je
500. Vorher waren es zu viert 18 % und zu acht 73 %. Der Grund ist nicht die
Grenze, sondern die Uhr davor: 20 Leben und zwei bis fünf Punkte Schaden je
Niederlage machen aus einem Ausscheiden sieben bis zehn verlorene Kämpfe statt
zwanzig. Die Zahl 30 bleibt trotzdem stehen — sie ist wieder das Rettungsseil,
als das sie gedacht war.

**2. Die Schwelle 6 ist tot, die Schwelle 4 seltener als vorher.** Sieben von
261.233 Antritten halten irgendeine Marke sechsfach — 0,003 % gegen 0,1 % im
selben Lauf mit 100 Leben —, und die Vier steht in 2,2 % statt 13,7 %. Das ist die **Kehrseite der kürzeren
Partie**: Sechs Träger brauchen mindestens Level 6, und dorthin kommt in
fünfzehn Runden kaum noch jemand. Dazu kommt die schon bekannte Ursache — der
Bot spielt gar nicht auf Marken hin (`MARKEN_GEWICHT` in `bot.ts` ist 25 gegen
Einheitenstärken von 130 bis 970). **Folgerung:** Erst dem Bot ein echtes
Markengewicht geben und neu messen; bleibt die Sechs auch dann leer, sind die
Schwellen zu hoch angesetzt (2/3/5 statt 2/4/6). Steht als eigener Punkt auf
dem Board. Die Probe prüft die Sechs deshalb nicht mehr — sie käme in 400
Partien nicht ein einziges Mal vor.

**3. Untot ist jetzt zu dünn für eine Aussage** — 65 Antritte in 5.000 Partien
(mit 100 Leben waren es 256), zwei Träger im Katalog, die Schwelle 4 nie
erreicht. In der gemischten
Besetzung, wo die Marke 314-mal antritt, liegt sie bei ×0,64 und damit als
einzige Zahl unter der Grenze von 0,7. **Folgerung:** dasselbe Rezept wie bei
Drache — ein dritter Träger, dann messen. Am Bonus zu drehen, solange die Marke
nur über zwei Kopien derselben Einheit zu haben ist, misst nicht die Marke.

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

**5. Der Funkenlehrling ist immer noch die zweitschwächste Einheit** (×0,51),
und der Irrlicht daneben (×0,57) — beide Ein-Gold-Magier mit 430 bis 450 Leben
und 10 Rüstung. Sie sterben, bevor sie zweimal geschossen haben. Der
Gassendieb liegt mit ×0,68 über 15.920 Antritten ebenfalls unten, obwohl der
Bot ihn für die stärkste Ein-Gold-Einheit hält. **Folgerung:** unverändert —
die Bewertung `staerke` in `bot.ts` rechnet Leben × Rüstung × Schaden und lässt
die Reichweite weg. Befund über den **Bot**, nicht über den Katalog; steht auf
dem Board.

**6. Der Moosheiler wird fast nie aufgestellt** (237 von 261.233 Antritten,
×0,25). Kein Katalogfehler: Heilen gibt es in `kampf.ts` noch gar nicht, und
ohne Fähigkeit ist eine Beistand-Einheit nur eine schwache Wache.
**Folgerung:** nichts, bis es Fähigkeiten gibt.

**7. Die Gangarten des Bots messen sich zu viert anders als zu zweit.** Im
Duell schlug `hart` den normalen Gegner vorher mit 125:75; seit die Partie zu
zweit 11 statt 21 Runden dauert, steht es 96:104 — der aggressive Ausbau
verdient sich in der kurzen Zeit nicht mehr. Zu viert bleibt die Reihenfolge
stehen (119 : 94 für den harten Sitz gegen drei normale, 241 : 53 gegen drei
sanfte). Die Probe in `bot.test.ts` misst deshalb seitdem im Feld zu viert und
nicht mehr im Duell.

**8. Gut jede dritte Partie steht zur Halbzeit fest** (36,7 % zu viert, vorher
43,0 %). Für einen Auto-Battler nicht ungewöhnlich — wer früh gewinnt, hat mehr
Gold —, und mit dem höheren Schaden je Niederlage ist es nicht schlimmer
geworden, sondern etwas besser.

**Was NICHT auffiel:** Keine Partie endete vor Runde fünf (die kürzeste lief
11 Runden), jede der 22 Einheiten wurde aufgestellt, und jede der sieben Marken
erreichte ihre erste Schwelle. Genau diese Punkte hält die Probe fest.
