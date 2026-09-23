# App-Release: iOS und Android, zuerst ohne Käufe

Stand 23.09.2026. Robins Entscheidung: Die App geht **zuerst ohne Käufe** in
die Stores, Käufe kommen später mit der Firma. **iOS zuerst in den Store,
Android sofort in den geschlossenen Test** (neue private Play-Konten brauchen
12 Tester über 14 Tage, bevor sie veröffentlichen dürfen). Das Apple-Konto
(Individual) gehört **Tom**; gebaut wird iOS auf Toms MacBook.

Diese Datei ist die Schritt-für-Schritt-Anleitung. Wie die iOS-Hülle gebaut
ist und wie der erste Build auf dem Mac geht, steht in **Abschnitt 7**; die
Token-Anmeldung beschreibt `docs/APPSTORE.md`.

---

## 1. Wie die Apps gebaut sind

| | iOS | Android |
| --- | --- | --- |
| Hülle | Swift, `apps/ios` in diesem Repo (seit 23.09.2026, Projekt per XcodeGen) | Kotlin, `apps/android` in diesem Repo (seit 23.09.2026) |
| Client | gebündelt unter `brauweg://app` | gebündelt unter `https://appassets.androidplatform.net` |
| Server | Debug: Staging, Release: Produktion (Build-Einstellung `BRAUWEG_API_BASE` überschreibt) | Debug: Staging, Release: Produktion (`-PapiBase=…` überschreibt) |
| Anmeldung | Token statt Cookie | dasselbe |
| Bundle-ID / Paket | `de.brauweg.app` | `de.brauweg.app` (Debug: `de.brauweg.app.debug`) |

**Kein Capacitor.** Am 23.09.2026 kurz begonnen und verworfen: Es wäre eine
zweite, konkurrierende iOS-Hülle neben der beschlossenen Swift-Hülle gewesen.
Android folgt stattdessen deren Vorbild.

**Warum Android eine andere Herkunft hat:** Der Android-WebView kennt keine
eigenen Schemata als richtige Herkunft — unter `brauweg://…` gäbe es weder
`localStorage` noch eine Herkunft, die sich von einer beliebigen
Sandbox-Seite unterscheidet (`Origin: null`). Google sieht für gebündelte
Inhalte `WebViewAssetLoader` unter `appassets.androidplatform.net` vor; die
Adresse gehört Google und liefert nie eine Webseite aus. Der Server kennt
beide (`APP_ORIGINS` in `packages/server/src/http/app.ts`).

**Paketgröße: rund 54 MB** (gemessen am 23.09.2026 mit
`apps/android/werkzeug/web-uebernehmen.mjs`: Karten 25 MB, Hub 13 MB, 3D 9 MB,
Klang 6 MB). Die 9,4 MB aus `APPSTORE.md` stammen vom August.

---

## 2. Was in der App anders ist als auf der Webseite

Alles serverseitig oder an der Herkunft erkannt — **die Webseite verhält sich
unverändert**, und nichts davon braucht einen neuen App-Build.

### Welche Spiele — EINE Liste

`FREIGABE` in `packages/server/src/games/registry.ts`, je Spiel `web` und
`app`:

- `spielbar` — wie heute.
- `bald` — steht mit „Bald"-Marke da, lässt sich nicht starten, ohne Abstimmung.
- `aus` — gar nicht zu sehen (nur App).

**Stand (Robin, 23.09.2026):** In der App spielbar **Doppelkopf, Skat,
Partykiste**; auf „Bald" alle anderen (Zauberer, Cambio, Poker, Mememory,
Filler, Eiland, Feldherr, Tafelrunde, Golf, BroCooked); Werwolf in der App
`aus`. Auf der Webseite alles wie bisher. **Ein Spiel wechselt mit einer
Zeile und einem Deploy in die App** — die installierten Apps richten sich
beim nächsten Öffnen danach.

Die Sperre greift an jedem Einstieg: Tisch anlegen, Tischliste,
Mitspielersuche, Beitritt per Kennung und per Code, Code-Vorschau. Wer schon
an einem Tisch sitzt, kommt immer an seinen Platz zurück.

### Keine Käufe

Der Shop-Reiter und die Plus-Knöpfe an Münzen und Edelsteinen fehlen in der
App (`zeigeKaufbares` in `GameSelect.tsx`, seit August). Kein Link zu einem
Kauf auf der Webseite (Apple 3.1.1).

### Kein Google-/Apple-Login in der App

Die Anbieter-Knöpfe erscheinen in der App nicht (`AnbieterKnoepfe.tsx`,
Release #228): Google lehnt Anmeldungen aus eingebetteten WebViews ab, und
ohne fremden Login entfällt auch Apples Pflicht, „Mit Apple anmelden"
anzubieten (4.8). Anmeldung in der App: E-Mail + Passwort oder als Gast.

### Partykiste: Trinkmodus — und der Rückweg

In der App **wie auf der Webseite, mit Trinkmodus** (Robins Entscheidung; das
Risiko bei Apple 1.4.3 ist bekannt). Lehnt Apple deshalb ab, genügt ein
Deploy mit einer Umgebungsvariablen — kein neuer Build:

| Variable | Wirkung (nur für Anfragen aus der App) |
| --- | --- |
| `APP_PARTYKISTE_TRINKMODUS=aus` | Tische aus der App zählen Strafpunkte statt Schlucke; an Trinktische der Webseite kommt aus der App niemand. |
| `APP_PARTYKISTE_HAERTE_MAX=2` | Textschärfe höchstens „pikant". |
| `APP_PARTYKISTE_HAERTE_MAX=1` | höchstens „harmlos" — nimmt auch alle 16 Kiffer-Einträge heraus (alle stehen auf pikant). |

Vorgabe: beide nicht gesetzt = App wie Web. Der Server sagt beim Start eine
Zeile, wenn der Rückweg aktiv ist.

### Moderation

- **Melden und Blockieren** gibt es jetzt (Apple 1.2): im fremden Profil (am
  Tisch führt der Tipp auf einen Namen dorthin) und im Wartesaal der
  Partykiste. Meldungen gehen per Mail an alle Testkonten und stehen unter
  `/api/aufsicht/meldungen`.
- **Clan-Chat und Profilbild-Hochladen sind in der App aus**, bis jemand die
  Meldungen abarbeitet und es einen Filter gibt. Auf der Webseite bleibt
  beides.

### Konto löschen (Apple 5.1.1(v))

Profil-Tab ganz unten. Mit Passwort wie bisher; **neu** für Konten ohne
Passwort: nur-Google/Apple-Konten bekommen einen Code per Mail, Gäste tippen
LÖSCHEN (`auth/loeschen.ts`).

---

## 3. iOS — was Tom auf dem Mac tut

### 3.1 Einmalig

1. **Xcode** (aktuelle Version aus dem App Store) installieren, einmal starten.
2. **Werkzeuge:** `brew install xcodegen node@22` (Homebrew). Nur `brauweg`
   klonen — die Hülle liegt darin (`apps/ios`); ein zweites Repo gibt es nicht.
3. **Team-ID** einmal in `apps/ios/Konfiguration/Lokal.xcconfig` eintragen
   (Vorlage `Lokal.xcconfig.beispiel`, nie einchecken). Nicht in Xcode unter
   *Signing & Capabilities*: Das Projekt entsteht bei jedem
   `xcodegen generate` neu, und dort Eingestelltes wäre danach weg.
4. **Erster Build und Start im Simulator und auf dem iPhone:** Schritt für
   Schritt in **7.4**.
5. **App-Eintrag** in App Store Connect anlegen: *Apps → + → Neue App*,
   Plattform iOS, Name „Brauweg", Sprache Deutsch, Bundle-ID `de.brauweg.app`,
   SKU frei (`brauweg-ios`).
6. **API-Schlüssel für den Bau ohne Kabel:** App Store Connect → *Users and
   Access → Integrations → App Store Connect API → Team Keys* → Schlüssel mit
   Rolle **Admin** anlegen (App Manager nur mit Zugriff auf *Certificates,
   Identifiers & Profiles* und die Cloud-Signierung — sonst scheitert
   `-exportArchive`), `.p8` **einmalig** herunterladen nach
   `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8` (Rechte `chmod 600`).
   Key-ID und Issuer-ID in `werkzeug/app/ios-lokal.env` (Vorlage
   `ios-lokal.env.beispiel`, **nie einchecken**), dazu die **Team-ID**
   (developer.apple.com → Membership).
7. **Server:** In Railway (Produktion und Staging) `APPLE_TEAM_ID=<Team-ID>`
   setzen. Dann liefert der Server
   `/.well-known/apple-app-site-association` aus; vorher gibt es sie
   absichtlich nicht.

### 3.2 Bauen und hochladen — der Weg ohne Kabel

```bash
cd ~/Broweg/brauweg
werkzeug/app/ios-testflight.sh --trocken   # bauen + exportieren, kein Upload
werkzeug/app/ios-testflight.sh             # dasselbe mit Upload
```

Das Skript macht `npm ci`, baut den Client, erzeugt das Xcode-Projekt aus
`apps/ios/project.yml` (`xcodegen generate` — fehlt XcodeGen, sagt es
`brew install xcodegen`), dann `xcodebuild archive` (die Build-Phase „Client
ins Paket" legt den eben gebauten Client nach `web/`) und `-exportArchive` (Methode
`app-store-connect`, Ziel `upload`, automatische Signierung) mit dem
API-Schlüssel. Alles Gebaute bleibt unter `werkzeug/app/ios-bau/`. Die
Buildnummer ist Commit-Zahl plus Zeitstempel. So kann die Aufsicht den Bau
als Worker-Aufgabe auf Toms MacBook auslösen, ohne dass jemand davorsitzt.

Von Hand geht es wie in `APPSTORE.md` (Product → Archive → Distribute).
Anderer Server oder Push an: `API_BASE=…` bzw. `PUSH=YES` in `ios-lokal.env`.

### 3.3 TestFlight — intern

1. **Tom testet zuerst selbst:** TestFlight-App aus dem App Store, der Build
   erscheint 10–30 Minuten nach dem Upload.
2. **Interne Tester (bis 100):** Tom lädt Robin und die anderen unter
   *Users and Access* mit ihrer **Apple-ID-Mail** ein (Rolle z. B.
   „Developer" oder „Marketing"), dann in *TestFlight → Interne Tests* der
   Gruppe zuordnen. **Keine Apple-Prüfung, keine Rechtstexte nötig.**
3. In „What to Test": Bots füllen freie Plätze; Gast-Anmeldung geht ohne Mail.
4. Builds verfallen nach 90 Tagen.

### 3.4 Einreichung im Store

**Prüfhinweise (App Review Information):**

- Demo-Konto: eine eigene Adresse, bestätigt, Passwort. Dazu: „Oder ‚Als Gast
  spielen' auf dem Anmeldeschirm."
- „Die App braucht eine Internetverbindung. Freie Plätze am Tisch lassen sich
  mit Bots füllen — Doppelkopf: Tisch anlegen, ‚Mit Bots auffüllen'. Die
  Partykiste braucht 4 Plätze; Bots zählen mit."
- „Es gibt keine Käufe. Münzen und Edelsteine sind Spielwährung ohne
  Echtgeld-Wert; Poker (noch nicht freigegeben) wird mit Spielgeld gespielt."
- „Konto löschen: Profil-Tab ganz unten. Melden/Blockieren: Tipp auf einen
  Spielernamen am Tisch → Profil."

**Altersfreigabe — vorgeschlagene Antworten.** Apple hat die Stufen
2025/26 umgestellt (4+, 9+, 13+, 16+, 18+ statt 17+); **die Stufe rechnet Apple
selbst aus den Antworten**, und die genaue Zuordnung ist hier nicht
nachgeprüft. Ehrlich beantwortet:

| Frage | Antwort | Warum |
| --- | --- | --- |
| Alkohol, Tabak, Drogen (Bezüge) | **häufig/intensiv** | Trinkmodus der Partykiste, Kiffer-Sprüche |
| Simuliertes Glücksspiel | **selten/mild** (heute), **häufig**, sobald Poker freigegeben ist | Poker mit Spielgeld, Truhen mit Münzspannen |
| Grober Humor / derbe Inhalte | **häufig/intensiv** | Partykiste Stufe „derb" |
| Sexuelle Anspielungen | **selten/mild** | einzelne „pikant"-Einträge — vor dem Ausfüllen stichprobenartig lesen |
| Nutzerinhalte / Kontakt zu Fremden | **ja** | Spielernamen, Clan-Namen, öffentliche Tische (Chat in der App aus) |
| Echtgeld-Glücksspiel, Wettbewerbe um Geld | **nein** | |
| Lootboxen gegen Geld | **nein** | Truhen gibt es nur gegen Spielwährung, Käufe fehlen |

**Erwartung: 18+** (früher 17+), mindestens 16+. Mit
`APP_PARTYKISTE_TRINKMODUS=aus` und `HAERTE_MAX=1` wären die ersten beiden
Zeilen deutlich milder — dann müsste die Freigabe neu beantwortet werden.

**App-Datenschutz („Nutrition Labels") — was die App wirklich erhebt:**

| Datenart | Erhoben? | Mit Person verknüpft | Zweck | Tracking |
| --- | --- | --- | --- | --- |
| E-Mail-Adresse | ja (nicht bei Gästen) | ja | App-Funktion (Anmeldung, Mails) | nein |
| Name (Anzeigename) | ja | ja | App-Funktion | nein |
| Geburtsdatum (unter „Sonstige Kontaktdaten"/„Sonstiges") | ja | ja | App-Funktion (Altersgrenze, Geburtstagsgeschenk) | nein |
| Nutzerinhalte: Fotos | nur über die Webseite (Upload in der App aus) | ja | App-Funktion (Profilbild) | nein |
| Nutzerinhalte: Sonstiges | ja (Clan-Name, Meldetexte) | ja | App-Funktion | nein |
| Gameplay-Inhalte / Produktinteraktion | ja (Partien, Statistik, Trophäen) | ja | App-Funktion | nein |
| Kennungen (Nutzer-ID) | ja | ja | App-Funktion | nein |
| Diagnose | **nein** in der App (Feldherr-Mitschnitte gibt es nur für Feldherr, dort „bald"; das Feedback-Widget nur auf Staging) | | | |

Kein Werbe-SDK, keine Analyse von Dritten, **kein Tracking**. Die
Datenschutz-Adresse `https://www.brauweg-spielen.de/rechtliches/datenschutz.html`
muss vor der Einreichung ausgefüllt sein (rote Lücken, siehe `APPSTORE.md`).

---

## 4. Android — Schritt für Schritt

### 4.1 Eine Test-APK zum Herunterladen (sofort, ohne Play)

GitHub → Actions → **„Android-APK" → Run workflow**. Nach ~10 Minuten liegt
unter dem Lauf das Artefakt `brauweg-test-<N>` mit `app-debug.apk`. Die APK
heißt „Brauweg Test", spricht mit **Staging** und lässt sich neben der
Store-Fassung installieren (am Handy „Installation aus unbekannten Quellen"
erlauben). Bewusst nur von Hand, wegen des Actions-Kontingents.

Lokal geht es ebenso, sobald ein JDK 21 und das Android-SDK da sind:

```bash
node apps/android/werkzeug/web-uebernehmen.mjs
cd apps/android && ./gradlew assembleDebug        # app/build/outputs/apk/debug/
```

Auf den Windows-Rechnern der Werkstatt gibt es beides nicht (23.09.2026); dort
wurde **nichts** installiert.

Derselbe Lauf baut seit dem 23.09.2026 auch das **App-Bundle für Play**
(signiert, sobald der Upload-Schlüssel als Secret hinterlegt ist — 4.6).
Ohne die Secrets steht oben im Lauf die Warnung **„Release-Signatur fehlt"**;
das ist dann kein Fehler, sondern der Hinweis, dass nur die Test-APK
brauchbar ist.

### 4.2 Play Console

1. **Konto:** play.google.com/console, privates Konto, **25 $ einmalig**,
   Identitätsprüfung mit Ausweis (dauert Tage). Wer das Konto hält,
   entscheiden Robin/Tom.
2. **App anlegen:** Name „Brauweg", Standardsprache Deutsch, **Spiel**,
   kostenlos. Erklärungen: keine Werbung, Zielgruppe **18+** (dann greifen die
   Familien-Regeln nicht).
3. **Signierschlüssel (Upload-Schlüssel) erzeugen — einmal, sicher aufbewahren:**
   ```bash
   keytool -genkeypair -v -keystore brauweg-upload.jks -alias brauweg \
     -keyalg RSA -keysize 4096 -validity 10000
   ```
   Datei und Passwörter **nie ins Repo** (`*.jks` steht in `.gitignore`),
   sondern in den Passwortmanager und eine zweite Kopie offline. Play App
   Signing verwaltet den eigentlichen App-Schlüssel; geht der
   Upload-Schlüssel verloren, lässt er sich über den Support zurücksetzen —
   der App-Schlüssel nicht.
   Genaueres (woher `keytool`, welches Passwort wohin, zwei Kopien, ab in
   die Secrets) steht in **4.6** — das ist der übliche Weg. Die Punkte 4 und
   5 hier sind nur für einen Rechner mit JDK und SDK.
4. `apps/android/keystore.properties` (lokal, ignoriert):
   ```properties
   storeFile=/pfad/zu/brauweg-upload.jks
   storePassword=…
   keyAlias=brauweg
   keyPassword=…
   ```
5. **AAB bauen** (auf dem Rechner mit dem Schlüssel):
   ```bash
   node apps/android/werkzeug/web-uebernehmen.mjs
   cd apps/android && ./gradlew bundleRelease -PversionCode=<höher als zuletzt>
   # → app/build/outputs/bundle/release/app-release.aab
   ```
   Achtung: Die CI zählt `versionCode` mit ihrer Laufnummer (4.8). Wer
   lokal baut und hochlädt, springt ihr voraus — dann lehnt Play den
   nächsten CI-Upload ab, bis die Laufnummer aufgeholt hat. Hochgeladen wird
   darum **nur aus der CI**.
6. **Fingerabdruck für App Links:** Play Console → *Test und Release →
   App-Integrität → App-Signatur* → SHA-256 des **App-Signaturschlüssels**
   kopieren und in Railway `ANDROID_SHA256=<Wert>` setzen (mehrere mit Komma,
   z. B. zusätzlich der Upload-Schlüssel). Dann liefert der Server
   `/.well-known/assetlinks.json` aus. **Nicht** der Fingerabdruck, den der
   CI-Lauf in seiner Zusammenfassung zeigt — das ist der Upload-Schlüssel,
   und die App auf den Handys der Tester trägt Googles Signatur (4.7).

### 4.3 Geschlossener Test: 12 Tester, 14 Tage

1. *Test → Geschlossene Tests → Track anlegen*, AAB hochladen.
2. Tester per **Google-Group** oder Mail-Liste hinzufügen — **mindestens 12**,
   die sich **über den Opt-in-Link anmelden** und die App **14 Tage am Stück**
   installiert lassen. Erst danach darf ein neues privates Konto die
   Produktion beantragen.
3. Parallel geht der **interne Test** (bis 100, ohne Prüfung) — der schnellste
   Weg für uns selbst.

**Der ganze Weg in der Reihenfolge, in der er gegangen wird** (Stand der
Play-Regeln: September 2026 — vor dem Anlegen in der Console gegenlesen,
Google ändert die Zahlen):

1. **Konto** (4.2 Punkt 1). Zur Identitätsprüfung gehört bei neuen privaten
   Konten auch der Nachweis eines echten Android-Geräts über die
   Play-Console-App und eine bestätigte Telefonnummer. Die Prüfung dauert
   Tage — deshalb zuerst.
2. **App anlegen** (4.2 Punkt 2). Play App Signing ist für neue Apps
   eingeschaltet und bleibt es (4.7).
3. **Upload-Schlüssel erzeugen und als Secrets hinterlegen** (4.6).
4. **Erstes AAB bauen:** GitHub → Actions → „Android-APK" → *Run workflow*
   auf dem Zweig, der in den Store soll (in der Regel `main`). Unter dem
   Lauf liegt dann `brauweg-play-<Version>-<Lauf>` mit `app-release.aab`.
5. **Pflichtangaben der Console** (*Dashboard → App einrichten*):
   Datenschutzerklärung, App-Zugriff (Demo-Konto wie bei Apple, 3.4),
   Anzeigen („nein"), Inhaltsbewertung (IARC), Zielgruppe (18+),
   Data Safety, Store-Eintrag. Die Texte und Antworten stehen in
   **`docs/store/`** (eigener Auftrag „Store-Unterlagen"); die Kurzfassung
   hier in 4.4 und 4.5. Ohne diese Punkte lässt sich kein geschlossener Test
   an die Tester ausrollen.
6. **Geschlossenen Test anlegen:** *Testen und veröffentlichen → Testen →
   Geschlossener Test → Track erstellen* (oder den vorhandenen „Alpha"),
   Länder wählen (mindestens Deutschland), **Tester**: am einfachsten eine
   **Google-Gruppe** (`groups.google.com`, z. B. `brauweg-tester@googlegroups.com`
   — neue Tester kommen dann ohne Console dazu) oder eine Mail-Liste mit
   den Google-Konto-Adressen. Release anlegen, das AAB aus Schritt 4
   hochladen, Versionshinweis schreiben, zur Prüfung senden. Die erste
   Prüfung dauert Stunden bis einige Tage.
7. **12 Tester einladen:** den **Opt-in-Link** des Tracks
   (*Tester → Link kopieren*) an alle schicken. Jeder muss mit seinem
   Google-Konto auf „Tester werden" tippen und die App **aus Play**
   installieren (die Debug-APK aus 4.1 zählt nicht). Lieber 15 als 12: Wer
   in den 14 Tagen austritt, fällt aus der Zählung.
8. **14 Tage** am Stück mindestens 12 angemeldete Tester. Updates in der
   Zeit sind erwünscht (Google fragt danach, ob getestet und nachgebessert
   wurde) — jeder neue CI-Lauf ist ein höherer `versionCode`.
9. **Produktionszugang beantragen:** *Dashboard → Zugriff auf die Produktion
   beantragen*. Google fragt nach dem Test (wie Tester gefunden wurden,
   welches Feedback, was geändert wurde) — ehrliche Stichpunkte reichen.
   Die Antwort kommt nach etwa einer Woche. Erst dann gibt es den Track
   *Produktion*.

### 4.4 Data-Safety-Formular

Die ausführliche Fassung zum Abtippen liegt in `docs/store/` (Auftrag
„Store-Unterlagen"); gilt dort etwas anderes als hier, gilt `docs/store/`.

Gleiche Wahrheit wie bei Apple (Abschnitt 3.4): erhoben werden E-Mail,
Anzeigename, Geburtsdatum, Nutzer-ID, Spielverlauf, Nutzerinhalte
(Clan-Name, Meldungen); **nichts wird geteilt**, nichts dient Werbung;
Übertragung verschlüsselt (HTTPS); **Löschung auf Anfrage in der App möglich**
(Profil-Tab) — dazu eine Lösch-URL, falls Play sie verlangt:
`https://www.brauweg-spielen.de` (Löschen im Profil; eine eigene Seite dafür
gibt es noch nicht, siehe Offene Punkte). Keine Sicherung des App-Speichers
(`allowBackup=false`).

### 4.5 IARC-Fragebogen (Inhaltsbewertung)

Auch hier: die ausführliche Fassung in `docs/store/`.

Dieselben Antworten wie bei Apple: Alkoholbezüge (Trinkspiel) **ja**,
Drogenbezüge **ja** (Kiffer-Sprüche), derbe Sprache **ja**, simuliertes
Glücksspiel **ja**, Nutzerinteraktion **ja** (Mehrspieler, Namen), Käufe
**nein**, Echtgeld **nein**. Ergebnis voraussichtlich USK 16/18 bzw. PEGI 16/18.

### 4.6 Upload-Schlüssel erzeugen und in die CI legen (Robin, einmal)

Den Schlüssel erzeugt **ein Mensch** auf seinem eigenen Rechner — nicht die
CI, nicht eine Claude-Sitzung. Er darf nie in einem Chat, einem Commit,
einem PR-Text oder einem Log stehen.

**1. `keytool` besorgen.** Es gehört zum JDK. Ohne etwas zu installieren:
das Temurin-JDK 21 als **ZIP** (adoptium.net → „Other platforms" → Windows
x64, *JDK*, `.zip`) entpacken und `bin\keytool.exe` direkt aufrufen. Mit
Android Studio liegt es schon unter
`C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`.

**2. Schlüssel erzeugen** (in einem Ordner außerhalb jedes Repos):

```bash
keytool -genkeypair -v -keystore brauweg-upload.jks -storetype PKCS12 \
  -alias brauweg -keyalg RSA -keysize 4096 -validity 10000
```

`keytool` fragt nach einem Passwort und nach Name/Organisation (frei, z. B.
„Brauweg"). **Bei PKCS12 ist das Schlüssel-Passwort dasselbe wie das des
Schlüsselbunds** — `keytool` fragt kein zweites ab. Passwort ohne
Backslash (`\`) wählen: Die CI schreibt es in eine Properties-Datei, und dort
ist `\` ein Fluchtzeichen.

**3. Sicher aufbewahren — zwei Kopien.** Die `.jks`-Datei und das Passwort
in den Passwortmanager (Datei als Anhang), eine **zweite Kopie offline**
(USB-Stick im Schrank). Wer den Upload-Schlüssel verliert, kann bei Google
einen neuen beantragen (4.7) — aber das dauert Tage, und bis dahin geht kein
Update raus.

**4. Als GitHub-Secrets hinterlegen** (Git Bash, im Ordner mit der Datei;
`gh` fragt die Werte verdeckt ab und schreibt sie nirgends hin):

```bash
base64 -w0 brauweg-upload.jks | gh secret set ANDROID_UPLOAD_KEYSTORE_BASE64 --repo moodsteppi/brauweg
gh secret set ANDROID_UPLOAD_KEYSTORE_PASSWORT --repo moodsteppi/brauweg   # Passwort eintippen
gh secret set ANDROID_UPLOAD_KEY_ALIAS         --repo moodsteppi/brauweg   # brauweg
gh secret set ANDROID_UPLOAD_KEY_PASSWORT      --repo moodsteppi/brauweg   # dasselbe Passwort
```

Oder im Browser: Repo → *Settings → Secrets and variables → Actions → New
repository secret* (für die Base64-Fassung dann
`[Convert]::ToBase64String([IO.File]::ReadAllBytes("brauweg-upload.jks"))`
in PowerShell). **Alle vier oder keins** — mit nur einigen bricht der Lauf
ab, statt halb zu signieren.

**5. Prüfen:** Workflow einmal laufen lassen. Die Warnung „Release-Signatur
fehlt" ist weg, in der Zusammenfassung steht „Signiert mit dem
Upload-Schlüssel — SHA-256 …", und unter dem Lauf liegt
`brauweg-play-<Version>-<Lauf>`.

Was der Workflow mit den Secrets tut: Er legt den Schlüssel für die Dauer
des Laufs unter `$RUNNER_TEMP` ab, schreibt `apps/android/keystore.properties`
(dieselbe Datei wie beim lokalen Bau, 4.2 Punkt 4), baut `bundleRelease` und
löscht beides am Ende wieder — auch wenn der Bau scheitert.

### 4.7 Zwei Schlüssel: Upload-Schlüssel und App-Signaturschlüssel

Play App Signing ist für neue Apps Pflicht, und das ist gut so:

| | Upload-Schlüssel | App-Signaturschlüssel |
| --- | --- | --- |
| Wer hat ihn | wir (4.6) | nur Google |
| Wofür | beweist Google, dass ein Upload von uns kommt | damit signiert Google die APKs, die auf den Handys landen |
| Verloren? | neuer über *App-Integrität → Upload-Schlüssel zurücksetzen* | kann nicht verloren gehen |
| Fingerabdruck steht | in der Zusammenfassung des CI-Laufs und in der Console | nur in der Console |

Beim **ersten Upload** fragt die Console, wie die App signiert werden soll:
**„Von Google generierten Schlüssel verwenden"** (Vorgabe) wählen. Danach
steht unter *Testen und veröffentlichen → Einrichtung → App-Integrität →
App-Signatur* beides.

**Für App Links (`ANDROID_SHA256` in Railway) zählt der
App-Signaturschlüssel.** Android prüft den Einladungslink gegen die Signatur
der installierten App — und die ist Googles. Mit dem Upload-Schlüssel allein
öffnen die Links weiter im Browser, ohne Fehlermeldung. Der Upload-Schlüssel
gehört nur dann zusätzlich hinein (Komma), wenn eine selbst signierte
Release-APK außerhalb von Play verteilt wird — das tun wir nicht. Die
Debug-APK aus 4.1 bekommt nie App Links (anderer Paketname, Debug-Schlüssel);
dort öffnen Einladungen im Browser, und das ist gewollt.

### 4.8 Versionen

- **`versionName`** (steht im Store, „1.0.0"): `apps/android/VERSION`, eine
  Zeile. Vor einem Release von Hand hochsetzen, im selben PR wie die
  Änderung.
- **`versionCode`** (die Zahl, die Play für jeden Upload höher verlangt): die
  **Laufnummer** des Workflows „Android-APK". Sie wächst mit jedem Lauf von
  selbst. *Re-run* behält die Nummer — für einen neuen Upload einen **neuen**
  Lauf starten. Test-APK und AAB desselben Laufs tragen dieselbe Nummer.

### 4.9 Was die Hülle für Play mitbringt (geprüft am 23.09.2026)

- **Ziel-API 36** (Android 16). Play verlangt seit dem 31.08.2026 für neue
  Apps und Updates mindestens 36 (developer.android.com → „Target API level
  requirements"). `compileSdk` ebenso 36, `minSdk` 26 (Android 8).
- **`android:exported`**: nur die `MainActivity` ist exportiert, und muss es
  sein (Startsymbol, App Links). Sonst gibt es keine eigenen Dienste,
  Empfänger oder Provider. Die CI zeigt die Berechtigungen des Release-Baus
  in ihrer Zusammenfassung.
- **Berechtigungen**: `INTERNET`, `VIBRATE` (Haptik am Tisch),
  `ACCESS_NETWORK_STATE` (Meldung ohne Netz, `navigator.onLine`). Alle drei
  sind Normal-Berechtigungen ohne Rückfrage. Mit Push kämen
  `POST_NOTIFICATIONS`, `WAKE_LOCK` und `com.google.android.c2dm.permission.RECEIVE`
  dazu (alle drei aus der Firebase-Bibliothek, gemessen im CI-Lauf 3) — nur mit Schalter (4.10).
  Dazu kommt aus androidx eine app-eigene Signatur-Berechtigung
  (`…DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`); die sieht kein Nutzer.
- **Zurück-Taste**: Der Client blättert nicht über den Verlauf des WebViews
  (seine Schirme sind Zustand in `App.tsx`). Die Hülle feuert deshalb erst
  `brauweg:zurueck` (`packages/client/src/zuruecktaste.ts`); heute blättert
  der Client damit aus einem Profil zurück und aus der Kartenlobby
  (Doppelkopf, Skat, Zauberer, Cambio) in die Spielauswahl. Sonst der
  WebView-Verlauf, und zuletzt geht die App **in den Hintergrund, statt sich
  zu beenden** — am Tisch und in der Partykiste bricht die Taste also nie
  eine Partie ab.
- **Ohne Netz**: ein natives blaues Schild „Keine Verbindung" statt eines
  Anmeldeschirms (der erste Abruf wäre gescheitert, und der Client hielte
  sich für abgemeldet). Startete die App ohne Netz, lädt sie neu, sobald es
  wieder da ist; geht das Netz mitten im Spiel weg, bleibt alles stehen, und
  der Client verbindet sich selbst neu. Kurze Aussetzer (unter 2 s) zeigen
  kein Schild.
- **Keine Käufe, kein Google-Login** in der App — beides serverseitig bzw. im
  Client (Abschnitt 2), kein eigener Code in der Hülle.

### 4.10 Push — vorbereitet, standardmäßig aus

Push braucht ein **Firebase-Projekt**, und das gibt es noch nicht (anlegen
entscheidet Robin; der Server-Teil ist ein eigener Auftrag). Bis dahin baut
die App **ohne** Firebase und ohne `POST_NOTIFICATIONS`.

- **Schalter:** `-Ppush=an` beim Gradle-Bau. Dann kommt
  `firebase-messaging` dazu, und statt `app/src/pushAus` wird
  `app/src/pushAn` übersetzt. Die CI übersetzt die Fassung mit Push bei
  jedem Lauf mit (ohne Werte, ohne sie zu bauen), damit der Schalter nicht
  verrottet.
- **Werte des Projekts** (Firebase Console → Projekteinstellungen → Android-App
  `de.brauweg.app`): `firebaseAppId`, `firebaseApiKey`,
  `firebaseProjektId`, `firebaseSenderId` — als Gradle-Eigenschaften oder in
  `apps/android/firebase.properties` (ignoriert). Eine
  `google-services.json` braucht es nicht; die Hülle meldet Firebase selbst
  an. Für die CI wären das vier weitere Secrets und eine Zeile im Workflow
  — noch nicht verdrahtet.
- **Absprache mit dem Client** (dieselben Namen übernimmt die iOS-Hülle):
  - `window.BRAUWEG_APP.push` — `true`, wenn diese App Push kann.
  - `BrauwegNativ.pushErlauben()` — der Client bittet um Benachrichtigungen,
    wenn der Nutzer es einschaltet. Erst dann fragt Android 13+ nach.
  - Ereignis **`brauweg:push-token`** am `window`, `detail =
    {plattform: 'android', token}` — nach jedem Laden der Seite und bei
    jedem neuen Token. Dasselbe liegt als `window.BRAUWEG_APP.pushToken`
    für den, der erst später hinsieht.
- **Data Safety** ändert sich mit Push: Das Token ist eine Geräte-Kennung
  („Geräte- oder andere IDs", App-Funktion, nicht geteilt). Vor dem ersten
  Build mit Push das Formular nachziehen.

---

## 5. Wer was tun muss

### Fertig (in diesem Repo)

- Spiel-Freigabe je Plattform, serverseitig, mit Robins Werten.
- Rückweg Partykiste ohne Trinkmodus (Umgebungsvariablen, aus).
- Keine Käufe, keine Anbieter-Logins in der App.
- Profilbilder, Tafelrunde-Link, Rechtstexte funktionieren in der App.
- Melden/Blockieren; Clan-Chat und Bild-Upload in der App aus.
- Konto löschen auch ohne Passwort.
- Android-Hülle `apps/android` mit App Links, Teilen, Wach-Halten, Symbolen
  (Platzhalter); Test-APK per Actions.
- Android releasefertig für den geschlossenen Test: signiertes AAB aus der
  CI (sobald die Secrets stehen), `versionCode` automatisch, Ziel-API 36,
  Zurück-Taste, Meldung ohne Netz, Push vorbereitet und aus (4.6–4.10).
- Server liefert `apple-app-site-association` und `assetlinks.json`, sobald
  die Variablen gesetzt sind.
- iOS-Bauskript für den Mac ohne Kabel.
- iOS-Hülle `apps/ios` (XcodeGen, Swift, keine Fremdbibliotheken) mit
  Universal Links, Teilen, Haptik, Wach-Halten, Zurück-Wischen, Safari-Blatt
  für Rechtstexte, Meldung ohne Netz, Privacy Manifest, Push vorbereitet und
  aus (Abschnitt 7). **Geschrieben, aber noch nie übersetzt** — auf den
  Windows-Rechnern gibt es kein Xcode.

### Tom

- Xcode, XcodeGen, `Lokal.xcconfig`, App-Eintrag, API-Schlüssel,
  `ios-lokal.env` (3.1).
- Erster Build nach 7.4: Tests, Simulator, iPhone — und die Liste in 7.5
  abhaken.
- Erster TestFlight-Build, interne Tester einladen (3.3).

### Robin

- Rechtstexte ausfüllen (Name, Anschrift, Support-Adresse — `APPSTORE.md`).
- Demo-Konto für die Prüfer anlegen.
- Play-Konto (25 $), Upload-Schlüssel erzeugen und verwahren, 12 Tester
  zusammentrommeln.
- Die vier Secrets `ANDROID_UPLOAD_*` setzen (4.6), dann den ersten
  signierten Lauf starten und das AAB hochladen (4.3).
- Nach dem ersten Upload: SHA-256 des **App-Signaturschlüssels** aus der
  Console nach `ANDROID_SHA256` (4.7).
- Entscheiden, ob und wann es ein Firebase-Projekt für Push gibt (4.10).
- Railway: `APPLE_TEAM_ID`, `ANDROID_SHA256` setzen.
- Entscheiden, wann das nächste Spiel mit einer Zeile in die App wechselt.

---

## 6. Offene Punkte

- **iOS-Hülle noch nie übersetzt.** `apps/ios` ist auf Windows geschrieben
  (23.09.2026); geprüft ist dort nur, was in Textdateien steht
  (`packages/server/test/app-ios.test.ts`). Swift-Compiler, XCTests und das
  Gerät sehen sie erst auf Toms Mac — Reihenfolge und Stolpersteine in 7.4/7.5.
  Das in früheren Fassungen genannte Repo `Brauweg-spiel-ios` hat es nie
  gegeben (Robin, 23.09.2026).
- **Push („du bist dran")** nicht gebaut: braucht APNs-Schlüssel aus Toms
  Konto bzw. ein Firebase-Projekt, und am Server eine Tabelle für
  Geräte-Token. Kommt nach dem ersten Release. *Stand 23.09.2026:* Die
  Android-Seite ist vorbereitet und aus (4.10); der Client horcht noch nicht
  auf `brauweg:push-token`.
- **Zurück-Taste in den Spielen mit eigenem Menü** (Partykiste, Golf, …):
  Dort blättert sie nicht, die App geht in den Hintergrund. Soll sie im
  Schirm zurückblättern, hängt sich der Schirm selbst mit
  `useZuruecktaste` an (`packages/client/src/zuruecktaste.ts`).
- **Android nur in der CI gebaut**; auf einem echten Gerät noch nicht
  gestartet. Der erste Test sollte prüfen: Anmeldung, WebSocket am Tisch,
  Einladungslink aus WhatsApp, Teilen, Bildschirm bleibt an.
- **Kiffer-Einträge gezielt ausblenden** (ohne die ganze Stufe „pikant"):
  braucht eine Marke an den 16 Inhalten und eine Filterzeile im Modul.
- **Profilbilder anderer** (auf der Webseite hochgeladen) erscheinen weiter
  in der App; melden lässt sich das über „Unangemessener Name oder Inhalt".
- **Meldungen abarbeiten:** Es gibt die Liste und die Mail, aber keinen
  Menschen mit Zusage, binnen 24 Stunden zu reagieren — Apple fragt danach.
- **App-Symbol und Startbild** sind Platzhalter aus dem Web-Symbol (mit
  eingezeichneter Rundung). Eine Bestellung nach `CLAUDE.md` Regel 5 steht aus.
- **Lösch-Seite fürs Web** (Play verlangt eine URL, unter der man die
  Löschung auch ohne App anstoßen kann).

---

## 7. iOS-Hülle: so ist sie gebaut

Stand 23.09.2026, `apps/ios`. Robins Entscheidung vom selben Tag: eine
eigene Swift-Hülle **in diesem Repo**, keine Fremdbibliotheken, nur
Apple-Standard-APIs. Vorbild ist die Android-Hülle — dieselben Regeln,
dieselben Namen an der Naht zum Client.

### 7.1 Aufbau

| Datei (unter `apps/ios`) | Aufgabe |
| --- | --- |
| `project.yml` | XcodeGen-Spezifikation: App `Brauweg` und `BrauwegTests`, Bundle-ID `de.brauweg.app`, iOS 16, nur iPhone, Build-Phase „Client ins Paket". Das `.xcodeproj` entsteht mit `xcodegen generate` und steht in `.gitignore`. |
| `Brauweg/Huelle.swift` | Schema, Serveradresse, Einladungslinks, was dem Client eingespritzt wird (wie `Huelle.kt`) |
| `Brauweg/PaketSchema.swift` | `WKURLSchemeHandler`: liefert `web/` aus dem App-Paket unter `brauweg://app` aus (wie `PaketLader.kt`) |
| `Brauweg/HauptController.swift` | Der WKWebView: Navigation, `alert`/`confirm`/`prompt`, Safari-Blatt, Teilen, Zurück-Wischen, Meldung ohne Netz |
| `Brauweg/Wegweiser.swift` | Welche Adresse wohin darf — nie eine fremde Seite im WebView |
| `Brauweg/Bruecke.swift`, `Haptik.swift` | Die Brücke `window.BrauwegNativ` |
| `Brauweg/Mitteilungen.swift` | Push — vorbereitet, aus |
| `Brauweg/Fehlerschirm.swift` | „Keine Verbindung" und die Probe gegen `/api/health` |
| `Brauweg/AppDelegat.swift`, `SzenenDelegat.swift` | Einstieg, Fenster, Universal Links |
| `Konfiguration/` | `Info.plist`, Berechtigungen `Push-NO`/`Push-YES.entitlements`, `Lokal.xcconfig` (Team-ID, ignoriert) |
| `Ressourcen/` | App-Symbol (**Platzhalter** aus `icon-1024.png`, mit eingezeichneter Rundung), Startfarbe, `PrivacyInfo.xcprivacy` |
| `werkzeug/web-einbauen.sh` | Build-Phase: `packages/client/dist` → `Brauweg.app/web` (ohne Safari-Startbilder), dazu `stand.json` |
| `werkzeug/pruefen.sh` | XCTests im ersten verfügbaren iPhone-Simulator |
| `BrauwegTests/` | XCTests der reinen Teile: Pfadauflösung, Universal Links, Wegweiser, Haptik, Teilen |

**iOS 16 als Mindestversion:** Vite 7 baut den Client für Safari 16
(Vorgabeziel „baseline-widely-available"); älteres WebKit versteht Teile des
ausgelieferten JavaScripts nicht. iOS 16 läuft ab dem iPhone 8. Alles, was die
Hülle selbst braucht, gibt es länger.

Auf Windows prüft `packages/server/test/app-ios.test.ts` die Pflichtwerte
(Bundle-ID, nur iPhone, hochkant, Associated Domains, Privacy Manifest, keine
Berechtigungstexte, Symbol ohne Alphakanal) und die Namen an der Naht zu
Server und Client. Übersetzt wird erst auf dem Mac.

### 7.2 Herkunft, Anmeldung, WebSocket

- **`brauweg://app` über einen `WKURLSchemeHandler`.** WebKit gibt einem
  Schema mit eigenem Handler eine echte Herkunft (unter Android wäre sie
  `null`). Darunter liegen `localStorage` und `sessionStorage` im
  Standard-Datenspeicher und überleben Neustarts — dort liegt das
  Sitzungstoken (`laufzeit.ts`).
- **`fetch`** an den Server trägt `Origin: brauweg://app`; der Server gibt
  genau dieser Herkunft CORS und beim Anmelden das Token (`APP_ORIGINS`,
  `credentials: false`). **Cookies spielen keine Rolle:** Für WebKit wäre das
  Sitzungs-Cookie ein Drittanbieter-Cookie, der Client schickt
  `credentials: 'omit'` und `Authorization: Bearer …`.
- **WebSocket** `wss://…/ws`: dieselbe Herkunft (der Gateway lässt
  `APP_ORIGINS` zu), das Token als Unterprotokoll hinter `brauweg-token`.
- **SPA-Rückfall:** Jeder Pfad ohne Dateiendung ist die `index.html`
  (`/beitritt/K7X9MQ`), eine fehlende Datei ehrlich 404.
- **ATS:** nur HTTPS; Klartext allein zu lokalen Adressen
  (`NSAllowsLocalNetworking`, für einen Entwicklungsserver im Simulator).
- **Welcher Server:** Debug Staging, Release Produktion
  (`BRAUWEG_API_BASE` in `project.yml`); umstellen in `Lokal.xcconfig` bzw.
  `API_BASE` in `ios-lokal.env`.

Dass WebKit genau `Origin: brauweg://app` schickt, ist das bekannte Verhalten
eigener Schemata (Capacitor fährt mit `capacitor://localhost` denselben Weg),
**hier aber noch nicht beobachtet** — das ist der erste Blick in 7.4.

### 7.3 Die Brücke — dieselben Namen wie Android

| Client | iOS | Android |
| --- | --- | --- |
| `window.BRAUWEG_APP` | `{apiBase, plattform: 'ios', push, pushToken?}` | `{…, plattform: 'android', …}` |
| `navigator.share` | `UIActivityViewController` (Text und Link getrennt) | Teilen-Auswahl |
| `navigator.vibrate` | Taptic Engine: je Einschaltphase ein Anschlag (`Haptik.swift`) | Vibration |
| `navigator.wakeLock` | `isIdleTimerDisabled`, bis die letzte Sperre frei ist | `FLAG_KEEP_SCREEN_ON` |
| `BrauwegNativ.pushErlauben()` | fragt nach der Erlaubnis, registriert bei APNs | Firebase |
| Ereignis `brauweg:push-token` | `{plattform: 'ios', token}` (hex) | `{plattform: 'android', token}` |
| Ereignis `brauweg:zurueck` | Wischen vom linken Rand | Zurück-Taste |

- Unter iOS werden `share`, `vibrate` und `wakeLock` **immer** ersetzt, nicht
  nur, wo sie fehlen: `vibrate` kennt WebKit nicht, und ob `share` und
  `wakeLock` unter einem eigenen Schema tragen, hängt an der iOS-Version.
- **Bildschirm an:** nur, solange der Client eine Sperre hält — heute
  fordert allein die Partykiste eine an (`useTischwache`). Andere Tische
  lassen den Schirm ausgehen; das wäre eine Zeile im jeweiligen Schirm,
  nicht in der Hülle. Nach jedem Neuladen wird zurückgesetzt.
- **Zurück-Wischen:** iPhone-Nutzer gehen in jeder App mit dem Wischen vom
  linken Rand eine Ebene zurück — das ist das Gegenstück zur Taste. Blättert
  der Client nicht (am Tisch, Partykiste), passiert **nichts**: Eine iOS-App
  schickt sich nie selbst in den Hintergrund. Die Geste nimmt dem Spiel
  keine Berührung weg (`cancelsTouchesInView = false`); den Verlauf des
  WebViews gibt es bewusst nicht, die Schirme sind Zustand in `App.tsx`.
- **Links:** Einladungen `/beitritt/<CODE>` des eingestellten Servers laden
  in der App (Universal Links für `www` und `staging`); eine Staging-Einladung
  in der Produktions-App öffnet das Safari-Blatt. Impressum und Datenschutz
  (`/rechtliches/…`) kommen im Safari-Blatt vom Server — mit „Fertig", und
  der Schirm darunter bleibt stehen. Alles Fremde ins Safari-Blatt,
  `mailto:`/`tel:` ans System.
- **Ohne Netz:** Probe gegen `/api/health` (10 s). Scheitert sie, liegt ein
  natives blaues Schild „Keine Verbindung" mit „Erneut versuchen" über dem
  Client; kommt das Netz zurück oder die App nach vorn, wird von selbst neu
  geprüft und der Client frisch geladen. Geht das Netz mitten im Spiel weg,
  verbindet sich der Client selbst neu.
- **Push:** Build-Einstellung `BRAUWEG_PUSH`, Vorgabe `NO`. Mit `YES` gilt
  `Push-YES.entitlements` (`aps-environment`), `BRAUWEG_APP.push` wird
  `true`, und die Erlaubnis wird erst auf `pushErlauben()` hin erfragt.
  Braucht einen APNs-Schlüssel aus Toms Konto und die Server-Seite (eigener
  Auftrag); dann im Privacy Manifest und in App Store Connect die
  Geräte-Kennung nachtragen.

### 7.4 Der erste Build auf dem Mac

Einmal von Hand, damit jeder Stolperstein gesehen wird, bevor ein Worker
das Skript fährt.

1. **Stand holen und den Client bauen:**
   ```bash
   cd ~/Broweg/brauweg && git pull
   npm ci && npm run build --workspace @brauweg/client
   ```
2. **Werkzeug:** `brew install xcodegen` (einmal).
3. **Team-ID:** `cp apps/ios/Konfiguration/Lokal.xcconfig.beispiel
   apps/ios/Konfiguration/Lokal.xcconfig`, `DEVELOPMENT_TEAM = …` eintragen.
   In Xcode unter *Settings → Accounts* muss Toms Apple-ID angemeldet sein.
4. **Tests:** `apps/ios/werkzeug/pruefen.sh` — XCTests im Simulator, ohne
   Signierung. Rot heißt: zuerst hier reparieren.
5. **Simulator:** `cd apps/ios && xcodegen generate && open Brauweg.xcodeproj`,
   Scheme **Brauweg**, ein iPhone-Simulator, *Run* (Debug → Staging).
   Dann mit Safari → *Entwickler* → Simulator → Brauweg den Web-Inspektor
   öffnen und prüfen:
   - Netzwerk: Anfragen an `staging.brauweg-spielen.de` tragen
     `Origin: brauweg://app`, `/ws` steht auf 101. Konsole ohne Fehler.
   - Als Gast anmelden, Doppelkopf-Tisch mit Bots, ein paar Karten spielen.
   - App beenden, neu starten: noch angemeldet (localStorage).
   - Impressum im Safari-Blatt; im Profil vom linken Rand wischen → zurück.
   - Netz am Mac aus, App neu starten → „Keine Verbindung"; Netz an →
     verschwindet von selbst.
6. **iPhone per Kabel:** Gerät wählen, *Run* (am iPhone einmal den
   Entwicklermodus einschalten). Zusätzlich: Partykiste-Einladung teilen
   (WhatsApp zeigt den Link mit Vorschau), Haptik, wenn man dran ist,
   Bildschirm bleibt an.
7. **Universal Link:** erst, wenn in Railway (Staging) `APPLE_TEAM_ID`
   gesetzt ist und `https://staging.brauweg-spielen.de/.well-known/apple-app-site-association`
   antwortet. App neu installieren (iOS holt die Datei beim Installieren,
   über Apples CDN — das kann dauern), dann einen Link
   `https://staging.brauweg-spielen.de/beitritt/<CODE>` in Notizen antippen.
8. **TestFlight:** `werkzeug/app/ios-testflight.sh --trocken`, dann ohne
   `--trocken` (3.2).

### 7.5 Was als Erstes schiefgehen könnte

Die Hülle ist geschrieben, nie übersetzt. Am wahrscheinlichsten, in dieser
Reihenfolge:

- **Übersetzungsfehler.** Kleinigkeiten in Swift, die ohne Compiler
  durchrutschen, dazu Warnungen zur Nebenläufigkeit mit Xcode 26
  (`SWIFT_VERSION` steht bewusst auf 5; kein `async`, keine Actors). Beheben,
  nicht auf Swift 6 umstellen.
- **Signierung:** „requires a development team" → `Lokal.xcconfig` fehlt.
  „Provisioning profile doesn't include the Associated Domains capability" →
  einmal aus Xcode mit angemeldeter Apple-ID bauen, dann legt die automatische
  Signierung die Fähigkeit an der App-ID an; mit dem API-Schlüssel nur bei
  passender Rolle (3.1 Punkt 6).
- **Weißer Schirm statt Client:** im Web-Inspektor nachsehen. „Im App-Paket
  liegt kein Client" → Schritt 1 fehlt (ein Release-Bau bricht dann
  absichtlich ab). Ein Modul-Skript mit falschem Typ oder ein CORS-Fehler auf
  eigene Dateien → `PaketSchema.swift`.
- **Anmeldung scheitert, 401 oder CORS am Server:** die Herkunft ist nicht
  `brauweg://app` — dann stimmt 7.2 nicht, und Server (`APP_ORIGINS`) und
  Hülle müssen neu verabredet werden.
- **Build-Phase „Client ins Paket" meldet „Operation not permitted":** Die
  Skript-Sandbox ist trotz `ENABLE_USER_SCRIPT_SANDBOXING = NO` an —
  XcodeGen-Fassung prüfen (`xcodegen --version`, mindestens 2.38).
- **Universal Link öffnet Safari statt der App:** Datei auf dem Server fehlt
  (404, solange `APPLE_TEAM_ID` nicht gesetzt ist), oder die App wurde vor
  dem Setzen installiert.
- **Upload abgelehnt wegen des Symbols:** Das Platzhalter-Symbol ist RGB ohne
  Alphakanal (geprüft), wirkt wegen der eingezeichneten Rundung aber doppelt
  gerundet. Für den Store ein bestelltes Symbol.
