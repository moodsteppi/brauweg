# Startseite, Quick-Play, Spiele-Tab und Brauweg-Bock — Plan

**Stand 28.11.2026.** Grundlage ist Robins Sprachnachricht vom 28.11.2026
(Rundgang über staging) und eine Bestandsaufnahme des Codes auf `staging`
(34d1e23b). Zweig `startseite-quickplay`. Alles im heutigen Holz-/Grün-Design
des Hubs, keine neue Gestaltungssprache.

---

## 1. Was Robin will (zusammengefasst)

1. **Kopf:** „5 Spieler gerade am Tisch“ (oben links) fliegt raus. Sonst bleibt der
   Kopf, wie er ist (Avatar, Stufe, Pokal, Münzen, Edelsteine).
2. **Tagesaufgaben und Belohnungen** werden kleine Symbole rechts an der Seite,
   mit Anzeige, wenn etwas bereit ist.
3. Die beiden freien großen Kacheln oben bekommen:
   - **oben links Quick-Play:** antippen und man landet sofort in irgendeinem
     Spiel, am liebsten dort, wo schon Leute warten, sonst wird eins aufgemacht.
     Ein **Zahnrad** legt fest, welche Spiele Quick-Play nehmen darf.
   - **oben rechts der Brauweg-Bock:** 3–5 Spieler spielen nacheinander mehrere
     Spiele mit wenigen Runden (z. B. eine Runde Doppelkopf, eine Runde Tanks,
     eine Runde Farbduell), am Ende gewinnt einer über alle Spiele.
4. **Mitte:** Der große Play-Knopf weicht einem **Schild „Zu den Spielen“**, das
   auf den Spiele-Tab wischt. Zusammen mit Quick-Play und Bock gibt es damit drei
   direkte Wege ins Spiel.
5. **Spiel lernen** und **Browort** bleiben unten im Mosaik.
6. **Weiterspielen:** Wer noch in einer Runde steckt, bekommt ein
   **vollflächiges Pop-up** „Du bist noch in einer Runde — zurück an den
   Tisch?“ mit Ja/Nein. Bei Nein bleibt ein **kleines Pop-up** stehen, an
   anderer Stelle, das ruhig über Social/Lernen/Browort liegen darf — man soll ja
   eigentlich nicht aus einer Runde rausgehen.
7. **„Deine Spiele“ verschwindet von der Startseite**, darunter kommt sofort
   TikTok/Instagram. Die Startseite braucht kein Scrollen mehr.
8. **Spiele-Tab:** zuerst „Deine Spiele“ mit **Favoriten** (Herz oben rechts auf
   der Spielseite) und **zuletzt gespielten** Spielen.

---

## 2. Bestandsaufnahme — was es schon gibt und was fehlt

| Thema | Gibt es | Fehlt |
| --- | --- | --- |
| Online-Zeile | `HubRahmen.tsx:129`, 15-s-Abfrage `api.aktiveGesamt` in `GameSelect.tsx:229` | – (fliegt raus, Abfrage gleich mit) |
| Aufgaben/Truhen | Blatt `HeuteNeu`, Zahlen `me.bereit.aufgaben/truhen`, Symbole `icon-aufgaben.webp` (256²), `truhe-holz.webp` | nur die neue Stelle |
| Mitspielersuche | Server-Schlange für **jedes** Modulspiel (`suche/vermittlung.ts`, 30-s-Fenster, Bots füllen auf). Genutzt aber nur von Tafelrunde, Farbduell, Eiland, Mememory. Poker, Golf, BroCooked, Partykiste suchen im Client („offenen Tisch nehmen, sonst aufmachen“). Doppelkopf, Skat, Zauberer, Cambio, Schach, DreckBro, Bro Bluff haben nur die Lobby. | Übersicht „wo warten gerade Leute“, ein Weg, aus dem Hub direkt in eine Suche zu springen, ein Wartebildschirm im Hub |
| Arenen ohne Modul | Tanks Online, Ice Clash mit eigener Suche über WebSocket | stehen in keiner Freigabe-/Umfangsliste |
| Vorlieben am Konto | nur feste Spalten (`sprache` …), sonst localStorage | Ablage für Favoriten und Quick-Play-Auswahl. Nächste freie Migration: **0047** |
| Zuletzt gespielt | – | kein Zeitstempel; ableitbar aus `table_seat`/`party` (nur Modulspiele) |
| Weiterspielen | `me.activeTable` (nur beim Neuladen von `/api/me` aktuell), Karte auf dem Start | Pop-ups; Auffrischen beim Zurückkommen, sonst springt ein schon beendetes Spiel auf |
| Pop-up-Bausteine | `HbBlatt`, `useRueckfrage` (Ja/Nein), Vollbild `.hb-voll`, `MeisterFeier` | ein schwebendes kleines Pop-up gibt es noch nicht |
| Brauweg-Bock | nur Ankündigung mit Abstimmung (`mehrkampf`, „Bald“), Banner `banner-mehrkampf.webp` | alles Eigentliche: keine Serie über mehrere Tische, kein Modul, keine Tabelle |
| Herz-Symbol | – | neu (SVG reicht) |
| Schild „Zu den Spielen“ | – | neue Grafik (Bestellung nach Regel 5) |

---

## 3. Die neue Startseite

```
┌───────────────────────────────────────┐
│ (Avatar) Eisvogel  Stufe 12  🏆 💰 💎   │  Kopf, ohne Online-Zeile
│                          [📋2] [🧰1]   │  Aufgaben + Truhen als Symbole (Frage A1)
├──────────────────┬────────────────────┤
│  QUICK-PLAY   ⚙  │   BRAUWEG-BOCK     │
│   ▶ (Play-Bild)  │   (Pokal/Bock)     │
│        ┌─────────┴─────────┐          │
│        │ Schild:            │          │
│        │ „Zu den Spielen“   │          │
│        └─────────┬─────────┘          │
│  SPIEL LERNEN    │      BROWORT       │
├──────────────────┴────────────────────┤
│   [TikTok]              [Instagram]   │
└───────────────────────────────────────┘
     (kleines Weiterspielen-Pop-up schwebt bei Bedarf darüber)
```

- **Kopf:** `.hb-online` und die 15-s-Abfrage fallen weg. Der rote Punkt am
  Start-Reiter bleibt (Aufgaben + Truhen + Weg).
- **Symbole Aufgaben/Truhen:** rund, Holz/Messing wie `.hb-rund`, mit roter
  Zahl-Marke bei `bereit > 0` (Zahl im `aria-label`, DESIGN.md: „Aufgaben, 2
  bereit“). Antippen öffnet wie heute das Blatt „Heute“ (Aufgaben bzw. Truhen).
- **Quick-Play-Kachel** (oben links, heutige Kachel-Größe 184 px, Holzrahmen):
  Titel „Quick-Play“, Unterzeile „Sofort in eine Runde“, Bild `play.webp`
  verkleinert. Das **Zahnrad** sitzt als eigener kleiner Knopf in der Ecke der
  Kachel (eigene Tippfläche ≥ 44 pt, damit es nicht die Kachel auslöst).
- **Bock-Kachel** (oben rechts): Titel „Brauweg-Bock“, Unterzeile „Mehrere Spiele,
  ein Sieger“. Bild: freigestelltes Motiv (Bock/Pokal) — **neu zu bestellen**; bis
  dahin ein Ausschnitt aus `banner-mehrkampf.webp` hinter Abdeckung.
- **Schild „Zu den Spielen“** in der Mitte, wo heute der Play-Kreis sitzt.
  Schrift als echtes HTML auf einem leeren Holzschild (nichts ins Bild brennen).
  Antippen = heutiges `onAlleSpiele` (wischt auf den Spiele-Tab).
- **Weiterspielen-Karte und „Deine Spiele“** verschwinden vom Start;
  **Social** rückt direkt unter das Mosaik.
- **Nebenbei:** Die Start-Bilder `aufgaben/lernen/browort/play.webp` sind
  1254² und 240–320 kB für eine Anzeige um 84 px. Beim Umbau auf 256² verkleinern
  (je ~15–25 kB) — schneller Start, gleiche Optik.

### Weiterspielen

1. **Großes Pop-up** (Vollbild `.hb-voll`-Muster, Holzrahmen, Banner des Spiels):
   „Du bist noch in einer Runde — Doppelkopf läuft. Zurück an den Tisch?“
   **Ja** (Goldknopf) → Tisch. **Nein** (leiser Knopf) → kleines Pop-up.
   Für einen wartenden Tisch: „Du wartest noch an einem Tisch“.
2. **Kleines Pop-up:** schwebt unten über der Reiterleiste (über Social/Lernen),
   Bannerbild, Spielname, Zustand, Pfeil „Zurück“. Bleibt stehen, solange man in
   der Runde ist (Frage A4: mit „Verlassen“?).
3. **Auffrischen:** `/api/me` wird beim Zurückkommen auf den Start und beim
   Wiedereinblenden der App (`visibilitychange`) neu geholt — sonst fragt das
   große Pop-up nach einem Spiel, das längst vorbei ist.
4. Quick-Play und Bock sind gesperrt, solange man an einem **laufenden** Tisch
   sitzt: Antippen bringt das große Pop-up statt einer zweiten Runde (sonst säße
   man an zwei Tischen; ein wartender Tisch wird bei einer neuen Suche ohnehin
   verlassen, `leaveOtherWaitingTables`).

---

## 4. Quick-Play

**Server, neu: `POST /api/schnellspiel`** mit den erlaubten Spielen. Reihenfolge:

1. **Suche, in der schon jemand wartet** (neu: `Suchschlange.wartendeJeSpiel()`)
   → dort einreihen. Zwei Leute, die beide Quick-Play drücken, landen so
   zusammen.
2. **Öffentlicher wartender Tisch mit freien Plätzen und echten Menschen** (aus
   `listTables`, Hausspieler-Bots nicht mitgezählt) → beitreten.
3. **Sonst:** zufälliges erlaubtes Spiel → dessen Suche. Nach 30 s füllen Bots auf,
   man spielt also spätestens nach 30 s.

**Client:** ein **Such-Blatt im Hub** („Quick-Play: Doppelkopf — suche
Mitspieler … 0:24“, Gesichter der Wartenden, Abbrechen). Sobald der Tisch steht,
geht es direkt an den Tisch (`onResume`). Damit braucht kein Spielbildschirm einen
eigenen „sofort suchen“-Schalter.

**Kandidaten:** nur, was auf der Plattform spielbar und sichtbar ist
(`api.games` „playable“, `inAppSichtbar`, `imUmfang`) und mehr als einen Sitz
hat. In der App heute: Doppelkopf, Skat, Farbduell, Schach, Bro Bluff, DreckBro
(+ Würfelglanz auf iOS). Allein-Spiele (Runner, Browort, Flying Bro …) nie.

**Zahnrad-Blatt:** Liste der Kandidaten mit Banner und Schalter, „Alle“/„Keine“,
mindestens eins muss an bleiben. Vorgabe: alle an.

**Folgen, die man kennen muss:**
- Doppelkopf, Skat, Zauberer, Cambio, Schach, DreckBro, Bro Bluff bekommen damit
  erstmals eine echte Mitspielersuche (die Schlange ist spielunabhängig, es geht
  ohne Eingriff ins Modul). Die Suche nimmt die Vorgabe-Regeln und die größte
  Sitzzahl (Doppelkopf 5? → `suchSitze: 4` setzen, Zauberer 6 → 4, Cambio 6 → 4).
- Poker zieht BroJetons als Einsatz ein — Quick-Play-Poker kostet also Jetons.
- Trophäen zählen wie an jedem Suchtisch.
- Tanks Online / Ice Clash laufen außerhalb der Tische (Frage B2).

---

## 5. Spiele-Tab: Deine Spiele

- Ganz oben, vor den Registern: **„Deine Spiele“** — erst die **Favoriten**, dann
  **zuletzt gespielt** (ohne Doppelte), als waagerechte Reihe der heutigen
  Kacheln `.hb-sk`. Favoriten tragen ein kleines Herz.
- **Herz:** oben rechts im Kopf der Spielseite (`SpielSeite`, `.hb-sp-kopf`,
  heute leer), rundes Holzknöpfchen wie der Zurück-Knopf, gefüllt = Favorit.
- **Zuletzt gespielt:** neues Feld in `/api/me` (`zuletzt: {gameId, am}[]`,
  höchstens 8, aus `table_seat` + `table_`). Allein-Spiele und Arenen kennt der
  Server so nicht (Frage B4).
- **Leer** (neues Konto): Reihe entfällt, kein leerer Kasten.

---

## 6. Brauweg-Bock

**Idee:** 3–5 Spieler, mehrere **Stationen** (verschiedene Spiele, kurzes
Format), Punkte je Platz, am Ende ein Gesamtsieger mit Belohnung.

**Bauweise (Empfehlung): eine Serie echter Tische**, nicht ein großes
Sammelmodul. Grund: Jedes Spiel behält seinen Bildschirm, seine Bots, seine
Sonderwege (Golf/BroCooked rechnen auf den Geräten), und auch Tanks (kein Modul)
lässt sich als Station einhängen. Ein Sammelmodul wie die Partykiste müsste jedes
Spiel in sich nachbauen.

- **Server, neu:** Tabellen `bock` (Spieler, Stand, Stationen, Punkte) und
  `bock_station` (Spiel, Tisch, Ergebnis) — Migration 0047/0048. Ein Dienst baut
  die Station n als Tisch mit denselben Sitzen (Menschen + Bots, gleiche
  Sitzzahl), hängt sich in `finish()` ein, schreibt die Plätze in die Punkte und
  baut die nächste Station. Am Ende: Gesamtwertung, Belohnung, Bock-Statistik.
- **Client:** Bock-Lobby (Spieler, Stationen-Vorschau), **Zwischenstand** nach
  jeder Station (Tabelle, „Weiter zu Station 2: Farbduell“, Countdown 15 s), dann
  automatisch an den nächsten Tisch, am Ende **Siegerehrung**. Während einer
  Station ein kleines Band „Bock · Station 2/3 · du bist 1.“.
- **Kurze Formate je Station** (Schätzung, nicht gemessen):
  Doppelkopf 1 Runde = 4/5 Hände (~12 min) · Skat 3 Spiele (~8) · Zauberer 4
  Runden (~8) · Cambio 1 Geberrunde (~8) · Farbduell nur zu viert (Extreme, ~4) ·
  DreckBro (~6) · Bro Bluff (~5, max 4) · Mememory (~5, max 4) · Golf 2 Löcher
  (~4) · Tafelrunde (~7) · Poker 2 Runden (~8, kostet Jetons → eher raus) ·
  Tanks (~3, kein Modul).
  Raus: Schach, Eiland, Feldherr (nur zu zweit), BroCooked (alle Platz 1).
- **Punkte:** je Station nach Platz, z. B. zu viert 4/2/1/0, Gleichstand teilt.
  Gesamtsieger = meiste Punkte, Gleichstand → mehr Stationssiege.
- **Verlassen:** Bot übernimmt den Sitz, der Verlassende wird Letzter im Bock.
- **App:** dort sind nur Doppelkopf, Skat, Farbduell, Bro Bluff, DreckBro
  spielbar — der Bock nimmt nur Stationen, die auf **allen** beteiligten Geräten
  spielbar sind.
- **Name:** „Bock“ ist im Doppelkopf schon die Bockrunde (Frage C1).

---

## 7. Grafik (Bestellung nach CLAUDE.md Regel 5)

`docs/ASSETS-START-NEU.md` wird angelegt:
- **Holzschild** leer (für „Zu den Spielen“), freigestellt, Alpha, ~600×300.
- **Bock-Motiv** für die Kachel, freigestellt wie `aufgaben.webp`.
- **Quick-Play-Motiv** (falls `play.webp` nicht reicht).
- Herz und Zahnrad: SVG bzw. vorhandenes `icon-einstellungen.webp`.

Erzeugt wie bei Tafelrunde über `codex exec` (Konzeptbild), aufbereitet und
gewandelt zu WebP, Original ins Archiv `brauweg-art`.

---

## 8. Reihenfolge und Lieferung

1. **PR 1 — Startseite + Weiterspielen + Spiele-Tab:** Kopf, Symbole, Schild,
   Quick-Play-Kachel (zunächst mit Suche), Zahnrad, Pop-ups, Social, Favoriten,
   zuletzt gespielt, Migration Vorlieben.
2. **PR 2 — Quick-Play-Server** (falls nicht in PR 1): `/api/schnellspiel`,
   Wartende-Übersicht, `suchSitze` für Doppelkopf/Zauberer/Cambio, Such-Blatt.
3. **PR 3 — Brauweg-Bock:** Tabellen, Dienst, Lobby, Zwischenstand, Siegerehrung,
   Belohnung. Bis dahin zeigt die Bock-Kachel ehrlich „Bald“ (DESIGN.md: kein Knopf
   ohne Funktion).

Je PR: Tests anpassen (`HubNeu.test.tsx` hängt an den Knopfnamen „Spielen:
Spieleübersicht öffnen“, „Weiterspielen“, „Heute“), neue Proben, Sichtprobe am
Handy (375×812 und 390×844) in `/?dev=hub&iphone`, PR nach `staging`, CI
abwarten, Tafel-Notiz.

## 9. Offene Fragen

Werden per Pop-up abgefragt (A = Startseite, B = Quick-Play/Spiele-Tab,
C = Bock). Antworten werden hier nachgetragen.

### Antworten (Robin, 28.11.2026, per Pop-up)

| Frage | Entscheidung |
| --- | --- |
| A1 Symbole Aufgaben/Truhen | **senkrecht am rechten Bildschirmrand**, schwebend, leicht über dem Mosaik, rote Zahl bei Bonus |
| A2 Schild „Zu den Spielen“ | **neue Grafik über codex**, Schrift als echter Text |
| A3 großes Weiterspielen-Pop-up | **jedes Mal auf dem Start** (auch beim Wiedereinblenden der App) |
| A4 kleines Pop-up | **Zurück + Tisch verlassen** (mit Hinweis auf die Verlassen-Strafe bei laufender Partie) |
| B1 Quick-Play-Spiele | **alle Mehrspieler-Spiele** (Suche über die Server-Schlange, Bots nach 30 s) |
| B2 Arenen | **Tanks Online und Ice Clash mit rein** |
| B3 Ablage Favoriten/Auswahl | **am Konto auf dem Server** |
| B4 Deine Spiele | **zwei Reihen**: Favoriten, darunter zuletzt gespielt |
| B5 Zuletzt gespielt | **alle Spiele**, auch Solo und Arenen |
| C1 Name | **BroweG-Bock** (Kennung bleibt `mehrkampf`) |
| C2 Einstieg | **Suche + mit Freunden** (Code) |
| C3 Stationen | Suche: **3 zufällige**; Freunde: Gastgeber wählt **2–5** Stationen selbst oder lässt zufällig wählen |
| C4 Belohnung | **Bock-Trophäen (eigene Rangliste) + Münzen**; Stationen zählen nicht für die Trophäen ihres Spiels |
| C5 Tanks im Bock | **erst Tischspiele**, Tanks/Ice Clash als Station später |
| Lieferung | **alles in einem PR** |

### Selbst entschieden (mit Grund)

- **Feldherr nicht in Quick-Play und nicht im Bock:** Sein Bot gibt nur auf — nach
  30 s Suche gäbe es einen geschenkten Sieg.
- **Suchgröße** (`suchSitze`): Doppelkopf 4, Zauberer 4, Cambio 4, Poker 4, Golf 4,
  Partykiste 4, DreckBro 4, Würfelglanz 4 — wie Tafelrunde: Bot-Tisch, Lobby und
  Messungen stehen dort auf vier, acht Bots machen eine Quick-Play-Runde nur länger.
- **Quick-Play und Bock gesperrt an einem laufenden Tisch** — Antippen öffnet das
  große Weiterspielen-Pop-up (sonst säße man an zwei Tischen).
- **Bock-Münzen** nach Endplatz 50 / 25 / 10 (Rest 0), **Bock-Trophäen** nach der
  Tabelle in `trophies.ts` (wie ein Tisch dieser Sitzzahl). Stationen laufen mit
  `training` (keine Spieltrophäen), Tagesaufgaben und XP zählen wie überall.
- **Bock-Spielerzahl:** Suche 4; Freunde so viele wie da sind (3–5), fehlende
  Plätze bis 3 füllen Bots.
- **Station verlassen** = Bot übernimmt, im Bock Letzter.

## 10. Schnittstelle Client ↔ Server (steht schon in `packages/client/src/api.ts`)

- `Me.vorlieben?: { favoriten: string[]; schnellspiel: string[] | null }`
- `Me.zuletzt?: { spiel: string; am: string }[]` (neueste zuerst, max. 8)
- `POST /api/schnellspiel` `{spiele?}` → `Schnellspielstand`
  (`tisch` | `suche` mit `Suchstand` | `arena`)
- `GET /api/schnellspiel/kandidaten` → `{ kandidaten: {id, art, wartende}[] }`
- `PUT /api/me/schnellspiel` `{spiele: string[] | null}`
- `POST /api/me/favoriten` `{spiel, an}` → `{ favoriten }`
- `POST /api/zuletzt/:spiel` (Solo/Arenen melden sich selbst; Tischspiele trägt
  der Server beim Hinsetzen ein)
- Bock: eigene Datei `packages/client/src/bock/api.ts`, Routen unter `/api/bock/…`.
