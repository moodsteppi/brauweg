# Pro-Subway — Stand, Bugs, Ideen

Übergabe für Claude / Cursor / Team. Stand: **5. August 2026**.

Solo-Endless-Runner im Hub (Spielauswahl → **Alleine** → **Pro-Subway**).
Technik-Demo weiterhin unter `/?dev=runner` (ohne Hub-Münzen).

Staging: **https://staging.brauweg-spielen.de** (Zweig `staging`, Deploy bei Push).

---

## 1. Was schon läuft

| Bereich | Stand |
|---|---|
| Hub-Einstieg | Spielauswahl → Tafel „Alleine“ → Pro-Subway + Banner/Icon |
| Ablauf | menu → flee (~2,9 s) → lobby (5 s, Hindernisse sichtbar, keine Kollision) → run → dead |
| Steuerung | ←→ Spur, ↑/Space springen, ↓ rutschen; Touch-Swipe |
| Pinguin | `penguin_anim.glb` (Flee + Run), Root-Motion gestrippt, In-Place |
| Hindernisse | 16 Prop-GLBs + 3 Fahrzeug-GLBs (Scooter, Silber, BMW) |
| Münzen im Lauf | Einsammeln; im Hub-Modus Cashout nach Tod → Hub-Konto |
| Server | `POST /api/runner/cashout`, `GET /api/runner/today`, Tabelle `runner_day` |
| Limits | max. 20 Hub-Münzen / Lauf, 40 / Tag (Europe/Berlin) |

### Wichtige Dateien

```
packages/client/src/screens/Runner.tsx          # Spiel-Logik + Szene
packages/client/src/App.tsx                     # Screen `prosubway`
packages/client/src/screens/GameSelect.tsx      # Tafel „Alleine“
packages/client/public/3d/subway/               # GLBs (penguin, props, vehicles)
packages/client/public/hub/spielwahl-prosubway.png
packages/client/public/hub/icon-prosubway.png
packages/server/src/runner.ts                   # Cashout + Tageslimit
packages/server/drizzle/0016_runner_day.sql
docs/KONZEPT-ENDLESS-RUNNER.md                  # früheres Konzept (Biome etc.)
```

Kunst-Originale: `brauweg-art/3d/Subway/` (außerhalb des Client-Repos).

---

## 1b. Umbau vom 5. August, abends (Claude)

Der große Feel-/Logik-Pass. Was aus Abschnitt 2 und 3 damit **erledigt** ist:

- **Hitboxen je Prop** — Tabelle `KASTEN` (Halbmaße x/z je Prop), je Tor eine
  eigene Durchlass-Unterkante (`TOR_LUECKE`), je Fahrzeug Kasten + Sprungkante.
  Dazu Nachsicht-Faktor 0,9: Streifschüsse sind kein Tod. **Debug:**
  `/?dev=runner&hitbox=1` zeichnet alle Kästen als rotes Drahtgitter (Ticket 1).
- **Faire Muster** — die freie Spur wandert je belegtem Platz um höchstens
  eine Spur (`pfadSpur`), unlösbare Wände kann der Zufall nicht mehr bauen.
  Dichte steigt mit der Strecke; ab 240 m Doppel-Hindernisse (freie Spur
  bleibt frei); Fahrzeuge erst ab 120 m und **fahren einem jetzt wirklich
  entgegen** (eigener Vortrieb je Art).
- **Meter sind Meter** — Tempo wird je Bild aufintegriert (`Laufuhr`), statt
  +1 je 200 ms Wanduhr. Tempo hängt an der Strecke: 15 → 30 m/s bis ~525 m.
- **Score-Wirrwarr weg** — Münzen zählen 1:1, Punkte = Meter + 10 je Münze,
  die Rechnung steht offen auf dem Endblatt. Cashout schickt die Münzzahl.
- **Rekord am Gerät** (localStorage `brauweg.prosubway.rekord`), „Neuer
  Rekord!" mit Fanfare auf dem Endblatt, Rekord im Startblatt.
- **Pause** — Knopf im HUD, Escape/P, Tafel mit Weiter/Neustart/Zurück; bei
  `visibilitychange → hidden` pausiert der Lauf von selbst (sonst stirbt man
  gedrosselt im Hintergrund).
- **Geisterlobby raus** — statt 5 s „Hindernisse ohne Kollision" (lehrt genau
  das Falsche) gibt es einen Anlauf: die ersten Hindernisse kommen erst nach
  34 m an.
- **Feedback** — Münzton (`kauf`, leise), Treffer (`fehler` + roter Blitz +
  Kamera-Wackler + Umfaller nach vorn), Rekord (`sieg`), Knöpfe (`tipp`),
  „+1" steigt aus der Münzkapsel. Sprung mit Streck/Stauch, Spurwechsel mit
  Kurvenlage, Sprung-Eingabepuffer (140 ms vor der Landung).
- **Menüs als Holztafeln** — dieselben Klassen wie im Hub (`hub-tafel`,
  `hub-knopf--a/-a-gold`), HUD als Messingkapseln, Pause-Knopf auf
  `side-btn-grund`. Der graue Systemkasten ist raus.
- **Assets geschrumpft** — alle 20 GLBs mit `~/modellwerkzeug/schrumpfen.mjs`:
  **62 MB → 5,9 MB** (Props 512er-Texturen, Pinguin 1024). Animationen
  geprüft, beide Clips intakt. Props laden gestaffelt im Leerlauf nach,
  Pinguin + Fahrzeuge sofort (Ticket 3).
- **Kamera-Explosion gefixt** — `KameraFuehrung` lerpte mit ungekapptem
  `delta`; nach einem Tab-Wechsel (rAF gedrosselt, delta sekundengroß) schoss
  der Lerp-Faktor über 1 und die Kamera ins Nichts. `dt`-Deckel 0,05.

### Nachschlag, gleiche Nacht: Biome, Kräfte, Tagesliste, Aufgaben

- **Biome-Optik** — alle 220 m wechselt die Strecke die Zone, dieselbe Reihe
  wie der Trophäenpfad (Heimat → Wiesen → Strand → Feuerberg → Schneefeld →
  Sternenhafen, dann von vorn). Boden, Randmauern, Spurlinien je Zone;
  Himmel und Nebel gleiten weich hinterher (`BiomStimmung`). Kein neues
  Bildmaterial — nur Töne.
- **Kräfte** — Magnet (12 s, Münzen fliegen einem zu), Schild (verzeiht
  einen Treffer, Hindernis verschwindet), Doppel (12 s, jede Münze zählt
  zwei). Als Fund am Wegesrand (16 % je Chunk, immer auf der freien Spur),
  einfache leuchtende Geometrie statt fehlender Modelle, HUD-Chips mit
  Restzeit. Kein Turbo: mehr Tempo wäre in dieser Wertung Punkte fürs
  Nichtstun.
- **Tagesliste** — `runner_best` (Migration 0017): bester Lauf des Tages je
  Konto, Meter/Münzen gehören zum besten Lauf (kein Flickenteppich aus
  Maxima). `GET /api/runner/rangliste`: beste zehn plus eigener Platz.
  Startblatt-Knopf „Tagesliste" (nur Hub-Modus), Endblatt zeigt „Platz N".
- **Aufgaben** — zwei neue Tagesaufgaben: „Lauf eine Runde Pro-Subway" (5)
  und „Sammle 15 Münzen im Lauf" (10). Eigene Messarten `runnerLaeufe` /
  `runnerMuenzen` + `fortschreibeRunner()` — der Runner hat keine Partien,
  Plätze oder Karten, also läuft er nicht durch `Ereignis`.
- **Ein Aufruf statt drei** — `POST /api/runner/lauf` macht Münzen (Kappen),
  Aufgaben und Bestwert zusammen und liefert den Tagesplatz zurück. Wird
  auch bei 0 Münzen gerufen (die Lauf-Aufgabe zählt das Laufen). `/cashout`
  bleibt für Clients von vor dem Deploy. Punkte-Obergrenze 100 000 gegen
  Skript-Rekorde; fürs Geld kappen ohnehin Lauf- und Tageslimit.
- **Steuerung geschmeidiger** — Wisch löst beim ZIEHEN aus, nicht erst beim
  Loslassen, und der Startpunkt wandert mit (durchziehen = zwei Spuren ohne
  abzusetzen). Spurwechsel als feste 170-ms-Ease-Out-Kurve statt
  Exponentialjagd, die nie ankommt. Gehaltenes ↓ verlängert das Rutschen;
  Auto-Repeat für Spur/Sprung aus.
- **Servertests**: `test/runner.test.ts` — Kappen, Aufgaben (auch 0-Münzen-
  Lauf), Bestwert-Semantik, Listenreihenfolge, Punkte-Obergrenze.

### Nachtrag: Wisch-Fix und Boden-Design

- **Ein Wisch = eine Spur.** Der Kettenwisch (Startpunkt wandert mit) sprang
  bei normalen 100–200-px-Wischen zwei Spuren auf einmal — von ganz links
  nach ganz rechts. Jetzt verbraucht die erste Aktion die Geste; die
  nächste beginnt erst, wenn der Finger abhebt.
- **Boden als Strecke statt Farbfläche:** gestrichelte Trennlinien ZWISCHEN
  den Spuren (Tempo wird sichtbar, die Spurmitte gehört Figur und Münzen),
  Bordstein-Blöcke im 2-m-Wechsel je Biom, gewürfelte Bodenflecken am
  Fahrbahnrand, niedrigere Hecke statt Betonwand. Alles Geometrie, kein
  Ladegewicht.
- **Bestellung für gemalte Böden:** `docs/ASSETS-RUNNER-BODEN.md` — je Biom
  eine kachelbare Bodenkachel (1024²) und eine Randleiste (1024×256), mit
  Nahtlos-Prüfschritt und Einbauanleitung (`map` + `RepeatWrapping` statt
  `color`).

### Nachtrag: Randdeko je Biom

Leben neben der Bahn, alles einfache Geometrie ohne Ladegewicht: Heimat
Laubbäume und Büsche, Wiesen helle Bäume/Blumen, Strand **Palmen und
Kakteen**, Feuerberg Glutfelsen und Dürrbäume, Schneefeld verschneite
Tannen, Sternenhafen leuchtende Laternen und Goldfelsen. Je Seite vier
Plätze pro Chunk, je Recycle gewürfelt (Stelle, Sorte, Größe, Drehung),
ohne Schlagschatten — zweihundert Schattenwerfer außerhalb der Spielfläche
kosten Bildrate und erzählen nichts. Die Strecke erzählt damit dieselbe
Reise wie der Trophäenpfad, nur im Vorbeirennen.

### Nachtrag: gemalte Boeden, keine Ueberlappungen, Autos raeumen auf

- **Die zwoelf Kacheln sind eingebaut** (`public/runner/`). Geladen wird
  **ohne Suspense** (`useKacheln`, `TextureLoader` von Hand): Der Weg ueber
  `useTexture` hielt die Leinwand an und kam nicht wieder heraus — alle
  Dateien kamen mit 200, die Suspense loeste trotzdem nie auf, man stand
  dauerhaft im Ladetext. Jetzt steht die Bahn sofort in Biomfarbe da und
  bekommt ihr Bild, sobald es geladen ist. Fehlt eine Datei, bleibt es bei
  der Farbe.
- **Kein `clone()` je Chunk.** Der erste Versuch gab jedem Chunk eine
  eigene Kopie — zwoelf zusaetzliche 1024er-Texturen, und der WebGL-Kontext
  ging verloren ("Context Lost"). Alle Chunks brauchen dieselbe
  Wiederholung, also teilen sie sich die Textur.
- **Nahtpruefung ist Pflicht, nicht Zierde.** Gemessen (Kantenabstand gegen
  Innenvarianz) hatten drei Randleisten echte Nahtlinien, Schneefeld mit
  Faktor 25. Geheilt mit `~/bildwerkzeug/naht-heilen.mjs` (beide Kanten
  abklingend zur Mitte ziehen) — alle jetzt auf 0,0. **Neue Kacheln immer
  messen**, eine Naht rast im Spiel zwoelfmal je Sekunde vorbei.
- **Nichts liegt mehr ineinander.** Muenzreihen und Kraft-Token suchen sich
  eine freie Stelle (`belegt()` / `freieStelle()`) und bleiben weg, wenn
  keine da ist — lieber keine Muenze als eine Muenze in der Kiste. Geprueft
  wird die GANZE Dreierreihe, nicht nur ihr Anfang.
- **Autos raeumen ihre Spur.** Ein Fahrzeug walzt Hindernisse, Muenzen und
  Kraefte nieder, die vor ihm auf seiner Spur liegen: Das Stueck kippt zur
  Seite, sackt in den Boden und dreht sich weg (0,55 s). Wer gerade zerlegt
  wird, toetet nicht mehr — sonst stuerbe man an einer Kiste, die sichtbar
  schon umfaellt.

### Nachtrag: Sprung-/Rollclips, groessere Props, Kraftzeichen

- **Echte Clips fuer Sprung und Rolle** (`penguin_sprung_hecht.glb`, aus
  `jump+and+dive` im Archivrepo, 3,47 → 0,48 MB). Zweites GLB, gleiches
  Skelett: Der Mixer haengt am Laufmodell, die beiden neuen Clips werden ihm
  untergeschoben — geht nur, weil beide Dateien dieselben 43 Knochen mit
  denselben Namen haben. `LoopOnce` + `clampWhenFinished`, angestossen an
  der **Flanke** (nicht am Zustand), sonst setzt `reset()` in jedem Bild neu
  an. `timeScale` streckt sie auf die Dauer, die das Spiel vorgibt: Der
  Hechtsprung dauert im Modell 3,5 s, das Rutschen 0,78 s.
  **Damit ist Punkt 1 der Must-haves erledigt.**
- **Fahrrad und Einkaufswagen doppelt** (0,62 → 1,24). Damit fiel die
  pauschale Sprungkante (0,7 fuer alles) — sie stimmte nur, solange jedes
  Prop unter 0,62 lag. Jetzt kommt sie aus der Hoehe des Stuecks
  (`sprungFrei()`); Kaesten wie ueblich aus den Modellmassen gerechnet.
- **Kraefte sieht man an der Figur**, nicht nur im HUD: Schild als blaue,
  atmende Kugel um den Pinguin (Zwischenloesung — ein gemaltes Modell kommt
  noch), Magnet als Hufeisen an der Flosse. Beide ausserhalb von
  `koerperRef`, damit sie beim Rutschen nicht mitducken.
- **Sprungabbruch:** Runterwischen im Flug zieht die Figur zu Boden
  (Schnellfall −18) und geht dort sofort in die Rolle. Vorher wurde das
  Wischen im Sprung verworfen — man musste die ganze Flugkurve abwarten,
  obwohl schon das naechste Tor kam. Beim Aufsetzen hat der Rutschwunsch
  Vorrang vor einem gepufferten Sprung: Er ist der juengere.

### Nachtrag: Countdown und die sitzende Blase

- **Countdown 3 – 2 – 1 – LOS!** zwischen Flucht und Lauf (je 700 ms, eigene
  Phase `countdown`). Vorher ging es ansatzlos los: Die Flucht endete, und im
  selben Augenblick rollte die Welt mit vollem Tempo — man verlor die ersten
  Meter, weil man nicht wusste, dass es losgegangen war. Die Strecke steht
  dabei schon sichtbar da, rollt aber nicht: Ein Countdown über einer
  laufenden Bahn wäre keiner. Über einen Zähler statt vier gestaffelter
  Timer — vier Timer sind vier Dinge zum Aufräumen, und eines vergisst man.
- **Die Schildblase umschließt die Figur.** Sie hing zu hoch: `passeHoehe`
  allein setzt nur die Größe, die Unterkante blieb, wo das Modell sie hatte.
  Jetzt zusätzlich `erdeFuesse` und kein Versatz mehr im JSX — die Kugel
  steht auf dem Boden statt um den Kopf zu schweben. Das Pulsieren
  kompensiert seinen eigenen Versatz, sonst wüchse sie nur nach oben und
  sähe aus, als hüpfe sie.

**Noch offen aus Abschnitt 2/3:** echte Jump-/Slide-Clips im Mixer (weiter
Tween), Kästen am Gerät nachstimmen (`hitbox=1`), Banner PNG→WebP,
Ghost-Läufe/Koop-Challenge, gemalte Böden einbauen sobald geliefert.

---

## 2. Bekannte Bugs / Baustellen (zuerst fixen)

### Gameplay / Physik
- [ ] **Prop-Maße vs. Kollision:** Jump-/Slide-Höhen sind getunt (`JUMP_H`, `SLIDE_H`, `CLEAR_*`), passen aber nicht exakt zu den echten Mesh-Löchern der 3D-Tore (Banner/Gerüst/Girlande). Oft trifft man „unsichtbar“ oder rutscht durch, obwohl es eng aussieht.
- [ ] **Slide-Tore:** Logische Unterkante `SLIDE_CLEARANCE` ≠ visuelle Lücke im GLB. Besser: Hitboxen pro Prop (Box) statt nur Rollen-Flag / Kopfhöhe.
- [ ] **Sprung-Animation fehlt:** Nur Physik + leichte Neigung; kein Jump-/Slide-Clip im Mixer.
- [ ] **Rutschen:** Visuell nur `scale.y` + leichte Neigung — kein echter Roll/Slide. Früher ging die Figur durch den Boden (negatives `position.y`); das ist gefixt, wirkt aber noch steif.
- [ ] **Kollisionsboxen zu grob:** Feste `hitX` / `hitZ` für alle Props; schmale Kegel und breite Bänke fühlen sich gleich an.
- [ ] **Fahrzeuge:** Selten, aber Hitbox/Höhe noch „Block“-Logik — nicht an Mesh angepasst.
- [ ] **Doppel-Tod / Hit-Lock:** `hitLock` pro Chunk; nach Recycle ok, Edge-Cases bei Spurwechsel + engem Timing prüfen.

### Technik / Performance
- [ ] **Asset-Gewicht:** ~16 Prop-GLBs à 2–4 MB → Runner-Start schwer (Mobil). Compress / Draco / weniger Varianten / LOD.
- [ ] **Preload:** Alle Props werden beim Mount vorgeladen — auf schwachem Netz langer schwarzer/leerer Moment.
- [ ] **Viele Suspense-Instanzen:** Jeder Slot lädt ggf. dasselbe GLB mehrfach geklont — ok, aber Cache/Instancing prüfen.
- [ ] **Dev vs. Hub:** `/?dev=runner` ohne Login; Hub braucht Session. Fehlerpfade (Cashout 401) nur grob abgefangen.
- [ ] **Schwarzer Screen (erledigt, im Auge behalten):** Ursache war falscher Pfad `/3d/subway/props/…` statt `/3d/subway/prop_….glb`. Nicht wiederholen.

### Produkt / Hub
- [ ] **Tageslimit UX:** Spieler sieht „noch X heute“, aber keine Erklärung vor dem ersten Lauf.
- [ ] **Score vs. Hub-Münzen:** Intern Score `+10` pro Pickup, Anzeige/Cashout `score/10`. Verwirrt beim Debuggen.
- [ ] **Kein Persistenz-Highscore** (nur Session + Hub-Münzen-Cap).
- [ ] **Banner ist PNG:** Rest der Spielwahl oft WebP (`docs/ASSETS-SPIELWAHL.md`).

---

## 3. Was noch fehlt (MVP → „richtig“)

### Must-have für ein gutes Feel
1. **Eigene Jump- / Slide-Animationen** am Pinguin (Clips im GLB oder Retarget).
2. **Explizite Hitboxen** pro Prop-Typ (Höhe, Breite, „slide gap“).
3. **Feedback:** Treffer-Blitz, Sound, Vibration; Münzen-Sound; UI „+1“.
4. **Pause / Zurück** zuverlässig ohne State-Leaks.
5. **Difficulty-Kurve** feiner (Spawn-Dichte, Tempo, Lane-Wechsel-Fallen).

### Should-have
6. Biome / Strecken-Optik (siehe Konzept: Heimat → Wiesen → …) statt einer Grasbahn.
7. Power-ups (Magnet, Schild, Tempo kurz).
8. Tutorial beim ersten Start (Lobby-Text reicht nicht).
9. Rangliste „weiteste Strecke heute“ (separat von Kartenspiel-Trophäen).
10. Quest-Anbindung (`quests.ts`: z. B. „3× Pro-Subway gespielt“ / „20 Münzen im Runner“).

### Nice-to-have
11. Skins / Outfits aus dem Hub-Avatar im Runner.
12. Tägliche Mission + Truhe nur über Runner.
13. Ghost-Run / Freunde-Geister.
14. Season / Pass — **nur** wenn Shop-Regeln (APPSTORE.md) klar sind.

---

## 4. Feature-Ideen (gut für Brauweg)

Ideen, die zur Marke passen (Pinguin, Biome, Münzen, kein Glücksspiel-Einsatz):

| Idee | Warum |
|---|---|
| **Münzen → Hub** (schon da) | Gleiche Währung wie Truhen/Shop; Cap hält Economy stabil |
| **Biome-Abschnitte** | Nutzt vorhandene Biom-Kunst; Abwechslung ohne neues Meta |
| **„Brauweg-Strecke“** | Landmarken (Kneipe, Parkbank, Fahrrad) — Props sind schon da |
| **Koop-Challenge (asynchron)** | „Schlag Emils 400 m“ — sozial, ohne Echtzeit-Netzwerk |
| **Kosmetik nur Optik** | Hut im Runner sichtbar = Shop-Wert ohne Pay-to-Win |
| **Wochenevent** | Doppelte Runner-Münzen Sa/So — Retention |
| **Foto-Finish / Replay kurz** | Letzte 3 s bei Tod — Bugs finden + Sharing |

**Nicht bauen:** Echtgeld-Wetten, PvP-Einsatz um Münzen (Grauzone, siehe `waehrung.ts`-Kommentar).

---

## 5. Wirtschaft (kurz)

- Runner-Pickup → 1 Hub-Münze (nach Kappen).
- `RUNNER_MAX_PRO_LAUF = 20`, `RUNNER_MAX_PRO_TAG = 40` in `packages/server/src/runner.ts`.
- Anti-Cheat nur Soft-Caps + Rate-Limit — kein signiertes Replay. Für Produktion später: Mindestdauer, Server-seitige Plausibilität, oder nur Quest-Belohnung statt Direkt-Cashout.

---

## 6. So testen

```bash
# Lokal Dev
cd brauweg && npm run dev:client
# → http://localhost:5173/?dev=runner

# Hub-Pfad (mit Login gegen lokalen/Staging-Server)
# Spielauswahl → Alleine → Pro-Subway
```

Staging nach Push auf `staging`: Railway-Deploy abwarten, Hard-Refresh.

Migration: `0016_runner_day` muss auf der Staging-DB gelaufen sein (Server startet Migrates).

---

## 7. Vorschlag: nächste 3 Tickets

1. **Hitbox-Pass:** Pro Prop `{ kind, height, width, slideGap? }` + Debug-Drahtgitter (`/?dev=runner&hitbox=1`).
2. **Animationen:** Jump + Slide Clips (oder Placeholder-Tween ohne Boden-Clip).
3. **Performance:** Props compressen, Preload staffeln, nur 6–8 Varianten aktiv.

---

## 8. Changelog (relevant)

| Commit / Thema | Inhalt |
|---|---|
| Pro-Subway Hub + Cashout | Spielauswahl, API, Migration |
| 3D-Props | 16 GLBs statt Billboards |
| Black-Screen-Fix | Pfad `/3d/subway/prop_*.glb` |
| Slide/Jump-Retune | Kein Versinken; Größen + `headY`-Kollision |

Wenn du hier weiterarbeitest: Bugs in Abschnitt 2 abhaken, Ideen aus 4 nur übernehmen wenn sie zu Ticket 1–3 passen — Feel zuerst, Meta später.
