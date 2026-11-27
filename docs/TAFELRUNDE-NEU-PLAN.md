# Tafelrunde neu — Plan

**Entwurf zur Abstimmung, 27.11.2026** (Robin, mit Claude). Noch nichts davon
ist gebaut. Der Plan wird erst verbindlich, wenn Robin ihn freigibt; bis
dahin ändert sich an Tafelrunde nichts.

Ausgangspunkt ist `staging` auf dem Stand von #426. Den Zustand des Spiels
davor beschreibt `docs/STAND.md` im Abschnitt „Stand am 27. November 2026":
Tafelrunde ruht seit dem 26.09.2026.

---

## 1. Was entschieden ist

| Frage | Entscheidung |
| --- | --- |
| Regelkern | **bleibt.** `packages/game-tafelrunde` wird nicht angefasst. |
| Spielregeln, Balance, neue Modi | **erst danach**, anhand echter Partien im neuen Spiel. |
| Oberfläche | **komplett neu**: Einstieg, Suche, Tisch, Rüstphase, Kampf, Abschluss. |
| Format | **Handy hochkant**, ein Aufbau für Webseite und iOS-App. |
| Figuren | **Pinguine und Freunde als Helden**, im Stil der Marke. |
| Herkunft der Figuren | **Konzeptbild, daraus KI-3D, daraus vorgerenderte Bildfolgen.** |
| Suche | neues Aussehen, und **man sieht, wer schon da ist**. |
| Tisch | neues Aussehen, und **Freunde lassen sich direkt einladen**. |
| Wer erzeugt die Grafik | eine **Sitzung auf Robins Rechner**, wo ChatGPT angemeldet ist. Die Cloud-Sitzung baut derweil den Code. |

## 2. Warum die Grafik heute alt aussieht

Nachgesehen am 27.11.2026, nicht vermutet:

- **Tafelrunde hat kein echtes 3D.** Was nach 3D aussieht, sind fünf
  vorgerenderte Bildfolgen unter `public/tafelrunde/figuren3d/`
  (`wache`, `meuchler`, `schuetze`, `magier`, `beistand`), gerendert aus dem
  freien Paket KayKit Adventurers.
- **22 Einheiten teilen sich diese fünf Figuren.** Eine Frostweberin und eine
  Grabfürstin sehen im Kampf gleich aus, weil beide „Magier" sind.
- Die Zelle ist **128 Pixel** groß. Auf einem heutigen Handy mit dreifacher
  Pixeldichte wird sie hochgezogen und wirkt unscharf.
- Daneben stehen noch die 22 alten Pixelbilder (`public/tafelrunde/*.webp`)
  als Rückfall.

Das Neue muss also drei Dinge leisten: eine eigene Figur je Einheit, ein
einheitlicher eigener Stil und genug Auflösung.

## 3. Woher die neuen Figuren kommen

### Der Weg

```
Stilbibel (ein Blatt: Proportionen, Farben, Licht, was nie ins Bild gehört)
   ↓
Konzeptbild je Einheit              ChatGPT-Bildmodell, lokal über codex
   ↓
3D-Modell aus dem Bild              Bild-zu-3D (Anbieter: siehe Stilprobe)
   ↓
Rig und fünf Bewegungen             stand, lauf, schlag, getroffen, tod
   ↓
Bildfolge                           packages/client/src/figuren3d/bildfolgen-rendern.mjs
   ↓
WebP unter public/tafelrunde/figuren3d/, Original ins Archiv brauweg-art
```

Der letzte Schritt ist schon da und bleibt: Der Renderer macht aus einem
gerigten `.glb` ein Blatt. `docs/TRIPO.md` beschreibt, wie ein KI-Modell dort
hineinkommt (andere Clipnamen, Datei lokal statt von GitHub) — beides kleine
Eingriffe, keiner davon ist bisher gemacht.

**Vorgerendert statt live gerendert**, und zwar mit Absicht: Im Kampf stehen
bis zu zwanzig animierte Figuren gleichzeitig auf dem Feld. Als Bildfolge
läuft das auf jedem Handy und in der App-Hülle flüssig; als Echtzeit-3D wäre
es genau die Stelle, an der `CLAUDE.md` schon zweimal einen verlorenen
WebGL-Kontext vermerkt.

### Welcher 3D-Anbieter

Nicht aus dem Bauch entscheiden, sondern an einer **Stilprobe**. Die
öffentlichen Vergleiche von 2026 nennen für gerigte, animierte Figuren meist
Meshy vorn und Tripo als günstigere Wahl; Rodin liefert die feinsten Modelle,
riggt aber nicht. Mehrere dieser Vergleiche stammen von den Anbietern selbst,
taugen also als Hinweis und nicht als Urteil. Tripo ist im Projekt schon
eingeführt (alle 27 Modelle unter `public/3d/` kommen von dort,
`docs/TRIPO.md`).

Die Probe: **drei Figuren, zwei Anbieter**, dieselben Konzeptbilder.

| Probe | Warum gerade die |
| --- | --- |
| Dorfwache (Wache) | Schild und Schwert, der Normalfall. |
| Frostweberin (Magier) | Robe und Stab, also Stoff, der beim Riggen gern reißt. |
| Gassendieb (Meuchler) | Kapuze und schnelle Bewegung. |

Geprüft wird an der fertigen Bildfolge, nicht am Standbild:

1. Sieht die Figur aus wie das Konzeptbild, und sehen die drei aus wie aus
   einer Hand?
2. **Lässt sich ein Pinguin überhaupt riggen?** Kurze Beine, Flügel statt
   Arme, kein Hals: Die Rig-Vorlagen sind für Menschen gebaut. Das ist das
   größte Risiko des ganzen Plans, deshalb steht es ganz vorn.
3. Sind die fünf Bewegungen lesbar, vor allem `schlag` und `tod`?
4. Was kostet eine Figur, und wie lange dauert sie?

Fällt Punkt 2 bei beiden durch, gibt es zwei Auswege, die dann zu entscheiden
sind: Pinguine mit etwas längeren Gliedmaßen zeichnen, oder die Bewegungen
aus Standbildern von Hand zusammensetzen (wie die Kartenmanufaktur mit ihrem
Rig aus Einzelteilen).

### Wofür Kling taugt

Kling erzeugt Videos, keine Modelle. Für die Kampffiguren ist das der falsche
Weg: Über fünf Bewegungen bleibt eine Figur im Video nicht dieselbe, und das
Freistellen jedes Einzelbilds ist fehleranfällig. Gut passt Kling dagegen für
**ein bewegtes Titelbild im Einstieg** und für Werbeclips. Das ist ein
Zusatz für das Ende, keine Voraussetzung.

### Was vor der Serie geklärt sein muss

- **Die Lizenz der erzeugten Modelle.** `docs/TRIPO.md` führt sie als
  offenen Punkt. Vor 22 Figuren muss feststehen, dass der gewählte Tarif die
  kommerzielle Nutzung deckt.
- **Die Dateigröße.** Heute wiegt ein Blatt rund 50 bis 80 kB bei 128 Pixeln.
  Mit doppelter Kantenlänge und 22 statt 5 Blättern wird aus 300 kB ein
  Mehrfaches. Geladen wird deshalb nach Bedarf (nur was im Laden, auf dem
  Brett oder im Kampf steht), nicht alles vorab.

## 4. Die 22 Figuren

Namen, Rollen, Kosten und Marken kommen aus `katalog.ts` und bleiben. Die
rechte Spalte ist ein **Vorschlag** für die Bildwelt und noch nicht bestellt.
Drei Regeln halten das Feld lesbar: Die **Rolle** bestimmt die Silhouette
(Schild, Fernwaffe, Stab, Klingen, Heilzeichen), die **Marke** ein
wiederkehrendes Merkmal (Farbe oder Abzeichen), und die **Kosten** den Prunk.

| Einheit | Kosten | Rolle | Marken | Figur (Vorschlag) |
| --- | --- | --- | --- | --- |
| Dorfwache | 1 | Wache | Krieger, Wächter | Pinguin mit Topfhelm, Holzschild, Kurzschwert |
| Schildknappe | 1 | Wache | Wächter, Untot | Geisterpinguin hinter einem viel zu großen Schild |
| Astschütze | 1 | Schütze | Naturwesen | Pinguin im Blätterumhang mit Astbogen |
| Steinschleuderer | 1 | Schütze | Krieger | stämmiger Pinguin mit Lederkappe und Schleuder |
| Funkenlehrling | 1 | Magier | Elementar, Drache | Jungpinguin in zu großer Robe, Funken am Flügel |
| Irrlicht | 1 | Wache | Elementar, Untot | schwebende Geisterlaterne, kein Pinguin |
| Gassendieb | 1 | Meuchler | Meuchler | Pinguin mit Kapuze und Dolch |
| Moosheiler | 1 | Beistand | Naturwesen | Pinguin mit Mooshut und Kräuterkorb |
| Hainwächterin | 2 | Wache | Wächter, Naturwesen | Pinguin in Rindenrüstung mit Speer |
| Grimmbart | 2 | Wache | Krieger | bärtiger Kaiserpinguin mit großer Axt |
| Bogenmeisterin | 2 | Schütze | Krieger, Naturwesen | Pinguin mit Federhut und Langbogen |
| Nachtpfeil | 2 | Schütze | Meuchler | Pinguin im dunklen Umhang mit Armbrust |
| Frostweberin | 2 | Magier | Elementar | Pinguin mit Eisstab und Kristallkrone |
| Schattenklinge | 2 | Meuchler | Meuchler | maskierter Pinguin mit zwei Klingen |
| Knochenspäher | 2 | Meuchler | Untot | Geisterpinguin mit Knochenmaske |
| Runenpriester | 2 | Beistand | Wächter | Pinguin in Robe mit leuchtender Runentafel |
| Wurzelriese | 3 | Wache | Naturwesen, Wächter | die Giraffe aus dem Logo in Rindenpanzer |
| Drachenkind | 3 | Schütze | Drache, Elementar | kleiner Drache, kein Pinguin |
| Sturmrufer | 3 | Magier | Elementar | Pinguin mit Sturmstab und wehendem Mantel |
| Grabfürstin | 3 | Magier | Untot | gekrönte Geisterpinguin-Königin mit Stab |
| Klingentänzerin | 3 | Meuchler | Krieger, Meuchler | Pinguin mit Schärpe und zwei Säbeln |
| Lichtwahrerin | 3 | Beistand | Wächter | Pinguin in heller Robe mit Lichtlaterne |

„Untot" wird freundlich gelesen, als Gespenst und nicht als Leiche. Die
Plattform ist ein Familienspiel.

## 5. Die Bildschirme

Alle neu, alle hochkant, alle nach `docs/DESIGN.md` („Nachtblau & Gold").
Grün bleibt die Farbe des Spiels.

| Bildschirm | Was er zeigen muss |
| --- | --- |
| Einstieg | Titelbild, Schnellsuche, Tisch erstellen, Tisch beitreten, Regeln |
| Suche | Restzeit und die **Gefundenen mit Bild und Namen**, wie sie einlaufen |
| Tisch (Wartesaal) | Plätze, Beitrittscode, **Einladen**, Link teilen, Bot-Stufe, Start |
| Ladebild | Fortschritt, solange die Figuren der ersten Runde laden |
| Rüstphase | Brett 5 × 4, Bank mit 9 Plätzen, Laden mit 5 Karten, Gold, Stufe, Restzeit, Marken, Mitspieler mit Leben |
| Einheitenblatt | eine Figur groß, Werte, Marken, Verkaufen |
| Kampf | Arena 5 × 10, Leben beider Seiten, wer gegen wen |
| Rundenende | Sieg oder Niederlage, verlorene Leben, Zwischenstand |
| Abschluss | Platzierung aller, Trophäen, noch einmal |
| Regelblatt | die Regeln zum Nachlesen |

Leitplanken für den Bau:

- **Der Client rechnet keine Regel nach.** Was der Bildschirm braucht und die
  Sicht nicht liefert, wird ein neues Feld in der Sicht. Genau hier hat
  Tafelrunde am 05.09.2026 dreimal an einem Tag danebengelegen (`CLAUDE.md`).
- **Alles Wichtige in Daumenreichweite.** Laden und Bank unten, das Brett in
  der Mitte, Anzeigen oben.
- **Ziehen bleibt die Hauptgeste**; Antippen und dann Ziel antippen geht
  daneben auch.
- Deutsch und Englisch von Anfang an (`packages/client/src/i18n/`).
- `Tafelrunde.tsx` hat heute 2359 Zeilen. Der neue Bildschirm entsteht in
  Bausteinen unter `minispiele/tafelrunde/`, nicht wieder als eine Datei.

**Der Umstieg läuft hinter einem Schalter**, wie beim neuen Hub (#277, #278):
Bis zur Abnahme bleibt das heutige Tafelrunde der Standard und das neue ist
über einen Parameter erreichbar. So bleibt `staging` die ganze Zeit spielbar.

## 6. Suche und Tisch

**Suche zeigt, wer da ist.** Heute meldet der Server dem Suchenden nur einen
Zähler und die Restzeit. Neu liefert `stand()` zusätzlich die Wartenden mit
Anzeigename und Bild. Das ist ein Feld mehr in der Antwort von
`GET /api/suche/:gameId`; an Fenster, Stille-Regel und Tischbau
(`packages/server/src/suche/`) ändert sich nichts. Weil die Schlange für alle
Spiele dieselbe ist, haben Farbduell, Eiland und Mememory dasselbe Feld gleich
mit zur Verfügung.

**Freunde einladen.** Die Funktion gibt es seit #419 für die Kartentische:
`POST /api/tables/:tableId/einladen` und das Blatt
`packages/client/src/tisch/EinladenBlatt.tsx`. Sie wird im neuen Wartesaal
eingebunden, nicht neu gebaut. Dazu „Link teilen" über das Teilen-Menü des
Handys; der Beitrittscode bleibt für alle, die ihn lieber diktieren.

Die Abläufe selbst bleiben: 30 Sekunden ab dem ersten Suchenden, dann ein
Tisch mit Bots auf den freien Plätzen; der Gastgeber startet, wann er will.

## 7. Wer was macht

Zwei Sitzungen arbeiten parallel und treffen sich im Repository.

| | Sitzung auf Robins Rechner | Cloud-Sitzung |
| --- | --- | --- |
| Aufgabe | Grafik erzeugen | Code bauen |
| Werkzeuge | codex mit ChatGPT, 3D-Anbieter, `wandeln.mjs` | Repository, Tests, Browser für Sichtproben |
| Eingang | die Bestellung `docs/ASSETS-TAFELRUNDE-NEU.md` | die gelieferten WebP |
| Ausgang | WebP im Repo, Originale in `brauweg-art` | Pull Requests nach `staging` |

Die Cloud-Sitzung baut mit Platzhaltern (den heutigen Figuren) und wartet
nicht auf die Grafik. Die Bestellung schreibt sie zuerst, damit die lokale
Sitzung sofort loslegen kann.

## 8. Reihenfolge

Jeder Schritt ist ein eigener Pull Request nach `staging`. An drei Stellen
entscheidet Robin, bevor es weitergeht.

1. **Stilbibel und Stilprobe bestellen.** `docs/ASSETS-TAFELRUNDE-NEU.md` mit
   den drei Probefiguren, fertigen Prompts, Maßen und Abnahmekriterien.
2. **Ist-Aufnahme.** Bildschirmfotos aller heutigen Tafelrunde-Bildschirme
   bei drei Handygrößen, als Vergleichsgrundlage.
3. **Abnahme 1: der Stil.** Robin sieht die Stilprobe und wählt Anbieter und
   Richtung. Vorher wird keine Serie bestellt.
4. **Gerüst.** Der neue Bildschirm hinter dem Schalter, hochkant, mit
   Platzhaltern: Rüstphase, Kampf, Rundenende, Abschluss.
5. **Suche und Tisch.** Das neue Feld im Server, der neue Suchbildschirm, der
   neue Wartesaal mit Einladen.
6. **Abnahme 2: der Aufbau.** Robin spielt das Gerüst auf `staging` am Handy.
7. **Serie.** Die restlichen 19 Figuren, Brett und Arena als Hintergrund,
   Rahmen, Zeichen und Titelbild. Einbau, sobald geliefert.
8. **Feinschliff.** Kampf-Inszenierung, Übergänge, Ladeverhalten, Sichtprobe
   an drei Größen, Sichtvertrag und Tests, beide Sprachen.
9. **Abnahme 3: fertig.** Der Schalter kippt, das alte Tafelrunde wird
   entfernt. Danach die eigene Entscheidung, ob das Spiel in der App von
   „Bald" auf spielbar wechselt (eine Zeile in `FREIGABE`).

Erst nach Schritt 9 kommen die Spielregeln dran.

## 9. Was schiefgehen kann

- **Pinguine lassen sich nicht riggen.** Siehe Abschnitt 3; deshalb die
  Stilprobe vor allem anderen.
- **Die Figuren sehen nicht aus wie aus einer Hand.** Dagegen stehen die
  Stilbibel und derselbe Weg für alle 22. Eine Figur, die herausfällt, wird
  neu erzeugt und nicht hingenommen.
- **Zwei Sitzungen ändern dieselben Dateien.** An diesem Repository arbeiten
  mehrere gleichzeitig. Die neuen Bausteine entstehen in neuen Dateien, und
  die alten werden erst am Ende entfernt, damit niemand in einen Umbau
  hineinläuft.
- **Der Plan wird größer als gedacht.** Regeln, Balance und neue Modi sind
  ausdrücklich nicht Teil davon. Wer unterwegs eine Regelidee hat, schreibt
  sie auf und baut sie nicht ein.

## 10. Noch offen

- Bleiben die **Namen** der Einheiten (Dorfwache, Grimmbart, Grabfürstin),
  oder bekommen die Pinguine neue? Neue Namen wären eine Änderung an
  `katalog.ts` und an beiden Sprachdateien.
- Stimmt der **Figurenvorschlag** aus Abschnitt 4, vor allem die drei
  Nicht-Pinguine (Irrlicht, Wurzelriese als Giraffe, Drachenkind)?
- Welche **Zellgröße** die neuen Blätter bekommen (256 oder 192 Pixel),
  entscheidet die Stilprobe zusammen mit der Dateigröße.

## Quellen zur Anbieterfrage

Abgerufen am 27.11.2026; die Vergleiche sind teils von Anbietern verfasst.

- <https://ludo.ai/compare/best-ai-3d-model-generators>
- <https://www.meshy.ai/compare/meshy-vs-tripo>
- <https://ai-game.dev/blog/best-ai-3d-model-generators-for-games>
- <https://zeroatoms.com/blog/ai-3d-model-generators-for-games>
- <https://kenerateai.com/blogs/tripo-vs-meshy-vs-rodin>
