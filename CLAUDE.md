# Brauweg — für Agenten

Kartenspiel-Plattform, **zehn Spiele laufen**: Doppelkopf, Zauberer, Skat,
Cambio, Poker (easypoker), Mememory, Filler, Eiland, Feldherr und Tafelrunde.
Diese Datei ist die Kurzfassung; sie steht hier, weil die ausführlichen Regeln
in `docs/STAND.md` erst ab Zeile 55 kommen und sonst niemand sie findet.

Vier davon halten sich nicht an die üblichen Annahmen, und wer das nicht weiß,
sucht lange: **Feldherr** ist ein Echtzeitduell ohne Zugfolge (`currentActor`
ist immer null, `legalActions` immer leer; Trophäen gibt es seit dem
4.9.2026 wie überall, abgesichert nur durch die Doppelmeldung beider Geräte —
siehe `docs/FELDHERR-PLAN.md`), bei **Skat** (Drücken, Ansage) sowie beim
**Doppelkopf** (Armut) baut der Client die Aktion selbst aus der Sicht, weshalb
`legalActions` dort leer ist, obwohl jemand am Zug ist — und bei **Eiland**
ziehen beide **gleichzeitig**, obwohl `currentActor` einen Sitz nennt. Der
Server prüft `currentActor` beim Handeln nämlich gar nicht; das Modul nennt den
Sitz nur, damit Zugzeit, Bot-Übernahme und die Verlassen-Regel greifen (ohne
ihn bekäme ein Tisch von der Plattform keinen einzigen Timer). Wer handeln
darf, entscheidet allein `amZug` in `packages/game-eiland/src/partie.ts`: jeder,
dessen Zettel noch offen ist. Auch dort ist `legalActions` leer, und aus dem
Skat-Grund: Eine Aktion ist eine MENGE von Feldern, die sich nicht aufzählen
lässt — der Bildschirm stellt sie selbst zusammen und schickt sie als einen
Zettel. **Tafelrunde** (Auto-Battler, seit dem 4.9.2026) macht es wie Eiland —
alle rüsten gleichzeitig, `currentActor` nennt trotzdem einen Sitz — hat aber
noch einen eigenen Dreh: `legalActions` ist dort weder leer noch vollständig.
Kaufen, Würfeln, Aufsteigen und Verkaufen stehen drin, das Verschieben nicht
(es wäre ein Paar aus 19 Plätzen). Weil man das einer Liste nicht ansieht,
sagt die Meta des Moduls es ausdrücklich: `legalActionsUnvollstaendig: true`.

**Ausführlich:** `docs/STAND.md` (Übergabezettel, offene Punkte, was schon
schiefging) · `docs/DESIGN.md` (Gestaltung, Bilder) · `docs/KLANG.md` (Töne und
Musik — Herkunft, Lizenzen, Auslagerungsgrenze) ·
`docs/plattform-plan.md` (das große Ganze) · `docs/TAFEL.md` (die
Visual-Building-Tafel: lesen, pflegen, erzeugen) · **`docs/JETZT-AUSFUEHREN.md`
(Bilder einbauen, Schritt für Schritt — die Werkzeuge stehen auf dem Rechner
bereit)**.

---

## Die sechs Regeln, an denen man sonst scheitert

**1. Standardmäßig gegen `staging` arbeiten.** `main` löst den Deploy in die
Produktion aus. Ein Push nach `main` braucht keine bestimmte Person: Wer dich
in der Sitzung anweist, gibt ihn frei — frag vorher einmal kurz zur Sicherheit
nach (ein Prod-Deploy ist schwer rückholbar, siehe Regel 7), aber warte auf
niemand anderen. Vor jedem Push `git pull --no-rebase origin staging` — an
diesem Repo arbeiten mehrere Sitzungen gleichzeitig, auch Cursor. Merges sind
der Normalfall, kein Fehler.

**2. Alles auf Deutsch.** Bezeichner, Kommentare, Commit-Nachrichten,
Oberflächentexte. Kommentare erklären das **Warum**, nicht das Was — und
nennen oft den Fehler, den die Zeile verhindert. Wer eine Zeile ändert, deren
Kommentar einen Grund nennt, prüft erst, ob der Grund noch gilt.

**3. Migrationen von Hand schreiben.** `drizzle-kit generate` erzeugt hier
Anweisungen für längst vorhandene Spalten — die Snapshots unter
`packages/server/drizzle/meta/` sind veraltet (nur `0001`, `0002`, `0006`).
Selbst schreiben, Eintrag in `_journal.json` selbst ergänzen, und **vorher
prüfen, welche Nummer auf `origin/staging` schon vergeben ist.** Zwei
Sitzungen haben schon dieselbe `0012` benutzt. **Mehrere Befehle in einer
Datei brauchen zwischen sich die Drizzle-Trennzeile (Pfeil-Kommentar, siehe
`0016`).** Der PGlite-Prüfstand nimmt je Abschnitt nur einen Befehl; der
Server-Migrator ist nachsichtiger — `0016` lief deshalb im Deploy durch,
während 215 Tests rot waren. Und den Trenner nie im Kommentar zitieren:
gesplittet wird auf die wörtliche Zeichenkette, auch mitten im Kommentar.

**4. Bilder: Original ins Archiv, WebP ins Repo.** Originale liegen im
Repository [`moodsteppi/brauweg-art`](https://github.com/moodsteppi/brauweg-art),
`packages/client/art/` steht in `.gitignore`. Ausgeliefert wird
ausschließlich WebP unter `packages/client/public/`. **Beim Einbauen einer
Lieferung zuerst die Dateigröße ansehen** — eine Spielkarte liegt bei 80 kB,
nicht bei 1,7 MB. Genau das ist zweimal live gegangen. Auf diesem Mac ist
kein WebP-Werkzeug installiert; gewandelt wird mit
`node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> [karten|szene|wappen]` —
der ganze Ablauf steht in `docs/JETZT-AUSFUEHREN.md`.

**Für Klänge gilt dasselbe** mit `node ~/klangwerkzeug/wandeln.mjs <quelle>
<ziel.mp3> [sfx|musik]`. MP3, nicht Ogg — Safari spielt kein Ogg, und dort
läuft die Beta. Alle 23 Töne zusammen wiegen 123 kB und bleiben im Repo;
**Musik ab der fünften Schleife nicht mehr** — dafür steht
`VITE_KLANG_BASIS` bereit, siehe `docs/KLANG.md`.

**5. Neue Grafik wird bestellt, nicht beschrieben.** Eine Datei
`docs/ASSETS-*.md` mit Maßen, Freihalte-Zonen, Abnahmekriterien und einer
Liste, was **nicht** ins Bild gehört. Drei Fehler sind schon passiert und
gehören in jede Bestellung: Schachbrett statt Alphakanal, eingebrannter Text,
Originalauflösung unter `public/`.

**6. Fragen vorab bündeln, dann bis fertig durchbauen.** Nicht mittendrin
nachfragen.

**7. Vor jedem Commit `git diff --cached --stat` lesen — die Zahl, nicht die
Liste.** Am 5. August hat ein Commit 932 Dateien mitgelöscht (halber Server,
Migrationen, Doku) und ging so auf `staging`. Aufgefallen ist es erst danach:
**Build und alle 541 Tests liefen grün durch**, weil sie von der Platte lesen
und nicht aus dem Index. Auslöser war ein `git add` auf einen ignorierten Pfad
(`packages/client/art/`); danach stand fast alles als gelöscht im Index. Und
weil hier mehrere Sitzungen im **selben Arbeitsbaum** arbeiten, kann der Index
sich zwischen zwei Befehlen ändern — Index aufbauen und committen deshalb in
**einem** Aufruf, mit einer Plausibilitätsschwelle davor:

```bash
git diff --cached --stat | tail -1        # "N files changed" gegen die Erwartung
git diff --cached HEAD --diff-filter=D    # leer, wenn nichts weg soll
```

---

## Bauen und prüfen

```bash
npm run build     # im WURZELVERZEICHNIS, nie --workspace @brauweg/server
npm test          # 1.359 Tests in den Paketen (419 im Server), dazu
                  # 402 Client-Tests in 37 Dateien (vitest)
```

**Der Build im Wurzelverzeichnis ist keine Bequemlichkeit.** Baut man nur den
Server, ist die `.d.ts` von `@brauweg/game-api` der alte Stand, und `tsc`
meldet Felder als fehlend, die im Quelltext längst stehen (`xpBasis`,
`interludeMs`).

Testdateien liegen unter `packages/server/test/`. Von Hand aufräumen muss man
nach einem Zweigwechsel nichts mehr: Jedes `build` räumt sein `dist/` vorher
selbst (`werkzeug/dist-raeumen.mjs`), und `test` läuft über `build`. Der Grund
steht im Kopf des Skripts — getestet wird aus `dist/test/*.js`, und eine
kompilierte Testdatei ohne `.ts` bleibt sonst liegen und färbt den Lauf rot,
obwohl die Quelle sauber ist.

`gh` ist **nicht** installiert, das Remote läuft über SSH — Pull Requests
gehen aus einer Sitzung heraus nicht. Gemerged wird direkt.

---

## Wie der Code gebaut ist

**Der Server kennt kein einzelnes Kartenspiel.** Alles Spielabhängige läuft
über `GameModule` (`packages/game-api`). Ein neues Spiel ist ein neues Paket,
kein Eingriff in Server oder Client. Ein Spielmodul ist eine reine
Logikbibliothek: kein Netzwerk, keine Datenbank, keine Uhr, kein Zufall außer
dem übergebenen Seed.

**Sichtbarkeit entsteht ausschließlich in `viewFor`.** Der Client bekommt nie
den vollen Zustand und blendet nichts selbst aus. Bots laufen auf derselben
gefilterten Sicht und können deshalb bauartbedingt nicht schummeln.

**Der Client bildet keine Regel nach.** Schaltflächen entstehen aus
`legalActions`, die Kartenreihenfolge kommt als `order` vom Server.
Wo er es doch tut, weil das Modul die Aktion nicht aufzählen kann (Skat
Drücken/Schieben, Doppelkopf Armut), steht die Regel als reine Funktion in
`packages/client/src/tisch-auswahl.ts` bzw. `tisch-armut.ts` — geprüft, weil
sie sonst niemand abfängt.

**Der Client beschreibt jede Sicht ein zweites Mal** (`protocol.ts`) und
importiert sonst nichts aus den Spielpaketen. Damit ein umbenanntes Feld
nicht erst im Betrieb als leere Anzeige auffällt, hält `src/vertrag/` je
Spiel die Client-Typen gegen die echte Modulsicht: beim Übersetzen (die
Modulsicht muss auf den Client-Typ passen, und kein Feld darf nur noch im
Client stehen) und beim Prüfen (eine mit Bots gespielte Partie muss jedes
Feld auch wirklich liefern). Gedeckt sind alle zehn Spiele. Ein neues Spiel
bekommt eine Datei nach demselben Muster — und beschreibt seine Sicht **nicht
im Bildschirm**, sondern in `src/minispiele/<spiel>/sicht.ts`: Ein Vertrag,
der aus einer `.tsx` importiert, zieht React in den Test.

**Feldherr: `kern.js` und `feldherr.html` sind gebaut, nicht geschrieben.**
Quelle ist `packages/game-feldherr/quelle/teile/`, gebaut wird mit
`node packages/game-feldherr/werkzeug/bauen.mjs` — die Artefakte nie von Hand
ändern und nie als Quelltext lesen, der nächste Bau überschreibt sie.

**Preise stehen im Katalog, nie in der Datenbank** (`kosmetik.ts`,
`tischware.ts`). Besitz liegt in `account_cosmetic` mit freier Kennung —
deshalb ist eine neue Warenart eine Datei und keine Migration.

**Edelsteine kaufen alles, Münzen nicht alles; der Umtausch ist einseitig.**
Es gibt `edelsteineZuMuenzen()` und bewusst nichts daneben. Wer eine
Gegenrichtung ergänzt, macht jede Truhe zur Geldquelle und bricht das
Wirtschaftsmodell.

---

## Was regelmäßig Zeit kostet

- **React-Effekte an einen Schlüssel hängen, nicht an ein Objekt.** Ein
  Effekt mit dem Sichten-Objekt in der Abhängigkeitsliste läuft bei jedem
  Serverfunk neu und räumt seine Timer ab. So blieb der Rundenabschluss
  einmal komplett unsichtbar.
- **Am Tisch nichts stumm verwerfen.** `send()` verschluckte Aktionen bei
  toter Verbindung; am Handy stirbt sie genau dann, wenn man kurz woanders
  hinsieht. Jetzt hält eine Warteschlange sie kurz fest.
- **Bilder mit Alpha auf rotem Grund prüfen.** Schachbrett statt Alphakanal
  ist hier dreimal passiert. Bei **gestapelten** Ebenen (Pinguin) zusätzlich
  die Ecken prüfen: Eine undurchsichtige Ecke löscht alles darunter.
- **Vor einem `push --force` gegen `git ls-remote` prüfen, nie gegen den
  lokalen Stand.** Beim Historien-Schnitt am 4. August stand das lokale `main`
  auf einem uralten Commit — ein Spiegel-Push hätte die Produktion
  zurückgerollt.
- **WebGL-Leinwand in einem Blatt: nach dem Aufbau ein `resize` am `window`
  feuern.** Sonst bleibt die Bühne beim ersten Öffnen leer und füllt sich
  erst, wenn der Nutzer die Fenstergröße ändert. Die Höhe des Containers zu
  verstellen genügt **nicht** — R3F horcht über `react-use-measure` sowohl am
  Element als auch am Fenster, und nur der zweite Weg wirkt. Steht als
  `anstossen()` in `Avatarwerkstatt.tsx`.
- **Kein `<img>` auf eine Datei, die es noch nicht gibt.** Lieber ein Zeichen
  oder gar nichts: Ein weißer Kasten sieht nach Fehler aus, ein Notenzeichen
  nach Absicht. Beim Clan-Krieg ging das einmal fast so live.
- **Kachelbare Texturen vor dem Einbau auf Nähte messen.** Kantenabstand
  gegen Innenvarianz; über Faktor 3 sieht man die Linie, über 8 ist sie ein
  Balken. Von zwölf gelieferten Runner-Kacheln hatten drei echte Nähte
  (Schneefeld: Faktor 25). Heilen mit `~/bildwerkzeug/naht-heilen.mjs`.
- **In `<Canvas>` nichts laden, was anhalten kann, ohne es zu prüfen.**
  `useTexture` löste im Runner nie auf, obwohl alle Dateien mit 200 kamen —
  die äußere Suspense hängte die ganze Leinwand ab, Dauerladetext. Für
  Kulisse (Böden, Hintergründe) lieber `TextureLoader` in einem Effekt: Es
  gibt nichts anzuhalten, und bis das Bild da ist, steht eine Farbfläche.
  Und **niemals `clone()` je Instanz** — zwölf zusätzliche 1024er-Texturen
  kosteten den WebGL-Kontext ("Context Lost").
- **Bei `border-image` zählt nicht das Bild, sondern wo das Motiv darin
  liegt.** Die drei Knopfplatten sind alle 512 × 160, das Motiv belegt aber
  92 % (Holz), 77 % (Rot) und 63 % (Gold) der Breite. Mit demselben Randmaß
  fällt die Luft in die gestreckte Mitte: Der Knopf sieht schmaler aus als
  seine Nachbarn, obwohl alle `width: 100%` haben, und die Schrift steht über
  die Platte hinaus. Gemessen wird der Alphakanal auf der Mittelzeile, nicht
  die Dateigröße. Bestellung und Sollmaße: `docs/ASSETS-KNOEPFE.md`.
- **Vor Server- und Modultests erst die Spielpakete bauen.** `npm test
  --workspace @brauweg/server` und `--workspace @brauweg/game-tafelrunde`
  brechen mit `TS2307: Cannot find module '@brauweg/game-…'` oder `TS7006:
  … implicitly has an 'any' type` ab, solange die Pakete kein `dist` haben:
  Ihre `exports.types` zeigen auf `dist/src/index.d.ts`, und was nicht da ist,
  kann `tsc` nicht lesen. Das sieht nach einem kaputten Zweig aus und ist
  keiner — am 05.09.2026 zweimal genau daran gesucht. `npm run build` im
  Wurzelverzeichnis genügt: npm läuft die Pakete alphabetisch ab, `game-api`
  steht vor `game-tafelrunde` und beide vor `server`.
- **Keine Prüfkopie unter `AppData/Local/Temp`.** Liegt der Arbeitsbaum dort,
  sammelt Vite eine fremde `vite.config.ts` aus dem Wurzelverzeichnis ein, und
  der Testlauf stirbt schon beim Laden der Konfiguration. Der Fehler zeigt dann
  auf eine Datei, die gar nicht zum Repo gehört — gesucht wird er trotzdem im
  eigenen Zweig. Arbeitskopien bekommen einen eigenen Pfad.
- **Was das Modul weiß, schreibt der Client nicht ab.** Die Regel selbst steht
  oben unter „Wie der Code gebaut ist"; hier stehen die Fälle, an denen sie
  geschärft wurde — drei an einem Tag, dem 05.09.2026, alle drei in
  Tafelrunde. Der **Regelsatz**: `REGELSATZ` in `Tafelrunde.tsx` war eine
  wörtliche Kopie von `DEFAULT_REGELN` und ging als `config` an `createTable`.
  Der Server schreibt eine mitgeschickte `config` als Regelsatz des Tisches
  fest, die Kopie überstimmte also das Modul, ohne dass irgendwo ein Fehler
  auffiel; bei der Umstellung der Startleben (100 → 20 → 14) wäre das zweimal
  an jedem echten Tisch vorbeigelaufen. Die **Platzierung**: `platzTabelle` im
  Client war eine wortgetreue Abschrift von `platzierungen` aus `partie.ts` —
  möglich, weil alle Eingaben in jeder Sicht stehen, und trotzdem eine zweite
  Wahrheit über eine Regel. Wer im Modul das zweite Kriterium ändert, bekommt
  am Bildschirm eine andere Rangfolge als der Server. Der **Markenchip**: fast
  abgeschrieben statt herausgelöst. Zwei Fassungen wären beim ersten geänderten
  Zähler auseinandergelaufen, und der Gegner sähe anders aus als man selbst,
  obwohl beides dieselbe Zahl aus derselben Sicht ist. **Liefert die Sicht
  etwas nicht, das der Bildschirm braucht, ist die Antwort ein neues Feld in
  der Sicht — nicht eine zweite Rechnung im Client.**
- **`dist/` räumt sich nicht von selbst.** Getestet wird nicht aus den `.ts`,
  sondern aus `dist/test/*.js` (`tsc && node --test …`). `tsc` löscht nichts,
  was es nicht selbst neu schreibt, und weil `dist/` in `.gitignore` steht,
  räumt auch kein Zweigwechsel auf: Eine kompilierte Testdatei, deren Quelle es
  nicht mehr gibt, läuft weiter mit und färbt den Lauf rot, obwohl an der
  Quelle nichts falsch ist. Getroffen hat es Tafelrunde (Reste des abgelösten
  Regelkerns) und den Server (`suche.test.js`). Solange das Räumen nicht im Bau
  steckt, gehört `dist/` nach einem Zweigwechsel gelöscht — und wer ein Paket
  neu anlegt, sorgt dafür, dass dessen `dist/` beim Räumen mitkommt.

---

## Übergreifende Arbeitsregeln

Für alle Broweg- und goodFil-Repos gelten zusätzlich die gemeinsamen
Regeln — Git-Weg, Orchestrator, **Tafel-Pflicht (Visual Building)**:

@ARBEITSREGELN.md
