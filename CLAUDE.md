# Brauweg — für Agenten

Kartenspiel-Plattform, zwei Spiele laufen (Doppelkopf, Zauberer). Diese Datei
ist die Kurzfassung; sie steht hier, weil die ausführlichen Regeln in
`docs/STAND.md` erst ab Zeile 55 kommen und sonst niemand sie findet.

**Ausführlich:** `docs/STAND.md` (Übergabezettel, offene Punkte, was schon
schiefging) · `docs/DESIGN.md` (Gestaltung, Bilder) · `docs/KLANG.md` (Töne und
Musik — Herkunft, Lizenzen, Auslagerungsgrenze) ·
`docs/plattform-plan.md` (das große Ganze) · **`docs/JETZT-AUSFUEHREN.md`
(Bilder einbauen, Schritt für Schritt — die Werkzeuge stehen auf dem Rechner
bereit)**.

---

## Die sechs Regeln, an denen man sonst scheitert

**1. Gegen `staging` arbeiten, nie gegen `main`.** `main` löst den Deploy in
die Produktion aus; was dorthin geht, entscheidet Nils. Vor jedem Push
`git pull --no-rebase origin staging` — an diesem Repo arbeiten mehrere
Sitzungen gleichzeitig, auch Cursor. Merges sind der Normalfall, kein Fehler.

**2. Alles auf Deutsch.** Bezeichner, Kommentare, Commit-Nachrichten,
Oberflächentexte. Kommentare erklären das **Warum**, nicht das Was — und
nennen oft den Fehler, den die Zeile verhindert. Wer eine Zeile ändert, deren
Kommentar einen Grund nennt, prüft erst, ob der Grund noch gilt.

**3. Migrationen von Hand schreiben.** `drizzle-kit generate` erzeugt hier
Anweisungen für längst vorhandene Spalten — die Snapshots unter
`packages/server/drizzle/meta/` sind veraltet (nur `0001`, `0002`, `0006`).
Selbst schreiben, Eintrag in `_journal.json` selbst ergänzen, und **vorher
prüfen, welche Nummer auf `origin/staging` schon vergeben ist.** Zwei
Sitzungen haben schon dieselbe `0012` benutzt.

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

---

## Bauen und prüfen

```bash
npm run build     # im WURZELVERZEICHNIS, nie --workspace @brauweg/server
npm test          # 128 Doppelkopf + 117 Zauberer + 259 Server
```

**Der Build im Wurzelverzeichnis ist keine Bequemlichkeit.** Baut man nur den
Server, ist die `.d.ts` von `@brauweg/game-api` der alte Stand, und `tsc`
meldet Felder als fehlend, die im Quelltext längst stehen (`xpBasis`,
`interludeMs`).

Testdateien liegen unter `packages/server/test/`; nach einem Zweigwechsel
`rm -rf packages/server/dist`, sonst laufen Tests aus einem alten Übersetzer-
Stand mit und melden Fehler, die es nicht gibt.

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
- **Bei `border-image` zählt nicht das Bild, sondern wo das Motiv darin
  liegt.** Die drei Knopfplatten sind alle 512 × 160, das Motiv belegt aber
  92 % (Holz), 77 % (Rot) und 63 % (Gold) der Breite. Mit demselben Randmaß
  fällt die Luft in die gestreckte Mitte: Der Knopf sieht schmaler aus als
  seine Nachbarn, obwohl alle `width: 100%` haben, und die Schrift steht über
  die Platte hinaus. Gemessen wird der Alphakanal auf der Mittelzeile, nicht
  die Dateigröße. Bestellung und Sollmaße: `docs/ASSETS-KNOEPFE.md`.
