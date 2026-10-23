# Abgleich iOS ↔ Web (Stand `staging` 43215ba, 23.10.2026)

Projekt „Brauweg-Spielen Release-Fertig", Phase Abgleich, Aufgabe 1. Reine
Bestandsaufnahme — es wurde kein Code geändert.

## Die wichtigste Erkenntnis zuerst

**Es gibt keine eigene iOS-Fassung, die „auseinanderlaufen" könnte.**
`apps/ios` ist eine Swift-Hülle mit einem WKWebView (10 Swift-Dateien,
~1 400 Zeilen). Sie packt den **gewöhnlichen Web-Client** aus
`packages/client/dist` ins App-Paket (`apps/ios/werkzeug/web-einbauen.sh:5-8`,
„Zeichen für Zeichen derselbe Client wie auf der Webseite") und liefert ihn
unter `brauweg://app` aus (`apps/ios/Brauweg/PaketSchema.swift`). Vor der ersten
Zeile des Clients setzt sie `window.BRAUWEG_APP`
(`apps/ios/Brauweg/Huelle.swift:139`).

Daraus folgt: **Jeder Unterschied zwischen App und Webseite ist eine Weiche im
Client (`inApp`, `packages/client/src/laufzeit.ts:47`) oder im Server
(`plattformVon`, `packages/server/src/http/app.ts:260`).** „Web hängt hinterher"
heißt konkret: Neue Funktionen wurden in den letzten Wochen bewusst **nur für
`inApp`** eingeschaltet, und auf der Webseite fehlt deshalb ihr Einstieg — der
Code dahinter liefe dort genauso.

Die Android-Hülle (`apps/android`) hängt an denselben Weichen: Der Server
zählt beide Herkünfte als `app` (`APP_ORIGINS`,
`packages/server/src/http/app.ts:243`), der Client fragt nur `inApp`.

## 1. Was die App anbietet

Alle Fundstellen im Client gelten, weil die App den Client ausführt.

### Spiele (`FREIGABE`, `packages/server/src/games/registry.ts:157-187`)

| Spiel | App | Fundstelle |
| --- | --- | --- |
| Doppelkopf | spielbar | registry.ts:158 |
| Skat | spielbar | registry.ts:159 |
| Filler — in der App „**Farbduell**" | spielbar | registry.ts:173, Name `APP_NAMEN` packages/client/src/i18n.ts:773-779 |
| BroChess | spielbar | registry.ts:183 |
| Partykiste | **bald** (seit 21.10.) und zusätzlich überall ausgeblendet (Statistik, „Deine Spiele") | registry.ts:165, packages/client/src/app-sichtbar.ts:12 |
| Zauberer, Cambio, Poker, Mememory, Eiland, Feldherr, Tafelrunde, Golf, BroCooked | bald | registry.ts:166-178 |
| Werwolf (Vorschau ohne Modul) | aus | registry.ts:186 |
| **Kartenmanufaktur** (das neue Spiel, Idle, Solo, `packages/manufaktur-kern`) | spielbar, nur App | packages/client/src/screens/SpieleNeu.tsx:349-372, GameSelect.tsx:222-226, 617 |
| Browort (Tageswort, Solo) | spielbar, nur App | SpieleNeu.tsx:365, StartNeu.tsx:151, GameSelect.tsx:219, 607 |
| Pro-Subway (Runner) | bald | SpieleNeu.tsx:465, App.tsx:846, Server-Sperre app.ts:1326-1328 |
| Mehrkampf | bald | SpieleNeu.tsx:466 |

Kategorie-Chips in der App nur mit spielbaren Spielen plus „Kommt bald"
(SpieleNeu.tsx:178-180); die Bald-Liste zugeklappt und ohne Abstimmung
(SpieleNeu.tsx:197, 204, 444-469).

### Funktionen

| Bereich | In der App | Fundstelle |
| --- | --- | --- |
| Anmeldung | E-Mail/Passwort und Gast; **keine** Apple-/Google-Knöpfe, kein Abschnitt „Anmeldearten" | anmeldung/AnbieterKnoepfe.tsx:92, Anmeldearten.tsx:45, Einstellungen.tsx:132 |
| Sitzung | Token in `localStorage`, `Authorization`-Kopf, WS-Unterprotokoll | laufzeit.ts:90-130, api.ts:37 |
| Hub | immer neues Hub; Reiter Profil · Spiele · Start · Sammlung · Clan | GameSelect.tsx:276-278 |
| Shop | **fehlt** (Reiter, Plus-Knöpfe) | GameSelect.tsx:156, 402-404 |
| Edelsteine | **ausgeblendet**, Kauf nur mit Münzen; Server lehnt `gems` aus der App ab | laufzeit.ts:54, HubRahmen.tsx:112, Kleiderschrank.tsx:337-352, app.ts:1411 |
| Gesperrte Inhaltspakete | „Nicht freigeschaltet" statt Shop-Verweis | inhaltspakete.ts:34-37 |
| Profil | Stufe statt Geburtstag, kein Geburtstagsgeschenk, **keine 3D-Figur / Werkstatt**, Profilbild nur anzeigen (kein Upload), **Browort-Statistik** | GameSelect.tsx:1096, 1111, 1115, 1217-1224, 4605-4616 |
| Sammlung | ohne Pinguin-Karte, Kleiderschrank ja | SammlungNeu.tsx:198 |
| Doppelkopf lernen (Lernpfad, Übungsrunde mit Tipps, Feier) | **nur App** | GameSelect.tsx:215, 230, 585; StartNeu.tsx:150; SpieleNeu.tsx:165; Table.tsx:639 |
| Clan | ohne Chat, ohne Clankrieg, Wappen nur eigene; **Clanwort nur App** | Clan.tsx:292, 350, 1149, 1337, 1351, 1375, 1435, 1481; GameSelect.tsx:220, 612 |
| Mitteilungen (Push) | Einstellungen + Glocke im Profil, Antippen führt an den Tisch | Einstellungen.tsx:125, 187; GameSelect.tsx:1276-1290; App.tsx:303, 874; push/* |
| Einladungslinks `/beitritt/<CODE>` | öffnet die Hülle, Link zeigt auf den Server | Huelle.swift:47-49, partykiste/einladungslink.ts:43 |
| Impressum/Datenschutz | im selben Fenster bzw. Safari-Blatt | Auth.tsx:406, Wegweiser.swift:30 |
| Kopfzeile | helle Statusleiste im Farbduell | kopfzeile.ts:21 |
| Haptik, Teilen, Bildschirm wach | native Bausteine statt Web-APIs | Huelle.swift:130-170, Haptik.swift |
| Einstellungen (Ton/Musik), Klanghalle, Kleiderschrank, Rangliste, Aufgaben/Truhen, Trophäenweg, Freunde, Melden/Blockieren, Konto löschen | wie Web | gemeinsamer Code, keine Weiche |

## 2. Was die Webseite anbietet

| Bereich | Auf der Webseite | Fundstelle |
| --- | --- | --- |
| Spiele | alle 13 Mehrspielermodule spielbar **außer BroChess (bald)**; Werwolf bald mit Abstimmung | registry.ts:157-187 |
| Solo | **nur Pro-Subway**; Kartenmanufaktur und Browort ohne Einstieg | SpieleNeu.tsx:375-400, App.tsx:846 |
| Mehrkampf | bald | SpieleNeu.tsx:403-417 |
| Abstimmung über Vorschau-Spiele | ja | SpieleNeu.tsx:204-211 |
| Anmeldung | E-Mail, Gast, **Apple, Google**, Abschnitt „Anmeldearten" | AnbieterKnoepfe.tsx, Einstellungen.tsx:132-136 |
| Shop, Edelsteine | ja | GameSelect.tsx:156, 404; HubRahmen.tsx:112 |
| Profil | Geburtstag + Geschenk, 3D-Figur/Werkstatt, Profilbild-Upload; **ohne Browort-Statistik**; Benachrichtigungen „Bald" | GameSelect.tsx:1096-1290, 4605 |
| Sammlung | mit Pinguin-Karte | SammlungNeu.tsx:198 |
| Doppelkopf lernen | **fehlt** (Lernpfad nicht erreichbar, Übungstipps aus) | GameSelect.tsx:215, Table.tsx:639 |
| Clan | Chat, Clankrieg, Wappen-Shop; **ohne Clanwort** | Clan.tsx (s. o.) |
| Mitteilungen | keine (kein Web-Push) | Mitteilungen.tsx:45, 73 |
| Altes Hub | per `?hub=alt` noch erreichbar | hubNeu.ts:13-30 |

## 3. Tabelle

Lücke: **fehlt in Web** = App hat es, Web nicht · **anders in Web** = beide
haben es, verschieden · **nur Web** = Kandidat zum Ausblenden auf `main`
(Entscheidung nötig, s. u.).

| Punkt | iOS | Web | Lücke |
| --- | --- | --- | --- |
| Doppelkopf, Skat, Filler | spielbar | spielbar | anders in Web: Filler heißt in der App „Farbduell" |
| BroChess | spielbar | bald | **fehlt in Web** (eine Zeile `registry.ts:183`) |
| Kartenmanufaktur (neu) | spielbar | kein Einstieg | **fehlt in Web** |
| Browort | spielbar + Startkarte + Profilstatistik | kein Einstieg | **fehlt in Web** |
| Clanwort | im Clan | kein Einstieg | **fehlt in Web** |
| Doppelkopf lernen / Übungsrunde | ja | nein | **fehlt in Web** |
| Mitteilungen | Push | „Bald" | anders in Web (Web-Push gibt es nicht; „Bald" ist ehrlich) |
| Partykiste | bald + ausgeblendet | spielbar (Trinkmodus) | nur Web → ausblenden? |
| Zauberer, Cambio, Poker, Mememory, Eiland, Feldherr, Tafelrunde, Golf, BroCooked | bald | spielbar | nur Web → ausblenden? |
| Pro-Subway | bald | spielbar | nur Web → ausblenden? |
| Abstimmung Vorschau-Spiele, Werwolf | aus | ja | nur Web |
| Shop, Edelsteine | aus | ja | nur Web (Apple 3.1.1 — auf der Webseite unkritisch) |
| Apple-/Google-Anmeldung | aus | ja | nur Web (technisch bedingt, bleibt) |
| Clan-Chat, Profilbild-Upload | aus | ja | nur Web (Moderation, Apple 1.2) |
| Clankrieg | aus | ja | nur Web → ausblenden? |
| 3D-Figur, Werkstatt, Pinguin-Karte | aus | ja | nur Web → ausblenden? |
| Geburtstag im Profil | aus | ja | nur Web |
| Altes Hub `?hub=alt` | — | ja | nur Web → entfernen |
| Kleiderschrank, Klanghalle, Rangliste, Aufgaben, Trophäenweg, Freunde, Melden, Löschen | ja | ja | keine |

## 4. Offene Zweige mit App-/iOS-Teilen

`git cherry` gegen `origin/staging` und `gh pr list --head`:

| Zweig | PR | Stand | iOS-Code nur dort? |
| --- | --- | --- | --- |
| feature/app-ios-huelle | #240 gemergt 23.09. | `apps/ios` auf staging ist neuer (126 Zeilen mehr) | nein |
| fix/ios-bundle-id | #262 gemergt 24.09. | inhaltsgleich auf staging | nein |
| aufgabe/ios-erster-build-der-swift-huelle-zu-tes-4fcfecce | **#265 offen** | einziger Commit inhaltsgleich mit #262 (`git cherry` „-") | nein — PR und Board-Karte 1e216a1b können geschlossen werden |
| feature/ios-v1-spielauswahl | — | 0 voraus, 75 zurück | nein (vollständig in staging) |
| feature/app-aufraeumen | — | 0 voraus, 23 zurück | nein |
| feature/browort (Kartenmanufaktur) | — | 0 voraus, 19 zurück | nein |
| feature/app-bereit-machen | #234 gemergt | Squash, Rest nur Merges | nein |
| feature/app-entscheidungen-robin | #243 gemergt | Squash | nein |
| feature/app-push-unterbau | #239 gemergt | Squash | nein |
| feature/app-store-unterlagen | #241 gemergt | Squash | nein |
| feature/app-android-release | #238 gemergt | Squash | nein |
| feature/auth-apple-google | #228 gemergt | Squash | nein |
| fix/app-einreichung-a1-a4 | #242 gemergt | Squash | nein |
| aufgabe/brauweg-clips-…-e240d610 | #298 gemergt | inhaltsgleich | nein |

**Ergebnis: Kein iOS- oder App-Code liegt nur auf einem Zweig.** Alles ist auf
`staging`. Die Zweige sind Altlast und können (nach Freigabe) gelöscht werden.

## 5. Server und Schalter

- **Derselbe Server.** Release-Build spricht mit `https://www.brauweg-spielen.de`,
  Debug mit `staging.brauweg-spielen.de` (`apps/ios/project.yml`, `configs`).
  Der Server erkennt die App allein an `Origin: brauweg://app` bzw. der
  Android-Herkunft (`app.ts:213-260`) und gibt nur dort das Token heraus
  (`app.ts:789, 983`).
- **Spiele an/aus:** `FREIGABE` im Server, je Spiel `web` und `app` mit
  `spielbar | bald | aus` (`registry.ts:157`). Geprüft an jedem Einstieg
  (`requireSpielbar`, `app.ts:2149, 2179, 2195, 2228, 2432`), ein Deploy genügt,
  installierte Apps folgen beim nächsten Öffnen. `test/spielfreigabe.test.ts`
  verlangt für jedes Modul einen Eintrag.
- **Partykiste-Rückweg:** Umgebungsvariablen `APP_PARTYKISTE_*` (`appInhalt`,
  `registry.ts:276`, `app.ts:2164, 2196`).
- **Funktionen an/aus:** **im Client fest einkompiliert** über `inApp`
  (Liste oben). Eine Änderung braucht einen Client-Build — und für die App
  zusätzlich einen neuen App-Build mit Apple-Prüfung, weil der Client im Paket
  liegt. Ausnahme serverseitig: Pro-Subway (`app.ts:1327`) und Edelstein-Kauf
  (`app.ts:1411`).
- **Nicht serverseitig gesperrt:** Browort-, Clanwort-, Manufaktur- und
  Lernpfad-Routen (`http/browort-routen.ts`, `manufaktur-routen.ts`,
  `lernpfad-routen.ts`) prüfen keine Plattform. Für die Webseite heißt das: Der
  Server ist bereit, es fehlt nur die Weiche im Client.
- **Hub-Schalter:** `hubNeu` (Standard neu, `?hub=alt` im Browser speicherbar).

## 6. Befunde nebenbei

- `docs/APP-RELEASE.md` §2 ist veraltet: nennt die Partykiste als in der App
  spielbar „mit Trinkmodus" (seit 21.10. „bald") und erwähnt weder
  Kartenmanufaktur, Browort, Clanwort, Lernpfad noch den Wegfall von
  Edelsteinen, Clankrieg und Figur in der App.
- Drei Weichen fragen `inApp && hubNeu`, eine nur `inApp`: Im alten Hub gäbe es
  Lernpfad/Browort auch in der App nicht. Unkritisch, solange die App das alte
  Hub nie zeigt.

## 7. Vorschlag für den Aufgabenschnitt

Vorher eine Entscheidung (Mensch): **Soll `main`/Web zum Release dasselbe
Angebot zeigen wie die App, oder die App plus das, was es nur im Web gibt?**
Davon hängt Teil C ab.

- **A — App-Funktionen ins Web holen** (Worker, je eine Aufgabe, jeweils nur
  eine Weiche im Client plus Sichtprobe):
  1. Kartenmanufaktur im Web (SpieleNeu „Allein", `soloStarten`).
  2. Browort im Web (Startkarte, Profilstatistik, „Allein").
  3. Clanwort im Web (Clan-Halle).
  4. Doppelkopf lernen im Web (Lernpfad, Übungstipps `Table.tsx:639`).
  5. BroChess auf der Webseite `spielbar` (eine Zeile, nach Robins „erst wenn
     es jemand gespielt hat").
- **B — Aufräumen** (Worker): `docs/APP-RELEASE.md` §2 nachziehen; PR #265 und
  die erledigten App-Zweige schließen (Mensch gibt frei); altes Hub entfernen.
- **C — Nur-Web-Teile auf `main` ausblenden** (nach der Entscheidung oben):
  Wenn gewünscht, als **Server-Schalter statt neuer `inApp`-Weichen** bauen —
  z. B. `FREIGABE.web` auf `bald` für die neun Spiele und eine
  Plattform-Funktionsliste in `/api/me`, damit Web und App künftig aus EINER
  Liste gesteuert werden und nicht wieder auseinanderlaufen.
