# Die Visual-Building-Tafel von Brauweg

Die ARBEITSREGELN verpflichten jede Sitzung, **vor** der Arbeit die Tafel des
Systems zu lesen und sie **danach** zu pflegen. Für Brauweg gab es lange
keine: Die Quelle lag seit dem 5. September 2026 im Repo, auf dem Server
stand sie bis zum **18. September 2026** nicht — `node tafel.mjs lesen
brauweg` antwortete bis dahin mit 404, und jeder Auftrag lief ohne
Systemwissen. Dieses Dokument sagt, wo sie liegt und wie man sie liest und
pflegt.

---

## Was eine Tafel ist

Eine Tafel ist ein GameDesk-Dokument (Bausteine als Kacheln, Verknüpfungen
als beschriftete Pfeile, Befunde als Warn-Kacheln), das im **bro-server** als
`Board`-Zeile liegt. Der Orchestrator destilliert sie zu Text und gibt sie
**jedem Auftrag** mit, der in diesem Repo läuft — ein Worker soll das
Systemwissen haben, ohne erst die Pakete durchsuchen zu müssen.

Die Zuordnung Repo → Tafel läuft **über den Namen**: Eine Tafel gehört zu
einem Repo, wenn ihr Name den Repo-Namen enthält (Groß/Klein egal). Unsere
heißt deshalb **„Brauweg — Funktionsweise"** — wer sie umbenennt und dabei
`brauweg` verliert, macht sie für jeden Auftrag unsichtbar, ohne dass etwas
kaputtgeht oder jemand eine Meldung bekommt.

## Wo sie herkommt

| Datei | Rolle |
|---|---|
| `werkzeug/gamedesk/boards/_erzeuger-brauweg.mjs` | **Quelle.** Hier wird geändert. |
| `werkzeug/gamedesk/boards/brauweg-funktionsweise.gamedesk.json` | **Erzeugnis.** Nie von Hand ändern — der nächste Lauf überschreibt es. |

```bash
node werkzeug/gamedesk/boards/_erzeuger-brauweg.mjs
```

Der Lauf meldet Fenster, Rahmen, Verknüpfungen und die geschätzte Länge des
Destillats. Zwei Warnungen kann er ausgeben, und beide beschreiben Fehler,
die man auf der Tafel selbst **nicht sieht**:

* **Rahmen überlappen.** Das Destillat ordnet eine Kachel dem ersten Rahmen
  zu, in dem ihre linke obere Ecke liegt. Überlappen zwei Rahmen, landet die
  Kachel unter Umständen im falschen Bereich.
* **Zu lang.** Der Tafel-Server deckelt bei 32.000 Zeichen
  (`TAFEL_MAX_ZEICHEN`) und schneidet am **Ende** ab; dort stehen die
  Verknüpfungen. Obendrauf kommen später noch bis zu 14 gemeldete Änderungen.

## Zwei Regeln, die wie Marotten aussehen

1. **Alles Wissen steht in Notiz-Kacheln.** Das Destillat liest ausschließlich
   `frame` und `notes` (`bro-server/src/lib/tafel-wissen.ts`). Code-, Skizzen-,
   Sandkasten- und Projekt-Kacheln erreichen keinen Auftrag. Sie dürfen als
   Anschauung stehenbleiben, aber keine Aussage tragen, die es nicht daneben
   als Notiz gibt.
   Eine Ausnahme davon ist der Verweis auf eine Nachbartafel: Er steht als
   `state.boardRef` (`board`, `wie`, `warum`) an einer Notiz und wird im
   Destillat als eigene Zeile ausgegeben. GameDesk kennt das Feld nicht und
   wirft es weg, sobald jemand genau diese Kachel im Editor speichert —
   danach hilft nur ein neuer Erzeugerlauf.
2. **Befunde heißen `⚠ …`.** Wer einen behebt, meldet den Kacheltitel; der
   Server macht daraus ein `✓` samt Datum und lässt den alten Text darunter
   stehen. Ein Befund ohne ⚠ im Titel ist von einem Baustein nicht zu
   unterscheiden.

## Lesen und pflegen

Das Werkzeug liegt bei jedem eingerichteten Worker; den Token sucht es sich
selbst aus dessen `.env`.

| System | Pfad |
|---|---|
| Windows | `%LOCALAPPDATA%\Broweg\worker\tafel.mjs` |
| macOS | `~/Library/Application Support/Broweg/worker/tafel.mjs` |
| Linux | `~/.local/share/broweg/worker/tafel.mjs` |

```bash
node tafel.mjs lesen brauweg          # das Destillat, so wie ein Auftrag es sieht
node tafel.mjs landkarte              # die Plattform-Landkarte
node tafel.mjs eintragen -            # Eintrag von der Standardeingabe
```

Der Eintrag ist dieselbe JSON-Form wie der `===TAFEL===`-Block eines Workers:

```json
{"board": "brauweg",
 "anlass": "kurz, wofür",
 "notizen": [{"titel": "…", "text": "…"}],
 "erledigt": ["⚠ Titel einer behobenen Befund-Kachel"]}
```

Notizen landen in einem eigenen Bereich **„Änderungen aus Aufgaben"** —
als Posteingang, nicht als fertige Einarbeitung. Sie an die richtige Stelle
im Netz zu bringen, ist Handarbeit.

## Auf dem Server liegt sie seit dem 18.09.2026

Bis dahin stand hier, das könne keine Sitzung selbst: Die Tafel-API konnte
lesen und anhängen, aber nicht anlegen, und der Import war ein Klick eines
Menschen im brotool. **Das gilt nicht mehr.** Die ARBEITSREGELN kennen seit
dem 17.09.2026 einen Anlege-Weg, den auch ein Rechner ohne Browser gehen
kann:

```bash
node tafel.mjs anlegen brauweg werkzeug/gamedesk/boards/brauweg-funktionsweise.gamedesk.json "Brauweg — Funktionsweise"
```

So ist sie entstanden (61 Kacheln, 45 Verknüpfungen). Der Name **muss**
`brauweg` enthalten, und es darf **genau eine** Tafel dazu geben — der Server
weist beides ab. Gegenprobe: `node tafel.mjs lesen brauweg` liefert Text,
nicht 404.

Der Weg über `brotool.broweg.de` → **Visual Building** → **Tafel
importieren** funktioniert weiterhin und tut dasselbe.

### Danach gibt es zwei Stände, und das ist die eigentliche Falle

Ab dem Import ist die **Fassung auf dem Server die gültige**: Dort tragen
Worker ihre Meldungen ein, dort werden Befunde abgehakt. Die Datei im Repo
ist der Ursprung, nicht der Spiegel.

Wer den Erzeuger laufen lässt und das Ergebnis erneut importiert, legt
entweder eine **zweite** Tafel an (dann greifen beide beim Namensabgleich,
und der Auftrag bekommt sie doppelt) oder überschreibt alle eingetragenen
Meldungen. Strukturelle Änderungen gehören deshalb nach dem Import in den
Editor im brotool — oder der Neu-Import wird bewusst gemacht, samt Übernahme
des Bereichs „Änderungen aus Aufgaben".
