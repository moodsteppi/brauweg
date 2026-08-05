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

**Noch offen aus Abschnitt 2/3:** echte Jump-/Slide-Clips im Mixer (weiter
Tween), Kästen am Gerät nachstimmen (`hitbox=1`), Biome-Optik, Power-ups,
Rangliste, Quest-Anbindung, Banner PNG→WebP.

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
