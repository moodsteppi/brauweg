# Übergabe: Tafelrunde neu

Stand 27.11.2026. Geschrieben in einer Cloud-Sitzung für die Sitzung, die auf
Robins Rechner weitermacht. Die Cloud-Sitzung hat den Plan abgestimmt und
sonst nichts gebaut — **alles ab hier passiert lokal**, Grafik und Code.

Der Grund für den Wechsel: Die Grafik entsteht mit ChatGPT über `codex exec`
und mit einem 3D-Anbieter. Beides ist nur auf Robins Rechner angemeldet; in
der Cloud gab es weder `codex` noch einen Schlüssel noch das Bildwerkzeug.

## Was zuerst zu lesen ist

1. `CLAUDE.md` und `ARBEITSREGELN.md` — der Git-Weg hat sich seit dem Sommer
   geändert: Zweig und Pull Request nach `staging`, nie direkt.
2. **`docs/TAFELRUNDE-NEU-PLAN.md`** — der abgestimmte Plan. Er ist die
   Vorgabe; diese Datei ergänzt ihn nur um das, was man zum Loslegen braucht.
3. `docs/TRIPO.md` — wie ein KI-Modell zur Bildfolge wird.
4. `docs/ASSETS-FLYINGBRO.md` — der eingeübte Weg für Bilder per `codex exec`
   samt Befehl (um Zeile 217) und der Stilvorlage.
5. `docs/JETZT-AUSFUEHREN.md` — Wandeln nach WebP, Originale ins Archiv.
6. `docs/DESIGN.md` — „Nachtblau & Gold".

## Wo die Arbeit liegt

Plan, Übergabe und der aufgefrischte `docs/STAND.md` stehen auf dem Zweig
**`claude/jetzt-ausfuehren-regeln-xx9dcc`** und sind noch **nicht** auf
`staging`. Der Zweig ist `staging` vom 27.11. (#426) plus drei Commits, alle
nur Dokumente.

```bash
git fetch origin
git checkout -b tafelrunde-neu origin/claude/jetzt-ausfuehren-regeln-xx9dcc
```

Von dort aus weiterarbeiten. Die drei Dokument-Commits gehen mit dem ersten
Pull Request nach `staging` — oder vorab als eigener, wenn Robin das lieber
getrennt hat.

## Was entschieden ist

Die Tabelle steht im Plan, Abschnitt 1. In einem Satz: **Regelkern bleibt,
Oberfläche komplett neu, hochkant für Web und App, Pinguine und Freunde als
Figuren, je Einheit eine eigene Figur über Konzeptbild → KI-3D →
vorgerenderte Bildfolge; Suche zeigt die Gefundenen, der Wartesaal bekommt das
Einladen; Regeln erst danach.**

## Was Robin noch nicht beantwortet hat

Diese drei Punkte standen am Ende der Abstimmung offen. Bis er etwas anderes
sagt, gelten die Annahmen rechts — und sie gehören bei der ersten Abnahme
noch einmal auf den Tisch.

| Frage | Annahme bis auf Widerruf |
| --- | --- |
| Bleiben die Namen der Einheiten? | **Ja.** Neue Namen wären ein Eingriff in `katalog.ts`, und der Kern bleibt. |
| Stimmt der Figurenvorschlag (Plan, Abschnitt 4)? | Er gilt als Vorschlag. Die Stilprobe nutzt drei unstrittige Figuren. |
| Zellgröße der neuen Blätter | Entscheidet die Stilprobe zusammen mit der Dateigröße. |

Außerdem hat Robin den Plan nicht Punkt für Punkt freigegeben, sondern
gesagt: lokal weitermachen. Das ist die Freigabe für die Reihenfolge aus
Abschnitt 8 — die drei Abnahmen dort bleiben trotzdem Haltepunkte.

## Der erste Schritt, und wo anzuhalten ist

**Vor allem anderen nachsehen, was auf dem Rechner da ist**, statt es
anzunehmen (dieselbe Falle wie die `gh`-Zeile in `CLAUDE.md`):

```bash
codex --version                      # ChatGPT-Anmeldung für die Konzeptbilder
tripo doctor && tripo balance        # 3D: Schlüssel, Region, Guthaben
ls ~/bildwerkzeug/wandeln.mjs ~/bildwerkzeug/node_modules/sharp
gh auth status && git remote -v      # gehen Pull Requests von hier?
```

Fehlt eines davon, das zuerst melden. Kein Wandelskript nachbauen
(`CLAUDE.md`, Regel 4).

Dann in dieser Reihenfolge (Plan, Abschnitt 8):

1. **Stilbibel und Stilprobe-Bestellung** als `docs/ASSETS-TAFELRUNDE-NEU.md`
   schreiben — nach Regel 5: Maße, Freihalte-Zonen, Abnahmekriterien und die
   Liste, was nicht ins Bild gehört (Schachbrett statt Alphakanal,
   eingebrannter Text, Originalauflösung unter `public/`). Stilvorlage ist der
   Ritter-Pinguin `packages/client/public/hub/pinguin.png`.
2. **Stilprobe erzeugen:** Dorfwache, Frostweberin, Gassendieb. Je ein
   Konzeptbild (T-Pose oder A-Pose, neutraler Grund), daraus ein Modell bei
   zwei Anbietern, geriggt, fünf Bewegungen, durch den Renderer.
3. **ANHALTEN — Abnahme 1.** Robin die Bildfolgen zeigen, nebeneinander und
   in Bewegung. Er wählt Anbieter und Richtung. **Vorher keine Serie
   bestellen und kein Guthaben für 19 weitere Figuren ausgeben.**

Erst danach Gerüst, Suche und Tisch, Serie, Feinschliff.

## Das Risiko, das die Stilprobe klären muss

**Lässt sich ein Pinguin automatisch riggen?** Kurze Beine, Flügel statt
Arme, kein Hals; die Rig-Vorlagen sind für Menschen gebaut. `tripo anim check`
prüft das, bevor Guthaben fürs Riggen draufgeht (`docs/TRIPO.md`). Fällt es
durch, nicht weiterprobieren, sondern Robin die zwei Auswege aus dem Plan
(Abschnitt 3) vorlegen.

Zweitens die **Lizenz** der erzeugten Modelle: `docs/TRIPO.md` führt sie als
offen. Vor der Serie klären, nicht danach.

## Wo was im Code steht

Nachgesehen am 27.11.2026 auf `staging` #426.

**Figuren**

- `packages/client/src/figuren3d/bildfolgen-rendern.mjs` — der Renderer
  (`.glb` → Blatt). Die Tabelle `ROLLEN` sagt je Blatt, welches Modell und wie
  seine fünf Clips heißen; `hole()` lädt heute von GitHub.
- `packages/client/src/figuren3d/figuren3d.ts` — das Format: Zelle 128 Pixel
  (`FIGUREN3D_KANTE`), 6 × 6 Zellen, Fußpunkt, Bewegungen mit Bildzahl und
  Bildrate. **Das Blatt wird heute über die Rolle gefunden**
  (`FIGUREN3D.find((b) => b.rolle === rolle)`, Zeile 223) — für eine Figur je
  Einheit muss die Zuordnung auf die Einheit umziehen.
- `packages/client/src/minispiele/tafelrunde/Figur3D.tsx` — das eine Bauteil,
  das an allen Orten die Figur zeichnet. Der Kopfkommentar erklärt, warum.
- `packages/client/public/tafelrunde/figuren3d/` — die fünf heutigen Blätter
  (KayKit, CC0) samt `LIZENZ.txt`. Wer sie ersetzt, zieht die Lizenzdatei nach.

**Bildschirm**

- `packages/client/src/screens/Tafelrunde.tsx` — 2359 Zeilen, alles in einem.
- `packages/client/src/minispiele/tafelrunde/` — die Bausteine (Brett, Bühne,
  Ladenkarte, KampfAnzeige, Mitspieler, Endbild …) mit ihren Tests, dazu
  `EinstiegNeu.tsx` (Menü, Suche, Tisch im Hub-Look vom 26.09.) und
  `sicht.ts` (die Sicht für den Vertrag).
- `packages/client/src/vertrag/tafelrunde.test.ts` und
  `tafelrunde-tisch.test.ts` — der Sichtvertrag. Ein neues Feld in der Sicht
  gehört dort hinein.
- `packages/client/src/i18n/de/tafelrunde.ts` und `en/tafelrunde.ts`, dazu
  `regeln-tafelrunde.ts` — beide Sprachen von Anfang an mitführen.

**Suche**

- `packages/server/src/suche/schlange.ts` — `Suchstand` hat heute `sucht`,
  `suchende` (nur die **Zahl**), `restMs`, `tischId`. Für „wer ist schon da"
  kommt die Liste der Wartenden mit Anzeigename und Bild dazu.
- Routen in `packages/server/src/http/app.ts`: `POST /api/suche/:gameId`,
  `GET /api/suche/:gameId`, `POST /api/suche/:gameId/abbrechen`.
- Die Schlange gilt für alle Spiele. Das neue Feld darf Farbduell, Eiland und
  Mememory nicht brechen — ihre Suchtests laufen mit.

**Tisch**

- Einladen: `POST /api/tables/:tableId/einladen`,
  `packages/server/src/tables/tischeinladung.ts`,
  `packages/client/src/tisch/EinladenBlatt.tsx` (#419). Einbinden, nicht neu
  bauen.
- Beitrittscode und `/?tisch=CODE` bleiben (`docs/STAND.md`, Abschnitt zum
  verabredeten Tisch).

**Freigabe in der App**

- `FREIGABE` in `packages/server/src/games/registry.ts`: Tafelrunde steht in
  der App auf `bald`. Das Umstellen ist die letzte Entscheidung, nicht Teil
  des Baus.

## Was nicht angefasst wird

- `packages/game-tafelrunde/` — der Regelkern. Braucht der Bildschirm etwas,
  das die Sicht nicht liefert, ist das ein neues Feld in `sicht.ts` des
  Moduls, keine Rechnung im Client (`CLAUDE.md`, „Was das Modul weiß").
  Das ist die einzige erlaubte Berührung, und sie ändert keine Regel.
- **Pull Request #58** (Tafelrunde: Zeitraffer, 14 Startleben) ist überholt
  und liegt auf der alten Historie. Nicht mergen, nicht als Vorlage nehmen.
- `main`. Was fertig ist, geht per Pull Request nach `staging`.

## Fallen, die hier schon zugeschnappt sind

- **Mehrere Sitzungen im selben Repository.** Neue Bausteine in neuen
  Dateien anlegen; die alten erst am Ende entfernen.
- **Der Umstieg läuft hinter einem Schalter**, bis Robin abnimmt — Vorbild
  ist die Einführung des neuen Hubs (#277 hinter Schalter, #278 als Standard,
  #324 das alte entfernt). `staging` muss durchgehend spielbar bleiben.
- **Erst committen und pushen, dann der volle Testlauf** (`CLAUDE.md`,
  „Bauen und prüfen"). Zahlen nicht von Hand in Dokumente tragen.
- **Bilder mit Alpha auf rotem Grund prüfen**, und die Dateigröße ansehen,
  bevor etwas unter `public/` landet. 22 Blätter in doppelter Auflösung
  dürfen nicht alle vorab laden.
- **Tafel-Pflicht:** Das neue Feld der Suche und der Wechsel „Figur je
  Einheit statt je Rolle" sind Systemwissen und gehören auf die Tafel
  (`ARBEITSREGELN.md`, Regel 3).

## Der Auftrag für den neuen Chat

Zum Kopieren. Er setzt voraus, dass der Chat im Repository `brauweg` auf
Robins Rechner startet.

```text
Wir bauen Tafelrunde neu. Der Plan ist abgestimmt, du setzt ihn um.

Hol dir zuerst den Stand:
  git fetch origin
  git checkout -b tafelrunde-neu origin/claude/jetzt-ausfuehren-regeln-xx9dcc

Lies dann in dieser Reihenfolge: CLAUDE.md, ARBEITSREGELN.md,
docs/UEBERGABE-TAFELRUNDE-NEU.md, docs/TAFELRUNDE-NEU-PLAN.md, docs/TRIPO.md,
docs/ASSETS-FLYINGBRO.md. Die Übergabe sagt, wo was im Code steht und wo du
anhalten musst.

Kurzfassung: Der Regelkern (packages/game-tafelrunde) bleibt unangetastet.
Die Oberfläche wird komplett neu, hochkant für Web und iOS-App. Die Figuren
werden Pinguine und Freunde, je Einheit eine eigene, auf dem Weg
Konzeptbild (ChatGPT über codex exec) -> KI-3D -> Rig mit fünf Bewegungen ->
vorgerenderte Bildfolge. Die Suche zeigt künftig, wer schon da ist, und der
Wartesaal bekommt das Einladen aus #419. Spielregeln ändern wir erst danach.

Fang so an:
1. Prüfe, was auf diesem Rechner da ist: codex, tripo (doctor und balance),
   ~/bildwerkzeug, gh. Sag mir, was fehlt, bevor du etwas nachbaust.
2. Schreib die Stilbibel und die Stilprobe-Bestellung als
   docs/ASSETS-TAFELRUNDE-NEU.md. Stilvorlage ist
   packages/client/public/hub/pinguin.png.
3. Erzeuge die Stilprobe: Dorfwache, Frostweberin, Gassendieb, je bei zwei
   3D-Anbietern, bis zur fertigen Bildfolge.
4. HALT AN und zeig mir die drei Figuren in Bewegung, nebeneinander je
   Anbieter, mit Kosten und Dauer je Figur. Ich wähle Anbieter und Stil.
   Bestell vorher keine weiteren Figuren.

Wichtig dabei: Ob sich ein Pinguin überhaupt riggen lässt, ist das größte
Risiko. Wenn es bei beiden Anbietern scheitert, probier nicht weiter, sondern
leg mir die zwei Auswege aus dem Plan vor. Und klär die Lizenz der erzeugten
Modelle, bevor wir in Serie gehen.

Arbeite auf dem Zweig tafelrunde-neu, committe und pushe früh, und geh per
Pull Request nach staging, nie nach main. Das neue Tafelrunde bleibt hinter
einem Schalter, bis ich es abnehme. Fragen bündelst du vorab, gern als
Auswahl zum Anklicken.
```
