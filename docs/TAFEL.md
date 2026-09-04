# Die Visual-Building-Tafel von Brauweg

Die ARBEITSREGELN verpflichten jede Sitzung, **vor** der Arbeit die Tafel des
Systems zu lesen und sie **danach** zu pflegen. Für Brauweg gab es bis zum
5. September 2026 keine: `node tafel.mjs lesen brauweg` antwortete mit 404.
Dieses Dokument sagt, wo sie jetzt liegt, wie man sie liest, pflegt und —
einmalig — auf den Server bringt.

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

## Der einmalige Handgriff: auf den Server bringen

**Das kann keine Sitzung selbst.** Die Tafel-API kann lesen und anhängen,
aber keine Tafel **anlegen**; `POST /boards` verlangt eine angemeldete
Sitzung, und auf den Rechnern liegt nur der Worker-Token. Der Import ist
deshalb ein Klick eines Menschen:

1. `brotool.broweg.de` → **Visual Building**
2. **Tafel importieren** → `werkzeug/gamedesk/boards/brauweg-funktionsweise.gamedesk.json`
3. Der Name kommt aus der Datei („Brauweg — Funktionsweise") — nicht ändern,
   siehe oben.
4. Gegenprobe: `node tafel.mjs lesen brauweg` muss Text liefern, nicht 404.

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
