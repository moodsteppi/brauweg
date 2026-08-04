# Testsystem (staging)

Zwei getrennte Dinge, die oft verwechselt werden:

- **`staging` ist ein Zweig.** Seit dem 4. August 2026 der Zweig, gegen den
  gearbeitet wird. `main` löst den Deploy der echten App aus und wird aus
  Sitzungen heraus nicht mehr angefasst.
- **`staging` ist außerdem eine Railway-Umgebung.** Nicht ein zweites Paar
  Dienste neben der Produktion, sondern eine eigene *Environment* im selben
  Projekt — mit eigenem `@brauweg/server`, eigenem Postgres und eigener
  Adresse. Der Umschalter dafür steht oben in der Kopfzeile, neben dem
  Projektnamen.

---

## 1 — Stand (geprüft am 4. August 2026)

**Beides steht und läuft.**

| | |
| --- | --- |
| Umgebung | `staging` im Projekt `brauweg` |
| Adresse | **staging.brauweg-spielen.de** |
| Datenbank | **eigener Postgres in der Umgebung** — die Produktion wird nicht berührt |
| Zweig | `staging`, Deploy bei jedem Push |

Die Trennung ist damit sauber: Testpartien, Testkonten und Trophäen liegen in
der Staging-Datenbank; die echten Listen sehen nichts davon.

**Wichtig für alles Weitere:** Variablen gehören in Railway **je Umgebung**.
Wer `STAGE` in der Produktion setzt, hat es auf staging nicht gesetzt — und
umgekehrt. Vor jeder Änderung also erst den Umschalter oben prüfen.

Wer den Stand im Terminal sehen will, braucht das Railway-CLI. **Auf dem
Windows-Rechner geht das derzeit nicht:** Die Binärdatei wird von Windows
Smart App Control geblockt („Eine Anwendungssteuerungsrichtlinie hat diese
Datei blockiert. Bösartige Binärreputation"). Der Weg läuft deshalb über die
Oberfläche.

---

## 2 — Variablen der Staging-Umgebung

Gesetzt sind (Stand 4. August 2026): `NODE_ENV`, `MIGRATE_ON_BOOT`,
`INVITE_CODE`, `INVITE_CODE_MAX_USES`, `MAIL_FROM`, `PORT`, `PUBLIC_URL`,
`DATABASE_URL`, `RESEND_API_KEY`, dazu neu:

| Variable | Wert | Wofür |
| --- | --- | --- |
| `STAGE` | `staging` | Das kleine graue Schild in der Kopfzeile |
| `STAFF_EMAILS` | `robin.hellmut+staging@gmail.com` | Testkonten, siehe Abschnitt 3 |

**Warum eine Plus-Adresse und nicht die normale?** Nötig wäre es nicht —
staging hat eine eigene Datenbank, dieselbe Adresse dort wäre ohnehin ein
anderes Konto. Zwei Gründe sprechen trotzdem dafür:

1. **Das Postfach.** Bestätigungs- und Passwortmails beider Systeme kämen sonst
   vom selben Absender mit fast gleichem Text. Beim dritten Mal klickt man auf
   den falschen Link.
2. **Das Demokonto der App-Store-Prüfung.** Es braucht später `STAFF_EMAILS`
   **in der Produktion**. Stünde dort die normale Adresse, hätte das echte
   Spielkonto plötzlich Premium und alles freigeschaltet — und wäre als
   Referenzkonto wertlos.

Alles hinter dem `+` ignoriert Gmail beim Zustellen: Die Mail landet im selben
Fach, für Brauweg ist es aber eine andere Adresse und damit ein anderes Konto.

**`RESEND_API_KEY` ist auf staging gesetzt** — Bestätigungsmails gehen also
wirklich raus, über dieselbe verifizierte Domain wie in der Produktion. Wer
das nicht will, entfernt die Variable in der Staging-Umgebung; dann steht der
Bestätigungslink im Log des Dienstes (Suche: `MAIL`).

**Watch Paths leer lassen.** Das Feld erwartet Glob-Muster, eine Zeile je
Pfad. Steht dort etwas anderes (schon einmal passiert: der Inhalt von
`railway.json`), findet Railway bei jedem Push null Änderungen und überspringt
still mit „No changes to watched files". Leer gelassen greift `watchPatterns`
aus `railway.json`, und dort steht `["**"]`.

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

**Wie erkennt der Server ein Testkonto?** Gar nicht — er bekommt es gesagt.
Es gibt kein Muster, keine Domain, keine Erkennung. Beim Start vergleicht er
`lower(account.email)` mit der Liste; wer darin steht **und eine bestätigte
E-Mail-Adresse hat**, bekommt `is_staff = true`, alle anderen `false`.

Die Bestätigung ist die eigentliche Sicherung. Ohne sie genügte es, sich mit
einer Adresse aus der Liste zu registrieren, um beim nächsten Start alle
Rechte zu haben — ohne je Zugriff auf das Postfach gehabt zu haben. Der
Bestätigungslink geht an das Postfach, und nur wer ihn hat, kommt an das
Merkmal.

Also: erst registrieren, dann bestätigen, dann die Adresse eintragen, dann den
Dienst neu starten.

**Genau da steht es gerade** (Log des Staging-Dienstes, 4. August 2026):

```
Testkonten: 0 gesetzt, ohne Konto: robin.hellmut+staging@gmail.com
```

Die Staging-Datenbank ist frisch, dort hat sich noch niemand registriert. Der
nächste Schritt ist deshalb: auf **staging.brauweg-spielen.de** mit
`robin.hellmut+staging@gmail.com` ein Konto anlegen, die Mail bestätigen — und
beim nächsten Deploy (oder einem Neustart des Dienstes) steht `1 gesetzt` im
Log.

Das Log unterscheidet die Fälle:

```
Testkonten: 1 gesetzt, ohne Konto: neu@example.org,
            E-Mail noch nicht bestaetigt: fremd@example.org
```

„Ohne Konto" heißt: Da muss sich noch jemand registrieren. „Noch nicht
bestätigt" heißt: Da fehlt nur der Tipp auf den Link — auf staging steht er im
Log des Dienstes (Suche: `MAIL`).

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
