# Anmeldung mit Apple und Google — was einzurichten ist

Stand 23.09.2026. Der Code ist fertig und im Betrieb **aus**, solange die
Variablen unten fehlen: Ohne Client-ID zeigt der Client keinen Knopf und lädt
nichts von Google oder Apple. Einschalten heißt also: bei beiden Anbietern
anlegen, Variablen in Railway setzen, Datenschutzerklärung ergänzen.

Reihenfolge: erst **staging**, dort ausprobieren, dann Produktion.

---

## 1. Google

In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt
anlegen (oder ein vorhandenes nehmen), dann **Google Auth Platform**
(früher „OAuth-Zustimmungsbildschirm“):

### 1a. Zustimmungsbildschirm (Branding)

| Feld | Wert |
|---|---|
| App-Name | `Brauweg` |
| Support-E-Mail | eine Adresse, die jemand liest |
| Startseite der App | `https://www.brauweg-spielen.de` |
| Datenschutzerklärung | `https://www.brauweg-spielen.de/rechtliches/datenschutz.html` |
| Nutzungsbedingungen | leer lassen (gibt es nicht) |
| Autorisierte Domains | `brauweg-spielen.de` |
| Kontakt Entwickler | eine Adresse, die jemand liest |

- **Zielgruppe: Extern.** Danach **„App veröffentlichen“** (Status „In
  Produktion“). Im Status „Testen“ kommen nur eingetragene Testnutzer
  durch — alle anderen sehen einen Fehler.
- **Datenzugriff/Bereiche:** nichts hinzufügen. Der Knopf fragt nur
  `openid`, `email`, `profile` ab; das sind keine sensiblen Bereiche, eine
  Prüfung durch Google ist dafür nicht nötig. (Wer ein Logo hochlädt, löst
  eine Markenprüfung aus, die einige Tage dauert — ohne Logo geht es sofort.)

### 1b. OAuth-Client

**Clients → Client erstellen:**

| Feld | Wert |
|---|---|
| Anwendungstyp | **Webanwendung** |
| Name | `Brauweg Web` |
| Autorisierte JavaScript-Quellen | `https://www.brauweg-spielen.de` und `https://staging.brauweg-spielen.de` |
| Autorisierte Weiterleitungs-URIs | **keine** (der Knopf arbeitet im Popup, es wird nirgends hin weitergeleitet) |

Für die Entwicklung am eigenen Rechner zusätzlich `http://localhost` und
`http://localhost:5173` als JavaScript-Quelle — nur falls jemand lokal
testen will.

Ergebnis ist eine **Client-ID** (endet auf `.apps.googleusercontent.com`).
Dieselbe ID gilt für staging und Produktion, weil beide Quellen eingetragen
sind. Das **Client-Secret wird nicht gebraucht** — nirgends eintragen.

---

## 2. Apple

Voraussetzung: **Mitgliedschaft im Apple Developer Program** (dasselbe Konto
wie für die iOS-App, `docs/APPSTORE.md`). Alles unter
[Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).

### 2a. App ID

**Identifiers → App IDs →** die App ID der iOS-App öffnen (oder eine neue
anlegen) → Capability **Sign in with Apple** anhaken → „Enable as a primary
App ID“ → speichern.

### 2b. Services ID (das ist die Client-ID fürs Web)

**Identifiers → „+“ → Services IDs:**

| Feld | Wert |
|---|---|
| Description | `Brauweg Web` (erscheint im Apple-Dialog) |
| Identifier | z. B. `de.brauweg-spielen.web` — **muss sich von der Bundle-ID der App unterscheiden** |

Danach die Services ID öffnen → **Sign in with Apple** anhaken →
**Configure**:

| Feld | Wert |
|---|---|
| Primary App ID | die App ID aus 2a |
| Domains and Subdomains | `www.brauweg-spielen.de`, `staging.brauweg-spielen.de` |
| Return URLs | `https://www.brauweg-spielen.de/api/auth/apple/rueckweg` und `https://staging.brauweg-spielen.de/api/auth/apple/rueckweg` |

Wichtig: Die Return-URL muss **genau** zu der Adresse passen, unter der die
Seite im Browser läuft — Apple schickt die Antwort des Popups an deren
Herkunft. Läuft die Seite auch ohne `www.`, gehört `brauweg-spielen.de` mit
eigener Return-URL dazu (und dann muss `APPLE_REDIRECT_URI` je nach Adresse
passen — einfacher ist eine Weiterleitung von der nackten Domain auf `www.`).

**Domain-Nachweis:** Zeigt Apple bei der Domain einen Knopf zum Herunterladen
von `apple-developer-domain-association.txt` und einen „Verify“-Knopf, dann:
Inhalt der Datei als Railway-Variable `APPLE_DOMAIN_ASSOCIATION` in DER
Umgebung setzen, zu der die Domain gehört (staging und Produktion haben je
eine eigene Datei), deployen lassen, prüfen mit

```bash
curl https://staging.brauweg-spielen.de/.well-known/apple-developer-domain-association.txt
```

und erst dann „Verify“ klicken. Ausgeliefert wird die Datei vom Server
(`anbieter-routen.ts`), nicht aus dem Repo. Verlangt Apple keine Datei
(neuere Konten), die Variable weglassen — dann antwortet die Adresse mit 404.

**Keinen Schlüssel anlegen.** Unter „Keys“ bietet Apple einen „Sign in with
Apple“-Schlüssel (.p8) an. Den braucht nur, wer den Autorisierungscode bei
Apple einlöst (client_secret). Wir prüfen nur das ID-Token gegen Apples
öffentliche Schlüssel; die Begründung steht in
`packages/server/src/auth/apple.ts`.

### 2c. Mails an Apple-Weiterleitungsadressen

Wer bei Apple „E-Mail-Adresse verbergen“ wählt, kommt mit einer Adresse
`…@privaterelay.appleid.com` an. Apple leitet dorthin nur Mails von
**angemeldeten Absendern** weiter — sonst kommen Bestätigungs- und
Passwortmails nie an.

**Services → Sign in with Apple for Email Communication → Configure →**
Absender eintragen: die Adresse aus `MAIL_FROM`
(`noreply@brauweg-spielen.de`) bzw. die Domain `brauweg-spielen.de`. Apple
prüft dabei SPF — die DNS-Einträge aus `docs/RESEND.md` sollten reichen;
meldet Apple einen SPF-Fehler, dort nachsehen.

---

## 3. Railway-Variablen

In **beiden** Umgebungen (staging und production) des Server-Dienstes:

| Variable | Wert | Pflicht |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Client-ID aus 1b (`….apps.googleusercontent.com`) | für Google |
| `APPLE_CLIENT_ID` | Services ID aus 2b (z. B. `de.brauweg-spielen.web`) | für Apple |
| `APPLE_REDIRECT_URI` | nur setzen, wenn die Return-URL **nicht** `${PUBLIC_URL}/api/auth/apple/rueckweg` ist | nein |
| `APPLE_DOMAIN_ASSOCIATION` | Inhalt der Nachweisdatei, falls Apple sie verlangt (2b) | nein |

`PUBLIC_URL` muss stimmen (`https://www.brauweg-spielen.de` bzw.
`https://staging.brauweg-spielen.de`) — daraus entsteht die Return-URL.

Keine der Variablen ist ein Geheimnis im eigentlichen Sinn (Client-IDs stehen
ohnehin im Browser), sie gehören trotzdem in Railway und nicht ins Repo, weil
sie an der Umgebung hängen.

---

## 4. Datenschutzerklärung

**Vor** dem Einschalten in der Produktion ergänzen
(`packages/client/public/rechtliches/datenschutz.html`). Vorschlag:

> **Anmeldung mit Google oder Apple.** Du kannst dich statt mit E-Mail und
> Passwort mit deinem Google- oder Apple-Konto anmelden. Anbieter sind
> Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland, bzw.
> Apple Distribution International Ltd., Hollyhill Industrial Estate,
> Hollyhill, Cork, Irland. Beim Öffnen der Anmeldeseite lädt dein Browser das
> Anmeldeskript des Anbieters; dabei erfährt der Anbieter deine IP-Adresse.
> Meldest du dich an, übermittelt uns der Anbieter eine Kennung deines Kontos,
> deine E-Mail-Adresse (bei Apple auf Wunsch eine Weiterleitungsadresse) und
> — nur beim ersten Mal — deinen Vornamen, den wir als Vorschlag für deinen
> Anzeigenamen verwenden. Die Kennung speichern wir, damit du beim nächsten
> Mal dasselbe Konto erreichst; die Verknüpfung kannst du in den
> Einstellungen trennen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
> Weitere Informationen: [Google](https://policies.google.com/privacy),
> [Apple](https://www.apple.com/legal/privacy/).

In der Tabelle „Empfänger und Auftragsverarbeiter“ sind Google und Apple
**keine** Auftragsverarbeiter (sie handeln als eigene Verantwortliche), sie
gehören also in den Text oben, nicht in die Tabelle.

---

## 5. Auf staging ausprobieren

1. Variablen setzen, Deploy abwarten.
2. `https://staging.brauweg-spielen.de` in einem privaten Fenster öffnen:
   Beide Knöpfe müssen unter dem Anmeldeformular stehen.
3. Mit Apple anmelden → Popup → „E-Mail-Adresse verbergen“ wählen → es
   folgt die Frage nach dem Geburtstag (dieselbe Altersgrenze wie beim
   Registrieren; unter 16 kommt die Absage, und es entsteht kein Konto) →
   man landet eingeloggt im Hub; das Konto heißt wie der Vorname.
4. Abmelden, noch einmal mit Apple → dasselbe Konto.
5. Einstellungen → Abschnitt „Anmeldung“ → „Weiter mit Google“ →
   Google ist verknüpft; Apple lässt sich jetzt trennen, Google danach nicht
   mehr („letzte Anmeldeart“).
6. Als Gast spielen → Einstellungen → Geburtstag eintragen → mit Apple oder
   Google verknüpfen → „Dein Konto ist gesichert“.

Bleibt ein Knopf weg oder das Popup leer: Browserkonsole ansehen. Eine
Meldung „Refused to load … Content Security Policy“ heißt, die Richtlinie in
`packages/server/src/http/app.ts` passt nicht (auf dem Entwicklungsserver
fällt das nie auf, Vite setzt keine). „The given origin is not allowed“ bei
Google heißt: JavaScript-Quelle in 1b fehlt oder ist falsch geschrieben.
„invalid_request“ bei Apple heißt fast immer: Return-URL oder Domain in 2b
passt nicht zur Adresse im Browser.

---

## 6. Was bewusst nicht gebaut ist

- **In der iOS-App gibt es die Knöpfe nicht.** Google lehnt eingebettete
  WebViews ab, Apples Web-Popup kommt dort nicht zuverlässig zurück. Für die
  App bräuchte es die nativen Wege (AuthenticationServices bzw. Googles
  iOS-SDK) — und dann gilt App-Store-Regel 4.8: Wer Google anbietet, muss
  Apple mit anbieten.
- **Kein Widerruf bei Apple beim Trennen oder Löschen.** Dafür bräuchte es
  den .p8-Schlüssel (siehe 2b). Wer Brauweg ganz aus seiner Apple-ID lösen
  will, tut das unter appleid.apple.com → „Mit Apple anmelden“.

## Wie es im Code zusammenhängt

- Token-Prüfung: `packages/server/src/auth/idtoken.ts` (RS256 gegen JWKS,
  `iss`, `aud`, `exp`), `google.ts`, `apple.ts`; Einmal-Nonce in `nonce.ts`.
- Zuordnungsregeln (wer bekommt welches Konto): `auth/anbieter.ts`.
- Tabelle `account_identity` (Migration `0028`), eine Zeile je Bindung,
  eindeutig über (Anbieter, `sub`).
- Routen: `packages/server/src/http/anbieter-routen.ts`.
- Client: `packages/client/src/anmeldung/` — Knöpfe, Skript-Nachladen,
  Abschnitt in den Einstellungen.
