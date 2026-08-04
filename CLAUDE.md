# Brauweg — für Agenten

Kartenspiel-Plattform, zwei Spiele laufen (Doppelkopf, Zauberer). Diese Datei
ist die Kurzfassung; sie steht hier, weil die ausführlichen Regeln in
`docs/STAND.md` erst ab Zeile 55 kommen und sonst niemand sie findet.

**Ausführlich:** `docs/STAND.md` (Übergabezettel, offene Punkte, was schon
schiefging) · `docs/DESIGN.md` (Gestaltung, Bilder) · `docs/plattform-plan.md`
(das große Ganze).

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
kein WebP-Werkzeug installiert; der Weg läuft über `sharp` außerhalb des
Projekts (Anleitung in der README des Archivrepos).

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
  ist hier dreimal passiert.
