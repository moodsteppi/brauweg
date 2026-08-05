# Stand der Arbeit

Übergabe für eine neue Sitzung. Was hier steht, ist am 4. August 2026
geprüft — Zahlen und Zustände stammen aus tatsächlichen Läufen, nicht aus
der Erinnerung.

---

## Wo das Projekt steht

Brauweg läuft unter **www.brauweg-spielen.de**. **Zwei Spiele sind
spielbar: Doppelkopf und Zauberer**, der Hub steht, Clans funktionieren.
Der Deploy hängt an `main`: Was dorthin gemerged wird, ist nach etwa zwei
Minuten live.

**Prüfstand:** 128 Doppelkopf-Tests, 117 Zauberer-Tests, **259 Servertests**,
`tsc --noEmit` sauber. `npm test` und `npm run build` im Wurzelverzeichnis
decken beides ab.

**Vorsicht beim ersten Bauen in einem frischen Arbeitsbaum:** `npm run build`
im Wurzelverzeichnis, nicht `--workspace @brauweg/server`. Die `.d.ts` von
`@brauweg/game-api` ist sonst der alte Stand, und `tsc` meldet Felder als
fehlend, die im Quelltext längst stehen (`xpBasis`, `interludeMs`).

**Stand der Zweige am Ende des 4. August 2026:** `staging` trägt jetzt auch
den Edelstein-Umbau. Auf `staging` und noch **nicht in der Produktion**
liegen: Währungen, Truhen, Tagesaufgaben, der **gemalte** anziehbare Pinguin,
Clanchat, Clankrieg, Zurufe am Tisch, der erweiterte Shop und der Edelstein
als universelle Währung. Ob und wann das nach `main` geht, entscheidet Nils.

**Die Historie ist am 4. August umgeschrieben worden** (`git filter-repo`),
um die Bildoriginale aus der Vergangenheit zu entfernen: 977 MB → 143 MB, ein
frischer Klon dauert 7 statt vieler Sekunden. **Alte Klone von vor diesem Tag
sind unbrauchbar — neu klonen, nicht pullen.** Erhalten sind alle 194 Commits
und alle 51 Zweige; `staging` ist dateiweise unverändert geblieben, auf `main`
sind nur die Originale verschwunden.

> **Was dabei fast schiefging, zum Nachlesen:** Der erste Spiegel kam vom
> *lokalen* Repo, dessen `main` auf einem uralten Commit stand — ein
> Spiegel-Push hätte die Produktion zurückgerollt. Und der erste Schnittplan
> hätte die Kartenrückseiten mitgenommen, die `main` noch als PNG
> referenziert. Beides fiel nur auf, weil vor dem Push Zweigstände und
> Dateibäume verglichen wurden. **Vor einem `push --force --mirror` immer
> gegen `git ls-remote` prüfen, nie gegen den lokalen Stand.**

**Der Edelstein-Umbau ist eingearbeitet.** Er entstand in einer Sitzung auf
einer Windows-Maschine ohne Node und war dort nie übersetzt oder getestet;
beim Übernehmen lief beides nach und war grün. Die Einzelheiten und die
Begründungen stehen in [UEBERGABE-EDELSTEINE.md](UEBERGABE-EDELSTEINE.md) —
lesenswert vor allem der Abschnitt über die gewürfelten Kauftruhen, der vor
einem echten Bezahlweg noch einmal auf den Tisch gehört.

`staging` ist an diesem Tag einmal auf ausdrückliche Anweisung nach `main`
gebracht worden (Fast-Forward über 17 Commits), damit Stufen, Testkonten,
Cursors Rundenabschluss und die Doppelkopf-Nachbesserungen gemeinsam auf dem
Produktivsystem zu sehen sind. **Das war eine Ausnahme** — die Regel unten gilt
weiter: `main` wird aus einer Sitzung heraus nicht angefasst.

**Bilder:** `packages/client/public/` liegt bei 39 MB — `karten/` 24 MB,
`hub/` 10 MB. Gemaltes wird als **WebP** ausgeliefert.

**Die Originale liegen seit dem 4. August in einem eigenen Repository:
[`moodsteppi/brauweg-art`](https://github.com/moodsteppi/brauweg-art).**
`packages/client/art/` steht in `.gitignore` und gehört hier nicht mehr
hinein. Grund war der Deploy: Railway lädt bei jedem Bauen das ganze
Repository, und die Originale waren über 800 MB, die weder der Build noch
ein Nutzer je anfasst. Der Weg für neue Bilder steht in `docs/DESIGN.md`
unter „Wo die Originale liegen"; die Umwandlungsanleitung samt Richtwerten
in der README des Archivrepos.

> **Achtung beim Einbauen einer Lieferung:** Zuerst die Dateigröße ansehen.
> Eine Spielkarte liegt bei ~80 kB. Kommt sie mit 1,7 MB, ist es das
> Original und gehört gewandelt — genau das ist zweimal live gegangen.

**Der Ablauf steht in [JETZT-AUSFUEHREN.md](JETZT-AUSFUEHREN.md)** — von der
Lieferung bis zum Push, mit dem eingerichteten Werkzeug und den drei Fehlern,
die dabei schon passiert sind.

**Kein WebP-Werkzeug auf diesem Mac.** Weder `cwebp` noch `magick` noch
`sharp` ist installiert, und `sips` kann WebP zwar lesen, aber nicht
schreiben. Eingerichtet ist es unter `~/bildwerkzeug/`, samt Skript:
`node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> [karten|szene|wappen]`.
Es liegt außerhalb beider Repositories, weil es zum Rechner gehört und nicht
zum Projekt; eine Kopie liegt im Archivrepo.

---

## Wie hier gearbeitet wird

> **Kurzfassung steht in [`CLAUDE.md`](../CLAUDE.md) im Wurzelverzeichnis.**
> Sechs Regeln auf einer Seite — Agenten lesen die Datei automatisch, diesen
> Abschnitt hier findet nur, wer 800 Zeilen weit kommt. Wer eine Regel
> aendert, aendert beide Stellen.

**Gearbeitet wird gegen `staging`, nicht gegen `main`** (seit 4. August
2026): Zweig von `origin/staging`, Änderung, Zweig pushen, nach `staging`
mergen, `staging` pushen. **`main` wird aus der Sitzung heraus nicht mehr
angefasst** — was von `staging` nach `main` geht, entscheidet Jan.

Der Grund: `main` löst den Deploy aus. Bis dahin lag jede Änderung nach
zwei Minuten auf dem Produktivsystem, auch die, die man erst noch ansehen
wollte.

**Das Testsystem läuft** unter **staging.brauweg-spielen.de** — als eigene
Railway-*Umgebung* im selben Projekt, mit eigenem Postgres. Einzelheiten in
[STAGING.md](STAGING.md). Wichtigste Falle: Variablen gehören in Railway
je Umgebung; wer `STAGE` in der Produktion setzt, hat es auf staging nicht
gesetzt.

**Testkonten** (`account.is_staff`) haben alles: Premium, vollen
Münzstand, alles Kaufbare. Gesetzt wird das ausschließlich über
`STAFF_EMAILS` beim Start — kein Endpunkt, keine Oberfläche. Gefragt wird
an einer einzigen Stelle: `src/entitlements.ts`.

Vor dem Mergen immer `git fetch` — auf den Zweigen landen auch Commits aus
Cursor.

**`gh` ist nicht installiert**, und das Remote läuft über SSH. Pull
Requests lassen sich deshalb aus der Sitzung heraus nicht anlegen; gemerged
wird mit `git merge --ff-only`.

**Fragen vorab bündeln**, dann bis fertig durchbauen — nicht mittendrin
nachfragen.

**Bildbestellungen als Datei.** Neue Grafik wird nicht beschrieben, sondern
bestellt: eine Datei `docs/ASSETS-*.md` mit Maßen, Freihalte-Zonen,
Abnahmekriterien und einer Liste, was **nicht** ins Bild gehört. Der Nutzer
generiert danach und legt die Dateien unter `packages/client/public/hub/`
ab. Bis dahin laufen Platzhalter unter denselben Namen, damit der
Bildschirm vollständig funktioniert.

Drei Fehler sind dabei schon passiert und stehen deshalb in jeder
Bestellung: Schachbrett statt Alphakanal, eingebrannter Text, und
Originalauflösung unter `public/`.

**Migrationen** laufen in der Produktion automatisch (`MIGRATE_ON_BOOT` ist
gesetzt). Die Drizzle-Snapshots sind nicht durchgängig gepflegt —
`db:generate` erzeugt deshalb Anweisungen für längst vorhandene Spalten.
Migrationen werden von Hand geschrieben und im Journal eingetragen; zuletzt
`0012_waehrungen_truhen_aufgaben` (`account.gems` plus vier Tabellen:
`chest_claim`, `quest_progress`, `account_cosmetic`, `account_avatar`).
Durchgehend mit `IF NOT EXISTS` und einem `DO $$`-Block für den Enum-Typ — sie
darf zweimal laufen, ohne zu brechen. Davor `0011_erfahrung` (`account.xp`) und
`0010_testkonten` (`account.is_staff`).

Die 0009 legt `account_game_theme` an und übernimmt die bisherigen Werte
aus `account.card_deck` und `account.table_scene` nach `doppelkopf`. **Die
beiden alten Spalten stehen absichtlich noch da** und werden nicht mehr
gelesen: Fällt ein Deploy zurück, läuft die vorige Fassung damit weiter.
Sie dürfen weg, sobald dieser Stand eine Weile stabil läuft.

---

## Zwei Währungen, Truhen, Tagesaufgaben, Pinguin

Steht seit dem 4. August auf `staging`, geprüft an der laufenden Anwendung:
Truhe geöffnet, Aufgabenstand gelesen, Hut für 120 Münzen und Krone für 40
Edelsteine gekauft, angezogen, ausgezogen — dazu die Fehlerpfade (zweimal
öffnen, gesperrte Stufentruhe, zu wenig Münzen, Geschenk kaufen).

**Zwei Währungen, einseitiger Umtausch.** **Münzen** (`account.coins`) fallen
aus Truhen und Tagesaufgaben, **Edelsteine** (`account.gems`) nur aus Kauf oder
Geschenk. Seit dem Edelstein-Umbau gilt: **Geld kauft nur Edelsteine,
Edelsteine kaufen alles andere** — zum Kurs von 15 Münzen je Edelstein.

**Der Umtausch läuft nur in eine Richtung, und das ist keine Regel in einem
Kommentar, sondern eine fehlende Funktion:** Es gibt `edelsteineZuMuenzen()`
und bewusst nichts daneben. Solange aus Münzen keine Edelsteine werden, ist
keine Truhe und keine Tagesaufgabe ein Weg zu etwas, das Geld kostet. **Wer
`muenzenZuEdelsteinen()` ergänzt, bricht das Wirtschaftsmodell.**

**Jede Buchung läuft über `src/waehrung.ts`** — die einzige Stelle, an der ein
Guthaben sich ändert. Die Deckungsprüfung steht in der WHERE-Klausel und nicht
davor: `select` und danach `update` sind zwei Schritte, und zwischen ihnen passt
ein zweiter Kauf. So kann ein Stand bauartbedingt nie unter Null geraten.
Testkonten (`is_staff`) zahlen nicht, und ihr Stand schrumpft dabei nicht.

**Der VIP-Platz oben rechts ist jetzt der Edelstein.** VIP ist kein Guthaben,
sondern ein Zeitraum, und steht deshalb im Shop-Regal. So bleiben es drei
Pillen wie bisher — vier wären auf einem Hochkant-Handy eine zu viel.

**Truhen** (`src/truhen.ts`): eine **Tagestruhe** je Kalendertag (Holz, 1 bis 3
Münzen) und **elf Stufentruhen** bei den Stufen 2, 3, 5, 8, 12, 16, 20, 25, 30,
40, 50, in fünf Graden bis Diamant (60 bis 100 Münzen). **Nur Münzen drin** —
Truhen mit Kosmetik wären Zufallsboxen, und die schließt Plan 11 aus.

Zwei Dinge sind dort Absicht: **Gewürfelt wird genau einmal**, das Ergebnis
steht in `chest_claim` — würde die Anzeige neu würfeln, bekäme jeder mit genug
Neuladen die 3. Und der Eintrag kommt **vor** der Gutschrift, mit
`onConflictDoNothing`: Nur wer die Zeile wirklich angelegt hat, schreibt Münzen.
Andersherum zahlt ein doppelter Tipp zweimal.

**Tagesaufgaben** (`src/quests.ts`): sechs, **jeden Tag dieselben**. Ein
täglich wechselnder Satz bräuchte eine Auswahlregel, eine Verteilung über
Schwierigkeiten und eine Antwort darauf, was um Mitternacht mit halb erledigten
Aufgaben passiert; feste Aufgaben brauchen davon nichts. Zusammen 50 Münzen am
Tag. Gezählt wird am **Partie-Ende** (`countQuests` in `runtime/party.ts`),
auch an Tischen mit Bots — Aufgaben sind eine Belohnung fürs Spielen, keine
Wertung. Der Tag läuft in Europe/Berlin.

**Der Pinguin ist anpassbar:** **sechs Plätze** (Kopf, Augen, Oberteil,
Schuhe, Flosse, Aura), **33 Stücke**, je Platz eines zum Preis 0. Der Server kennt Kennung, Platz
und Preis (`src/kosmetik.ts`), das Aussehen kennt nur der Client — dieselbe
Trennung wie bei Kartenblatt und Szenerie. Getragen wird über
`account_avatar` (eine Zeile je belegtem Platz, kein Spaltensatz: ein sechster
Platz ist damit ein Katalogeintrag und keine Migration).

**Der Kauf gegen Münzen und Edelsteine läuft wirklich.** Alles, was echtes Geld
kostet — Münz- und Edelsteinpakete, VIP, Season Pass —, zeigt Preis und Inhalt
und sagt beim Antippen „Kommt bald": **Es gibt dafür keinen Endpunkt.** Die
Cent-Beträge in `src/shop.ts` sind Platzhalter; Plan 13 führt die Preise noch
als offenen Punkt.

**Das Geburtstagsoutfit ist jetzt tragbar.** `hut-partyhut` und
`aura-konfetti` sind `herkunft: 'geschenk'`, stehen in keinem Regal und sind
nur über die Geburtstagsbelohnung zu bekommen. Wären sie kaufbar, wäre der
Geburtstag belanglos. `account.hasBirthdayOutfit` bleibt stehen — die Spalte
trägt die Anzeige im Profil.

**Aufgaben und Truhen liegen auf einem Vollbild, nicht in einem sechsten Tab.**
Die Tab-Leiste hat laut DESIGN.md fünf Plätze mit „Spielen" mittig und größer;
ein sechster nimmt die Mitte weg und damit die einzige Stelle, die ein Daumen
ohne Hinsehen trifft. Der Weg hinein ist die Truhe am rechten Rand des
Startbildschirms — dort stand vorher „Der Tagesbonus, bald". Ein roter Punkt
daran sagt, dass etwas bereitliegt; die Zahlen dafür kommen als `bereit` aus
`/api/me`, mit zwei schlanken Zählabfragen statt der vollen Listen.

**Der Pinguin ist gemalt — geliefert und eingebaut.** Alle 34 Bilder (Basis
und 33 Stücke) liegen als 3D-Render im Stil des Ritter-Pinguins vor, gewandelt
532 kB für alles, im Schnitt 14 kB je Stück. Die **Zeichnungen bleiben als
Rückfall** stehen, auch die der Basis (`PinguinBasisGezeichnet`): Fällt eine
Datei aus, ist der Pinguin schlicht statt weg.

**Der sechste Platz „Augen" ist neu.** Eine Sonnenbrille hätte sonst am Hut
gehangen — wer sie aufsetzt, müsste die Mütze abnehmen. Beim Zeichnen liegt
die Brille **unter** dem Hut, damit ein breiter Hutrand darüberfällt.

**Was bei der Abnahme wirklich zählt** (die Prüfungen sind in
`ASSETS-PINGUIN.md` festgehalten und haben sich bewährt): alle 480 × 512 mit
echtem Alpha und **durchsichtigen Ecken** — eine undurchsichtige Ecke löscht
beim Stapeln alles darunter; jedes Stück in seiner Zone; die **Stapelprobe**
mit sieben Ebenen; die **Hut-über-Brille-Probe**. Ein Skript dafür steht nicht
im Repo, die Prüfung lief über `sharp` (Maße, Alphakanal, Eckentransparenz,
Begrenzungsrahmen je Stück).

**Der Basis-Pinguin ist bewusst nicht `pinguin.png`.** Der ist ein Ritter mit
Helm, Schwert, Panzer und Umhang — also mit vier von sechs Plätzen belegt, und
ein Hut auf einem Helm sieht aus wie ein Fehler. Der Ritter bleibt, wo er steht
(Trophäenweg, Vorgabe fürs Profilbild); der Basis-Pinguin ist **dieselbe
Figur ohne alles**. Die **Passvorlage** liegt im Archivrepo unter
`pinguin/pinguin-zonen.png` samt Quelle; sie gehört als Referenzbild in jede
Bildgenerierung — zusammen mit `pinguin.png` als Stilvorgabe.

**Noch nicht gemalt:** Truhen, Edelstein und Aufgaben-Zeichen. Sie bleiben
SVGs im Bundle; die Bestellungen `ASSETS-TRUHEN.md`, `ASSETS-WAEHRUNGEN.md`
und `ASSETS-AUFGABEN.md` liegen bereit.

**Was bewusst nicht gebaut ist:** Kartenblätter und Szenerien bleiben im
Themen-Tab und sind nicht ins Shop-Regal kopiert — dort gibt es sie schon, mit
Vorschau in Tischgröße, und ein zweiter Weg dorthin wäre einer ohne Vorschau.
Der Shop verlinkt sie deshalb nur.

**Prüfstand damals: 211 Servertests** (54 neue in `waehrung`, `truhen`, `quests`,
`shop`, `waehrung-http`), Doppelkopf und Zauberer unverändert bei 128 und 117.

---

## Der Edelstein als universelle Währung — angefangen, NICHT fertig

**Nichts davon liegt auf einem Zweig.** Der Umbau ist als nicht committete
Arbeitskopie in einem zweiten Klon entstanden (`Documents\Claude\brauweg` auf
dem Windows-Rechner), 13 Dateien, +1.386/−138. Alle Einzelheiten,
Aufrufstellen und die noch fehlenden Tests stehen in
[UEBERGABE-EDELSTEINE.md](UEBERGABE-EDELSTEINE.md) — hier nur, was man wissen
muss, um es nicht zweimal zu bauen oder versehentlich dagegen zu arbeiten.

**Die neue Ordnung:** Echtes Geld kauft **nur Edelsteine**. Edelsteine kaufen
**alles andere** — Münzpakete, Truhen, Kosmetik. Der Kurs ist **15 Münzen je
Edelstein** (`MUENZEN_JE_EDELSTEIN` in `src/waehrung.ts`), abgeleitet aus den
Cent-Platzhaltern der kleinsten Pakete.

**Der Umtausch läuft einseitig: Edelsteine werden zu Münzen, Münzen nie zu
Edelsteinen.** Die alte Begründung gegen einen Wechselkurs — sonst wäre jede
Truhe indirekt eine Geldquelle — gilt weiter, trifft aber nur die
Gegenrichtung. Erspieltes bleibt erspielt. Im Code ist die Einseitigkeit
deshalb keine Regel in einem Kommentar, sondern eine **fehlende Funktion**: es
gibt `edelsteineZuMuenzen()` und bewusst nichts daneben. **Wer
`muenzenZuEdelsteinen()` ergänzt, bricht das Modell.**

Was sich sonst ändert:

- **Kosmetik hat zwei Preise**, Münzen und Edelsteine; bezahlt wird mit einer,
  der Käufer wählt. Gepflegt wird nur eine Zahl je Stück, die zweite leitet der
  Kurs ab — aufgerundet, damit der direkte Edelsteinpreis nie billiger ist als
  derselbe Betrag über den Umtausch. `Stueck.preis` ist damit ein Objekt
  (`{coins, gems}`) statt einer Zahl, und `Stueck.waehrung` fällt weg. **Das
  ist die einzige wirklich brechende Änderung.**
- **Die legendären Stücke sind dadurch erspielbar** (Krone 40 Edelsteine = 600
  Münzen). Bewusst hingenommen: teuer, aber nicht mehr unerreichbar für den,
  der nicht zahlt.
- **Die Münzpakete kosten Edelsteine** (500/1.500/4.000 für 35/100/250) und
  laufen wirklich, über `POST /api/shop/pakete/:paketId/buy`.
- **Drei Kauftruhen** gegen Edelsteine (`truhe-silber/-gold/-diamant`, 25/60/150
  Edelsteine, Spannen 250–500 / 650–1.150 / 1.700–2.800), über
  `POST /api/shop/truhen/:truheId/buy`. Gekauft ist geöffnet.
- **Season Pass bekommt einen Edelsteinpreis** (150), der VIP-Pass behält den
  Geldpreis. Beide bleiben „bald".
- **Keine Migration.** Der Doppelpreis lebt im Katalog, die Kauftruhen benutzen
  `chest_claim` samt bestehender `chest_grade`-Aufzählung unverändert. Wer eine
  `0015` dafür anlegt, hat etwas anders gebaut als beschrieben.

**Die Kauftruhen würfeln** — ausdrücklicher Wunsch, nachdem der Einwand vorlag.
Entschärft ist es an zwei Stellen: Die Spanne steht dran, und ihre Mitte ist
genau der Kurs, das Würfeln kostet im Erwartungswert also nichts; daneben steht
ein Münzpaket mit fester Zahl. **Vor dem Anschluss eines echten Bezahlwegs
gehört das trotzdem noch einmal auf den Tisch:** Eine gewürfelte Ausschüttung
auf eine mit Geld gekaufte Währung ist derselbe Grenzbereich, wegen dem Plan 11
Einsätze und Zufallsboxen schon ausschließt. Der Hinweis steht auch im Kopf von
`src/truhen.ts`.

### Was dem Einarbeiten im Weg steht

**Es ist nicht gebaut und nicht getestet.** Auf dem Rechner, auf dem der Umbau
entstand, ist **kein Node.js installiert** — kein `npm install`, kein
`npm run build`, kein `tsc`. Jede Aufrufstelle der geänderten Signaturen ist
von Hand durchsucht, aber Handarbeit ist kein Compiler. Erwartbar sind
Kleinigkeiten, die eine Übersetzung in Sekunden findet.

**Sechs Dateien überschneiden sich mit der zweiten Sitzung dieses Tages:**
`server/src/shop.ts`, `server/src/http/app.ts`, `client/src/api.ts`,
`client/src/i18n.ts`, `client/src/screens/GameSelect.tsx`,
`client/src/styles.css`. Ein Merge ohne Nacharbeit gibt es hier nicht.

**Die schwerste Stelle ist `tischware.ts`.** Der neue Katalog für Szenerien,
Rückseiten, Wappen und Zurufe trägt das **alte Ein-Währungs-Modell**
(`preis: number` plus `waehrung`) und läuft durch dasselbe `kaufen()`, das der
Umbau um einen Währungsparameter erweitert. Beides zusammen heißt: **Tischware
braucht denselben Doppelpreis wie die Pinguin-Kosmetik**, sonst gilt „mit
Edelsteinen ist alles zu haben" für die halbe Auslage nicht. Das ist der Teil,
der in der Übergabe noch fehlt — sie wurde geschrieben, bevor `tischware.ts`
existierte.

Reihenfolge, die sich daraus ergibt: erst Node installieren und den Umbau für
sich übersetzen und testen, dann `tischware.ts` auf `Preis` umstellen, dann auf
`origin/staging` mergen — nicht umgekehrt.

---

## Stufen und Erfahrungspunkte

Steht seit dem 4. August. Zwei Regeln, mehr nicht:

1. **Eine gelegte Karte, ein Punkt.** Belohnt wird Mitspielen, nicht
   Gewinnen — wer verliert, geht nie leer aus.
2. **Doppelt für jeden mit positivem Trophäengewinn.** Bewusst am
   Vorzeichen festgemacht und nicht am Platz: Damit braucht die Plattform
   kein Spielwissen. Beim Doppelkopf trifft es die Plätze eins und zwei,
   beim Skat den Sieger, beim Zauberer jeden mit positivem Ergebnis.

**Keine Tabelle, eine Formel** (`packages/server/src/level.ts`). Der
Aufwand je Stufe wächst linear, die Summe damit quadratisch: 40, 60, 80 …
1000 für Stufe 50, insgesamt 25.480 Punkte. Eine Doppelkopf-Partie über
vier Runden gibt 48 Punkte, 96 für die vordere Hälfte — Stufe 50 sind also
rund 350 Partien. Die Kurve ist nach oben offen; eine Tabelle bis 50 wäre
bis Stufe 50 richtig und danach falsch.

**Die Stufe wird gerechnet, nicht gespeichert.** Sonst gäbe es zwei
Wahrheiten. In der Datenbank steht nur `account.xp` (Migration
`0011_erfahrung`). Der Client bekommt Stufe und Fortschritt fertig — wird
die Kurve nachjustiert, gilt das sofort und nicht erst nach dem nächsten
App-Update.

**Wie viele Karten eine Partie hatte, weiß nur das Modul.** Dafür gibt es
`GameModule.xpBasis`: Doppelkopf rechnet Blattgröße mal abgerechnete
Runden, der Zauberer die Summe der Rundennummern. Fehlt der Haken, gibt es
keine Punkte statt geratener. Nur abgerechnete Runden zählen — sonst wäre
Abbrechen kurz vor Schluss eine Rechenaufgabe statt einer Entscheidung.

Angezeigt wird es als Balken oben im Profil; angetippt öffnet sich die
Leiter (`/api/me/levels`, eigener Endpunkt, weil `/api/me` bei jedem Laden
läuft). Bildbestellung dafür: `docs/ASSETS-STUFEN.md` — bis dahin sind
Plakette und Balken einfache Farbflächen.

**Zum Ausprobieren einen Punktestand setzen** (es gibt bewusst keinen
Endpunkt dafür — ein Weg, sich selbst Punkte zu geben, wäre der lohnendste
Angriffspunkt der App):

```sql
UPDATE account SET xp = 330 WHERE email = 'DEINE-ADRESSE';
```

330 ergibt Stufe 5 mit 50 von 120 Punkten, also einem halb gefüllten
Balken. Die Grenzen: Stufe 2 ab 40, Stufe 3 ab 100, Stufe 4 ab 180,
Stufe 5 ab 280, Stufe 6 ab 400.

**Zum Ausprobieren Guthaben setzen** — auch dafür gibt es bewusst keinen
Endpunkt, aus demselben Grund:

```sql
UPDATE account SET coins = 2000, gems = 200 WHERE email = 'DEINE-ADRESSE';
```

Mit `xp = 330` stehen zugleich drei Stufentruhen offen (Stufe 2, 3 und 5).
Wer alles auf einmal sehen will, nimmt lieber ein Testkonto: `STAFF_EMAILS`
setzen und neu starten — dann ist alles besessen und nichts wird abgebucht.

## Am 5. August fertig geworden: Ton

**Ausführlich in `docs/KLANG.md`** — hier nur, was man beim Weiterbauen
wissen muss. Keine Migration; die Warenarten `klang` und `musik` sind eine
Datei, wie es `tischware.ts` verspricht.

**Einstellungen gibt es jetzt als eigenes Blatt** im Profil-Tab, oben mit dem
Zahnrad. Darin nur die zwei Regler: Sounds 0–100, Musik 0–100. Bisher gab es
überhaupt keinen Ort für Einstellungen — Sprache und Benachrichtigungen können
dort nachrücken.

**Was man hört, steht in der Klanghalle**, einem eigenen Bildschirm neben dem
Kleiderschrank im Profil. Dort liegen die gekauften Musikstücke und
Klangpakete, jedes mit einem Abspielknopf. Die Trennung ist Absicht: Zwei
Regler sind eine Einstellung, eine wachsende Sammlung ist Besitz — läge beides
im selben Blatt, schöbe die Sammlung die Lautstärke immer weiter nach unten.

**Vorgehört wird auch im Shop**, an der Kaufrückfrage. Klang und Musik kauft
man nach Gehör und nicht nach Namen; der Knopf steht deshalb vor der
Währungsfrage.

**23 Töne, 123 kB zusammen**, alle CC0 von Kenney, plus ein zweites Paket
„Glas" mit 8 Dateien. Die Originale liegen im Archivrepo unter `klang/`.
Gewandelt wird mit `~/klangwerkzeug/wandeln.mjs` — auf diesem Mac ist weder
`ffmpeg` noch `lame` noch `sox` installiert, und `afconvert` kann kein MP3.

**Was am Tisch klingt, steht in `tisch/klangtisch.ts`, nicht in den Tischen.**
Derselbe Grundsatz wie bei den Emotes: Der Haken bekommt nur Zahlen und
Wahrheitswerte, kennt kein Spiel, und ein neuer Klang gilt sofort für beide.
Wer einen Klang in `Table.tsx` einbaut, hat ihn beim Zauberer vergessen.

> **Die eine Zeile, um die es beim Ton wirklich ging:**
> `navigator.audioSession.type = 'ambient'`. Ohne sie hält iOS beim ersten
> eigenen Ton die Musik in jeder anderen App an — man startet eine Partie,
> und Spotify ist weg. Der Preis steht auch in den Einstellungen, weil man es
> sonst für kaputt hält: Am iPhone schaltet der Klingelschalter uns mit stumm.

**Vibration war kurz gebaut und ist am selben Tag wieder herausgeflogen.**
Safari kennt `navigator.vibrate` nicht, weder am Handy noch am Rechner. Ein
Schalter, den die halbe Beta nur abgeblendet sieht, wirft Fragen auf, statt
etwas einzustellen. Wie er zurückkäme, steht in `docs/KLANG.md`.

**Vier Musikstücke**, alle CC0 von OpenGameArt, zusammen 5,2 MB. `stube` ist
kostenlos, die anderen drei kosten. Die Lizenz wurde auf jeder Einzelseite
nachgesehen und nicht der Sammlung geglaubt, in der sie stehen.

**Zwei Dinge sind bewusst offen und keine Vergesslichkeit:**

- **Beim fünften Musikstück steht der Umzug an.** 5,2 MB sind die Obergrenze
  dessen, was ich noch im Repo lassen würde; `VITE_KLANG_BASIS` ist dafür
  eingebaut und kostet keine Codeänderung, weil Musik über ein einfaches
  `<audio>` läuft und deshalb keine CORS-Kopfzeilen braucht.
- **`sieg`, `niederlage`, `stufe`** sind nach Länge und Instrument gewählt,
  nicht nach Gehör — in keinem Dateinamen steht, welcher Jingle nach Sieg
  klingt. Einmal anhören, notfalls Datei desselben Namens drüberlegen.
- **Klang und Musik haben keine Grafik.** Im Shop steht ♪ beziehungsweise ♫
  statt eines Bildes. `WareRegal` nimmt dafür jetzt `bild: () => null` — ein
  `<img>` auf eine fehlende Datei wäre ein weißer Kasten, und genau das ging
  beim Clan-Krieg schon einmal fast live.

## Am 5. August: Profil-Tab und die Sache mit den Knöpfen

**Der Profil-Tab war der einzige, der den Tafel-Baustein nicht benutzt hat.**
Jeder Abschnitt ein eigener Kasten aus CSS-Verlauf mit goldenem Strich und
`box-shadow: 0 4px 0`. `DESIGN.md` sagt seit jeher „Neue Hub-Inhalte gehören
in eine Tafel, nicht in einen eigenen Kasten"; der Shop hält sich daran, das
Profil hielt sich nicht daran. Jetzt schon: Deine Sachen, Geburtstag,
Trophäen, Freunde, Konto.

**Alles Konto-artige liegt jetzt an einem Ort und als richtige Knöpfe.**
Vorher standen Einstellungen ganz oben allein, Benachrichtigungen und Abmelden
irgendwo unter der Freundesliste, und „Konto löschen" war eine nackte
Textzeile — drei Bauformen für dieselbe Art Sache. Reihenfolge in der Tafel
ist Absicht: harmlos oben, endgültig unten, Löschen allein in der letzten
Zeile.

**Der Klangschrank heißt jetzt Klanghalle.** Datei, Bauteil, CSS-Klassen,
Texte.

> **Die eigentliche Ursache steht in `docs/ASSETS-PROFIL.md`:**
> `menue-knopf-holz.webp` heißt Holz, ist aber eine flache blassolive Pille
> mit dünnem Strich — keine Maserung, keine Standfläche, keine Tiefe. Die
> Bestellung dafür (`ASSETS-MENUE.md`) hatte „gemaltes Holz, warme Töne"
> verlangt; geliefert wurde etwas anderes, und es ist so eingebaut worden.
> `menue-blatt.webp` und `menue-feld.webp` aus derselben Bestellung **sind**
> richtig gemaltes Holz mit Messingnieten. Die Knöpfe sind die Ausreißer, und
> sie stehen auf jedem Bildschirm der App.
>
> Der Abnahmepunkt, der das verhindert hätte und jetzt in jeder Bestellung
> steht: **das neue Bild neben `menue-blatt.webp` legen und fragen, ob es nach
> demselben Haus aussieht.**

Bis die neuen Bilder da sind, leihen sich die drei Profilkacheln vorhandene
Symbole. Das sieht ungenau aus, aber nicht kaputt — ein `<img>` auf eine
Datei, die es nicht gibt, wäre ein weißer Kasten.

## Am 4. August später fertig geworden (zweite Sitzung)

Alles auf `staging`, Stand `66b6d25`. Migrationen **0013** (Clanchat und
Clankrieg) und **0014** (Kartenrückseiten).

### Clanchat

Nachrichten, Systemzeilen, Löschen. `packages/server/src/clubs/chat.ts`,
Ansicht in `packages/client/src/screens/ClanChat.tsx`.

- **Zwei Sorten Zeile:** was Mitglieder schreiben (`text`) und was der
  Server selbst vermerkt (`system` — Beitritt, Kriegsbeginn, Kriegsergebnis).
  Die Systemzeilen tragen kein Konto; damit kann sie niemand einem Mitglied
  unterschieben, und der Chat ist nebenbei die Chronik des Clans.
- **Gelöscht wird nie wirklich.** `deletedAt` markiert, der Text bleibt in
  der Zeile stehen, ausgeliefert wird er nicht mehr. Das hält die
  Reihenfolge stabil und macht eine Löschung nachvollziehbar. Löschen darf
  der Verfasser und die Leitung; **Systemzeilen lassen sich nicht löschen** —
  eine Chronik, die sich frisieren lässt, ist keine.
- **Abgleich per Polling, alle 3 s, mit `seit`-Parameter** — es kommt nur
  Neues über die Leitung. Ein WebSocket wäre sparsamer, aber der bestehende
  hängt an einem Tisch; ihn dafür umzubauen hieße, die Zustellung am
  Spieltisch anzufassen, und die funktioniert.

### Clankrieg

`packages/server/src/clubs/war.ts`, Ansicht in `ClanKrieg.tsx`. Die Regel
steht sichtbar auf dem Bildschirm, nicht in einer Hilfe:

1. **Platz 1 = 3 Punkte, Platz 2 = 1**, sonst nichts.
2. **Je Mitglied zählen höchstens 10 Partien.** Ohne Deckel entschiede der
   Vielspieler den Krieg allein.
3. **Nur Partien mit mindestens zwei Menschen am Tisch.** Trophäen gibt es
   inzwischen auch gegen Bots — einen Krieg gegen drei Bots zu farmen wäre
   das Gegenteil dessen, wofür ein Clankrieg da ist.

Dauer **48 Stunden**. Ein Krieg entsteht auf zwei Wegen: Gegnersuche (der
Server paart zwei suchende Clans) oder gezielte Herausforderung, die der
andere annehmen muss. Ein laufender Krieg lässt sich nicht absagen — sonst
zöge die unterlegene Seite kurz vor Schluss den Stecker.

- **Kein Hintergrunddienst.** Fällige Kriege werden **beim Lesen und beim
  Punkteschreiben** abgerechnet (`settleDueWars`). Ein Zeitgeber im
  Arbeitsspeicher überlebt keinen Neustart, und Railway startet den
  Container bei jedem Deploy neu.
- Angebunden am Partie-Ende über `recordWar` in `runtime/party.ts`. Die
  Regel liegt im Kriegsdienst, nicht dort: Die Datei kennt kein einzelnes
  Spiel und soll auch keine Wettbewerbsregel kennen.

### Zurufe (Emotes) an beiden Tischen

Gab es vorher an **keinem** Tisch. Jetzt an beiden, mit derselben Mechanik:
`server/src/emotes.ts`, `client/src/emotes.ts`, Bausteine in
`client/src/tisch/emote.tsx`.

- **Ein Zuruf ist kein Zustand.** Nicht gespeichert, in keiner Sicht,
  überlebt kein Neuladen. Wer zu spät hinsieht, hat ihn verpasst — wie am
  echten Tisch. Die `EmoteMessage` trägt deshalb auch keine Revision.
- **Feste Liste statt Freitext** ist der ganze Grund, warum es Zurufe gibt
  und keinen Tischchat: Aus fünf Sprüchen lässt sich niemand beleidigen.
  Damit braucht dieser Weg **keine Moderation**.
- **Doppelt gebremst**, Client und Server je 2 s, und **still**. Eine
  Fehlermeldung wäre genau die Aufmerksamkeit, auf die es der Dauerklicker
  abgesehen hat. Zuschauer dürfen nicht rufen.

### Shop: Szenerien, Rückseiten, Zurufe, Wappen

Neuer Katalog `packages/server/src/tischware.ts` — eine Datei, ein Kaufweg,
vier Sorten (`szene`, `ruecken`, `emote`, `wappen`; `blatt` steht bereit).

- **Besitz liegt in `account_cosmetic`**, derselben Tabelle wie die
  Pinguin-Kosmetik. Sie trägt eine freie Kennung und keinen Fremdschlüssel
  auf einen Katalog — deshalb war für die vier neuen Sorten **keine
  Migration** nötig. Die Präfixe (`szene-`, `ruecken-`, `emote-`, `wappen-`)
  halten die Kennungen auseinander.
- **Preis 0 heißt „gehört allen"** und erzeugt keine Besitzzeile. Die zehn
  Szenerien und acht Wappen der ersten Stunde bleiben kostenlos: Wer sich an
  seinen Filz gewöhnt hat, soll ihn nicht plötzlich kaufen müssen. Zwei
  Zurufe sind frei, damit auch ein neues Konto lachen und loben kann.
- **Geprüft wird beim Benutzen, nicht nur beim Kaufen** (`darfBenutzen`).
  Sonst wäre ein Aufruf mit fremder Kennung der Weg, eine gekaufte Szenerie
  zu benutzen, ohne sie zu haben.
- **Unbekannte Kennungen gelten als erlaubt.** Sie sind schon durch die
  Liste in `scenes.ts`/`decks.ts` gegangen; sperren hieße, dass ein
  vergessener Katalogeintrag eine bestehende Einstellung unbrauchbar macht.

**Kartenrückseiten sind eine eigene Kosmetik, getrennt vom Blatt.** Die
Rückseite sehen alle am Tisch, die Vorderseiten nur die eigene Hand. Damit
sind die zehn gelieferten Blätter schon verkaufbar, obwohl von ihnen erst
die Rückseite gemalt ist. Technisch hängt sie am **Deck-Objekt**
(`deckMitRuecken`, Feld `backSrc`) und nicht als Prop an jeder Karte — sonst
hätte jede der sechs Zeichenstellen einen weiteren Durchreiche-Prop
bekommen.

**Wappen kosten, aber geprüft wird der Besitz des Setzenden, nicht des
Vereins.** Ein Wappen gehört einem Menschen, ein Verein hat kein Konto. Wer
austritt, nimmt es dem Clan nicht wieder weg.

**Preise (vorläufig, alle in `tischware.ts`):** Szenerien 250–900, Rückseiten
200–900, Wappen 250–800, Zurufe 80–150.

### Doppelkopf-Nachbesserungen

- **Scharfer Doppelkopf** (ohne Neunen) ist als Regelkachel schaltbar. Die
  Engine konnte das Blatt längst (`deck: 'without9'`), es war nur nirgends
  einstellbar. 50 volle Partien ohne Neunen laufen sauber durch.
- **Botzüge im 0,8-Sekunden-Takt** statt 250 ms — man sieht jede Karte
  einzeln fallen.
- **Rundenpause**: Die fertige Runde bleibt liegen, bis alle anwesenden
  Sitze „Weiter" getippt haben oder 15 s um sind. Erst dadurch erscheinen
  Auswertung und Zwischenstand überhaupt.
- **Karten vormerken:** Wer nicht am Zug ist, tippt eine Karte an (goldener
  Rand); sobald er dran und die Karte zulässig ist, spielt sie von selbst.
- **Trophäen auch an Bot-Tischen.** Die alte Sperre ist raus — solange es
  wenige Mitspieler gibt, sollen auch aufgefüllte Tische zählen. Gebucht
  wird ohnehin nur auf Sitze mit Konto; wer ohne Wertung spielen will,
  stellt Training an.

---

## Am 4. August fertig geworden

**Das zweite Spiel: Zauberer** (intern `wizard`, das international als
„Wizard" bekannte Stichspiel). Vollständig — Engine, Adapter, Server,
eigener Tisch, Bildbestellung. Regelwerk in `docs/wizard-spec.md`,
Gestaltung in `docs/DESIGN-WIZARD.md`.

- **Der Name ist Absicht.** „Wizard" ist eine eingetragene Marke (Ken
  Fisher / US Games Systems, hier Amigo). Regeln sind nicht schützbar, ein
  Produktname schon — und die App soll in den App Store. Die interne
  Kennung bleibt `wizard`, weil sie in Datenbankzeilen steht.
- **Die Trennung hat gehalten.** Für das zweite Spiel war am Server genau
  eine Zeile in der Registrierung nötig. Kein Schema, keine Migration:
  `game_id` ist eine Textspalte.
- **Zwei Plattform-Lücken sind dabei aufgefallen** und behoben:
  `PLACEMENT_TROPHIES` kannte nur drei bis fünf Sitze und hätte am Ende
  jeder Sechserpartie geworfen; und die Filterknöpfe der Tischauswahl waren
  fest auf „3er/4er" verdrahtet — sie kommen jetzt aus `seatCounts` des
  Moduls.
- **`rotationSize` ist beim Zauberer 1.** Die kanonische Rundenzahl
  (60 Karten / Spieler = 20/15/12/10) geht durch keine Sitzzahl auf, die
  Plattform verlangt aber ein Vielfaches der Geberrotation. Es weicht die
  Gleichverteilung, nicht die Spiellänge; die Begründung steht ausführlich
  in `ruleset.ts` und im Spec.
- **Der Spieltisch ist zerlegt.** Was jedes Kartenspiel braucht — Sitzplan,
  Avatar, Handkarte, Stichstapel, Zugtimer, letzter Stich, Regelblatt,
  Wartebereich, Partie-Ende — liegt jetzt in `packages/client/src/tisch/`.
  `Table.tsx` (Doppelkopf) und `WizardTable.tsx` bauen darauf auf.
  Doppelkopf blieb dabei unverändert: dieselben 127 Tests, gleicher Ablauf.
- **Acht Hausregeln** sind schaltbar: Der letzte sticht, Es darf nicht
  aufgehen, Bonus für angesagte Null, verdeckt ansagen, blinde erste Runde,
  Geber wählt blind, trumpffrei, Narr = Geber wählt. Der Kern (Bedienpflicht,
  Zauberer schlägt alles, 20 + 10 / −10) ist fest.
- **„Der letzte sticht"** dreht die Reihenfolge um: Dann gewinnt der zuletzt
  gelegte Zauberer statt des ersten, und ein Stich aus lauter Narren geht an
  den letzten Narren. Trumpf und Farbe bleiben unberührt — dort entscheidet
  die Höhe. Im Standard lohnt es, früh zuzustechen; mit der Regel lohnt es,
  abzuwarten.
- **Am laufenden Server geprüft**, nicht nur in Tests: Sechsertisch mit
  fünf Bots, komplette Runden, Punktetafel, und die blinde erste Runde.
- **Bildbestellung `docs/ASSETS-WIZARD.md`:** volles gemaltes Blatt
  (52 Zahlenkarten, vier verschiedene Zauberer, vier verschiedene Narren,
  Rücken), zwei Zauber-Szenerien, Trumpf-Plakette. Bis zur Lieferung läuft
  alles auf dem Textblatt — **kein Platzhalter nötig**, weil `cardImage`
  unbekannte Karten von selbst als Text zeigt.

**Die Bilder sind geliefert und eingebaut** (noch am selben Tag):

- **Blatt „Zauberwald"** unter `public/karten/zauberwald/`, 61 WebP-Dateien
  bei 360 × 523, zusammen 1,8 MB. Originale in `art/zauberwald/`.
- **Zwei Szenerien** (`zauberturm`, `sternenwiese`) — bewusst für **alle**
  Spiele wählbar: Eine Szenerie ist der Untergrund, keine Regel.
- **Trumpf-Plakette** als Hintergrundbild von `.wiz-trumpf`.
- **Blätter sind jetzt spielgebunden** (`Deck.games`). Der Wähler zeigt nur
  Passendes, und `deckForGame()` fällt auf Text zurück, falls im Konto ein
  unpassendes Blatt steht. Beides ist nötig: Ein Zauberblatt hat keine Dame,
  ein Doppelkopfblatt keine Sieben — auch die Minimal-Blätter nicht, die
  deshalb ebenfalls auf Doppelkopf beschränkt sind.
- **Themen werden jetzt groß vorgeführt.** Ein Tipp auf Blatt oder Szenerie
  übernimmt die Wahl **und** öffnet eine Vorschau im Tischformat: gewählte
  Szenerie, ein Stich in der Mitte, die eigene Hand am unteren Rand, alles in
  den Größen des echten Tisches. Der Grund: Auf zu dunklem Untergrund
  verschwinden Kreuz und Pik, und ein Daumennagel verrät das nicht.

**Nach den ersten echten Runden am Handy nachgebessert** — vier Sachen fielen
sofort auf, eine davon war größer als sie aussah:

1. **Blätter stahlen dem Filz ein Drittel der Höhe.** `.doko > *:not(.doko-bg)`
   setzte `position: relative` und holte damit auch die Blätter zurück in den
   Fluss; als Flex-Kind nahm ein offenes Blatt Höhe weg. Am Zaubertisch ist
   fast durchgehend eines offen (Ansage), deshalb fiel es dort auf — **beim
   Doppelkopf war derselbe Fehler nur unsichtbar**, weil Vorbehalt und
   Pflichtansage nur Sekunden stehen. Gemessen: Filz 285 statt 585 Pixel.
2. **Die Trumpf-Plakette lag auf dem linken Mitspieler.** Sie stand auf halber
   Höhe — genau dort sitzt in jeder Verteilung jemand. Jetzt unten links, wo
   in keiner Sitzverteilung etwas liegt.
3. **Der Plakettenrahmen passte nicht zur Karte.** Das Bild wurde auf eine
   Fläche gezogen, deren Seitenverhältnis nicht stimmte, und die Beschriftung
   lag auf der Karte. Jetzt trägt der Rahmen die Bildränder als Polsterung
   (9,2 % seitlich, 4,2 % oben) und die Karte sitzt in seinem Fenster.
4. **Drei Handkarten lagen übereinander**, obwohl die halbe Breite frei war.
   Der Kartenabstand hing an der festen Zwölf des Doppelkopfs; er hängt jetzt
   an der Handgröße.

Dazu: In der blinden Runde wird die verdeckte Karte **angetippt** statt über
einen Knopf gespielt, und sie zeigt den Rücken des gewählten Blattes statt des
Textblatt-Musters.

**Was das kostet:** `packages/client/art/` wächst um 25 MB (die gelieferten
PNG-Originale). Das folgt der Regel aus `DESIGN.md` — Originale gehören ins
Repository, nicht unter `public/`. Wer den Klon klein halten will, muss diese
Regel ändern, nicht diese Dateien einzeln löschen.

### Startbildschirm nachgebessert (nach Handy-Rückmeldung)

- **Zwischen den Tabs wird gezogen, nicht nur getippt** (`GameSelect.tsx`,
  `.front-viewport`/`.front-track` in `styles.css`). Beim waagerechten Ziehen
  folgt der Inhalt dem Finger, die Nachbarseite schaut herein, beim Loslassen
  rastet sie ein oder federt zurück. Der laufende Zug steuert den Track
  **direkt über eine Referenz** — kein Rendern je Fingerbewegung, sonst
  ruckelt es; gerendert wird nur bei Zugbeginn (um die Nachbarn zu hängen) und
  beim Einrasten. **Nachbarn hängen nur während eines Zugs am Baum**, damit
  der Startbildschirm nicht alle fünf Tabs auf einmal lädt. Nur klar
  waagerechte Züge zählen, am Rand ohne Nachbar gibt es Gummiband, und in
  einer Vollbild-Auswahl (Spielwahl, Vorschau, Kommt-bald) steuert der Zug die
  Auswahl statt den Tab. Zwei Stellschrauben, falls das Gefühl am Gerät nicht
  stimmt: die Einrast-Schwelle (`Math.min(72, breite * 0.22)`) und die
  Rand-Dämpfung (`* 0.32`).
- **Der Pinguin steht im unteren Drittel, nicht mittig** (`Pfad.tsx`,
  `FIGUR_VON_OBEN = 2/3`). Er startet unten und steigt höchstens bis an die
  Grenze des unteren Drittels — gemessen 63 % von oben bei 550 Trophäen.
- **Große Zahlen in der Kopfzeile abgekürzt** (`kompakteZahl` in `i18n.ts`):
  `550 · 1,5K · 12K · 10M`. Der siebenstellige Testkonto-Münzstand (9.999.999)
  schob sonst Name und Level ineinander. Zusätzlich gibt der Name bei Enge
  zuerst nach (`front-spieler { flex: 1 1 auto }`), die Anzeigen rechts
  behalten ihre Breite.
- **Checkpoint-Marke tritt zurück, wenn der Pinguin darauf steht.** Bei genau
  500 saßen Pinguin und Feuerberg-Marke auf derselben Mittellinie; jetzt
  blendet sich die Marke aus, solange die Figur näher als eine Drittelkachel
  darauf steht (`is-verdeckt`).

Alles am laufenden Server mit einem Staff-Konto (550 Trophäen, 9.999.999
Münzen) durchgemessen: Münzen „10M+" ohne Überlappung, Pinguin bei 63 %,
Zug mit Nachbar-Vorschau, Einrasten, Zurückfedern, senkrechtes Ziehen ohne
Wechsel, Rand-Gummiband, Guard in der Spielauswahl.

---

## Am 3. August fertig geworden

- **Gemalte Hintergründe** für Tischauswahl, Tisch erstellen und Spieltisch.
- **Clans vollständig** (Plan 9.3): gründen, suchen, beitreten — offen oder
  auf Anfrage mit Warteschlange —, Mitgliederliste, Rangstufen
  (Anführer, Vize, Ältester, Mitglied), Rauswurf, Austritt,
  Admin-Nachfolge bei Kontolöschung.
- **Acht Tischszenerien**, persönlich wählbar wie das Kartenblatt, mit
  Vorschau auf echten Karten.
- **Abschlussbildschirm** gestaltet, mit gemalten Medaillen.
- **Startseite** randlos, gemalte Wegpunkte und Ortsschilder, Knöpfe über
  dem Bild.
- **Handkarten** als gerade Reihe von Rand zu Rand, die mit jeder gespielten
  Karte zusammenrückt; Legeanimation beim Tippen, Schütteln bei gesperrten
  Karten, keine Hervorhebung.
- **Fehler behoben:** Der Erstellen-Bildschirm schaltete jede Regel ab, auch
  Hochzeit und Armut — wer zwei Kreuz-Damen hielt, bekam sie nicht
  angeboten.
- **Kontolöschung** in der Oberfläche, mit Passwortabfrage. `DELETE /api/me`
  verlangt jetzt das Passwort im Rumpf; vier neue Servertests decken
  richtig, falsch, fehlend und nicht angemeldet ab.
- **Impressum und Datenschutzerklärung** als eigenständige Seiten unter
  `packages/client/public/rechtliches/`, verlinkt aus Anmeldung und Profil.
  Echte Adressen statt eines Blattes in der App, weil App Store Connect
  eine aufrufbare Datenschutz-Adresse verlangt und die Impressumspflicht
  auch den trifft, der sich nie anmeldet.
- **Bildbestellung `docs/ASSETS-MENUE.md`:** sieben dehnbare Bausteine für
  alle Menüblätter — Blattgrund, Eingabefeld, drei Knöpfe, Umschalter an
  und aus. Bewusst **ohne** Platzhalter, siehe die Begründung am Ende der
  Bestellung. Geliefert und eingebaut: `border-image` mit `fill`, das
  Randmaß im Bild wird über `border-image-width: 1` auf die tatsächliche
  `border-width` heruntergerechnet.
- **Anmeldung gestaltet.** Sie war der einzige Bildschirm ohne eine
  einzige CSS-Regel. Erbt jetzt den gemalten Satz aus den Menüblättern,
  dazu der bestellte Hintergrund. Der zweite Knopf ist eine Textzeile — er
  wechselt den Modus und ist keine Handlung wie „Anmelden".
- **Trophäenpfad aus sechs Biom-Kacheln**, angetippt scrollbar im
  Vollbild, öffnet an der Stelle des Pinguins. Die zwanzig von Hand
  vermessenen Stützpunkte sind **weg**: Nachgemessen weicht der Weg auf
  den gelieferten Kacheln im Mittel 1,4 bis 2,9 % von der Mittellinie ab,
  höchstens 9,8 % — auf einem Handy wenige Pixel. Der Weg ist die Mitte.
  Ein siebtes Biom ist ein Bild plus eine Zeile in `BIOME`.
- **Mails mit HTML-Fassung** (`src/mail/vorlage.ts`). Tabellen und Stile
  am Element, weil Outlook über die Word-Engine rendert. Kopfbild als
  **JPEG**, nicht WebP — Outlook zeigt WebP nicht an. Überschrift und Link
  stehen zusätzlich als Text da, weil viele Programme Bilder erst nach
  Bestätigung laden.

---

## iOS

**Die App steht und läuft im Simulator.** Eigenes Repository
`Brauweg-spiel-ios` neben diesem: eine SwiftUI-Hülle um einen `WKWebView`,
die den gebauten Client aus dem App-Paket ausliefert. **Kein Capacitor** —
die Begründung und alle Einzelheiten stehen in `docs/APPSTORE.md`.

Der eine Eingriff hier im Repository ist die **Anmeldung**: Für den Server ist
die App eine fremde Herkunft und bekommt kein Cookie. Sie trägt ihr Token
selbst, per `Authorization`-Kopf und am WebSocket als Unterprotokoll. Die
frühere Empfehlung `sameSite: none` trägt nicht — für `fetch` ließe sie sich
noch retten, für den WebSocket nicht, und dort hängt der Spieltisch. Siehe
`docs/SICHERHEIT.md`.

**Im Browser ändert sich dadurch nichts.** `packages/client/src/laufzeit.ts`
fällt ohne `window.BRAUWEG_APP` auf das bisherige Verhalten zurück.

**Der Shop erscheint im App-Paket nicht** (`zeigeKaufbares` in
`GameSelect.tsx`) — im Browser bleibt er sichtbar, dort gilt weiter die Regel
aus `DESIGN.md`.

**Vor jedem Bauen der App einmal `./scripts/web-uebernehmen.sh` im
iOS-Repository laufen lassen.** Ohne das liegt kein Client im Paket; die App
sagt das dann im Klartext, statt weiß zu bleiben.

**Prüfstand jetzt: 118 Engine-Tests, 125 Servertests** (acht neue für die
Token-Anmeldung, `test/app-huelle.test.ts`).

---

## Was offen ist

### Vor dem App-Store-Release zwingend

1. ~~Kontolöschung in der Oberfläche~~ — **erledigt.** Profil-Tab ganz
   unten, kleiner Textknopf unter „Abmelden", dann ein Blatt mit Warnung
   und Passwortabfrage. Das Passwort ist Absicht: Die Sitzung hält dreißig
   Tage, ohne die Frage genügte ein kurz aus der Hand gelegtes Handy.
2. ~~Versanddienst für E-Mail~~ — **erledigt, läuft.** Resend über die
   verifizierte Domain `brauweg-spielen.de`, DKIM und SPF als TXT bei
   Strato, der MX für den Return-Path auf der eigens angelegten Subdomain
   `send`.

   **Zwei Strato-Eigenheiten, die Zeit gekostet haben:** Die MX-Maske der
   Hauptdomain kennt kein Präfix und keine Zahl als Priorität, nur
   „niedrig"/„hoch". Deshalb die Subdomain `send` mit eigener
   MX-Einstellung — der MX der Hauptdomain darf **nicht** angefasst
   werden, dort hängt eine aktive Mailbox. Und Resend wollte Priorität 10,
   Strato macht daraus 20; das stört nicht, bei einem einzigen MX-Eintrag
   ist die Zahl bedeutungslos. Die Meldung „Invalid SPF MX" verschwand von
   selbst, sobald der MX propagiert war.

   **Merke fürs nächste Mal:** Steht im Log `=== MAIL an …`, läuft der
   Server ohne Versanddienst — das ist der `ConsoleMailer`. Fehlt
   `RESEND_API_KEY`, schreibt der Start außerdem eine Zeile mit `ACHTUNG`.
   Diese beiden Suchen beantworten die Frage in einer Sekunde.
3. **Rechtstexte: Gerüst steht, Angaben fehlen.** `/rechtliches/impressum.html`
   und `/rechtliches/datenschutz.html` sind angelegt und aus Anmeldung und
   Profil verlinkt. Die offenen Stellen sind **rot umrandet** — Name,
   Anschrift, Support-Adresse, Datenbankanbieter, Aufbewahrungsdauer der
   Protokolle. **Solange Platzhalter drinstehen, erfüllen die Seiten die
   Pflicht nicht.** Der Datenschutztext beschreibt, was die Anwendung
   tatsächlich tut (am Code geprüft), ersetzt aber keine Rechtsberatung.
4. Demokonto für die Prüfer — Einzelheiten in `docs/APPSTORE.md`. Wichtig
   ist der Hinweis, dass die Prüfer freie Plätze mit Bots füllen können; wer
   allein in einer leeren Lobby steht, meldet „App funktioniert nicht".
5. ~~Capacitor-Hülle und getrennte API-Adresse~~ — **erledigt**, aber anders
   als geplant: eigene Swift-Hülle statt Capacitor. Siehe oben und
   `docs/APPSTORE.md`.

### Aus dem Plan noch nicht gebaut

- **Vereinseigener Regelsatz je Spiel.** Das Schema hat nur eine einzelne
  Spalte; ohne zweites Spiel ist nicht entscheidbar, wie die Zuordnung
  aussehen soll.
- **Vereinspunkte und die zwei Ranglisten.** Die Berechnungsformel steht in
  `docs/plattform-plan.md` selbst noch unter den offenen Fragen.
- **Clanchat, Clantruhe, Clankrieg.** Stehen als Knöpfe da und melden
  „kommt bald" — so gewollt. Chat braucht Moderation (M8).
- **Bild-Upload für Szenerien.** Bewusst zurückgestellt: ein hochgeladenes
  Vollbild braucht Moderation, und die steht aus.

### Rund um das zweite Spiel noch offen

- ~~Die Rangliste zeigt nur Doppelkopf.~~ **Erledigt.** Das Ranglisten-Blatt
  hat jetzt Reiter: „Gesamt" (Summe über alle Spiele, `/api/rankings`) und je
  spielbarem Spiel einen (`/api/rankings/:gameId`). Die Reiter kommen aus den
  spielbaren Spielen, nicht aus fester Verdrahtung — ein drittes Spiel steht
  von selbst dort; bei nur einem Spiel bleiben sie weg (`RanglisteBlatt` in
  `GameSelect.tsx`, `.front-ranking-tabs`).
- **„Neu hier?" bleibt eine Bald-Attrappe** — bewusst so: Die Beta-Spieler
  kennen alle Spiele, ein Tutorial braucht es dafür nicht. Der frühere feste
  Doppelkopf-Text ist raus, der Knopf ist jetzt spielneutral („So funktioniert
  Brauweg").
- **Bot mit Kartengedächtnis** für den Zauberer ist bewusst zurückgestellt
  (Spec Abschnitt 14). Der jetzige Bot spielt solide auf sein Soll, merkt sich
  aber keine gespielten Zauberer/Trümpfe.

### Zauberer-Tisch: dieselben Animationen wie Doppelkopf

Der Zauberer-Tisch teilt Bausteine und CSS mit dem Doppelkopf, hatte aber drei
Tisch-Bewegungen noch nicht. Jetzt angeglichen:

- **Austeil-Zeremonie, verkürzt.** `DealCeremony` gibt es jetzt in zwei
  Taktungen (`VOLL`/`KURZ`); der Zauberer nutzt die kurze, weil er jede der bis
  zu zwanzig Runden neu gibt. Ausgelöst am Rundenbeginn (volle Hände, kein
  Stich, `roundNumber` als Schlüssel), einmal je Runde, Beitritt mitten in der
  Runde zeigt sie nicht. Die zwei hohen Sechser-Sitze (`to-left-high`/
  `to-right-high`) fehlten in den Flugbahnen und sind ergänzt.
- **Trumpf dreht sich auf.** Solange ausgeteilt wird, liegt an der Plakette ein
  Rücken; danach dreht sich die aufgedeckte Karte einmal auf (`wiz-trumpf-auf`).
- **Stich zieht zum Gewinner.** Nutzt Cursors `tc-sweep` (auf staging schon für
  Doppelkopf gebaut), erweitert um die zwei hohen Sechser-Sitze
  (`sweep-left-high`/`sweep-right-high`).

### Rund um Shop und Clan noch offen

- **Die 24 Vorderseiten je Blatt fehlen.** Von den zehn neuen Blättern ist
  nur die Rückseite gemalt; die wird als „Kartenrückseite" verkauft und
  funktioniert. Als **Blatt** stehen sie noch nicht zur Wahl — ohne
  Vorderseiten wäre die eigene Hand ein Feld aus kaputten Bildern.
  Bestellung liegt fertig: `docs/ASSETS-BLATT-VORDERSEITEN.md`.
  **Blattweise liefern lassen**, nicht kartenweise: Ein halbes Blatt lässt
  sich nicht freischalten. Einbauen ist danach je Blatt eine Zeile in
  `client/src/decks.ts`, `server/src/decks.ts` und `server/src/tischware.ts`.
- **Die Clantruhe** ist weiter eine ehrliche Bald-Attrappe — der einzige
  verbliebene Platzhalter in der Clanhalle.
- **Chat und Krieg haben keine eigenen Bilder.** Beide kommen mit dem aus,
  was da ist (Wappen, `icon-krieg`). Wenn sie eigene bekommen sollen,
  braucht es eine Bestellung; nötig ist sie nicht.
- **Kriegspunkte sind nirgends historisch.** Nach dem Ende steht nur der
  letzte Krieg im Chat und auf dem Kriegsbildschirm. Eine Chronik über
  mehrere Kriege gibt es nicht.

### Kleinkram

- Die Rolle **„Ältester"** hat noch keine Sonderrechte; sie verhält sich wie
  „Mitglied" und ist bisher nur eine Auszeichnung.
- **`pinguin-geburtstag.png`** und die Symbolvorlage liegen unter
  `packages/client/art/`.
- **Tab-Leiste am Spieltisch: entschieden — sie kommt nicht.** Der Entwurf
  zeigte sie, der Tisch bleibt trotzdem Vollbild. Drei Gründe: Ein
  Fehlgriff mitten im Stich lässt drei Leute sitzen und kostet nach drei
  Zeitüberschreitungen zehn Trophäen; der Tisch ist ein konzentrierter
  Modus, der Weg hinaus soll eine Entscheidung sein; und die Handkarten
  reichen seit „gerade Reihe von Rand zu Rand" bis an die untere Kante —
  eine Leiste dort schnitte genau in die Fläche, deren Abschneiden erst
  kürzlich als Fehler behoben wurde. Wer zwischendurch in den Clan will,
  nimmt Zurück; der Server schickt beim Zurückkommen die volle Sicht.

---

## Was in der letzten Sitzung schieflief

Damit es nicht zweimal passiert:

- **`drizzle-kit generate` erzeugt Migrationen, die auf der echten Datenbank
  scheitern.** Der Schnappschuss unter `drizzle/meta/` ist veraltet — es
  liegen nur `0001`, `0002` und `0006` dort, alles seither wurde von Hand
  geschrieben. `generate` diffft deshalb gegen einen Stand von vor zehn
  Migrationen und schreibt `CREATE TABLE`/`ADD COLUMN` für Dinge, die längst
  existieren. **Migrationen in diesem Projekt von Hand schreiben** und den
  Eintrag in `drizzle/meta/_journal.json` selbst ergänzen. Wer `generate`
  benutzt, muss die Ausgabe auf das wirklich Neue zusammenstreichen.
- **Zwei Sitzungen vergaben dieselbe Migrationsnummer.** Beim Merge lagen
  `0012_clan_chat_krieg` und `0012_waehrungen_truhen_aufgaben` nebeneinander.
  Vor dem Anlegen einer Migration prüfen, was auf `origin/staging` schon
  liegt — nicht nur, was lokal da ist.
- **Ein React-Effekt mit dem Sichten-Objekt in der Abhängigkeitsliste hat
  den Rundenabschluss unsichtbar gemacht.** Der Effekt lief bei jedem
  Serverfunk neu, räumte seinen Timer ab, und der Frühausstieg oben stellte
  ihn nie wieder. Auswertung und Zwischenstand erschienen deshalb nie. **An
  einen Schlüssel hängen, nicht an das Objekt** — dieselbe Falle steht schon
  bei den Ansage-Blasen im Quelltext beschrieben.
- **`send()` im Client verwarf Aktionen stumm, wenn die Verbindung gerade
  weg war.** Am Handy stirbt sie genau dann, wenn man kurz woanders
  hinschaut — die Armut-Abgabe ging so verloren, ohne dass es jemand merkte.
  Jetzt hält eine kurze Warteschlange sie fest und reicht sie nach dem
  Wiederverbinden nach.

- **Railway lieferte stundenlang einen alten Stand aus, ohne zu meckern.**
  Ins Feld „Watch Paths" im Dienst war der komplette Inhalt von
  `railway.json` hineinkopiert worden. Das Feld erwartet Glob-Muster, eine
  Zeile je Pfad — es bekam `{`, `"$schema": …`, `"builder": "NIXPACKS"`.
  Keines dieser „Muster" trifft je auf eine Datei zu, also fand Railway
  bei jedem Push null Änderungen und übersprang still mit „No changes to
  watched files". **Das Feld gehört leer**; dann greift `watchPatterns`
  aus `railway.json`, und dort steht `["**"]` bereits richtig.
- **Ein Redeploy holt keinen neuen Commit.** Er wiederholt die bestehende
  Auslieferung — im Zweifel also genau den alten Stand, den man loswerden
  wollte. Er meldet trotzdem „Deployment successful". Nach einer solchen
  Panne hilft ein frischer Push, nicht der Redeploy-Knopf.
- **Woran man es von außen erkennt**, ohne Zugang zu Railway: Die
  ausgelieferte `index.html` nennt die gehashten Bundlenamen. Weichen sie
  von denen aus dem eigenen `npm run build` ab, läuft dort ein anderer
  Stand — und die Dateigrößen unter `/hub/` lassen sich genauso
  vergleichen. Das beantwortet in zehn Sekunden, ob es am Server liegt
  oder am Browser.
- **Bilder vor dem Umwandeln auf den Zeitstempel prüfen.** Eine
  nachgebesserte Kachel lag bereits auf der Platte, während ich noch die
  neun Minuten ältere Fassung beurteilt und ausgeliefert habe.
- **In einem git-Arbeitsbaum liegt kein eigenes `node_modules`.** Node
  sucht nach oben und findet `C:\Brauweg\node_modules` — dort zeigt
  `@brauweg/game-api` auf die Pakete des **Hauptcheckouts**. Eine Änderung
  am Paket im Arbeitsbaum ist für den Server dort also unsichtbar, und
  `tsc` meldet Typfehler, die im Quelltext längst behoben sind. Abhilfe:
  einmalig Verzeichnis-Junctions von `<arbeitsbaum>/node_modules/@brauweg/*`
  auf die eigenen `packages/*` legen. `node_modules` ist ignoriert, das
  bleibt lokal.

- **`git add -A` sammelt ein, was gerade im Ordner liegt.** So sind 13,9 MB
  gelieferte Original-PNGs in `public/` gelandet und ausgeliefert worden.
  `.gitignore` kennt jetzt `tmp-*/`; die Regel steht in `docs/DESIGN.md`.
- **PNG8 mit 200 Farben kostet sichtbar Tiefe.** Die Weltkarte hatte 4 %
  mittlere Abweichung; WebP bei Qualität 85 war halb so groß und doppelt so
  genau. Deshalb WebP.
- **ImageMagick füllt beim SVG-Rendern weiß**, wenn `-background none`
  fehlt. Zwei Platzhalter gingen mit weißem Kasten live.
- **CSS-Regeln werden oft von späteren überschrieben.** Vor jeder Änderung
  prüfen, ob es eine zweite, spezifischere Regel gibt — sonst greift die
  Änderung nicht und man sucht an der falschen Stelle.
