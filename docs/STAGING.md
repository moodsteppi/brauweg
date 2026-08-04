# Testsystem (staging)

Zwei getrennte Dinge, die oft verwechselt werden:

- **`staging` ist ein Zweig.** Er existiert seit dem 4. August 2026 und ist der
  Zweig, gegen den gearbeitet wird. `main` löst den Deploy der echten App aus
  und wird aus Sitzungen heraus nicht mehr angefasst.
- **Ein Testsystem ist ein Dienst.** Den gibt es noch nicht — er muss in
  Railway angelegt werden. Bis dahin läuft der Zweig ins Leere: Er sammelt
  Arbeit, aber niemand sieht sie.

Diese Datei sagt, wie der Dienst angelegt wird und was Testkonten sind.

---

## 1 — Hat staging schon eine eigene Datenbank?

**Aus der Sitzung heraus lässt sich das nicht beantworten.** Es gibt kein
`railway`-CLI auf dem Rechner und keinen API-Schlüssel; ich sehe nur das
Repository, nicht das Hosting. Die Antwort steht in Railway, an zwei Stellen:

1. **Dienste zählen.** Im Projekt Brauweg: Steht dort außer dem App-Dienst und
   einem Postgres noch ein zweites Paar, ist das Testsystem schon da.
2. **`DATABASE_URL` vergleichen.** Zeigen App- und Testdienst auf dieselbe
   Datenbank, ist es **keine** getrennte Umgebung — dann liegen Testpartien in
   denselben Tabellen wie die echten.

Wer das im Terminal sehen will:

```bash
npm i -g @railway/cli
```

Danach `railway login`, `railway link` (Projekt Brauweg wählen) und:

```bash
railway status
```

Das listet Dienste und Umgebungen. `railway variables --service <name>` zeigt
die Variablen eines Dienstes, dort steht die `DATABASE_URL`.

---

## 2 — Testsystem anlegen (Railway, einmalig)

1. **Postgres hinzufügen:** *New → Database → Add PostgreSQL*. Der Dienst heißt
   sinnvollerweise `postgres-staging`.
2. **App-Dienst hinzufügen:** *New → GitHub Repo → moodsteppi/brauweg*, danach
   in den Einstellungen **Branch auf `staging`** stellen.
3. **Variablen setzen** (Tab *Variables* des neuen App-Dienstes):

   | Variable | Wert |
   | --- | --- |
   | `DATABASE_URL` | Referenz auf `postgres-staging` (`${{postgres-staging.DATABASE_URL}}`) |
   | `PUBLIC_URL` | die Adresse des Testsystems, z. B. `https://brauweg-staging.up.railway.app` |
   | `STAGE` | `staging` |
   | `MIGRATE_ON_BOOT` | `true` |
   | `INVITE_CODE` | ein eigener Code, **nicht** derselbe wie in der Produktion |
   | `STAFF_EMAILS` | Adressen der Testkonten, mit Komma getrennt |
   | `NODE_ENV` | `production` (es ist ein echter Build, keine Entwicklungsausgabe) |
   | `RESEND_API_KEY` | **weglassen** — dann landen Bestätigungsmails nur im Log |

4. **Watch Paths leer lassen.** Das Feld erwartet Glob-Muster, eine Zeile je
   Pfad. Steht dort etwas anderes (schon einmal passiert: der Inhalt von
   `railway.json`), findet Railway bei jedem Push null Änderungen und
   überspringt still mit „No changes to watched files". Leer gelassen greift
   `watchPatterns` aus `railway.json`, und dort steht `["**"]`.

**Ohne `RESEND_API_KEY` kommt keine Bestätigungsmail an.** Der Link steht im
Log des Dienstes (Suche: `MAIL`). Das ist beabsichtigt: Ein Testsystem, das
echte Mails verschickt, schickt sie irgendwann an echte Leute.

---

## 3 — Testkonten

Ein Testkonto hat **alles**: Premium dauerhaft, einen vollen Münzstand, der
nicht kleiner wird, und alles Kaufbare als besessen — Blätter, Szenerien,
Emotes, Namensdekoration. Heute ist ohnehin nichts davon beschränkt; der
Schalter steht schon, damit die erste Schranke ihn nicht vergisst.

**Das Merkmal hängt am Konto, nicht an der Umgebung.** Zwei Gründe: Auf einem
Testsystem mit gemeinsamer Datenbank hätte sonst jedes echte Konto plötzlich
alles, sobald es über die Testadresse hereinkommt. Und in der Produktion wird
genau ein solches Konto gebraucht — das Demokonto, das App Store Connect
verlangt (siehe [APPSTORE.md](APPSTORE.md)): Die Prüfer müssen jede Funktion
sehen können, ohne etwas zu kaufen.

**Gesetzt wird es nur über `STAFF_EMAILS`**, beim Start abgeglichen:

```
STAFF_EMAILS=jan@example.org,tester@example.org
```

Wer daraufsteht, ist Testkonto. Wer heruntergenommen wird, verliert es beim
nächsten Start. **Es gibt bewusst keinen Endpunkt und keine Oberfläche dafür**
— ein Weg, sich aus der laufenden Anwendung heraus Rechte zu geben, ist der
lohnendste Angriffspunkt einer App.

Das Konto muss vorher existieren: erst registrieren, dann die Adresse
eintragen, dann den Dienst neu starten. Steht eine Adresse ohne Konto in der
Liste, schreibt der Start eine Zeile `Testkonten: … ohne Konto: …` ins Log.

**Von Hand in der Datenbank** (falls einmal kein Neustart möglich ist):

```sql
UPDATE account SET is_staff = true WHERE lower(email) = 'jan@example.org';
```

Achtung: Beim nächsten Start gewinnt wieder `STAFF_EMAILS`. Die Variable ist
die einzige Wahrheit.

---

## 4 — Woran man das Testsystem erkennt

In der Kopfzeile steht ein kleines graues Schild: **STAGING**. Ein Testkonto in
der Produktion trägt stattdessen **TEST**. Kein Band, kein Warnton — nur so
viel, dass niemand aus Versehen im falschen System sitzt und sich wundert,
warum die Trophäen nicht im Profil ankommen.

Fehlt die Angabe (etwa in einem Prüfstand), gilt die Produktion: Ein
vergessener Schalter soll kein Schild in die echte App hängen, sondern
höchstens eines auf dem Testsystem fehlen lassen.

---

## 5 — Was bewusst NICHT anders ist

- **Der Einladungscode bleibt.** Auf staging ein eigener, aber er bleibt: Ein
  offenes Testsystem im Netz füllt sich mit Fremden, und Bots melden sich
  überall an, wo keine Tür ist.
- **Die E-Mail-Bestätigung bleibt.** Sie ist Teil des Ablaufs, den man testen
  will; der Link steht im Log.
- **Trophäen und Ranglisten laufen normal.** Sie stehen in der
  Staging-Datenbank und berühren die echten Listen nicht — vorausgesetzt,
  Punkt 1 ist sauber beantwortet.
