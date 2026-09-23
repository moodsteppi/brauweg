# Datenschutz-Angaben: Apple „App Privacy" und Google „Data safety"

Stand 23.09.2026, Version 1.0. Abgeleitet aus dem, was Server und Client
**wirklich speichern** — jede Zeile mit Beleg. Zeilennummern gelten für den
Stand dieses Zweigs; wer sie nach einer Änderung nachschlägt, sucht den
genannten Bezeichner.

Grundsätze, die für beide Formulare gelten:

- **Kein Tracking, keine Werbung, keine Analyse von Dritten.** Im Client
  steckt kein SDK dieser Art; die einzige Telemetrie (`aufzeichnung.ts`)
  läuft nur am Feldherr-Tisch (`FeldherrTisch.tsx:774`), und Feldherr steht
  in der App auf „Bald". Der Feedback-Knopf erscheint nur auf staging
  (`FeedbackWidget.tsx:118`).
- **Nichts wird geteilt.** Railway (Server, Datenbank) und Resend (Mails)
  sind Auftragsverarbeiter — für Apple kein „Tracking", für Google kein
  „Sharing" (Dienstleister sind ausgenommen).
- **Verschlüsselt übertragen:** ja, nur HTTPS/WSS (Release-Adresse
  `https://www.brauweg-spielen.de`, `docs/APP-RELEASE.md` Abschnitt 1).
- **Im Gerät** liegt nur das Sitzungstoken (`localStorage`,
  `packages/client/src/laufzeit.ts:70–79`) und Einstellungen der Oberfläche.

---

## Was der Server speichert

| Daten | Wer | Beleg | Pflicht? |
| --- | --- | --- | --- |
| E-Mail-Adresse | Konten mit Mail (nicht Gäste) | `account.email`, `packages/server/src/db/schema.ts:132`; Registrierung `packages/server/src/http/app.ts:330–340` | für ein Konto ja, Gäste nein |
| Passwort (nur argon2id-Prüfwert) | Konten mit Mail | `account.passwordHash`, `schema.ts:134` | wie Mail |
| Anzeigename | alle, auch Gäste | `account.displayName`, `schema.ts:136`; Gast: `app.ts:831–842` | ja |
| Geburtsdatum | Konten mit Mail (Pflicht, ab 18) | `account.birthday`, `schema.ts:228`; `assertValidBirthday`, `packages/server/src/birthday.ts:11,47` | Konto ja, Gast nein |
| Konto-ID | alle | `account.id`, `schema.ts:130` | ja |
| Bindung an Google/Apple | nur Webseite (in der App aus, `AnbieterKnoepfe.tsx:83`) | `account_identity`, `schema.ts:295` | — |
| Sitzungen (nur Hash, **keine IP, kein Gerät**) | alle | `session`, `schema.ts:346–364` | ja |
| Profilbild | nur wer es **auf der Webseite** hochlädt; in der App aus (`GameSelect.tsx:3410`) | `account.avatar` (data-URL), `schema.ts:207`; ausgeliefert `app.ts:1366` | nein |
| Figurbemalung (Striche, kein Bild) | wer bemalt | `account.figurBemalung`, `schema.ts:223` | nein |
| Partien, Runden, Ergebnisse | alle | `party`, `round_summary`, `party_snapshot`, `schema.ts:901–990` | ja (Spielbetrieb) |
| Statistik, Trophäen, Bestleistungen | alle | `account_game_stat` `schema.ts:366`, `trophy_ledger` `:1033`, `bestleistung` `:1003` | ja |
| Stufe/XP, Tagesaufgaben, Truhen, Spielwährung | alle | `account.xp` `:170`, `quest_progress` `:485`, `chest_claim` `:457`, `coins/gems/broJetons` `:139–164` | ja |
| Besitz und Aussehen (Blätter, Szenen, Kosmetik) | alle | `account_cosmetic` `:568`, `account_avatar` `:587`, `account_game_theme` `:402` | ja |
| Freundschaften, Blockierungen | wer sie anlegt | `friendship` `:1053`, `block` `:1073` | nein |
| Wer mit wem spielte (Absprache-Erkennung) | alle | `pairing_log` `:1092` | ja |
| Clan, Rolle, Clan-Name und -Motto | Clan-Mitglieder | `club` `:639`, `club_member` `:693` | nein |
| Clan-Nachrichten | **nur Webseite** (Chat in der App aus, `Clan.tsx:280,338`) | `club_message` `:722` | nein |
| Meldungen (Grund + optional Freitext bis 500 Zeichen) | wer meldet | `report` `:1108`; `melden-routen.ts:127` | nein |
| Server-Protokolle (IP, Zeit, Adresse) | alle | Railway-Logs, Aufbewahrung **offen** (rote Lücke in der Datenschutzerklärung) | technisch |
| **Geräte-Token für Push** | **noch nicht** — kommt mit „Push Server-Seite" | — | — |

Nicht erhoben: Standort, Kontakte, Fotos/Kamera in der App, Telefonnummer,
Anschrift, Zahlungsdaten (keine Käufe in der App), Werbe-ID,
Absturzberichte.

---

## Apple „App Privacy"

App Store Connect → App → *App-Datenschutz*. Frage „Erheben Sie Daten?":
**Ja.** Für jeden Typ unten: **verknüpft mit der Identität: ja**, **Tracking:
nein**, Zweck: **App-Funktionalität** (bei E-Mail zusätzlich nichts weiter —
keine Werbung, keine Analyse, keine Personalisierung durch Dritte).

| Apple-Kategorie → Typ | Erhoben | Warum dieser Typ |
| --- | --- | --- |
| Kontaktinformationen → **E-Mail-Adresse** | ja | Anmeldung, Bestätigung, Passwort zurücksetzen |
| Kennungen → **Nutzer-ID** | ja | Apple zählt „Screen Name, Handle, Account-ID" hierzu — also Anzeigename **und** Konto-ID. **Nicht** unter „Name": der Anzeigename ist ein Spielername, kein Vor-/Nachname. |
| Sonstige Daten → **Andere Datentypen** | ja | Geburtsdatum. Apple nennt es in keiner Kategorie; „Other Data" ist der ehrliche Ort. |
| Nutzerinhalte → **Gameplay-Inhalt** | ja | Partien, Spielstände, Mitspielersuche (Apple: „saved games, multiplayer matching or gameplay logic") |
| Nutzerinhalte → **Andere Nutzerinhalte** | ja | Clan-Name und -Motto, Figurbemalung, Meldetext |
| Nutzungsdaten → **Produktinteraktion** | ja | Tagesaufgaben-Fortschritt, Stufe/XP — vorsichtshalber; Apple zählt „saved place in a game" dazu |
| Nutzerinhalte → Fotos oder Videos | **nein** | In der App gibt es keinen Upload (`GameSelect.tsx:3410`). **Geht der Upload in der App an: ja, verknüpft, App-Funktion.** |
| Kennungen → Geräte-ID | **nein** | Heute keine. **Mit Push:** das APNs-Token ist nach Apples Definition keine Geräte-ID im Werbesinn — trotzdem beim Einbau entscheiden und hier nachtragen. |
| Diagnose | **nein** | siehe Grundsätze |
| Standort, Kontakte, Käufe, Finanzdaten, Gesundheit, Browserverlauf, Suchverlauf | **nein** | |

Die Spielersuche (Freunde → Suchen, `app.ts:1603`) schickt den Suchtext an
den Server und speichert ihn nicht — für Apple kein „Suchverlauf".

---

## Google „Data safety"

Play Console → *App-Inhalte → Datensicherheit*.

**Allgemein**

| Frage | Antwort |
| --- | --- |
| Erhebt oder teilt die App Nutzerdaten? | **Ja** |
| Werden alle Daten bei der Übertragung verschlüsselt? | **Ja** |
| Können Nutzer die Löschung ihrer Daten beantragen? | **Ja** — in der App (Profil → ganz unten → Konto löschen) und im Web |
| Web-Link zur Kontolöschung | **`https://www.brauweg-spielen.de/konto-loeschen`** (neu mit diesem Zweig) |
| Teilen Sie Daten mit Dritten? | **Nein** (nur Auftragsverarbeiter) |

**Datentypen** — alle **erhoben: ja, geteilt: nein, nicht vergänglich**
(außer wo vermerkt), Zweck **App-Funktionalität** und **Kontoverwaltung**:

| Google-Kategorie → Typ | Pflicht/optional | Anmerkung |
| --- | --- | --- |
| Personenbezogene Daten → **Name** | Pflicht | Google zählt Spitznamen dazu — der Anzeigename |
| Personenbezogene Daten → **E-Mail-Adresse** | **optional** | Gäste spielen ohne |
| Personenbezogene Daten → **Nutzer-IDs** | Pflicht | Konto-ID |
| Personenbezogene Daten → **Sonstige Informationen** | optional | Geburtsdatum (Google nennt es dort ausdrücklich) |
| App-Aktivitäten → **App-Interaktionen** | Pflicht | Tagesaufgaben, Stufe/XP |
| App-Aktivitäten → **Sonstige Aktionen** | Pflicht | Spielverlauf, Ergebnisse, Trophäen |
| App-Aktivitäten → **Sonstige von Nutzern erstellte Inhalte** | optional | Clan-Name/-Motto, Figurbemalung, Meldetext |
| App-Aktivitäten → **In-App-Suchverlauf** | optional, **vergänglich** | Spielersuche; nicht gespeichert |
| Fotos und Videos → Fotos | **nein** | kein Upload in der App |
| Nachrichten → Sonstige In-App-Nachrichten | **nein** | Clan-Chat in der App aus |
| App-Info und -Leistung | **nein** | |
| Geräte- oder sonstige IDs | **nein** | **mit Push: Firebase-Token → „Geräte- oder sonstige IDs", Zweck App-Funktionalität** |
| Standort, Finanzen, Kontakte, Gesundheit, Dateien, Kalender, Audio | **nein** | |

Keine Sicherung des App-Speichers (`allowBackup=false`, `docs/APP-RELEASE.md` 4.4).

---

## Konto löschen — wo und was

**In der App:** Profil-Tab → ganz unten → **Konto löschen**
(`packages/client/src/screens/GameSelect.tsx`, Route `DELETE /api/me`,
`app.ts:1546`). Bestätigt wird mit Passwort, ohne Passwort per Code aus der
Mail (nur Google/Apple, `/api/me/loeschcode`), als Gast mit dem Wort
LÖSCHEN (`auth/loeschen.ts`).

**Ohne App:** `https://www.brauweg-spielen.de/konto-loeschen` — neu mit
diesem Zweig. Die Seite liegt als
`packages/client/public/rechtliches/konto-loeschen.html` neben den
Rechtstexten, die Route `/konto-loeschen` steht in `app.ts` vor dem
`setNotFoundHandler` (ohne sie bekäme die Adresse die index.html der App).
Sie nennt App und Anbieter, beide Wege (App, Browser mit Anmeldung), den Weg
per Mail an den Support, was gelöscht wird und was ohne Personenbezug bleibt.
Geprüft in `packages/server/test/konto-loeschen-web.test.ts`.

**Was die Löschung tut** (`anonymizeAccount`, `packages/server/src/auth/service.ts:703`):
Mail, Passwort, Bestätigung, Geburtsdatum weg; Anzeigename wird
`geloescht-<8 Zeichen>`; **Profilbild und Figurbemalung weg (neu mit diesem
Zweig — vorher blieben sie stehen, und `/api/avatars/:id` lieferte das Foto
eines gelöschten Kontos weiter aus)**; Google/Apple-Bindungen gelöscht; alle
Sitzungen widerrufen; Clan verlassen (`releaseClubMemberships`); seit dem
23.09.2026 (Robin, CHECKLISTE C5) auch Freundschaften, Blockierungen in beide
Richtungen, eigene Clan-Nachrichten und Beitrittsanfragen.

**Was bleibt** (ohne Personenbezug, an der anonymisierten Zeile): Partien,
Statistik, Trophäen, Währung; **außerdem** Meldungen gegen das Konto, für die
Moderation. So steht es auch auf der Löschseite.

---

## Vorschlag für die Datenschutzerklärung (Robin gibt frei)

Die Erklärung unter `packages/client/public/rechtliches/datenschutz.html`
ist **nicht** angefasst. Beim Abgleich mit dem Code und den Store-Angaben
fällt auf, was vor der Einreichung nachgezogen werden sollte:

1. **Gastkonten fehlen.** Ein Gast hat nur Anzeigenamen und Spielstand,
   keine Mail, kein Geburtsdatum (`gastSeit`, `schema.ts:271`). Vorschlag
   für Abschnitt 2: „Ohne Konto (als Gast): nur der gewählte Anzeigename und
   was du spielst. Verlierst du die Sitzung, kommst du nicht wieder hinein;
   du kannst das Gastkonto jederzeit mit Mail und Passwort sichern."
2. **Einladungscode ist nicht mehr Pflicht** (`registerSchema`, `app.ts:336–337`:
   „Seit der Oeffnung optional"). Die Zeile kann bleiben, sollte aber
   „falls angegeben" sagen.
3. **Löschung:** „Zur Bestätigung wird das Passwort erneut abgefragt" gilt
   nur noch für Konten mit Passwort (Code per Mail, Wort LÖSCHEN für Gäste).
   Die Liste des Gelöschten um **Profilbild und Figurbemalung** ergänzen, und
   den Link `/konto-loeschen` nennen.
4. **Melden und Blockieren fehlen.** Vorschlag: „Meldest du einen Spieler,
   speichern wir Grund, optionalen Text, dich und den Gemeldeten und schicken
   die Meldung an das Betreiberteam (Art. 6 Abs. 1 lit. f DSGVO — Schutz der
   Mitspieler). Blockierst du jemanden, speichern wir das Paar."
5. **Cookies/App:** In der App gibt es kein Cookie, sondern ein
   Sitzungstoken im Gerätespeicher der App. Ein Satz dazu in Abschnitt 3.
6. **Mindestalter:** erledigt (23.09.2026) — Abschnitt 7 und die Tabelle in
   Abschnitt 2 sagen „18 Jahre", passend zu `MIN_AGE = 18`.
7. **Anmeldung mit Google/Apple** (nur Webseite) fehlt als Empfänger/Weg —
   gehört in Abschnitt 2 und 4, sobald die Webseite es anbietet.
8. **Push** — erst, wenn es gebaut ist: Geräte-Token, Apple (APNs) bzw.
   Google (Firebase) als Empfänger.
