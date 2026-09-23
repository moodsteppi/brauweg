# Brauweg in den App Store

Der Client ist eine Web-App. Für den Store braucht sie einen nativen Rahmen.
Diese Datei hält fest, wie der aussieht, was fertig ist und was fehlt.

**Die Schritt-für-Schritt-Anleitung für den ersten Release (iOS und Android,
ohne Käufe) steht seit dem 23.09.2026 in `docs/APP-RELEASE.md`** — dort auch
die Spiel-Freigabe je Plattform, die Android-Hülle (`apps/android`) und das
Bauskript für Toms Mac.

## Heute schon möglich: Homescreen

Ohne Mac, ohne Apple-Konto, auf jedem iPhone:

1. **Safari** öffnen (nicht Chrome — nur Safari kann das)
2. `https://www.brauweg-spielen.de` aufrufen
3. Teilen-Symbol → **„Zum Home-Bildschirm"**
4. Name bestätigen

Danach: eigenes Icon, Vollbild ohne Browserleiste, eigenes Startbild.
Das ist kein Store-Eintrag, reicht aber zum Testen zu dritt.

Wichtig zu wissen:
- Die Anmeldung bleibt erhalten (Sitzungs-Cookie, 30 Tage).
- Ohne Netz startet die App nicht — es gibt bewusst keinen Offline-Speicher,
  weil ein veralteter zwischengespeicherter Stand nach einem Deploy schlimmer
  wäre als eine ehrliche Fehlermeldung.
- Push-Nachrichten gibt es nicht (brauchen wir noch nicht).

---

## Die App: eigene Hülle, kein Capacitor

**Entschieden am 04.08.2026, gebaut am 23.09.2026.** Die Hülle liegt in
**`apps/ios` dieses Repos** (Swift, UIKit, keine Fremdbibliotheken; das
Xcode-Projekt entsteht per XcodeGen aus `apps/ios/project.yml`). Sie ist
eine schlanke Hülle um einen `WKWebView`: Sie liefert den gebauten Client aus
dem App-Paket aus und sagt ihm, wo der Server steht — mehr nicht. Es gibt
**keine zweite Oberfläche in Swift**, sonst gäbe es zwei Wahrheiten und jede
Änderung am Spiel müsste zweimal gebaut werden.

**Berichtigung (Robin, 23.09.2026):** Frühere Fassungen dieser Datei
beschrieben ein eigenes Repository `Brauweg-spiel-ios` mit fertiger Hülle,
die „im Simulator läuft". **Dieses Repository hat es nie gegeben**; alles,
was hier bis dahin über seinen Aufbau stand, war Plan, nicht Stand. Wie die
Hülle wirklich gebaut ist und wie der erste Build auf dem Mac geht, steht in
`docs/APP-RELEASE.md`, Abschnitt 7.

Der Plan sah Capacitor vor. Dagegen sprach nichts Grundsätzliches, aber
dreierlei Praktisches: Capacitor legt sein eigenes Xcode-Projekt an (das
vorhandene wäre überflüssig geworden), es braucht CocoaPods, und alles, was
die App wirklich vom Web unterscheidet — Push über APNs und der In-App-Kauf —
ist nativ einfacher als durch ein Plugin hindurch.

### Aufbau

Die wichtigsten Dateien unter `apps/ios` (vollständig in `APP-RELEASE.md` 7.1):

| Datei | Aufgabe |
| --- | --- |
| `Brauweg/Huelle.swift` | Schema, Serveradresse, Einladungslinks, was dem Client eingespritzt wird |
| `Brauweg/PaketSchema.swift` | Liefert `web/` aus dem App-Paket unter `brauweg://app` |
| `Brauweg/HauptController.swift` | Der WebView, Navigation, Dialoge, Safari-Blatt für Impressum und Datenschutz |
| `werkzeug/web-einbauen.sh` | Build-Phase: legt den gebauten Client nach `web/` ins App-Paket |

**Eigenes Schema, nicht `file://`.** Unter `file://` ist jede Datei eine
eigene Herkunft; `localStorage`, `fetch` und der WebSocket fänden nicht statt.
Der Client läuft deshalb unter `brauweg://app`.

### Anmeldung: Token statt Cookie

Daraus folgt der einzige echte Eingriff in den Server. Für ihn ist die App
eine **fremde Herkunft**: Das Sitzungs-Cookie wäre ein Drittanbieter-Cookie,
und die verwirft WebKit. Die frühere Fassung dieser Datei schlug
`sameSite: none` vor — **das trägt nicht.** Für `fetch` ließe es sich noch
umgehen, für den **WebSocket nicht**, und genau dort hängt der Spieltisch.

Die App bekommt ihr Sitzungstoken deshalb einmal beim Anmelden und schickt es
danach selbst mit:

- **HTTP:** `Authorization: Bearer …`
- **WebSocket:** als Unterprotokoll hinter der Marke `brauweg-token`.
  Bewusst nicht in der Adresse — Adressen landen in Zugriffsprotokollen,
  Kopfzeilen nicht.

**Herausgegeben wird das Token nur an die Herkunft `brauweg://app`.** Eine
Kopfzeile könnte sich jede Seite selbst setzen; die Herkunft setzt der
Browser, und fälschen kann sie von einer Webseite aus niemand. Für den
Browser bleibt es beim HttpOnly-Cookie, das kein Skript je zu sehen bekommt.

Beteiligte Stellen: `APP_ORIGIN` und `sessionToken` in
`packages/server/src/http/app.ts`, `TOKEN_PROTOKOLL` in
`packages/server/src/realtime/gateway.ts`,
`packages/client/src/laufzeit.ts`. Acht Tests decken die Naht ab
(`packages/server/test/app-huelle.test.ts`).

**Im Browser ändert sich nichts.** `laufzeit.ts` fällt ohne
`window.BRAUWEG_APP` auf das bisherige Verhalten zurück: gleiche Herkunft,
Cookie, `location.host`.

### Bauen

Der Client baut auf jedem Rechner, nur das iOS-Paket braucht macOS.
CocoaPods wird **nicht** gebraucht, XcodeGen schon (`brew install xcodegen`).

```bash
npm ci && npm run build --workspace @brauweg/client
cd apps/ios && xcodegen generate && open Brauweg.xcodeproj
```

Die Build-Phase „Client ins Paket" legt `packages/client/dist` nach `web/`
ins App-Paket. Danach in Xcode bauen und starten. **Fehlt der gebaute
Client, zeigt ein Debug-Bau den Hinweis, dass er fehlt** — die App bleibt
nicht weiß; ein Release-Bau bricht ab.

Nicht mit ins Paket gehen `start/` (Startbilder nur für die
Safari-Fassung), `hub-entwuerfe/`, `appicon.png` und `icon-1024.png`:
zusammen gut 5 MB, die sonst jedes Gerät mitschleppt. Das Paket lag damit im
August bei etwa 9,4 MB — **am 23.09.2026 gemessen sind es rund 54 MB**
(Karten 25 MB, Hub 13 MB, 3D 9 MB, Klang 6 MB), seitdem sind Spiele, Kartenblätter und
Klänge dazugekommen.

`web/stand.json` hält Commit und Bauzeit fest. Das beantwortet die Frage
„läuft im Paket wirklich der neue Client?", ohne raten zu müssen — genau die
Sorte Frage, die beim Deploy schon einen halben Tag gekostet hat (siehe
`STAND.md`).

### Einstellungen

| Einstellung | Wert |
| --- | --- |
| Bundle-ID | `de.brauweg.app` |
| Deployment-Ziel | iOS 16.0 |
| Geräte | nur iPhone |
| Ausrichtung | nur hochkant (wie das Web-Manifest) |
| Serveradresse | Build-Einstellung `BRAUWEG_API_BASE` — Debug `https://staging.brauweg-spielen.de`, Release `https://www.brauweg-spielen.de` |
| Push | Build-Einstellung `BRAUWEG_PUSH`, Vorgabe `NO` (nur vorbereitet) |

Die Serveradresse steht **nicht** in Swift, sondern als Build-Einstellung je
Konfiguration (`apps/ios/project.yml`, örtlich überschreibbar in
`Konfiguration/Lokal.xcconfig`). Sie landet über die Info.plist in
`Huelle.apiBasis`. Debug spricht mit Staging wie die Test-APK unter Android:
Wer aus Xcode startet, soll nicht aus Versehen Produktionsdaten anlegen.

`NSAllowsLocalNetworking` steht in der Info.plist, damit der
Entwicklungsserver über Klartext erreichbar ist. Das erlaubt Klartext
ausschließlich zu lokalen Namen und Loopback; der echte Server ist HTTPS und
davon unberührt.

---

## Was für den Store noch fehlt

### Sichere Ablehnungsgründe

| Punkt | Stand |
| --- | --- |
| ~~**Konto löschen**~~ | ✅ Profil-Tab ganz unten, mit Passwortabfrage. Gelöscht wird als Anonymisierung. Seit dem 23.09.2026 auch für Konten ohne Passwort: Code per Mail (nur Google/Apple) bzw. das Wort LÖSCHEN (Gast) — vorher konnten die sich gar nicht löschen. |
| ~~**Shop**~~ | ✅ **Im App-Paket ausgeblendet.** Shop-Tab und die Plus-Knöpfe an Münzen und VIP erscheinen nur im Browser (`zeigeKaufbares` in `GameSelect.tsx`). Angebote mit Paketangabe, die nichts verkaufen, gelten als unfertige App — und sobald sie etwas verkaufen, müssen sie über Apples Bezahlweg laufen. |
| **Rahmen** | Eigene Hülle in `apps/ios`, siehe oben — **geschrieben, noch nie übersetzt** (erster Build: `APP-RELEASE.md` 7.4). |
| **Datenschutzerklärung** | Seite steht unter `/rechtliches/datenschutz.html`, in der App als Blatt mit „Fertig" erreichbar. **Offen: die rot markierten Lücken ausfüllen** — Name, Anschrift, Support-Adresse, Datenbankanbieter, Aufbewahrungsdauer der Protokolle. |
| **Impressum** | Dasselbe unter `/rechtliches/impressum.html`, **dieselben Lücken.** Mit Platzhaltern erfüllt es die Pflicht nicht und ist abmahnfähig. |
| **Support-Adresse** | Pflichtfeld in App Store Connect — dieselbe Adresse gehört in beide Rechtstexte. |
| **Testzugang für die Prüfer** | Siehe unten. |

### Testzugang für die Prüfer

Der Einladungscode sperrt die Prüfer aus. In die Prüfhinweise gehören
deshalb ein fertiges Konto **und** der Code:

1. Ein Konto mit einer Adresse anlegen, die du liest, und bestätigen.
2. In den Prüfhinweisen angeben: Adresse, Passwort und der Einladungscode
   aus `INVITE_CODE`.
3. Dazuschreiben, dass die App einen Server braucht und ohne Netz nicht
   startet, und dass Doppelkopf zu viert läuft — die Prüfer sollen wissen,
   dass sie freie Plätze am Tisch **mit Bots füllen** können, sonst warten sie
   vergeblich auf Mitspieler.

Punkt 3 ist der, an dem Kartenspiele üblicherweise scheitern: Ein Prüfer, der
allein in einer leeren Lobby steht, meldet „App funktioniert nicht".

### Pflichtangaben (keine Programmierarbeit)

- Datenschutz-Etiketten („App Privacy"): E-Mail-Adresse, Anzeigename,
  Profilbild, Geburtstag, Spielstatistiken.
- Altersfreigabe: Kartenspiel mit Spielmünzen, **kein** Echtgeld-Glücksspiel.
- Kategorie: Spiele → Karten.
- Screenshots je Gerätegröße, Beschreibung, Schlüsselwörter.
- Ausfuhrangabe steht schon in der Info.plist
  (`ITSAppUsesNonExemptEncryption = false`), die Frage entfällt beim Upload.

---

## TestFlight: privat testen, ohne Release

Ziel dieser Stufe: die App **untereinander aufs iPhone laden und testen**, ohne
sie je öffentlich zu veröffentlichen. Das geht heute — ohne Firma, ohne Shop.

### Strategie: privater Account jetzt, Firma später

Entschieden im Gespräch am 5. August 2026.

- **Jetzt ein privater (Individual-)Account**, 99 $/Jahr, **ohne D-U-N-S-Nummer
  und ohne Firma**. Für TestFlight reicht das vollständig.
- **Free-to-play, keine In-App-Käufe.** Der Shop ist im App-Paket ohnehin
  ausgeblendet (`zeigeKaufbares`). Käufe brauchen den „Paid Apps"-Vertrag mit
  Bank- und Steuerdaten und kommen erst mit der gegründeten Firma.
- **Umstieg auf den Firmen-Account später ist unkritisch**, weil **alle echten
  Nutzerdaten auf unserem Server liegen, nicht bei Apple**. Ein Accountwechsel
  verliert kein Level, keine Trophäe. Wir laden später denselben Code in den
  neuen Account.
  - **Ein Haken: die Bundle-ID** (`de.brauweg.app`) ist weltweit eindeutig und
    an einen Account gebunden. Für den neuen Account entweder im alten Account
    freigeben (App-Eintrag löschen — bei einer nie veröffentlichten App ein
    Zwei-Klick-Ding) **oder** eine neue ID nehmen. Beides ist folgenlos, solange
    nichts öffentlich releast ist.
  - Ob Apple stattdessen eine **Konten-Umwandlung** Individual → Organization
    anbietet, ändert sich von Zeit zu Zeit — **vor dem Umstieg direkt bei Apple
    bestätigen**, nicht darauf verlassen.

### Was TestFlight *nicht* braucht

Die offenen Store-Punkte oben (Rechtstexte ausfüllen, Prüferkonto, volle
Store-Angaben) sind für die **Einreichung** nötig, **nicht** fürs interne
Testen. Zum Laden untereinander genügt ein Build und ein App-Eintrag.

- **Internes Testen** (bis 100 Personen, die App-Store-Connect-Zugang haben):
  **keine Prüfung, keine Rechtstexte, kein Datenschutz-Link nötig.** Genau das
  für „wir aufs eigene Handy".
- **Externes Testen** (bis 10.000 per E-Mail/öffentlichem Link, z. B. der
  Verein): braucht eine **leichte Beta-App-Review** und einen
  **Datenschutz-Link** (`/rechtliches/datenschutz.html` genügt formal, sollte
  bis dahin aber die roten Lücken gefüllt haben).

### Schrittfolge (macOS + Xcode)

1. **Programm beitreten:** developer.apple.com → Account → *Individual*
   einschreiben (99 $). Nach Freischaltung erscheint das persönliche Team in
   Xcode.
2. **Signierung:** Team-ID in `apps/ios/Konfiguration/Lokal.xcconfig`
   (Vorlage daneben) — automatische Signierung, Bundle-ID `de.brauweg.app`
   stehen schon in `project.yml`.
3. **Client ins Paket:** `npm run build --workspace @brauweg/client`, dann
   `cd apps/ios && xcodegen generate` (siehe oben). **Release**-Konfiguration
   nehmen — dann zeigt die App auf den Produktionsserver, nicht auf Staging.
4. **Archiv bauen:** in Xcode als Ziel „Any iOS Device (arm64)" wählen,
   *Product → Archive*.
5. **Hochladen:** im Organizer *Distribute App → TestFlight & App Store →
   Upload*. (Alternativ IPA exportieren und mit **Transporter** laden.)
   Ausfuhrfrage entfällt — `ITSAppUsesNonExemptEncryption = false` steht in der
   Info.plist.
6. **App-Eintrag:** in App Store Connect einmalig die App anlegen (Bundle-ID,
   Name, Hauptsprache). Der Build erscheint nach ~10–30 Min Verarbeitung im
   Reiter **TestFlight**.
7. **Intern einladen:** unter *Users and Access* die Mitspieler als Benutzer
   hinzufügen, in TestFlight der internen Gruppe zuordnen. Sie installieren die
   **TestFlight-App** aus dem Store und sehen Brauweg darin. Fertig.
8. **Später extern** (Verein): eigene Gruppe, Build zuordnen, zur Beta-Review
   einreichen, öffentlichen Link teilen.

### Fallstricke fürs Testen

- **Einladungscode:** Neue Tester müssen sich im Spiel weiterhin mit dem
  `INVITE_CODE` registrieren. Den Code in die TestFlight-Notizen („What to
  Test") schreiben, sonst stehen sie an der Anmeldung.
- **Bots:** dazuschreiben, dass man freie Plätze am Tisch mit Bots füllt —
  sonst wartet ein einzelner Tester vergeblich auf Mitspieler.
- **Build-Ablauf:** TestFlight-Builds verfallen nach **90 Tagen**; einfach neu
  hochladen.
- **Serveradresse:** Release zeigt auf `www.brauweg-spielen.de` (Produktion).
  Gegen `staging` spricht ein Debug-Bau; für einen Release-Bau gegen Staging
  `BRAUWEG_API_BASE = https://staging.brauweg-spielen.de`.

---

## Reihenfolge

1. ✅ Homescreen-Fassung
2. ✅ Konto löschen
3. ✅ Shop im App-Paket ausgeblendet
4. ✅ Token-Anmeldung (Server und Client); native Hülle **geschrieben**
   (`apps/ios`, 23.09.2026), **noch nie übersetzt** — erster Build auf Toms
   Mac nach `APP-RELEASE.md` 7.4
5. Datenschutz, Impressum, Support-Adresse ausfüllen
6. Demokonto anlegen und Prüfhinweise schreiben
7. TestFlight für die drei Geräte
8. Einreichung App Store
9. Play Store: Hülle steht seit dem 23.09.2026 (`apps/android`), Test-APK per
   GitHub Actions — Ablauf in `docs/APP-RELEASE.md`

Schritt 7 (TestFlight) geht **vor** den Schritten 5 und 6 los, sobald ein
privater Account eingeschrieben ist — internes Testen braucht die Rechtstexte
und das Prüferkonto nicht. Die volle Schrittfolge und die Account-Strategie
stehen oben unter „TestFlight: privat testen, ohne Release". Für den ersten
Upload fehlt nur die Signierung in Xcode.
