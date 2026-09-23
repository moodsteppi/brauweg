# Checkliste vor dem Einreichen — Version 1.0

Stand 23.09.2026. Wer einen Punkt erledigt, setzt den Status **im selben
Zug** und schreibt dazu, **woran** er es festmacht (Datum, PR, Lauf) — nicht
„müsste gehen". Status: `offen`, `entscheiden` (braucht eine Entscheidung),
`erledigt`.

Dazu gehören: [TEXTE.md](TEXTE.md) · [ALTERSFREIGABE.md](ALTERSFREIGABE.md) ·
[DATENSCHUTZ-ANGABEN.md](DATENSCHUTZ-ANGABEN.md) ·
[PRUEFHINWEISE.md](PRUEFHINWEISE.md) · [SCREENSHOTS.md](SCREENSHOTS.md) ·
Bau und Hochladen: [../APP-RELEASE.md](../APP-RELEASE.md).

---

## A. Blocker im Code — vor der Einreichung beheben

Gefunden beim Erzeugen der Screenshots gegen staging (App-Herkunft, 23.09.2026).
Alle drei liegen in Dateien, die dieser Zweig bewusst nicht anfasst
(Auftrag: kein `GameSelect.tsx`, kein `Lobby.tsx`, kein Spielcode).

| # | Punkt | Wer | Status |
| --- | --- | --- | --- |
| A1 | **Der erste Skat-Tisch lässt sich nicht anlegen.** Ohne gemerkte Einstellung schickt die Lobby 4 Sitze, Skat kennt nur 3 → „Diese Spielerzahl gibt es bei diesem Spiel nicht". Ursache `packages/client/src/screens/Lobby.tsx:137–141`: Fällt `merken` weg, bleibt `seats` beim Anfangswert 4, auch wenn `d.seatCounts` ihn nicht enthält. Vorschlag: `: d.seatCounts.includes(seats) ? seats : d.seatCounts[0]`. Genau daran bricht ein Prüfer ab (Apple 2.1). Trifft auch die Webseite. | Aufsicht (Worker) | behoben in #242 |
| A2 | **Themenpakete zeigen in der App einen Weg zum Shop, den es dort nicht gibt.** Partykiste-Menü: „JGA · 800 Münzen · Im Shop ansehen: „Spielpakete"" (`sperrgrund` in `packages/client/src/inhaltspakete.ts:28`). Der Shop ist in der App aus; ein Verweis auf einen Kaufweg außerhalb der App ist Apple 3.1.1. Vorschlag: In der App (`inApp`) nur „gesperrt" ohne Shop-Hinweis — oder die gesperrten Pakete in der App ausblenden. | Aufsicht, Wortlaut Robin | behoben in #242 (Wortlaut „Nicht freigeschaltet", Robin kann ihn ändern) |
| A3 | **Veraltete Minispielzahl.** Kachel „9 Minispiele" (`GameSelect.tsx:2616`), Menü „Zwölf Minispiele" (`screens/Partykiste.tsx:345`); das Modul hat 15 (`MINISPIELE`). Steht in Screenshot 01 und 06. Danach Screenshots neu erzeugen. | Aufsicht | behoben in #242 |
| A4 | Skat-Kopfzeile „Gabe 1 / 3Du bist am Reizen" — Leerzeichen fehlt (`SkatTable.tsx:287`). Schönheitsfehler, sichtbar in Screenshot 03. | Aufsicht | behoben in #242 |

## B. In diesem Zweig erledigt

| # | Punkt | Beleg |
| --- | --- | --- |
| B1 | Löschung nimmt **Profilbild und Figurbemalung** mit. Vorher lieferte `/api/avatars/:id` das Foto eines gelöschten Kontos weiter aus. | `anonymizeAccount` in `packages/server/src/auth/service.ts`; `packages/server/test/konto-loeschen-web.test.ts`, 23.09.2026 grün |
| B2 | **Lösch-Seite ohne App** für Google Play: `https://www.brauweg-spielen.de/konto-loeschen` | `packages/client/public/rechtliches/konto-loeschen.html`, Route in `app.ts`; derselbe Test |
| B3 | Store-Texte DE/EN mit Längenprüfung | `node werkzeug/store/texte-pruefen.mjs`: 18 Felder, alle innerhalb der Grenzen (23.09.2026) |
| B4 | Screenshots beider Größen, 7 Motive | `werkzeug/store/screenshots.mjs`, Lauf 23.09.2026: 14 Bilder ohne Fehler |

## C. Entscheidungen

| # | Frage | Wer | Status |
| --- | --- | --- | --- |
| C1 | **Mindestalter:** 18. `MIN_AGE = 18` für jedes neue Konto (Registrierung, Google, Apple, Gast verknüpfen), Datenschutzerklärung Abschnitt 7 und die Geburtstagsfelder sagen 18. **Bestandskonten zwischen 16 und 18 bleiben**; ob sie gesperrt werden, ist offen (Robin). | Robin | entschieden 23.09.2026 |
| C2 | **Pro-Subway in der App:** als „Bald"-Kachel wie die nicht freigegebenen Spiele; der Server weist Läufe aus der App ab (`runnerNurImWeb`). Auf der Webseite unverändert. | Robin | entschieden 23.09.2026 |
| C3 | Screenshot 04 (alkoholfrei) bleibt, 07 wird nicht hochgeladen. | Robin | entschieden 23.09.2026 |
| C4 | „Trinkspiel" als Suchwort: **ja**, ersetzt `Kneipe` in den Apple-Schlüsselwörtern (TEXTE.md). Das Risiko nach Apple 1.4.3 kennt Robin. | Robin | entschieden 23.09.2026 |
| C5 | **Löschung nimmt alles mit:** Freundschaften, Blockierungen (beide Richtungen), eigene Clan-Nachrichten und Beitrittsanfragen (`anonymizeAccount`). Meldungen gegen das Konto bleiben für die Moderation. Die Lösch-Seite sagt es so. | Robin | entschieden 23.09.2026 |
| C6 | **Verfügbarkeit:** nur Deutschland, Österreich, Schweiz. | Robin | entschieden 23.09.2026 |
| C7 | **EU-Händlerstatus (Digital Services Act).** Apple und Google fragen bei Vertrieb in der EU, ob der Anbieter „Händler" ist. Ja heißt: Name, Anschrift, Telefon und Mail stehen öffentlich im Store. **Der Einwand „Toms Privatanschrift wird öffentlich" entfällt:** Sie ist dieselbe wie die des Büros (Robin, 23.09.2026). Was er ankreuzt, entscheidet Tom beim Anlegen des Eintrags. | Tom (Apple), Kontoinhaber (Play) | offen: Tom kreuzt an |
| C8 | **Meldungen bearbeitet Tom**, Inhaber des Developer-Kontos, binnen 24 Stunden. Die 24-Stunden-Zeile in PRUEFHINWEISE.md bleibt. | Robin | entschieden 23.09.2026 |

## D. Robin

| # | Punkt | Status |
| --- | --- | --- |
| D1 | **Rechtstexte ausfüllen**: Name, Anschrift, Support-Adresse, Datenbankanbieter, Regionen, Aufbewahrung der Protokolle — in `datenschutz.html`, `impressum.html` **und** der neuen `konto-loeschen.html` (dieselben roten Lücken). Ohne ausgefülltes Impressum gibt es keine Support-URL. | offen |
| D2 | Vorschläge 1–8 für die Datenschutzerklärung prüfen und freigeben (DATENSCHUTZ-ANGABEN.md, letzter Abschnitt) | offen |
| D3 | **Prüfkonto** in der Produktion anlegen, bestätigen, in `STAFF_EMAILS` (Railway, Produktion); Passwort in den Passwortmanager (PRUEFHINWEISE.md) | offen |
| D4 | Play-Konto anlegen (25 $, Identitätsprüfung), Upload-Schlüssel, 12 Tester über 14 Tage (`docs/APP-RELEASE.md` 4.2–4.3) | offen |
| D5 | Play Console ausfüllen: Store-Eintrag (TEXTE.md), Datensicherheit und Konto-löschen-URL (DATENSCHUTZ-ANGABEN.md), Einstufung und Zielgruppe (ALTERSFREIGABE.md), App-Zugriff mit Prüfkonto, Werbung „nein" | offen |
| D6 | Feature-Grafik bestellen (`docs/ASSETS-STORE.md`) und das endgültige App-Symbol (`docs/APP-RELEASE.md` Abschnitt 6) | offen |
| D7 | Railway: `APPLE_TEAM_ID`, `ANDROID_SHA256` (`docs/APP-RELEASE.md`) | offen |

## E. Tom (Apple-Konto, Individual)

| # | Punkt | Status |
| --- | --- | --- |
| E1 | App-Eintrag in App Store Connect (`docs/APP-RELEASE.md` 3.1 Punkt 5) | offen |
| E2 | Texte DE und EN (TEXTE.md), Kategorie Spiele → Karten + Gelegenheitsspiele, Support- und Datenschutz-URL | offen |
| E3 | Altersfreigabe nach ALTERSFREIGABE.md → Ergebnis 18+ prüfen und hier eintragen | offen |
| E4 | App-Datenschutz nach DATENSCHUTZ-ANGABEN.md | offen |
| E5 | Screenshots 6,9" hochladen (von Robin/Aufsicht nach A3 neu erzeugt) | offen |
| E6 | Prüfhinweise und Prüfkonto (PRUEFHINWEISE.md), Kontaktangaben | offen |
| E7 | Inhaltsrechte („Enthält die App Inhalte Dritter?"): **Ja, mit Rechten** — gemeinfreies Kartenblatt, lizenzierte Klänge (`CREDITS.md`, `docs/KLANG.md`) | offen |
| E8 | Verschlüsselungsfrage entfällt (`ITSAppUsesNonExemptEncryption = false`, `docs/APPSTORE.md`) | erledigt (steht in der Info.plist, laut `docs/APPSTORE.md`) |
| E9 | Build, TestFlight, Associated Domains in der Swift-Hülle (`docs/APP-RELEASE.md` 3.1–3.3) | offen |

## F. Aufsicht

| # | Punkt | Status |
| --- | --- | --- |
| F1 | A1–A4 als Worker-Aufgaben vergeben | erledigt: die Aufsicht hat A1–A4 selbst gebaut (#242) |
| F2 | Nach A3 die Screenshots neu erzeugen (`SCREENSHOTS.md`) | offen |
| F3 | Kommt Push („Push Server-Seite"): Geräte-Token in DATENSCHUTZ-ANGABEN.md und in der Datenschutzerklärung nachtragen; Apple- und Play-Formular neu | offen |
| F4 | Wechselt ein weiteres Spiel in der App auf `spielbar`: ALTERSFREIGABE.md neu (Poker = simuliertes Glücksspiel), TEXTE.md, Screenshots | offen, sobald es passiert |
| F5 | Nach der Einreichung: tatsächliche Stufen (Apple, USK/PEGI) hier und in ALTERSFREIGABE.md eintragen | offen |
