# Mail: Bestätigung, Passwort vergessen, Diagnose

Stand 23.09.2026. Ersetzt `docs/RESEND.md` (dort steht nur noch der Verweis
hierher).

Brauweg verschickt genau zwei Arten Mail: den **Bestätigungslink** nach
Registrierung oder „Konto sichern" (48 Stunden gültig) und den
**Passwort-Link** aus „Passwort vergessen?" (zwei Stunden, einmal). Beide
gehen über [Resend](https://resend.com). Ohne Resend-Schlüssel schreibt der
Server die Mail stattdessen ins Betriebslog — das ist der **Log-Mailer**, und
genau der lief bis heute in der Produktion.

## Warum bisher nichts ankam

Robin am 23.09.2026: „Ich glaube, Resend ist nicht eingerichtet … in den Logs
kann man sich den Code immer holen." Das passt zum Code: Der Server nahm den
Resend-Weg nur, wenn `RESEND_API_KEY` einen **nicht leeren** Wert hatte.
Steht die Variable in Railway, aber ohne Wert (oder mit einem Platzhalter),
lief der Log-Mailer — und die Startwarnung sagte „RESEND_API_KEY fehlt",
obwohl sie im Dashboard zu sehen war. Die Registrierung schrieb trotzdem „Wir
haben dir eine E-Mail geschickt".

Seitdem gilt:

- **Beim Start steht EINE Zeile im Log**, welcher Mailer läuft und warum —
  „gesetzt", „gesetzt, aber leer" oder „nicht gesetzt", nie der Wert:
  - `Mailversand: Resend (RESEND_API_KEY gesetzt), Absender-Domain brauweg-spielen.de, Links auf https://…`
  - `Mailversand: NUR LOG, weil RESEND_API_KEY gesetzt, aber leer ist. …`
  - Hängt am Ende `ACHTUNG: …`, stimmt etwas an der Form: Schlüssel beginnt
    nicht mit `re_` (Platzhalter?), Absender auf `resend.dev` (Sandkasten)
    oder Links auf `localhost`.
- **Jeder Fehlschlag bei Resend steht laut im Log**, mit der festen Marke
  `MAILFEHLER`, Resends HTTP-Status, Fehlerkennung und Fehlertext sowie der
  **Domain** des Empfängers (nie der ganzen Adresse, nie dem Schlüssel).
- **Ohne Versanddienst verlangt die Produktion keine Bestätigung.** Wer sich
  registriert, ist sofort angemeldet, statt auf eine Mail zu warten, die nie
  kommt. Die Adresse bleibt dabei unbestätigt — das Testkonto-Merkmal
  (`STAFF_EMAILS`) hängt weiter an einer bestätigten Adresse, die Lockerung
  verschenkt dort also nichts. Sobald Resend läuft, gilt die Pflicht wieder,
  auch für diese Konten: Beim nächsten Anmelden steht „Bestätige zuerst deine
  Adresse" mit dem Knopf für einen neuen Link darunter. Lokal (`NODE_ENV`
  nicht `production`) bleibt die Pflicht immer an, der Link steht dort im
  eigenen Terminal.
- **Der Client sagt ehrlich, was los ist:** „E-Mail geschickt" nur, wenn
  Resend die Mail angenommen hat; sonst „ging nicht hinaus — fordere einen
  neuen Link an" bzw. „Mailversand ist gerade nicht eingerichtet".

## Was Robin einstellt (einmal, der Reihe nach)

Laut `docs/STAND.md` (Abschnitt „Was offen ist", Punkt 2) wurde die Domain
schon einmal bei Resend verifiziert, die DNS-Einträge liegen bei **Strato**.
Deshalb zuerst nachsehen, dann erst neu anlegen.

### 1. Resend-Konto und Domain

1. Auf [resend.com](https://resend.com) anmelden (oder ein Konto anlegen).
   Merke dir die Adresse des Resend-Kontos: Solange keine Domain verifiziert
   ist, stellt Resend **nur an diese eine Adresse** zu.
2. **Domains** öffnen. Steht dort `brauweg-spielen.de` mit Status
   **Verified**, weiter mit Schritt 2 — hier ist nichts zu tun.
3. Sonst **Add Domain** → `brauweg-spielen.de`, Region **EU (eu-west-1,
   Irland)**.
4. Resend zeigt jetzt die DNS-Einträge im Reiter **Records**. Werte **immer
   aus dem Dashboard kopieren**, nicht von hier abschreiben — der DKIM-Wert
   ist je Konto anders. Sie sehen so aus:

   | Zweck | Typ | Name (bei Strato) | Wert |
   | --- | --- | --- | --- |
   | DKIM | TXT | `resend._domainkey` | `p=MIGfMA0G…` (lang, aus Resend) |
   | SPF | TXT | `send` | `v=spf1 include:amazonses.com ~all` |
   | Return-Path | MX | `send` | `feedback-smtp.eu-west-1.amazonses.com`, Priorität 10 |
   | DMARC (empfohlen) | TXT | `_dmarc` | `v=DMARC1; p=none;` |

   **Strato-Eigenheiten** (aus `docs/STAND.md`): Die MX-Maske der
   Hauptdomain kennt kein Präfix und keine Zahl als Priorität. Deshalb bei
   Strato die **Subdomain `send` anlegen** und den MX dort setzen. Den MX der
   Hauptdomain **nicht anfassen** — daran hängt eine aktive Mailbox. Macht
   Strato aus Priorität 10 eine 20, ist das egal.

   Einen DMARC-Eintrag gibt es bei Strato vielleicht schon; dann **keinen
   zweiten** anlegen, zwei `_dmarc`-Einträge machen beide ungültig.
5. In Resend **Verify DNS Records** drücken. Meist Minuten, laut Resend bis
   zu 72 Stunden. Der Status muss **Verified** werden; `pending`,
   `failed` oder `temporary_failure` heißen: Eintrag fehlt oder ist falsch.

### 2. API-Schlüssel

1. In Resend **API Keys → Create API Key**.
2. Name `brauweg-production`, Berechtigung **Sending access**, Domain
   `brauweg-spielen.de`. (Ein Schlüssel mit reinem Senderecht ist Resends
   Empfehlung. Die Diagnose unten kann damit den Domain-Status nicht
   abfragen und sagt das auch — der Versand selbst geht.)
3. Den Schlüssel kopieren (beginnt mit `re_`). Resend zeigt ihn nur einmal.
   Nicht in Chats, Tickets oder Commits einfügen.

### 3. Railway (Dienst Brauweg, Umgebung production)

**Variables** öffnen und setzen:

| Variable | Wert |
| --- | --- |
| `RESEND_API_KEY` | der Schlüssel aus Schritt 2, ohne Anführungszeichen und ohne Leerzeichen |
| `MAIL_FROM` | `Brauweg <noreply@brauweg-spielen.de>` |
| `PUBLIC_URL` | die Adresse, unter der die Seite läuft, z. B. `https://www.brauweg-spielen.de` — ohne Schrägstrich am Ende |

`MAIL_FROM` muss auf der verifizierten Domain liegen. **Nicht**
`onboarding@resend.dev` — das ist Resends Sandkasten und stellt nur an die
Adresse des Resend-Kontos zu. Speichern; Railway startet den Dienst neu.

Dasselbe für **staging**, falls dort echte Mails gewünscht sind (am besten
mit eigenem Schlüssel `brauweg-staging`). Ob staging heute einen gültigen
Schlüssel hat, ist **offen** — `docs/STAGING.md` sagt ja (Stand 4. August),
geprüft wurde es am 23.09. nicht.

## Selbst prüfen

1. **Startzeile.** In Railway → Deployments → Logs nach `Mailversand:`
   suchen. Richtig ist `Mailversand: Resend (RESEND_API_KEY gesetzt),
   Absender-Domain brauweg-spielen.de, Links auf https://…` ohne `ACHTUNG`.
2. **Diagnose** (siehe unten) aufrufen. Richtig ist `domainStatus:
   verified` (oder `nichtAbfragbar` bei einem Sende-Schlüssel) und
   `versandt: true`, und die Testmail liegt im Postfach des Testkontos.
3. **Ganze Strecke** mit einer Adresse, die NICHT die des Resend-Kontos ist
   (sonst sieht man den Sandkasten-Fehler nicht): registrieren → Mail kommt
   → Link öffnet „Adresse bestätigt" → anmelden. Dann abmelden,
   „Passwort vergessen?" → Mail → neues Passwort → man ist angemeldet.
4. Kommt nichts an: im Log nach `MAILFEHLER` suchen — die Zeile nennt
   Resends Grund.

## Die Diagnose

`POST /api/staff/mail-probe` — nur für Testkonten (Adresse steht in
`STAFF_EMAILS` **und** ist bestätigt; sonst 403 „Das darf nur die Aufsicht").
Der Server fragt bei Resend den Status der Absender-Domain ab
(`GET https://api.resend.com/domains`) und schickt eine Testmail an die
Adresse des angemeldeten Kontos. Der Schlüssel steht nie in der Antwort.

**Aufrufen:** mit dem Testkonto anmelden und
**`https://<PUBLIC_URL>/aufsicht/mail`** öffnen → „Jetzt prüfen". Oder in der
Browser-Konsole derselben Seite:

```js
await (await fetch('/api/staff/mail-probe', { method: 'POST' })).json()
```

Wer in der Produktion noch kein bestätigtes Testkonto hat: Solange der
Log-Mailer läuft, steht der Bestätigungslink im Railway-Log (Suche
`MAIL an`) — öffnen, dann den Dienst einmal neu starten, damit
`STAFF_EMAILS` beim Start greift.

**Antwort** (Beispiel, Log-Mailer):

```json
{
  "mailer": "log",
  "absenderDomain": "brauweg-spielen.de",
  "domainStatus": "keinVersanddienst",
  "versandt": false,
  "fehler": "Versand laeuft ueber das Log, weil RESEND_API_KEY gesetzt, aber leer ist",
  "diagnose": "Versand laeuft ueber das Log, weil … RESEND_API_KEY mit einem Schluessel aus dem Resend-Dashboard fuellen (docs/MAIL.md).",
  "linkBasis": "https://www.brauweg-spielen.de",
  "letzterFehler": null
}
```

**`domainStatus` lesen:**

| Wert | Heißt | Tun |
| --- | --- | --- |
| `keinVersanddienst` | Log-Mailer: Schlüssel fehlt oder ist leer | Schritt 2 und 3 oben |
| `schluesselUngueltig` | Resend lehnt den Schlüssel ab (401/403) | neuen Schlüssel erzeugen, in Railway ersetzen |
| `sandbox` | `MAIL_FROM` auf `resend.dev` | `MAIL_FROM` auf `…@brauweg-spielen.de` |
| `nichtImKonto` | Domain nicht im Resend-Konto (oder anderes Konto als der Schlüssel) | Schritt 1 |
| `not_started`, `pending`, `failed`, `temporary_failure`, `partially_*` | Domain nicht (mehr) verifiziert — Resend stellt nur an die Kontoadresse zu | DNS-Einträge prüfen, „Verify" drücken |
| `verified` | alles gut; kommt nichts an, liegt es im Spam | — |
| `nichtAbfragbar` | Schlüssel darf nur senden; `versandt` zeigt, ob es geht | bei `versandt: false` siehe `fehler` |
| `nichtErreichbar` | Resend vom Server aus nicht erreichbar | später erneut prüfen |

`letzterFehler` zeigt den jüngsten `MAILFEHLER` seit dem Serverstart
(Zeit, Status, Resends Kennung, Text, Empfänger-Domain).

**Achtung Sandkasten-Falle:** `versandt: true` bei nicht verifizierter
Domain heißt nur, dass die Testmail an das **eigene** Resend-Konto durfte —
wenn das Testkonto zufällig dieselbe Adresse hat. Entscheidend ist
`domainStatus`.

## Im Code

- `packages/server/src/mail/index.ts` — `waehleMailer` (Auswahl und
  Startzeile), `ResendMailer` (meldet Fehlschläge, `entschaerfe` streicht
  Schlüssel), `ConsoleMailer` (Log).
- `packages/server/src/mail/probe.ts` — die Diagnose.
- `packages/server/src/auth/service.ts` — `bestaetigungPflicht`, Versand mit
  Rückmeldung (`versuche`), Reset meldet an und bestätigt die Adresse mit.
- `packages/client/src/kontolink.ts` + `screens/KontoLink.tsx` —
  Landeseiten `/verify`, `/reset`, `/aufsicht/mail`; `screens/KontoSichern.tsx`
  — „Konto sichern" für Gäste (Leiste über der Spielauswahl).
- Tests: `packages/server/test/mail.test.ts`,
  `packages/client/src/screens/KontoLink.test.tsx`,
  `screens/Auth.mail.test.tsx`, `App.kontolink.test.tsx`.
