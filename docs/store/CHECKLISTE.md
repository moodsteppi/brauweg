# Checkliste vor dem Einreichen — Version 1.0 (iOS)

Stand 27.10.2026 (zuerst 23.09.2026). Wer einen Punkt erledigt, setzt den
Status **im selben Zug** und schreibt dazu, **woran** er es festmacht (Datum,
PR, Lauf) — nicht „müsste gehen". Status: `offen`, `entscheiden` (braucht eine
Entscheidung), `erledigt`.

Dazu gehören: [TEXTE.md](TEXTE.md) · [ALTERSFREIGABE.md](ALTERSFREIGABE.md) ·
[DATENSCHUTZ-ANGABEN.md](DATENSCHUTZ-ANGABEN.md) ·
[PRUEFHINWEISE.md](PRUEFHINWEISE.md) · [SCREENSHOTS.md](SCREENSHOTS.md) ·
Bau und Hochladen: [../APP-RELEASE.md](../APP-RELEASE.md).

**Was 1.0 in der App ist** (Stand staging 29f6302): Doppelkopf mit Lernpfad,
Skat, BroChess, Farbduell, Browort/Clanwort, Kartenmanufaktur; Spind und
Pinguin-Kleidung, Trophäenweg, Freunde, Clans (ohne Chat). **Nicht** in der
App: Partykiste/Trinkspiele (seit 22.10.2026), Edelsteine und jeder Kauf
(nur erspielte Münzen, `nurMuenzenInApp`), Clankrieg, Profilbild-Upload,
Clan-Chat. Google-Login gibt es in der App nicht, Apple-Login nativ (#330).
Produktion grenzt das über `UMFANG` ein (`docs/APP-RELEASE.md`).

---

## A. Blocker — ohne sie keine Einreichung

| # | Punkt | Wer | Status |
| --- | --- | --- | --- |
| A1 | **Rechtstexte ausfüllen.** Toms Angaben sind eingetragen (27.10.2026, Anbieter Privatperson, ohne USt-Abschnitt). Offen in `datenschutz.html` und `konto-loeschen.html`: Region von Railway (Dienst und Datenbank), Aufbewahrung der Railway-HTTP-Logs in Tagen, Datum der Veröffentlichung. Bis zum Release sind auf www die alten Platzhalter live. | Robin, Tom | teilweise |
| A2 | **Datenschutzerklärung freigeben.** Entwurf vom 27.10.2026 in `datenschutz.html` (Apple/Google-Anmeldung, Push, Tagesstatistik, Werbekennung, neue Spiele, Löschung). Gegenlesen, idealerweise juristisch. | Robin | offen |
| A3 | **Sign in with Apple in der App** (PR #330): nach dem Merge in TestFlight mit einer echten Apple-ID durchspielen — neues Konto (Geburtstag-Nachfrage), zweite Anmeldung, „E-Mail verbergen", Verknüpfen in den Einstellungen. Server nimmt `aud` = Bundle-ID an (`APPLE_APP_ID`, vorbelegt). Fähigkeit an der App-ID: legt die automatische Signierung an (signiertes Archiv am 27.10.2026 geprüft). | Tom (TestFlight), Aufsicht | offen |
| A4 | **Screenshots neu.** Die vom 23.09.2026 zeigen die Partykiste, die es in der App nicht mehr gibt (Apple 2.3.3). Neue Motive: Doppelkopf, Skat, Lernpfad, Browort, Kartenmanufaktur, BroChess (`werkzeug/store/screenshots.mjs`, `SCREENSHOTS.md`). | Aufsicht | offen |
| A5 | **Produktion auf den Release-Stand.** staging → main mit #330 und dem Doku-Stand; danach in Railway (Produktion) prüfen: `UMFANG` gesetzt wie in `docs/APP-RELEASE.md`, `APPLE_CLIENT_ID` gesetzt (ist es: `/api/auth/apple/config` liefert die Services ID). | Aufsicht, Mensch mit Railway-Zugang | offen |
| A6 | **Prüfkonto** in der Produktion anlegen, bestätigen, in `STAFF_EMAILS` (Railway, Produktion); Zugang in App Store Connect unter „App-Prüfung" (PRUEFHINWEISE.md). Nach einem DB-Reset (C3) neu anlegen. | Tom | offen |

## B. Erledigt

| # | Punkt | Beleg |
| --- | --- | --- |
| B1 | Löschung nimmt Profilbild und Figurbemalung mit | `anonymizeAccount`, `packages/server/test/konto-loeschen-web.test.ts` (23.09.2026) |
| B2 | Lösch-Seite ohne App: `https://www.brauweg-spielen.de/konto-loeschen` | `konto-loeschen.html`, Route in `app.ts` |
| B3 | Store-Texte DE/EN auf den App-Umfang vom 27.10.2026, Längen geprüft | `node werkzeug/store/texte-pruefen.mjs`: 18 Felder innerhalb der Grenzen (27.10.2026) |
| B4 | Alte Code-Blocker A1–A4 vom 23.09.2026 (Skat-Tisch, Shop-Hinweis, Minispielzahl, Leerzeichen) | #242 |
| B5 | Push: Löschung entfernt Geräte-Token und Einstellungen | `loescheGeraeteDesKontos` in `auth/service.ts` |
| B6 | Push-Schalter in der App funktionieren (CORS `PUT`, alle fünf Anlässe) | Commit „App aufräumen" (22.10.2026), mit Tests |
| B7 | Kein Kauf in der App: nur erspielte Münzen, Server lehnt Edelsteinkäufe aus der App ab → **kein In-App-Kauf nötig** (Apple 3.1.1) | `nurMuenzenInApp`, `mitEdelsteinen()` in `packages/client/src/laufzeit.ts` |
| B8 | Verschlüsselungsfrage entfällt | `ITSAppUsesNonExemptEncryption = false` (`docs/APPSTORE.md`) |
| B9 | Datenschutz-Angaben (Apple/Google) auf Push, Apple-Login, Statistik, Werbekennung nachgezogen | `DATENSCHUTZ-ANGABEN.md` (27.10.2026) |

## C. Entscheidungen

| # | Frage | Wer | Status |
| --- | --- | --- | --- |
| C1 | **Altersfreigabe und Mindestalter.** Stufe nach Apples Fragebogen, nicht manuell 18+; `MIN_AGE` bleibt 18 (ALTERSFREIGABE.md, Weg 2). Erwartet: **13+** (siehe C2). | Robin | entschieden 27.10.2026 |
| C2 | **Alkohol-/Drogenwörter im Clanwort.** Als Tageswort kommt `BIERE` nie dran (steht nur in `NUR_ERLAUBT`, nicht in `LOESUNGEN`). Im Clanwort sind aber alle Wörter aus `ERLAUBT` wählbar, also auch BIERE, BOWLE, DROGE (`clanwortWaehlen` in `packages/server/src/browort/dienst.ts`). Bleibt so; im Fragebogen „Selten" → 13+. | Robin | entschieden 27.10.2026 |
| C3 | **Datenbank der Produktion vor dem Launch zurücksetzen.** Entschieden: nur Spielstände und Testkonten, vorher Backup (Railway), Prüfkonto (A6) danach neu. Vorschau- und Reset-Skript liegen bei der Aufsicht vor (endet mit ROLLBACK). **Nichts ohne ausdrückliche Freigabe ausführen.** | Robin, Tom | entschieden 27.10.2026, ausführen nach dem Release |
| C4 | **Verfügbarkeit:** nur Deutschland, Österreich, Schweiz. | Robin | entschieden 23.09.2026 |
| C5 | **Löschung nimmt alles mit** (Freundschaften, Blockierungen, Clan-Nachrichten, Beitrittsanfragen, Push-Token, Werbekennung); Meldungen gegen das Konto bleiben für die Moderation. | Robin | entschieden 23.09.2026, ergänzt 27.10.2026 |
| C6 | **EU-Händlerstatus (DSA):** Was angekreuzt wird, entscheidet Tom beim Anlegen des Eintrags. Die Anschrift ist die des Büros (Robin, 23.09.2026). | Tom | offen: Tom kreuzt an |
| C7 | **Meldungen bearbeitet Tom** binnen 24 Stunden (PRUEFHINWEISE.md). | Robin | entschieden 23.09.2026 |
| C8 | **Überholt:** „Trinkspiel" als Suchwort (alt C4) und Pro-Subway in der App (alt C2) — beides ist in der App nicht mehr da. | — | entfällt 27.10.2026 |

## D. Railway (Produktion) — Mensch mit Zugang

| # | Punkt | Status |
| --- | --- | --- |
| D1 | `APPLE_TEAM_ID=K772DG59JN` — ohne sie liefert `/.well-known/apple-app-site-association` 404, Einladungslinks öffnen dann nicht die App | offen (27.10.2026: 404) |
| D2 | `BROWORT_SALZ` mit eigenem, langem Zufallswert — sonst lässt sich das Tageswort aus dem Repo vorausrechnen | offen |
| D3 | `UMFANG` = `doppelkopf,skat,filler,brochess,kartenmanufaktur,browort,clanwort,lernpfad,abstimmung,mehrkampf,schafkopf,romme,maumau,schwimmen,backgammon,bauernskat,phase10,drecksau` (Robin 27.10.2026: mit Abstimmung), **vor** dem Release-Merge setzen | offen |
| D4 | APNs-Schlüssel für Push (docs/PUSH.md) — ohne ihn schreibt der Server Mitteilungen nur ins Log | offen |
| D5 | `HERKUNFT_SCHLUESSEL` (nur für die Werbeauswertung, kein Blocker) | offen |

## E. Tom (App Store Connect, Konto Individual)

| # | Punkt | Status |
| --- | --- | --- |
| E1 | App-Eintrag in App Store Connect | erledigt (TestFlight-Builds seit 21.10.2026) |
| E2 | Texte DE und EN (TEXTE.md), Kategorie Spiele → Karten + Gelegenheitsspiele, Support- und Datenschutz-URL | offen (nach A1) |
| E3 | Altersfreigabe nach ALTERSFREIGABE.md, Ergebnis nach C1 eintragen | offen |
| E4 | App-Datenschutz nach DATENSCHUTZ-ANGABEN.md (neu: Geräte-ID für Push) | offen |
| E5 | Screenshots 6,9" hochladen (nach A4) | offen |
| E6 | Prüfhinweise und Prüfkonto (PRUEFHINWEISE.md), Kontaktangaben | offen (nach A6) |
| E7 | Inhaltsrechte: **Ja, mit Rechten** — gemeinfreies Kartenblatt, lizenzierte Klänge (`CREDITS.md`, `docs/KLANG.md`) | offen |
| E8 | Build mit #330 in TestFlight, dann zur Prüfung einreichen | offen |

## F. Nach der Einreichung

| # | Punkt | Status |
| --- | --- | --- |
| F1 | Tatsächliche Stufe (Apple) hier und in ALTERSFREIGABE.md eintragen | offen |
| F2 | Wechselt ein weiteres Spiel in der App auf `spielbar` oder kommt Clan-Chat/Upload/Kauf in die App: ALTERSFREIGABE.md, TEXTE.md, DATENSCHUTZ-ANGABEN.md und Screenshots neu | Daueraufgabe |
| F3 | Google Play (Android): Konto, 12 Tester über 14 Tage, Formulare (`docs/APP-RELEASE.md` 4.x) — nicht Teil des iOS-Release | offen |
