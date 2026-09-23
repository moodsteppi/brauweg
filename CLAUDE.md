# Brauweg — für Agenten

Kartenspiel-Plattform, **dreizehn Spiele laufen**: Doppelkopf, Zauberer, Skat,
Cambio, Poker (easypoker), Mememory, Filler, Eiland, Feldherr, Tafelrunde,
Golf, Partykiste und BroCooked.
Diese Datei ist die Kurzfassung; sie steht hier, weil die ausführlichen Regeln
in `docs/STAND.md` erst ab Zeile 55 kommen und sonst niemand sie findet.

Fünf davon halten sich nicht an die üblichen Annahmen, und wer das nicht weiß,
sucht lange: **Feldherr** ist ein Echtzeitduell ohne Zugfolge (`currentActor`
ist immer null, `legalActions` immer leer; Trophäen gibt es seit dem
4.9.2026 wie überall, abgesichert nur durch die Doppelmeldung beider Geräte —
siehe `docs/FELDHERR-PLAN.md`), **Golf** (seit dem 6.9.2026) geht denselben
Weg für bis zu acht Spieler — die Physik läuft auf den Geräten, der Server
verwahrt nur die Schlagliste, und statt auf den Langsamsten zu warten, spult
jedes Gerät bei einem verspäteten Schlag zurück (`docs/GOLF-PLAN.md`; die
Schaupause `interludeMs` ist dort das Sicherheitsnetz gegen tote Tische, nicht
eine Anzeige), bei **Skat** (Drücken, Ansage) sowie beim
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
Zettel. **BroCooked** (hektische Küche, seit dem 22.09.2026) geht denselben Weg wie
Golf — Eingaben über die Leitung, Küche auf den Geräten
(`docs/SPEZIFIKATION-BROCOOKED.md`) —, ist aber das erste **Miteinander**:
Es gibt EINE Punktzahl, und `standings` setzt alle auf Platz 1. Wer dort eine
Rangfolge einzieht, baut ein anderes Spiel. Allein und zu zweit läuft es
sogar ganz ohne Tisch, weil der Server je Verbindung nur einen Sitz kennt.
**Tafelrunde** (Auto-Battler, seit dem 4.9.2026) macht es wie Eiland —
alle rüsten gleichzeitig, `currentActor` nennt trotzdem einen Sitz — hat aber
noch einen eigenen Dreh: `legalActions` ist dort weder leer noch vollständig.
Kaufen, Würfeln, Aufsteigen und Verkaufen stehen drin, das Verschieben nicht
(es wäre ein Paar aus 19 Plätzen). Weil man das einer Liste nicht ansieht,
sagt die Meta des Moduls es ausdrücklich: `legalActionsUnvollstaendig: true`.

**Ausführlich:** `docs/STAND.md` (Übergabezettel, offene Punkte, was schon
schiefging) · `docs/DESIGN.md` (Gestaltung, Bilder) · `docs/KLANG.md` (Töne und
Musik — Herkunft, Lizenzen, Auslagerungsgrenze) ·
`docs/plattform-plan.md` (das große Ganze) · `docs/TAFEL.md` (die
Visual-Building-Tafel: lesen, pflegen, erzeugen) · `docs/TRIPO.md` (3D-Modelle
erzeugen: wohin der API-Schlüssel gehört, was für Tafelrunde geht) ·
**`docs/JETZT-AUSFUEHREN.md` (Bilder einbauen, Schritt für Schritt — die
Werkzeuge stehen auf dem Rechner bereit)**.

---

## Die sechs Regeln, an denen man sonst scheitert

**1. Standardmäßig gegen `staging` arbeiten.** `main` löst den Deploy in die
Produktion aus. Ein Push nach `main` braucht keine bestimmte Person: Wer dich
in der Sitzung anweist, gibt ihn frei — frag vorher einmal kurz zur Sicherheit
nach (ein Prod-Deploy ist schwer rückholbar, siehe Regel 7), aber warte auf
niemand anderen. Vor jedem Push `git pull --no-rebase origin staging` — an
diesem Repo arbeiten mehrere Sitzungen gleichzeitig, auch Cursor. Merges sind
der Normalfall, kein Fehler. Nach einem Release muss `main` wieder Vorfahre
von `staging` sein (Rückfluss als echter Merge, kein Squash). Von Hand machen
muss ihn in der Regel niemand mehr: `.github/workflows/rueckfluss.yml` legt
nach jedem Push auf `main` den fertigen Rückfluss-PR nach `staging` an — es
bleibt das Freigeben, **als Merge-Commit, nicht als Squash**. Das Netz
darunter bleibt der Job „Rückfluss" in `.github/workflows/ci.yml`: Er wird bei
jedem Push auf einen der beiden Zweige rot, solange `main` kein Vorfahre ist —
am 06.09.2026 fiel es sonst erst Tage später am Release-Konflikt auf. Der
Grund für die Automatik steht im Kopf von `rueckfluss.yml`: Solange der
Rückfluss Arbeit war, wurde die Änderung stattdessen auf `staging`
nachgetippt („Uebernahme von main <hash>"), und genau daraus entstanden die
Konflikte.

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
nicht bei 1,7 MB. Genau das ist zweimal live gegangen. Gewandelt wird mit
`node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> [karten|szene|wappen]` —
der ganze Ablauf steht in `docs/JETZT-AUSFUEHREN.md`.

**Ob das Werkzeug da ist, hängt am Rechner — erst nachsehen:**

```bash
ls ~/bildwerkzeug/wandeln.mjs ~/bildwerkzeug/node_modules/sharp ~/klangwerkzeug/wandeln.mjs
```

Bis zum 23.09.2026 stand hier „Auf diesem Mac ist kein WebP-Werkzeug
installiert", als gelte das für jeden — dieselbe Mac-Zeit-Falle wie die
`gh`-Zeile weiter unten. Eingerichtet ist `~/bildwerkzeug` nur auf dem Mac;
auf dem Mood-XPS (Windows) fehlen beide Ordner, ebenso `cwebp` und `ffmpeg`.
**Fehlt das Bildwerkzeug:** Die Vorlage liegt im Archivrepo als
`brauweg-art/wandeln.mjs`, die Einrichtung (`sharp` in `~/bildwerkzeug`)
steht in `docs/JETZT-AUSFUEHREN.md` unter „Einmalige Einrichtung" — auf
Windows in Git Bash aufrufen, weil das Skript `sharp` über `$HOME` sucht.
**Fehlt das Klangwerkzeug** (ebenso `naht-heilen.mjs` und `vergolden.mjs`):
Davon gibt es keine Vorlage in einem Repo, es liegt nur auf dem Mac. Dann
nicht mit eigenen Zahlen nachbauen — die Profile sind die Norm, an der die
Dateigrößen hängen —, sondern melden bzw. als Worker mit `===BRAUCHT BRO===`
fragen. Ein selbst ausgedachtes Wandelskript ist genau der stille
Konventionsbruch, vor dem `docs/MEMEMORY-TICKETS.md` (T-01) warnt.

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
npm test          # alle Pakete (node --test) und der Client (vitest)

npm test | node werkzeug/pruefstand.mjs   # dieselbe Zählung wie in der CI
```

**Erst committen, dann messen.** Der volle Lauf dauert auf einem
Windows-Rechner rund eine Viertelstunde und baut den Client mit; wer Commit
und Push dahinter legt, verliert die ganze Arbeit, wenn die Sitzung im Lauf
endet. Am 09.09.2026 ist genau das zweimal hintereinander passiert — der Code
war beide Male fertig und lag im Arbeitsverzeichnis, auf dem Aufgabenzweig
stand trotzdem kein einziger Commit. Also: **zuerst die Änderung committen und
pushen, dann den vollen Lauf.**

**Die Zahlen trägt niemand mehr von Hand nach** — weder hier noch in
`docs/STAND.md`. Bis zum 19.09.2026 lautete die Regel andersherum, und mit
einem Worker ging das auf. An dem Tag liefen zehn gleichzeitig los: Sechs
Pull Requests kollidierten, alle in denselben drei Zeilen, keiner im Code.
Das ist kein Unglück, sondern die Regel selbst. Eine Zahl gilt nur für den
Zweig, in dem sie gemessen wurde, also **müssen** sich zehn ehrliche Messungen
widersprechen — und wer den Konflikt von Hand auflöst, trägt eine Zahl ein,
die der nächste Merge wieder falsch macht.

Gezählt wird trotzdem, nur woanders: Der CI-Job „Bauen und prüfen" wertet
seinen eigenen Lauf aus und schreibt die Aufschlüsselung in die Zusammenfassung
(`werkzeug/pruefstand.mjs`). Sie gehört damit zu genau einem Commit, statt in
einer Datei auf den nächsten Merge zu warten. Örtlich liefert
`npm test | node werkzeug/pruefstand.mjs` dieselbe Zeile.

**Was in die Fertigmeldung gehört, bleibt:** was der eigene Lauf ergeben hat —
und wenn er nicht mehr zustande kam, ausdrücklich, dass nicht gemessen wurde.
Eine geratene Zahl ist schlimmer als gar keine: Am 09.09.2026 hat ein Lauf so
„450 → 451" fortgezählt, gemessen waren es 468.

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

**Ob `gh` geht, hängt am Rechner — erst fragen, dann entscheiden.** Bis zum
07.09.2026 stand hier als Tatsache des Repos, `gh` sei nicht installiert und
das Remote laufe über SSH. Beides stammt aus der Mac-Zeit dieser Datei — Regel 4
sagte bis zum 23.09.2026 „Auf diesem Mac ist kein WebP-Werkzeug installiert" — und gilt
nicht überall: Auf dem Mood-XPS liegt `gh` 2.97.0, angemeldet als
`moodsteppi`, das Remote ist HTTPS, und `gh pr view`, `gh pr checks` sowie
`gh pr comment` laufen anstandslos. Also nicht raten, sondern nachsehen:

```bash
gh auth status && git remote -v     # geht es hier — und über welches Protokoll?
```

Meldet das ein angemeldetes Konto, gehen Pull Requests aus der Sitzung heraus:
lesen, prüfen, kommentieren, anlegen. Fehlt `gh` oder ist es nicht angemeldet,
geht davon nichts — **und das ist kein Freibrief zum Durchmergen.** Wer dann
was darf, hängt daran, wer arbeitet: Ein Mensch am eigenen Rechner führt selbst
nach `staging` zusammen (`ARBEITSREGELN.md`, Regel 1). Ein Worker im
Orchestrator **nicht** — er pusht seinen `aufgabe/…`-Zweig und hört dort auf,
ob mit `gh` oder ohne. Genau diese Verwechslung hat die alte Zeile angerichtet:
Ein Prüfauftrag zu PR #125 nahm sie ernst, versuchte den PR gar nicht erst zu
öffnen und fiel auf „gemerged wird direkt" zurück.

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
Feld auch wirklich liefern). Gedeckt sind alle dreizehn Spiele. Ein neues Spiel
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
  (Schneefeld: Faktor 25). Heilen mit `~/bildwerkzeug/naht-heilen.mjs` (liegt nur auf dem Mac, siehe
  Regel 4).
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
  steht vor `game-tafelrunde` und beide vor `server`. Wann dieser Lauf
  drankommt — nämlich nach Commit und Push —, steht oben unter „Bauen und
  prüfen"; diese Stelle hier sagt nur, warum er nicht durch einen
  Einzelpaket-Lauf zu ersetzen ist.
- **Dieselbe Meldung, andere Ursache: `npm install` statt `npm run build`.**
  Sagt `tsc` ein Spielpaket nicht ansprechen zu können, obwohl dessen
  `packages/game-<spiel>/dist/src/index.d.ts` **existiert**, dann fehlt in
  `node_modules/@brauweg/` der Symlink auf das Paket — npm verlinkt einen neu
  hinzugekommenen Workspace erst beim nächsten `npm install`, und wer seit
  dessen Einzug keins gelaufen hat, sieht wortgleich `TS2307: Cannot find
  module '@brauweg/game-…'`. Bauen hilft dann nicht, egal wie oft. Erst
  nachsehen (`ls node_modules/@brauweg/`), dann `npm install` im
  Wurzelverzeichnis — `package-lock.json` bleibt unberührt; ändert npm dort
  doch etwas (peer-Flags), gehört es nicht in den Commit. Getroffen hat es
  `game-golf` (kam am 06.09.2026 dazu) am 07.09. auf zwei Rechnern und am
  08.09. noch einmal auf einem dritten. **Warum ausgerechnet ein einzelner
  Link fehlt, ist offen** — die Regel gilt darum für jedes frisch angelegte
  Paket.
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
