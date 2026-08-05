# Bilder einbauen — der Ablauf

Diese Datei ist zum Nachmachen gedacht. Sie erklärt zuerst, **warum** es den
Umweg über ein zweites Repository gibt, und dann Schritt für Schritt, was zu
tun ist, wenn neue Bilder geliefert werden.

Stand: 4. August 2026. Auf diesem Rechner ist alles eingerichtet und einmal
durchgespielt worden.

---

## Das Problem, das dahintersteckt

Ein gemaltes Bild kommt in voller Auflösung als PNG. Eine Spielkarte war so
**1,7 MB** groß. Das ist für ein Archiv richtig — für die App ist es das
nicht, und zwar gleich doppelt:

**Erstens für die Spieler.** Alles unter `packages/client/public/` geht an
jedes Handy. Zehn Blätter mit je 25 Karten waren **408 MB**. Wer ein Blatt
gewechselt hätte, hätte auf Mobilfunk minutenlang gewartet.

**Zweitens für den Deploy.** Railway lädt bei jedem Bauen das ganze
Repository. Die Originale lagen mit im Repo — zusammen über 800 MB, die
weder der Build noch ein Nutzer je anfasst. Jeder Deploy schleppte sie mit.

Dieselbe Karte als WebP: **78 kB.** Gleiche Auflösung, gleiches Aussehen,
Faktor 20. Die Auflösung muss man dafür nicht anfassen — es ist allein das
Format.

**Das ist zweimal live gegangen**, erst mit den Szenerien (13,9 statt
1,2 MB), dann mit den Karten. Deshalb dieser Zettel.

### Was daraufhin eingerichtet wurde

| | wo | was |
| --- | --- | --- |
| **Originale** | [`moodsteppi/brauweg-art`](https://github.com/moodsteppi/brauweg-art) | volle Auflösung, PNG, nie ausgeliefert |
| **Auslieferung** | dieses Repo, `packages/client/public/` | WebP, das bekommen die Handys |

`packages/client/art/` steht in `.gitignore` — Originale gehören hier nicht
mehr hin. Zusätzlich ist die Historie einmal umgeschrieben worden, damit die
alten Originale auch aus der Vergangenheit verschwinden.

**Das Ergebnis, gemessen:** Ein frischer Klon dauert **7 Sekunden** und
bringt 75 MB. Vorher waren es 977 MB.

---

## Einmalige Einrichtung

**Auf diesem Rechner ist das schon erledigt.** Der Abschnitt steht hier für
einen neuen Rechner oder wenn `~/bildwerkzeug` verlorengeht.

Auf dem Mac ist **kein WebP-Werkzeug installiert** — weder `cwebp` noch
`magick`; `sips` liest WebP, kann es aber nicht schreiben. Deshalb läuft es
über `sharp`, bewusst **außerhalb** beider Repositories:

```bash
mkdir -p ~/bildwerkzeug && cd ~/bildwerkzeug && npm init -y && npm i sharp
```

Dazu gehört das Skript `~/bildwerkzeug/wandeln.mjs`. Es liegt nicht in einem
Repository, weil es zum Rechner gehört und nicht zum Projekt. Geht es
verloren, steht es in der README von `brauweg-art`.

Beide Repositories nebeneinander:

```
~/Desktop/BroCode/
├── Brauweg-spielen/brauweg/   ← der Code
└── brauweg-art/               ← die Originale
```

---

## Der Ablauf, wenn Bilder geliefert werden

### 1. Originale ins Archiv

Die gelieferten PNGs in den passenden Ordner von `brauweg-art` legen —
`karten/<blatt>/`, `szenerien/`, `wappen/`. **Nichts vorher
herunterrechnen.** Was einmal weich ist, wird nicht wieder scharf.

```bash
cd ~/Desktop/BroCode/brauweg-art
git add -A
git commit -m "Kartenblatt Eiche: die 24 Vorderseiten"
git push
```

**Zuerst hierhin, dann erst wandeln.** So liegt das Original nie nur an
einer Stelle.

### 2. Nach WebP wandeln

```bash
node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> [art]
```

`art` ist `karten`, `szene` oder `wappen` (letzteres auch für Emotes — es
schützt den Alphakanal). Beispiel für ein ganzes Blatt:

```bash
node ~/bildwerkzeug/wandeln.mjs \
  ~/Desktop/BroCode/brauweg-art/karten/eiche \
  ~/Desktop/BroCode/Brauweg-spielen/brauweg/packages/client/public/karten/eiche \
  karten
```

Das Skript sagt danach, was es getan hat:

```
25 Bilder gewandelt (karten)
  vorher  39.4 MB
  nachher 1.4 MB   (97 % kleiner)
  je Datei im Schnitt 56 kB
```

**Es prüft zwei Dinge von selbst:** ob ein Alphakanal verlorengegangen ist
(dann bricht es ab), und ob die Dateien verdächtig groß geblieben sind. Beides
sind Fehler, die hier schon passiert sind.

**Die Originale bleiben liegen.** Das Skript verschiebt nichts — ins Archiv
gehören sie per Hand, damit nichts wegwandert, was noch gebraucht wird.

### 3. Einbauen

Neue Blätter, Szenerien und dergleichen wollen registriert werden:

| was | wo |
| --- | --- |
| Kartenblatt | `packages/client/src/decks.ts`, `packages/server/src/decks.ts`, `packages/server/src/tischware.ts` |
| Szenerie | `packages/client/src/szenen.ts`, `packages/server/src/scenes.ts`, `tischware.ts` |
| Wappen | `packages/client/src/api.ts` (`WAPPEN`), `packages/server/src/clubs/service.ts` (`CRESTS`), `tischware.ts` |
| Emote | `packages/client/src/emotes.ts`, `packages/server/src/emotes.ts`, `tischware.ts` |

Der Preis steht immer in `tischware.ts` und nur dort.

### 4. Prüfen und hochladen

```bash
cd ~/Desktop/BroCode/Brauweg-spielen/brauweg
npm run build            # im WURZELVERZEICHNIS, nicht --workspace
npm test
git add -A && git commit -m "…"
git pull --no-rebase origin staging
git push origin staging
```

Gearbeitet wird gegen `staging`. Was nach `main` geht, entscheidet Nils.

---

## Prüfliste — die drei Fehler, die hier schon passiert sind

1. **Original unter `public/` liegen lassen.** Nach dem Wandeln nachsehen:
   liegt dort noch ein `.png`, das nicht hingehört? Für Karten gilt: `eiche`
   bis `schiefer` sind **nur** WebP, `klassisch` bleibt PNG (altes Blatt).
2. **Schachbrett statt Alphakanal.** Das Skript prüft es, aber wenn schon das
   Original ein Schachbrettmuster eingemalt hat, merkt es das nicht. Bei
   allem Freigestellten das Bild auf knallroten Grund legen — sichtbar wird
   nur, was sichtbar sein soll.
3. **Dateigröße nicht angesehen.** Eine Spielkarte liegt bei ~80 kB. Kommt
   sie mit 1,7 MB, ist es das Original.

---

## Wenn etwas schiefgeht

**Der Klon ist plötzlich riesig.** Dann liegen wieder Originale im Repo.
Nachsehen mit:

```bash
du -sh packages/client/public/*
find packages/client/public -type f -size +500k -exec ls -la {} \;
```

**Ein alter Klon lässt sich nicht mehr pullen.** Die Historie ist am
4. August umgeschrieben worden; alte Klone sind unbrauchbar. **Neu klonen**,
nicht pullen.

**Die Sicherung des alten Zustands** liegt unter
`~/Desktop/BroCode/brauweg-SICHERUNG.git` (967 MB, vollständiger Spiegel).
Sie kann weg, sobald ein Deploy sauber durchgelaufen ist.
