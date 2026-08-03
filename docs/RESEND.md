# Resend einrichten (E-Mail-Versand)

Bestätigungs- und Passwortmails laufen über [Resend](https://resend.com),
nicht über Strato. Der Code ist fertig (`ResendMailer`); ohne API-Key schreibt
der Server die Mails nur ins Log (Suche: `MAIL`).

## Was du klickst

1. Konto bei [resend.com](https://resend.com) anlegen.
2. **Domains → Add Domain** → `brauweg-spielen.de`.
3. Die angezeigten DNS-Einträge (SPF, DKIM, ggf. DMARC) bei **Strato** unter
   der Domain anlegen — genau so, wie Resend sie zeigt.
4. In Resend warten, bis die Domain **Verified** ist.
5. **API Keys → Create** → Key kopieren.
6. In **Railway** (Brauweg-Dienst) setzen:

   | Variable | Wert |
   | --- | --- |
   | `RESEND_API_KEY` | der Key aus Schritt 5 |
   | `MAIL_FROM` | `Brauweg <noreply@brauweg-spielen.de>` |
   | `PUBLIC_URL` | `https://www.brauweg-spielen.de` |

7. Dienst neu deployen (oder Variablen speichern und Restart).

## Kurz testen

1. Neues Konto mit Einladungscode `BRAUWEG-BETA` registrieren.
2. Bestätigungsmail sollte in wenigen Sekunden ankommen (Spam prüfen).
3. Passwort-Zurücksetzen einmal durchspielen.

Wenn die Mail ausbleibt: Railway-Logs nach `Bestaetigungsmail` / Resend-Fehler
durchsuchen; Domain-Status in Resend nochmal prüfen.

## Strato-DNS (typisch)

Resend liefert die konkreten Werte. Sinngemäß:

- **TXT** für SPF (oft `@` oder Hostname laut Resend)
- **TXT/CNAME** für DKIM (Hostname + Wert von Resend)
- Optional **TXT** `_dmarc` mit `v=DMARC1; p=none;` zum Start

TTL kann auf dem Strato-Minimum bleiben; Verifikation dauert oft Minuten,
selten bis zu einer Stunde.
