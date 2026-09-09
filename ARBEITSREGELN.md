# Arbeitsregeln — Broweg & goodFil

Diese Regeln gelten in **allen** Repositories beider Plattformen (Broweg-Team/*
und step-it-team/*). Sie richten sich an jede Claude-Session und jeden
Menschen, der hier arbeitet — auch und gerade außerhalb des Orchestrators.

**Kanonische Fassung:** `step-it-team/goodFil` → `ARBEITSREGELN.md`.
Änderungen zuerst dort, dann in alle Repos verteilen (am besten als
Orchestrator-Aufgabe). Die Kopie im eigenen Repo nie einzeln umschreiben.

## 1. Git: Feature-Branch und Pull Request, sonst nichts

- **Nie direkt auf `main`/`master` pushen.** Gearbeitet wird auf einem
  Feature-Branch, gemerged per Pull Request auf den Arbeitszweig
  (`staging`; im goodFil-Doku-Repo ist es `master`).
- `main` wird ausschließlich per Release-PR aus `staging` bedient.
- Ist `main` einmal voraus (passiert, wenn parallel gearbeitet wurde):
  **Rückfluss `main` → `staging` als echter Merge-Commit, niemals Squash** —
  sonst ist `main` kein Vorfahre mehr und jeder künftige Release konfligiert.
- Checks abwarten, bevor gemerged wird. Frisch nach PR-Anlage kann „keine
  Checks" heißen „noch nicht gestartet" — kurz warten statt durchwinken.

**Wenn du als Worker im Orchestrator läufst, gilt der letzte Punkt nicht: Du
merged nicht.** Du arbeitest auf dem Zweig, den der Worker angelegt hat, pushst
ihn — und hörst dort auf. Kein Pull Request, kein Merge, auch dann nicht, wenn
die Prüfungen grün sind und die Arbeit fertig aussieht. Das Zusammenführen ist
ein eigener Auftrag, den ein Mensch nach dem Blick in die Vorschau auslöst.

Der Grund ist der ganze Sinn der Vorschau: Zwischen deinem Zweig und `staging`
steht ein Mensch, der den Diff sieht. Am 02.09.2026 hat ein Worker in `brotool`
seinen eigenen PR geöffnet und sieben Minuten später selbst gemerged — nicht
aus Übermut, sondern weil genau diese Regel hier das Mergen verlangt und ihm
niemand gesagt hat, dass sie für ihn anders lautet. Die Änderung war gut; die
Zusage „nichts geht ohne Menschen nach `staging`" war es danach nicht mehr.

Woran du merkst, dass du ein Worker bist: Du hast die Aufgabe nicht von einem
Menschen im Gespräch bekommen, sondern als Auftragstext, und du arbeitest
bereits auf einem Zweig namens `aufgabe/…`. Im Zweifel gilt: nicht mergen. Ein
Zweig, der einen Tag auf die Freigabe wartet, kostet nichts. Ein Merge, den
niemand angesehen hat, kostet das Vertrauen in den ganzen Ablauf.

## 2. Der bevorzugte Weg: Orchestrator

Änderungsaufgaben laufen bevorzugt über das Bro-Dashboard
(**brotool.broweg.de** → Orchestrator): Dort arbeitet ein Worker auf einem
eigenen Zweig, ein Mensch sieht den Diff in der Vorschau und gibt frei, der
Merge wartet die Checks ab — und die Tafel-Pflege (Regel 3) passiert
automatisch. Wer lokal arbeitet, übernimmt all das selbst.

## 3. Tafel-Pflicht: Visual Building ist das Gedächtnis

Die Visual-Building-Tafeln (brotool.broweg.de → Visual Building) sind das
verbindliche Systemwissen beider Plattformen: je System eine Tafel plus die
Plattform-Landkarte — Bausteine, Verknüpfungen mit Wie und Warum, bekannte
Widersprüche als ⚠-Kacheln. Der Orchestrator gibt dieses Wissen jedem
Auftrag mit. **Veraltet es, arbeiten alle künftigen Aufgaben mit falschem
Wissen — deshalb ist die Pflege Teil der Änderung, nicht Aufräumarbeit
danach.**

### Das Werkzeug

`tafel.mjs` kommt mit dem eingerichteten Worker und findet den Zugang
selbst — es ist kein Token zu setzen:

- Windows: `%LOCALAPPDATA%\Broweg\worker\tafel.mjs`
- macOS: `~/Library/Application Support/Broweg/worker/tafel.mjs`
- Linux: `~/.local/share/broweg/worker/tafel.mjs`

Kein Worker auf diesem Rechner? Einrichten über brotool.broweg.de →
Orchestrator → „Worker einrichten"; danach ist der Zugang da. Der Token
bleibt auf dem Rechner — nie ins Repo, in einen Chat oder in ein Protokoll.

### Vor der Arbeit: Tafel lesen

Bevor du an einem System arbeitest, hol dir sein Tafel-Wissen als Kontext —
dieselbe Zusammenfassung, die der Orchestrator seinen Workern mitgibt:

```bash
node <pfad>/tafel.mjs lesen mystery-web    # Tafel eines Repos
node <pfad>/tafel.mjs landkarte            # systemübergreifende Sicht
```

### Nach der Arbeit: Tafel pflegen

Ändert deine Arbeit Systemwissen — neuer Baustein, neue oder geänderte
Verknüpfung (auch zwischen Systemen), geändertes Verhalten, behobener
⚠-Befund —, dann **im selben Zug**:

```bash
node <pfad>/tafel.mjs eintragen eintrag.json    # oder: … eintragen -
```

```json
{
  "board": "<repo-name>",
  "anlass": "kurz: wer und was",
  "notizen": [{ "titel": "kurz, eine Zeile", "text": "Was ist jetzt anders — und warum." }],
  "erledigt": ["exakter Titel einer behobenen ⚠-Kachel"]
}
```

- **notizen** landen als Kacheln im Bereich „Änderungen aus Aufgaben" der
  Tafel — was ist anders, und warum.
- **erledigt** nennt Titel behobener ⚠-Befund-Kacheln; der Server markiert
  sie (⚠→✓, grüner Akzent, Behoben-Vermerk zuoberst — der alte Text bleibt
  als Geschichte stehen). Nur eindeutige Treffer werden markiert; Teilweise-
  Behobenes gehört als Notiz beschrieben, nicht in `erledigt`.
- Alternativ von Hand im Dashboard (Visual Building → Tafel → Bereich
  „Änderungen aus Aufgaben"), nach denselben Regeln.

**Weder Worker noch Dashboard-Zugang?** Dann gehört derselbe Inhalt als
Abschnitt `TAFEL:` in die PR-Beschreibung — wer merged, trägt ihn ein.

Reine Feature-Arbeit, die kein Systemwissen berührt, löst keine
Tafel-Pflicht aus.

## 4. Board-Pflicht: das Issueboard ist die gemeinsame Arbeitsliste

Das Issueboard (brotool.broweg.de → Issueboard) führt, was noch zu tun ist —
für Menschen und Worker gemeinsam. Es steht neben der Tafel: Die Tafel sagt,
wie die Systeme gebaut sind, das Board sagt, was daran offen ist.

Offene Punkte trennen sich in zwei Spalten:

- **Braucht dich** — es fehlt eine Entscheidung, ein Zugang, ein Gespräch:
  etwas, das nur ein Mensch tun kann.
- **Kann ein Worker** — eine abgeschlossene Aufgabe, die sich verteilen
  lässt. An der Karte sitzt der Knopf „An Worker geben"; die Karte zieht
  danach von selbst mit (Review, dann Fertig).

Dazu **Kundenvorschlag** für Rückmeldungen aus dem Backoffice (bpm →
Feedback).

### Vor der Arbeit: offene Punkte lesen

```bash
node <pfad>/board.mjs offen
```

Der Pfad ist derselbe Ordner wie bei `tafel.mjs` (siehe oben). Wer nicht
weiß, was schon gemeldet ist, meldet es ein zweites Mal — oder arbeitet an
etwas, das längst jemand anderem gehört.

### Nach der Arbeit: eintragen, was sich geändert hat

**Die eigene Aufgabe gehört NICHT aufs Board** — sie läuft ja gerade. Aber:

- Fällt unterwegs etwas auf, das niemand angeht (Fehler, Lücke,
  Aufräumbedarf), leg eine Karte an.
- Erledigt die Arbeit einen offenen Punkt ganz oder teilweise, verschieb ihn
  bzw. schreib dazu, was jetzt anders ist.

```bash
node <pfad>/board.mjs eintragen eintrag.json
```

```json
{
  "wer": "dein Name",
  "neu": [{ "titel": "kurz", "beschreibung": "Was ist zu tun und warum.",
            "spalte": "worker", "art": "BUG" }],
  "aenderungen": [{ "id": "Kennung aus der Liste", "spalte": "Fertig",
                    "notiz": "Was erledigt wurde." }]
}
```

Worker bekommen dieselben Punkte automatisch im Auftrag und melden über einen
`===ISSUES===`-Block zurück — sie brauchen das Werkzeug nicht.

## 5. goodFil-Besonderheiten

- Strukturelle Änderungen (neue Tabelle, Rolle, Dienst, Datenfluss) ziehen
  `docs/modell/*.md` im goodFil-Repo mit — die Modell-Dokumente sind die
  Quelle, aus der die Tafeln generiert werden.
- Die Statuspflicht des Sicherheitskonzepts gilt unverändert (siehe
  CLAUDE.md im goodFil-Repo): Wer eine Maßnahme in Betrieb nimmt, zieht dort
  die Statuszeile im selben Zug nach.

## 6. Bekannte Fallen

- **Zwei Worker-Implementierungen:** `broweg-worker/src` (broweg-zentrale)
  und `bro-server/worker/worker.mjs` (Kollegen-PCs) implementieren denselben
  Ablauf. Wer eine ändert, ändert die andere mit.
- **Zwei Merges desselben Railway-Dienstes nie im Minutenabstand** — die
  Builds teilen sich den Next-Cache-Mount und sterben mit SIGBUS.
- **Cookies:** Ein Host-Cookie ersetzt kein Domain-Cookie. Wer die
  Cookie-Domain ändert, muss damit rechnen, dass beide Varianten eine Weile
  nebeneinander im Browser leben — und dass der Server beide sieht.
- **Secrets** (Tokens, Schlüssel, Zugangsdaten) gehören nie in Chats,
  Commits, PR-Texte oder Tafeln. Übergabe: lokale Datei → verschlüsselter
  Kanal → `.env` mit engen Rechten.
