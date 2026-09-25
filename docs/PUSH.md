# Push-Mitteilungen („Du bist dran")

Stand 23.09.2026. **Server und Client sind fertig und getestet, aber aus**,
bis die Schlüssel da sind: Ohne Variablen schreibt der Server jede Mitteilung
nur ins Log (`PUSH (nur Log) …`). Das ist Absicht und kein Fehler — so läuft
der ganze Ablauf schon heute, und am Tag, an dem Tom den APNs-Schlüssel
anlegt, genügt eine Variable in Railway.

Warum überhaupt: Die App braucht nativen Mehrwert gegenüber einer Web-Hülle
(Apple 4.2), und „du bist dran", während das Telefon in der Tasche steckt,
kann keine Webseite.

---

## 1. Was Robin und Tom setzen müssen

Alle Variablen am Railway-Dienst (Produktion und Staging getrennt). Der
Server liest sie beim Start und sagt in **einer** Zeile, was läuft — nie einen
Wert:

```
Push-Mitteilungen: iOS ueber APNs (production, de.broweg.brauweg-spielen); Android ueber FCM (Projekt brauweg-12345)
Push-Mitteilungen: iOS nur Log (fehlt: APNS_KEY); Android nur Log (FCM_SERVICE_ACCOUNT nicht gesetzt)
```

### iOS — APNs (Tom, Apple-Konto)

| Variable | Woher | Beispiel |
| --- | --- | --- |
| `APNS_KEY_ID` | developer.apple.com → *Certificates, Identifiers & Profiles* → **Keys** → „+" → Haken bei **Apple Push Notifications service (APNs)** → *Continue* → *Register*. Die **Key ID** (10 Zeichen) steht danach in der Liste. | `ABC123DEFG` |
| `APNS_KEY` | Beim selben Schritt **einmalig** „Download": `AuthKey_<KEY_ID>.p8`. Der **ganze Inhalt** der Datei, mit `-----BEGIN PRIVATE KEY-----`. Zeilenumbrüche sind egal: echte, wörtliche `\n` oder die ganze Datei als Base64 — der Server nimmt alle drei. | *(geheim)* |
| `APNS_TEAM_ID` | developer.apple.com → *Membership* → **Team ID**. Dieselbe wie `APPLE_TEAM_ID` (APP-RELEASE.md 3.1). | `9XYZ8ABC7D` |
| `APNS_BUNDLE_ID` | Die Bundle-ID der App. | `de.broweg.brauweg-spielen` |
| `APNS_UMGEBUNG` | `production` (Vorgabe) für TestFlight und App Store; `sandbox` nur für Builds, die Xcode per Kabel aufs Telefon spielt. | `production` |

Ein Schlüssel gilt für alle Apps des Teams und läuft nicht ab. Apple lässt
höchstens zwei APNs-Schlüssel je Team zu; die `.p8` gibt es **nur einmal** —
in den Passwortmanager, nie ins Repo, nie in einen Chat. Geht sie verloren:
Schlüssel in Apples Liste widerrufen, neuen anlegen, Variablen tauschen.

In Xcode braucht die Hülle zusätzlich die Capability **Push Notifications**
(und für Hintergrund-Updates *Background Modes → Remote notifications*, für
reine Mitteilungen nicht nötig).

### Android — FCM (Robin, Firebase-Projekt)

| Variable | Woher |
| --- | --- |
| `FCM_SERVICE_ACCOUNT` | console.firebase.google.com → Projekt anlegen (ohne Analytics) → *Projekteinstellungen* → **Dienstkonten** → „Neuen privaten Schlüssel generieren". Die heruntergeladene **JSON-Datei ganz** als Wert (oder als Base64). Gebraucht werden daraus `project_id`, `client_email`, `private_key`. |

Im selben Projekt die Android-App anlegen: Paketname **`de.brauweg.app`** —
und für die Test-APK zusätzlich **`de.brauweg.app.debug`** (sonst bekommt
die Test-APK ein Token, das FCM ablehnt). Die Werte für den App-Bau
(`firebaseAppId`, `firebaseApiKey`, `firebaseProjektId`, `firebaseSenderId`,
Bau mit `-Ppush=an`) stehen in APP-RELEASE.md 4.10 — die gehören in die
Hülle, `FCM_SERVICE_ACCOUNT` gehört auf den Server. Das Dienstkonto ist
geheim wie ein Passwort.

### Notschalter

| Variable | Wirkung |
| --- | --- |
| `PUSH_AUS` | Komma-Liste abgeschalteter Anlässe für **alle** Konten: `dran`, `start`, `einladung`. Beispiel `PUSH_AUS=dran`. Unbekannte Einträge nennt die Startzeile. |

---

## 2. Wie man prüft

1. **Ohne Schlüssel (heute):** Railway-Log nach `PUSH (nur Log)` durchsuchen.
   Jede Mitteilung, die hinausginge, steht dort mit Plattform, den letzten
   sechs Zeichen des Tokens, Titel und Text.
2. **Nach dem Setzen:** Neu deployen, in der Startzeile muss
   `iOS ueber APNs (…)` bzw. `Android ueber FCM (…)` stehen. Steht dort
   `nur Log (…)`, nennt die Klammer, was fehlt oder nicht lesbar ist.
3. **Am Telefon:** App öffnen, an einen Doppelkopf-Tisch mit Bots setzen, die
   Frage „Sollen wir dir Bescheid sagen?" mit *Ja, gern* beantworten, System
   erlauben. In den Einstellungen unter *Mitteilungen* verschwindet der Satz
   „Dieses Telefon bekommt noch keine Mitteilungen". App in den Hintergrund —
   sobald die Bots durch sind, kommt „Du bist dran".
4. **Fehler:** Railway-Log nach `PUSHFEHLER` durchsuchen. Werden plötzlich
   alle iOS-Geräte abgeschaltet (`aktiv = false` in `geraet_push`), ist fast
   immer `APNS_UMGEBUNG` falsch: Ein Xcode-Build hat ein Sandbox-Token, das
   die Produktion als `BadDeviceToken` ablehnt — und umgekehrt.

---

## 3. Die Absprache mit der Hülle (Brücken-Vertrag)

Die Namen stammen aus der Android-Hülle (PR #238, `apps/android/…/Huelle.kt`
und `Bruecke.kt`); die iOS-Hülle übernimmt dieselben. Im Client steht der
Vertrag in `packages/client/src/push/bruecke.ts`.

| Richtung | Was | Wann |
| --- | --- | --- |
| Hülle → Client | `window.BRAUWEG_APP = { apiBase, plattform: 'ios' \| 'android', push: boolean }` | Vorspann, vor der ersten Zeile des Clients. **`push: false` heißt: nie fragen** (Android ohne `-Ppush=an`). |
| Client → Hülle | `window.BrauwegNativ.pushErlauben()` | Nach dem *Ja* in der freundlichen Frage oder dem Knopf in den Einstellungen. Die Hülle zeigt die Systemabfrage (iOS `requestAuthorization`, Android 13+ `POST_NOTIFICATIONS`) und holt das Token. iOS darf statt des Objekts auch `webkit.messageHandlers.pushErlauben` anbieten; der Client ruft dann `postMessage({})`. |
| Hülle → Client | `window.BRAUWEG_APP.pushToken = { plattform, token }`, dann `window.dispatchEvent(new CustomEvent('brauweg:push-token', { detail: { plattform, token } }))` | Nach jedem Laden der Seite und bei jedem neuen Token, sobald Push erlaubt ist — ohne erneut zu fragen. Erst ablegen, dann auslösen: Der Client liest beim Einhängen das Abgelegte. `token: null` = abgelehnt/nicht da. |
| Client → Server | `POST /api/push/geraet { plattform, token }` | Für jedes gemeldete Token, einmal je Konto und Start. |

Die Hülle soll Mitteilungen **im Vordergrund nicht anzeigen** (Vorgabe beider
Systeme; iOS: `willPresent` ohne `.banner`). Der Server schickt ohnehin
keine, solange jemand am Tisch hinsieht — aber wer gerade im Menü steht, hat
keine Tischverbindung, und dort soll kein Banner über die App fallen.

Die Mitteilung trägt neben Titel und Text die Daten `anlass`, `tableId`,
`gameId` (APNs: neben `aps`; FCM: `data`) und eine Sammelkennung
`tisch-<tableId>` (APNs `thread-id`, FCM `tag`), damit sich Mitteilungen
desselben Tisches ersetzen statt stapeln. Beim Antippen einfach die App
öffnen; an den Tisch springen kann eine spätere Hülle mit `tableId`.

---

## 4. Wann eine Mitteilung entsteht

Drei Anlässe, jeder einzeln abschaltbar — für alle über `PUSH_AUS`, je Konto
in den Einstellungen der App (*Mitteilungen*, drei Schalter; gespeichert in
`push_einstellung.aus`):

| Kennung | Titel | Text | Auslöser |
| --- | --- | --- | --- |
| `dran` | Du bist dran | `{Spiel}: Der Tisch wartet auf deinen Zug.` | Der Zug wechselt zu einem Menschen (`currentActor`), nur in Spielen mit echter Zugfolge: Doppelkopf, Skat, Zauberer, Cambio, Poker, Mememory, Filler (`ZUGSPIELE` in `push/kennungen.ts`). Nicht bei Feldherr, Golf, BroCooked (Echtzeit), Eiland, Tafelrunde (alle gleichzeitig) und der Partykiste (man sitzt zusammen). |
| `start` | Deine Runde startet | `{Spiel}: Der Tisch ist voll — es geht los.` | Der Gateway startet die Partie (`ensureStarted`) — an alle Menschen am Tisch. |
| `einladung` | Einladung angenommen | `{Name} sitzt jetzt mit an deinem {Spiel}-Tisch.` | Jemand löst den Beitrittscode ein (`/api/tables/code/:code/join`) — an den Gastgeber (erster Mensch am Tisch). |

Die Texte stehen im Wörterbuch `packages/server/src/push/texte.ts`. **Außer
dem Anzeigenamen dessen, der die Einladung annimmt, steht nichts über Dritte
in einer Mitteilung** — der Sperrbildschirm ist öffentlich. Der Name wird von
Steuer- und Richtungszeichen befreit und auf 30 Zeichen gekürzt.

Vor jedem Versand, in dieser Reihenfolge:

1. **Vordergrund?** Hat das Konto eine offene Tischverbindung, die hinsieht,
   geht nichts hinaus. Die App meldet über dieselbe Leitung
   `{ type: 'hintergrund' }`, sobald sie vom Bildschirm verschwindet
   (`visibilitychange` in `useTable.ts`); zurück ist sie mit dem nächsten
   `join`, das sie beim Zurückkommen ohnehin schickt. Ohne Verbindung (App
   zu, Leitung gekappt) gilt: nicht im Vordergrund. Eine offene
   **Webseite** zählt als Vordergrund — sie meldet nie `hintergrund`, und wer
   am Rechner spielt, braucht keinen Stups aufs Telefon.
2. **Drosselung:** höchstens **eine Mitteilung je Konto, Tisch und Minute**,
   über alle Anlässe zusammen. Im Speicher des Servers — bei mehreren
   Server-Instanzen gälte sie je Instanz (heute läuft eine).
3. **Einstellungen** des Kontos.
4. An **jedes aktive Gerät** des Kontos, dessen Anmeldung noch gilt.

Meldet APNs `410`, `BadDeviceToken`, `Unregistered` oder
`DeviceTokenNotForTopic` bzw. FCM `UNREGISTERED` (oder `INVALID_ARGUMENT` zum
Token), wird das Gerät abgeschaltet (`aktiv = false`). Meldet die App dasselbe
Token später wieder, ist es wieder an. Andere Fehler (Netz, 5xx, falscher
Schlüssel) lassen das Gerät, wie es ist, und stehen als `PUSHFEHLER` im Log.

---

## 5. Server im Überblick

| Datei | Aufgabe |
| --- | --- |
| `drizzle/0030_geraet_push.sql` | Tabellen `geraet_push` (id, account_id, sitzung_id, plattform, token, erstellt, zuletzt_gesehen, aktiv) und `push_einstellung` (account_id, aus). |
| `src/push/sender.ts` | Schnittstelle `PushSender`, `LogSender`. |
| `src/push/apns.ts` | APNs über HTTP/2 mit ES256-JWT. |
| `src/push/fcm.ts` | FCM HTTP v1 mit Dienstkonto (RS256-Tausch gegen Zugriffstoken). |
| `src/push/versand.ts` | Wahl je Plattform aus der Umgebung, die Startzeile. |
| `src/push/anlaesse.ts` | Die drei Anlässe, Vordergrund, Drosselung, Abschalten toter Tokens. |
| `src/push/geraete.ts` | Datenbank: anmelden, abmelden, löschen, Einstellungen. |
| `src/http/push-routen.ts` | `POST/DELETE /api/push/geraet`, `GET/PUT /api/push/einstellungen`. |

**Keine Bibliothek, nur Node-Bordmittel** (`node:http2`, `node:crypto`,
`fetch`): APNs verlangt HTTP/2, das `fetch` in Node nicht spricht; die
verbreiteten Pakete (`apn`, `firebase-admin`) bringen für zwei Handgriffe —
ein JWT signieren, ein POST — eigene HTTP/2-Schichten, gRPC und über hundert
Abhängigkeiten mit, jede ein Einfallstor in einem Server mit Konto- und
Sitzungsdaten. `crypto.sign` kann ES256 (mit `dsaEncoding: 'ieee-p1363'`
gleich in JWT-Form) und RS256 von Haus aus.

**Wann Tokens verschwinden:** beim Abmelden die der Sitzung (`logout` in
`auth/service.ts`), bei der Kontolöschung alle samt Einstellungen
(`anonymizeAccount`). Höchstens zehn Geräte je Konto; das am längsten stille
fällt. Meldet sich auf demselben Telefon jemand anderes an, zieht das Token
zu ihm um. Ein Gerät, dessen Sitzung widerrufen oder abgelaufen ist, bekommt
nichts mehr.

---

## 6. Datenschutz

Das Push-Token ist eine **Geräte-Kennung**. Mit dem ersten Build, der Push
einschaltet, ändern sich die Angaben in den Stores (APP-RELEASE.md 3.4 und
4.4): Apple *Identifiers → Device ID*, Google *Geräte- oder andere IDs* —
jeweils „App-Funktion", mit dem Konto verknüpft, nicht geteilt, kein
Tracking. Zugestellt wird über Apple bzw. Google; die sehen Titel und Text der
Mitteilung.

---

## 7. Offen

- **iOS-Hülle:** entsteht parallel (`apps/ios`); sie muss den Vertrag aus
  Abschnitt 3 umsetzen. Bis dahin ist `push` dort nicht gesetzt, und der
  Client fragt nicht.
- **Antippen führt an den Tisch:** Die Daten (`tableId`, `gameId`) gehen mit,
  weder Hülle noch Client werten sie aus.
- **Clantische** laufen über Wochen; „du bist dran" dort ist gewollt, die
  Drosselung je Minute ist für sie aber kurz. Beobachten.
- **Hintergrund auf iOS** hängt an `visibilitychange` im WKWebView. Kommt es
  einmal nicht, bleibt die Leitung, bis iOS sie kappt, als „im Vordergrund"
  stehen — dann fällt die Mitteilung aus, statt doppelt zu kommen.
