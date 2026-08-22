# Reibungsstellen beim KI-gestützten Bauen — Fallakte Mememory

**Zweck.** Nicht das Spiel dokumentieren, sondern das *System*: Wo stolpert
ein KI-Agent, der auf diesem Rechner in diesem Repo ein neues Spiel von der
Idee bis auf den Server bringt? Jeder Eintrag nennt das Problem, wie es sich
gezeigt hat, und die Lösung oder den Notbehelf.

**Auflage des Nutzers:** Ich ändere die Infrastruktur *nicht*, um Probleme
wegzuräumen. Ich schreibe sie auf. Das Dokument wird später zur Verbesserung
des Systems benutzt. Wenn nichts schiefgeht, bleibt es kurz — eine leere
Liste wäre ein Ergebnis, kein Versäumnis.

**Bewertung ohne Beschönigung.** Ein Eintrag steht auch dann hier, wenn ich
den Fehler selbst gebaut habe; dann steht das dabei. Wer nur die Umgebung
anklagt, produziert einen unbrauchbaren Bericht.

---

## Legende

| Feld | Bedeutung |
| --- | --- |
| **Schwere** | *blockierend* (ohne Lösung geht es nicht weiter) · *bremsend* (kostet Zeit, umgehbar) · *stolpert* (einmalige Irritation) |
| **Art** | *Werkzeug* · *Dokumentation* · *Architektur* · *Umgebung* · *eigener Fehler* |
| **Stand** | *gelöst* · *umgangen* · *offen* |

---

## T-01 — Die in CLAUDE.md vorgeschriebenen Bild- und Klangwerkzeuge gibt es auf diesem Rechner nicht

**Schwere:** bremsend · **Art:** Dokumentation/Umgebung · **Stand:** umgangen

**Beobachtung.** `CLAUDE.md` Regel 4 ist eindeutig und lässt keinen anderen
Weg zu:

> Auf diesem Mac ist kein WebP-Werkzeug installiert; gewandelt wird mit
> `node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> [karten|szene|wappen]`
> […] Für Klänge gilt dasselbe mit `node ~/klangwerkzeug/wandeln.mjs`.

Auf diesem Windows-Rechner existiert weder `~/bildwerkzeug` noch
`~/klangwerkzeug`. Zusätzlich fehlen `cwebp`, ImageMagick (`magick`) und
`ffmpeg` im PATH.

**Warum das mehr ist als eine fehlende Datei.** Die Regel schreibt nicht nur
ein Werkzeug vor, sondern auch dessen *Voreinstellungen* — die Profile
`karten`, `szene`, `wappen` kodieren Qualitätsstufen und Zielgrößen, an denen
das ganze Repo hängt („eine Spielkarte liegt bei 80 kB, nicht bei 1,7 MB").
Ohne das Werkzeug ist nicht nur die Wandlung weg, sondern auch die
Normierung. Ein Agent, der sich eigene Zahlen ausdenkt, bricht still eine
Konvention, die zweimal live gegangen ist.

**Notbehelf.** Eigenes Wandelskript auf Python/Pillow (`Pillow 12.3` ist
vorhanden), mit ausdrücklich niedergeschriebenen Zielgrößen in
`docs/ASSETS-MEMEMORY.md`, damit die Zahlen prüfbar sind statt geraten.
Für Klänge: keine Wandlung, sondern Synthese im Browser (Web Audio) — dann
gibt es keine Datei, die gewandelt werden müsste. Siehe T-…, sobald das
gebaut ist.

**Vorschlag ans System (nicht von mir umgesetzt).** Entweder die Werkzeuge
plattformunabhängig ins Repo legen (`werkzeug/bild-wandeln.mjs` mit `sharp`
aus den vorhandenen `node_modules`), oder CLAUDE.md um den Windows-Weg
ergänzen. Der Satz „auf diesem Mac" verrät, dass die Datei für genau einen
Rechner geschrieben wurde; sie wird aber von jeder Sitzung auf jedem Rechner
gelesen.

---

## T-02 — Geteilter Arbeitsbaum ohne Anzeige: die Sitzung startet auf 85 Commits altem Stand

**Schwere:** stolpert · **Art:** Umgebung · **Stand:** gelöst

**Beobachtung.** Der Klon unter `Desktop\SPIDERVISION\brauweg` stand beim
Sitzungsstart auf `staging` — aber 85 Commits hinter `origin/staging`. Der
letzte örtliche Commit war vom 6. August, `origin/staging` vom 21. August.
Dazwischen sind zwei neue Spiele entstanden (`game-cambio`, `game-skat`), die
in der örtlichen Kopie nicht existierten.

**Warum das gefährlich ist.** Nichts weist darauf hin. `git status` meldet
einen sauberen Baum; die Verzweigung heißt richtig. Hätte ich sofort mit dem
Bauen begonnen, hätte ich gegen eine Registry gearbeitet, die drei Spiele
kennt statt fünf, und beim ersten Push einen Konflikt in genau der Datei
bekommen, die jedes neue Spiel anfassen muss
(`packages/server/src/games/registry.ts`). CLAUDE.md nennt den Pull nur „vor
jedem Push" — der teurere Zeitpunkt ist *vor jeder Zeile Code*.

**Lösung.** `git fetch` + `git pull --no-rebase origin staging` als erste
Handlung nach der Orientierung, vor jeder Änderung.

**Vorschlag ans System.** In CLAUDE.md Regel 1 den Pull an den *Anfang* der
Sitzung ziehen, nicht ans Ende. Ein Satz genügt: „Erste Handlung jeder
Sitzung: `git pull --no-rebase origin staging`. Mehrere Sitzungen und Cursor
teilen sich diesen Arbeitsbaum."

---

---

## T-03 — Steuerzeichen im Quelltext, entstanden auf dem Weg Werkzeug → Shell → Python → TypeScript

**Schwere:** bremsend · **Art:** eigener Fehler / Werkzeug · **Stand:** gelöst

**Beobachtung.** Ich wollte eine Funktion schreiben, die Steuerzeichen aus
einem selbstgewählten Spielernamen entfernt. Der reguläre Ausdruck dafür
enthält Zeichenbereiche wie `U+0000 bis U+001F`. Zweimal hintereinander landeten
**echte Steuerzeichen** in `partie.ts` statt der Escape-Folgen — die Datei war
danach für `git` eine Binärdatei (`file` meldete „data"), und das Edit-Werkzeug
konnte die Stelle nicht mehr treffen, weil ich die Zeichen im Suchtext nicht
reproduzieren konnte.

Zwei verschiedene Ursachen, beide unsichtbar:

1. Beim ersten Mal habe ich die Zeichen direkt in den Dateiinhalt geschrieben.
2. Beim Reparieren über ein Bash-Heredoc (`python - <<'PY'`) mit `\\u0000`
   im Python-String kollabierte die Verdopplung unterwegs zu einem einzelnen Backslash, und
   Python machte daraus wieder ein echtes NUL.

**Warum das teuer ist.** Es gibt keine Fehlermeldung. Der Übersetzer läuft
durch, die Datei sieht in jeder Ausgabe normal aus, und erst `file` oder
`grep` verraten es („Binary file … matches"). Ein Agent, der nur auf
Kompilat und Tests schaut, liefert so eine unlesbare Datei aus.

**Lösung.** Zwei Regeln, die ich mir für den Rest der Sitzung gesetzt habe:

- Reparaturskripte als **Datei** schreiben und dann ausführen, nie als
  Heredoc mit Escape-Folgen. Eine Schicht weniger, die etwas verschlucken
  kann.
- Im Zielcode **gar keine Escape-Folgen** verwenden, wo es auch ohne geht:
  Die Funktion filtert jetzt über `codePointAt` und Hexzahlen
  (`code < 0x20`) statt über eine Zeichenklasse. Der Kommentar dort sagt
  auch warum — die nächste Person soll die Falle nicht neu entdecken.
- Gegenprobe im Skript: nach dem Schreiben zählen, ob noch Steuerzeichen in
  der Datei stehen.

**Vorschlag ans System.** Eine Zeile in CLAUDE.md unter „Was regelmäßig Zeit
kostet" würde reichen: *Quelltext nie über ein Bash-Heredoc mit
Escape-Folgen schreiben — die Verdopplung überlebt den Weg nicht. Skript in
eine Datei, dann ausführen.* Ein Hook, der beim Schreiben auf Steuerzeichen
in `*.ts`/`*.tsx` prüft, wäre die härtere Variante.

---

## T-04 — Das Bildarchiv `brauweg-art` ist auf diesem Rechner nicht ausgecheckt

**Schwere:** stolpert · **Art:** Umgebung · **Stand:** offen

**Beobachtung.** CLAUDE.md Regel 4: „Originale liegen im Repository
`moodsteppi/brauweg-art`". Dieses Repository ist hier nirgends ausgecheckt,
und `packages/client/art/` ist leer bzw. ignoriert.

**Folge.** Die 44 PNG-Originale dieser Lieferung (40 Motive, 3 Tischdecken,
1 Banner, zusammen rund 60 MB) liegen unter
`packages/client/art/mememory/` — also **nur auf dieser Platte**. Ins Repo
gehen ausschließlich die WebP. Geht die Arbeitskopie verloren, ist ein Motiv
nicht mehr in besserer Auflösung nachzuziehen; nur die Prompts überleben,
und SDXL liefert bei gleichem Startwert nur dann dasselbe Bild, wenn auch
Modell und Sampler gleich bleiben.

**Nicht gelöst, bewusst.** Ein zweites Repository zu klonen und dort etwas
abzulegen ist eine Änderung an der Infrastruktur — genau das soll ich laut
Auftrag nicht tun. Der Zustand steht deshalb hier.

**Vorschlag ans System.** Entweder das Archivrepo auf diesem Rechner neben
`brauweg` auschecken und in CLAUDE.md den Pfad nennen, oder die Regel
umschreiben: Wenn das Archiv in der Praxis nicht erreichbar ist, ist „Original
ins Archiv" eine Regel, die jede Sitzung bricht, ohne es zu merken.

---

## T-05 — Eine globale `main`-Regel schrumpft jeden neuen Vollbild-Bildschirm

**Schwere:** bremsend · **Art:** Architektur · **Stand:** gelöst

**Beobachtung.** `styles.css` enthält weit oben:

```css
main { max-width: 60rem; margin: 0 auto; padding: 1rem; }
```

Mememory ist wie Feldherr ein `<main>` mit `position: fixed; inset: 0`. Die
Regel greift trotzdem: Gemessen lag die obere Leiste bei `x = 16, w = 343`
statt `x = 0, w = 375` — das Brett war auf dem Handy zwei Kartenbreiten
schmaler als gedacht, und auf einem breiten Bildschirm hätte `max-width`
die feste Fläche bei 960 px abgeschnitten.

**Warum es nicht auffällt.** Der Fehler sieht nach Absicht aus. Ein Rand von
16 px wirkt wie eine Gestaltungsentscheidung; man sucht ihn im eigenen
Blatt und nicht 10.000 Zeilen weiter oben. Gefunden habe ich ihn nur, weil
ich die Kastenmaße ausgelesen und mit der Fenstergröße verglichen habe —
mit dem Auge wäre er durchgegangen.

**Lösung.** `padding: 0; max-width: none;` auf `.mm-buehne` und `.mm-menue`,
mit Kommentar, warum die Zeilen dort stehen.

**Vorschlag ans System.** Entweder die globale Regel auf einen Container
umhängen (`main.blatt` o. ä.), statt jedes `<main>` zu treffen, oder eine
Merkzeile in CLAUDE.md: *Ein neuer Vollbild-Bildschirm muss `padding` und
`max-width` der globalen `main`-Regel zurücknehmen.* Feldherr hat dasselbe
Problem und löst es auf einem dritten Weg (Kinder begrenzen) — drei Wege
für eine Frage sind zwei zu viel.

---

## T-06 — Eine Spielkennung steht an vier Stellen, drei davon merkt niemand an

**Schwere:** bremsend · **Art:** Architektur · **Stand:** gelöst

**Beobachtung.** CLAUDE.md verspricht: „Ein neues Spiel hinzufügen heißt:
eine Zeile in `MODULES`, ein Eintrag in `PREVIEW` entfernt. Kein weiterer
Eingriff." Tatsächlich waren es vier Stellen:

1. `packages/game-api/src/index.ts` — die `GameId`-Union.
2. `packages/server/src/games/registry.ts` — `MODULES` (die dokumentierte).
3. `packages/server/src/http/app.ts` — `gameIdSchema`, ein **zweiter,
   handgepflegter** zod-Enum derselben Kennungen.
4. `packages/server/test/tables.test.ts` — eine fest verdrahtete Liste der
   spielbaren Spiele samt Testnamen („spielbar sind fünf").

Nummer 3 ist die gefährliche: Ohne sie übersetzt alles, alle Tests laufen
grün, das Spiel steht in der Auswahl — und **jeder** Aufruf mit dieser
Kennung endet in einem Zod-Fehler. Kein Tisch, kein Regelsatz, nichts.
Der Fehler zeigt sich erst beim Klicken.

Immerhin: Die Datenbank hält `game_id` bewusst als `text` und nicht als
Postgres-Enum (Kommentar in `schema.ts`: „bewusst kein Enum"). Dadurch
brauchte ein neues Spiel **keine Migration** — das ist die Stelle, an der
die Architektur genau richtig gebaut ist.

**Lösung.** Alle vier Stellen ergänzt.

**Vorschlag ans System.** `gameIdSchema` aus der `GameId`-Union ableiten
(`z.enum(GAME_IDS)` mit einer exportierten Konstante in `game-api`), dann
kann sie nicht mehr auseinanderlaufen. Und den Registry-Test gegen
`registry.all()` statt gegen eine Literalliste prüfen lassen — oder
zumindest die Zahl aus der Liste ableiten, damit der Testname nicht lügt.

---

## T-07 — Wer gerade spielt, ist über die öffentliche Schnittstelle nicht zu erfahren

**Schwere:** bremsend · **Art:** Architektur · **Stand:** gelöst (mit Servereingriff)

**Beobachtung.** Der Auftrag verlangt auf dem Suchknopf die *Zahl der gerade
aktiven Spieler innerhalb des Spiels*. Die einzige Quelle dafür wäre
`GET /api/tables?game=…` — die filtert aber hart auf `status = 'waiting'`
(`listTables` in `tables/service.ts`). Wer gerade eine Partie spielt, ist
darin unsichtbar.

Eine Anzeige, die aus dieser Liste rechnet, zeigt „2 aktive Spieler" und
fällt in dem Moment auf 0, in dem die beiden zu spielen anfangen. Das ist
schlechter als gar keine Zahl.

**Lösung — und warum sie die Regel nicht bricht.** Ein neuer Endpunkt
`GET /api/games/:gameId/aktiv`, der besetzte Plätze an Tischen im Zustand
`waiting` oder `running` zählt. Er ist **spielunabhängig**: Er kennt kein
Mememory, er zählt Sitze. Damit bleibt „der Server kennt kein einzelnes
Kartenspiel" gewahrt, und jedes weitere Spiel kann die Zeile mitbenutzen.

Das war trotzdem ein Eingriff in den Server, und der Auftrag lautete, das
Spiel möglichst als eigenes Paket zu bauen. Der Eingriff steht deshalb hier
und nicht nur im Commit.

**Vorschlag ans System.** Entweder diesen Endpunkt als Teil der Plattform
begreifen und dokumentieren, oder `listTables` einen Parameter für den
Zustand geben. Die zweite Variante wäre die kleinere Änderung, verrät aber
Tischkennungen laufender Partien — die erste ist enger.

---

## T-08 — Mein eigener Fehler: die vorweggenommene Kartendrehung blieb hängen

**Schwere:** bremsend · **Art:** eigener Fehler · **Stand:** gelöst

**Beobachtung.** Damit das Umdrehen nicht auf die Funkstrecke wartet, dreht
der Client die angetippte Karte sofort und lässt die Serverantwort sie
bestätigen. Meine erste Fassung merkte sich dafür nur die Platznummer und
nahm die Vorwegnahme zurück, sobald der Platz in `offen` der Sicht auftaucht.

Das geht schief, wenn zwei Sichten im selben Takt eintreffen: React fasst sie
zusammen, die Zwischenstufe mit dem eigenen Platz wird nie gerendert, die
Bedingung trifft nie zu — **und die Karte bleibt für den Rest der Partie
umgedreht**. Danach hält der Bildschirm zwei Karten für offen, obwohl nur
eine es ist, und lässt keinen Zug mehr zu. Die Partie steht.

**Wie ich es gefunden habe.** Nicht durch Hinsehen. Ich habe in beide
Browser-Fenster einen kleinen Automaten gesetzt, der zufällig spielt, wenn er
dran ist. Der blieb nach sechs Zügen stehen, und die ausgelesenen Kastendaten
zeigten `offen: 3` bei `besitz: 2`. Ein Mensch hätte an dieser Stelle
vermutlich neu geladen und den Fehler nie gemeldet.

**Lösung.** Die Vorwegnahme merkt sich jetzt die **Revisionsnummer**, die
beim Antippen galt, und verfällt, sobald *irgendeine* neuere Sicht eintrifft.
Ob der Zug angenommen wurde, entscheidet dann allein die Sicht.

**Übertragbar.** Jede optimistische Anzeige braucht einen Anker an einer
monoton wachsenden Größe des Servers, nicht an einem inhaltlichen Vergleich.
Der inhaltliche Vergleich setzt voraus, dass man jeden Zwischenzustand sieht —
und das garantiert kein Rahmenwerk, das Zustandsänderungen bündelt.

---

## T-09 — Kein Bildschirmfoto: die Sichtprüfung fällt aus

**Schwere:** bremsend · **Art:** Werkzeug · **Stand:** umgangen

**Beobachtung.** Jeder Versuch, ein Bildschirmfoto der laufenden Seite zu
machen, endet mit: *„Screenshot timed out after 5s: the Browser pane is not
displayed, so the page is not compositing frames."* Auch nach `tabs_select`.
Zwei Folgen:

- **Kein Bild.** Ob das Spiel gut aussieht, kann ich nicht sehen — nur, ob die
  Kästen dort liegen, wo sie liegen sollen.
- **Keine Animation.** Ohne Compositing laufen CSS-Übergänge nicht weiter:
  Die umgedrehte Karte meldete `transform: matrix(1,0,0,1,0,0)` (also gar
  keine Drehung), obwohl die Klasse gesetzt war. Dass die Drehung *stattfindet*,
  ist damit **nicht** nachgewiesen — nur, dass der Zustand umschaltet, der sie
  auslöst.

**Notbehelf.** Prüfen mit Zahlen statt mit Augen: `getBoundingClientRect` der
Leisten, des Bretts und der ersten/letzten Karte gegen die Fenstergröße;
`getComputedStyle` für Deckkraft und Farbe; `innerText` für die Beschriftung.
Genau so ist T-05 aufgefallen. Für die Bildabnahme der KI-Motive habe ich
Kontaktbögen als JPEG gebaut und *die* angesehen — Dateien lesen geht, die
Seite ansehen nicht.

**Ehrliche Einschränkung dieses Berichts:** Die Aussage „das Spiel sieht gut
aus" kann ich nicht belegen. Belegt sind Aufbau, Maße, Farben und Verhalten.
Wer den Auftritt beurteilen will, muss die Seite selbst öffnen.

---

## T-10 — Der Bildgenerator macht aus „ein einzelner Apfel" ein Wimmelbild

**Schwere:** bremsend · **Art:** Werkzeug · **Stand:** gelöst

**Beobachtung.** Von 40 erzeugten Motiven waren vier unbrauchbar, alle mit
demselben Fehler: SDXL malte statt eines Gegenstands eine ganze Fläche davon
(ein Haufen Äpfel, ein Haufen Emojis, ein Muster aus Scheren, ein Gekritzel
aus Strichfiguren). Auf einer 75 px breiten Karte ist ein Haufen ein
Farbfleck — und zwei Farbflecken kann man im Memory nicht auseinanderhalten.
Das Motiv ist damit nicht „etwas schlechter", sondern kaputt.

Der Stilzusatz enthielt bereits „centered single subject". Er reicht nicht.

**Lösung.** Nachziehen mit `exactly one single …, isolated` im Prompt und
`many, multiple, group, pile, heap, pattern, repeated, tiled` im
Negativprompt. Danach waren drei der vier in Ordnung; bei zweien blieb ein
unruhiger Hintergrund, den ein enger Mittelschnitt beim Wandeln wegnimmt
(Tabelle `ZUSCHNITT` im Wandelskript).

**Was daran systematisch ist.** Ein Agent, der 40 Bilder erzeugt und sie nicht
ansieht, liefert vier kaputte Karten aus. Die Abnahme muss Teil des Ablaufs
sein, nicht ein guter Vorsatz — deshalb steht in `docs/ASSETS-MEMEMORY.md`
jetzt eine Abnahmeliste mit fünf Punkten, und Punkt 1 ist genau dieser.

---

## T-11 — `npm install` schreibt Rauschen in die Sperrdatei

**Schwere:** stolpert · **Art:** Werkzeug · **Stand:** umgangen

**Beobachtung.** Das neue Paket in die `workspaces` aufzunehmen verlangt ein
`npm install`. Das fügt der `package-lock.json` neben den vier gewünschten
Zeilen **15 fremde `"peer": true`-Marken** hinzu, verteilt über die ganze
Datei. CLAUDE.md kennt das („erzeugt nur `"peer": true`-Rauschen in
package-lock.json — vor dem Commit zurücknehmen"), sagt aber nicht, wie.

Von Hand ist das nichts: 15 Stellen, jede mit einem Komma davor, das
mitwandert.

**Notbehelf.** Ein kleines Skript vergleicht die Datei mit dem Stand aus
`HEAD` und entfernt genau die `peer`-Schlüssel, die vorher nicht dastanden.
Danach ist der Unterschied 17 Zeilen, alle gewollt und alle prüfbar. Das ist
wichtig, weil CLAUDE.md Regel 7 verlangt, vor dem Commit die *Zahl* der
geänderten Zeilen gegen die Erwartung zu halten — mit dem Rauschen wäre diese
Prüfung wertlos.

**Vorschlag ans System.** Das Skript gehört ins Repo (`werkzeug/lock-saeubern.mjs`),
nicht in jede Sitzung neu. Oder die Ursache abstellen: Das Rauschen entsteht
durch eine npm-Version, die `peer`-Marken anders schreibt als die, mit der die
Datei zuletzt erzeugt wurde.
