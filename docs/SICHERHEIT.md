# Brauweg — Sicherheitsgrundsätze

Was hier steht, ist geprüft und soll so bleiben. Wer eine dieser Stellen
anfasst, prüft den zugehörigen Test mit — die Namen stehen jeweils dabei.

## Kartengeben (das Wichtigste)

Wer die Karten vorhersagen kann, gewinnt jede Partie — für eine Plattform
mit Rangliste ist das der schwerwiegendste denkbare Fehler.

- Der Zufall kommt **immer** aus `node:crypto`, nie aus `Math.random()`
  (`runtime/party.ts`).
- Jede Partie bekommt eine geheime **128-Bit-Basis** (`seedHex`). Aus ihr
  leitet die Engine für jedes Geben einen eigenen Seed ab
  (`game-doppelkopf/src/deal.ts: dealSeed`).
- Ein Geben darf **nie** aus einem anderen berechenbar sein. Früher stand
  dort `partieSeed * 1000 + runde * 10 + versuch`: Wer aus den eigenen zwölf
  Karten ein Geben erriet, kannte die ganze Partie.
- Der Zahlen-Seed (32 Bit) bleibt nur für Tests und das Nachspielen.
- Test: *„der Hex-Seed macht jedes Geben unabhaengig"*.

## Was ein Client nie erfährt

- Fremde Handkarten. Zuschauer bekommen `spectatorView`, die Hand, Partei,
  Zugrecht und Vorbehaltsoptionen entfernt (`adapter.ts: stripHand`).
- E-Mail-Adressen, Passwort-Hashes, Sitzungs-Token anderer Konten.
- Ob es eine E-Mail-Adresse gibt: Anmeldung, Bestätigungs- und
  Reset-Anforderung antworten immer gleich — **und rechnen gleich lange**
  (`auth/secrets.ts: blindvergleich`). Test: *„die Anmeldung verraet ueber
  die Dauer nicht, ob es das Konto gibt"*.

## Berechtigung

Jede Route und **jede WebSocket-Nachricht** prüft, ob der Handelnde darf:

- `join` über WebSocket prüft Sitz bzw. Clanmitgliedschaft; nur wer selbst
  sitzt, kann einen Tisch anlaufen lassen (`realtime/gateway.ts`).
  Test: *„ein Fremder kann sich nicht auf einen Clantisch schalten"*.
- Züge werden doppelt geprüft: Runtime (sitzt der Handelnde?) und Modul
  (gehört die Aktion zu seinem Sitz?).
- Regelsätze: nur der Eigentümer legt neue Versionen an
  (`tables/service.ts: saveRuleSet`).
- Ein laufender Tisch pinnt `(ruleSetId, ruleSetVersion)` — Regeln lassen
  sich nachträglich nicht ändern.

## Eingaben

- Jede HTTP-Route hat ein Zod-Schema. Jede WebSocket-Nachricht ebenfalls
  (`clientMessageSchema`) — keine ungeprüften Felder in die Tischverwaltung.
- Rumpfgrenze 128 kB, WebSocket-Nachrichten 64 kB.
- Profilbilder: Typ **und erste Bytes** werden geprüft
  (`app.ts: istEchtesBild`), Auslieferung mit `nosniff`. Ohne das ließe sich
  HTML als „image/png" unter unserer eigenen Herkunft ausliefern.

## Grenzen gegen Missbrauch

- Anmelden/Registrieren/Mails: 30 je 15 Minuten und Adresse — ein Verein
  hinter einer Adresse muss sich reihum anmelden können.
- Schreibende Routen: 60/Minute. Grundgrenze: 1200/Minute.
- WebSocket: höchstens 8 Verbindungen je Konto, 120 Nachrichten je 10 s.
- Passwort-Reset hat dieselbe 60-Sekunden-Sperrfrist wie der
  Bestätigungslink und entwertet ältere Links.

## Nebenläufigkeit

- `PartyRuntime.start`/`resume` setzen den Riegel **vor** dem ersten
  `await`. Ohne ihn legten zwei gleichzeitige `join` zwei Partien mit
  eigenen Timern auf denselben Tisch an — mit doppelt gebuchten Trophäen.
- Registrierung läuft in einer Transaktion: Ein Fehlversuch darf keine
  Einladung kosten. Test: *„eine gescheiterte Registrierung verbraucht
  keine Einladung"*.

## Kopfzeilen

`@fastify/helmet` mit CSP (`frame-ancestors 'none'`, `script-src 'self'`),
HSTS, `nosniff`, `Referrer-Policy`. Neue externe Quellen (Schriften, CDNs)
brauchen eine CSP-Änderung — das ist Absicht: Der Client lädt nichts nach.

## Vor jedem Deploy

```bash
npm test && npm audit --omit=dev
```
