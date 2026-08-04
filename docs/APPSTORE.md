# Brauweg in den App Store

Der Client ist eine Web-App. Für den Store braucht sie einen nativen Rahmen.
Diese Datei hält fest, wie der aussieht, was fertig ist und was fehlt.

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

**Entschieden am 04.08.2026.** Das Repository **`Brauweg-spiel-ios`** (Xcode,
SwiftUI) enthält eine schlanke Hülle um einen `WKWebView`. Sie liefert den
gebauten Client aus dem App-Paket aus und sagt ihm, wo der Server steht —
mehr nicht. Es gibt **keine zweite Oberfläche in Swift**, sonst gäbe es zwei
Wahrheiten und jede Änderung am Spiel müsste zweimal gebaut werden.

Der Plan sah Capacitor vor. Dagegen sprach nichts Grundsätzliches, aber
dreierlei Praktisches: Capacitor legt sein eigenes Xcode-Projekt an (das
vorhandene wäre überflüssig geworden), es braucht CocoaPods, und alles, was
die App wirklich vom Web unterscheidet — Push über APNs und der In-App-Kauf —
ist nativ einfacher als durch ein Plugin hindurch. Die Hülle ist knapp
400 Zeilen Swift.

### Aufbau

| Datei | Aufgabe |
| --- | --- |
| `Huelle.swift` | Schema, Serveradresse, was dem Client eingespritzt wird |
| `PaketSchema.swift` | Liefert `web/` aus dem App-Paket unter `brauweg://app` |
| `WebAnsicht.swift` | Der WebView, Navigation, Impressum-Blatt |
| `scripts/web-uebernehmen.sh` | Baut den Client und legt ihn nach `web/` |

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
CocoaPods wird **nicht** gebraucht.

```bash
cd Brauweg-spiel-ios && ./scripts/web-uebernehmen.sh
```

Das Skript baut `@brauweg/client` und legt `dist/` nach `web/` neben das
Xcode-Projekt. Danach in Xcode bauen und starten. **Ohne einen Lauf des
Skripts zeigt die App den Hinweis, dass der Client fehlt** — sie bleibt nicht
weiß.

Nicht mit ins Paket gehen `start/` (Startbilder nur für die
Safari-Fassung), `hub-entwuerfe/`, `appicon.png` und `icon-1024.png`:
zusammen gut 5 MB, die sonst jedes Gerät mitschleppt. Das Paket liegt damit
bei etwa 9,4 MB.

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
| Serveradresse | Build-Setting `BRAUWEG_API_BASE` — Debug `http://127.0.0.1:3000`, Release `https://www.brauweg-spielen.de` |

Die Serveradresse steht **nicht** in Swift, sondern als Build-Setting je
Konfiguration. Sie landet über die Info.plist in `Huelle.apiBasis`.

`NSAllowsLocalNetworking` steht in der Info.plist, damit der
Entwicklungsserver über Klartext erreichbar ist. Das erlaubt Klartext
ausschließlich zu lokalen Namen und Loopback; der echte Server ist HTTPS und
davon unberührt.

---

## Was für den Store noch fehlt

### Sichere Ablehnungsgründe

| Punkt | Stand |
| --- | --- |
| ~~**Konto löschen**~~ | ✅ Profil-Tab ganz unten, mit Passwortabfrage. Gelöscht wird als Anonymisierung. |
| ~~**Shop**~~ | ✅ **Im App-Paket ausgeblendet.** Shop-Tab und die Plus-Knöpfe an Münzen und VIP erscheinen nur im Browser (`zeigeKaufbares` in `GameSelect.tsx`). Angebote mit Paketangabe, die nichts verkaufen, gelten als unfertige App — und sobald sie etwas verkaufen, müssen sie über Apples Bezahlweg laufen. |
| ~~**Rahmen**~~ | ✅ Eigene Hülle, siehe oben. |
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

## Reihenfolge

1. ✅ Homescreen-Fassung
2. ✅ Konto löschen
3. ✅ Shop im App-Paket ausgeblendet
4. ✅ Native Hülle, Token-Anmeldung, läuft im Simulator
5. Datenschutz, Impressum, Support-Adresse ausfüllen
6. Demokonto anlegen und Prüfhinweise schreiben
7. TestFlight für die drei Geräte
8. Einreichung App Store
9. Später: Play Store (baut auch auf Windows, deutlich einfacher)

Für Schritt 7 fehlt nur noch die Signierung in Xcode; das Team steht bereits
im Projekt.
