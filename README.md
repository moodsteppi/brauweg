# Brauweg

Kartenspiel-Plattform mit **frei konfigurierbaren Regelsätzen**. Mehrere
klassische Kartenspiele unter einem Dach, eigene Rangliste je Spiel plus
spielübergreifende Gesamtwertung.

- **Domain:** `brauweg-spielen.de`
- **Paket-Namensraum:** `@brauweg/*`
- **Stand:** M4 (Server und Persistenz) und ein roher Web-Client stehen. Zwei
  Browser können eine vollständige Doppelkopf-Partie beenden.

Das Produktversprechen ist nicht "viele Spiele", sondern *"spiel nach euren
Regeln, über alle Spiele hinweg gewertet"*. Siehe
[docs/plattform-plan.md](docs/plattform-plan.md).

## Struktur

```
packages/
  game-api/            @brauweg/game-api        Schnittstelle, kennt kein Spiel
  game-doppelkopf/     @brauweg/game-doppelkopf Engine + Adapter
  server/              @brauweg/server          Konten, Tische, WebSocket
  client/              @brauweg/client          React-PWA
docs/
  plattform-plan.md    Umsetzungsplan der Plattform
  doppelkopf-spec.md   Fachliche Spezifikation des Doppelkopf-Regelwerks
```

**Server, Lobby und Client programmieren ausschließlich gegen
`@brauweg/game-api`.** Im Server gibt es genau eine Ausnahme:
[`src/games/registry.ts`](packages/server/src/games/registry.ts) verdrahtet die
verfügbaren Module. Wird irgendwo sonst ein Spielpaket importiert, ist die
Trennung gebrochen und ein zweites Kartenspiel wird teuer. Auf der Spielseite
ist [`src/adapter.ts`](packages/game-doppelkopf/src/adapter.ts) die einzige
Datei, die beide Welten kennt.

## Befehle

```bash
npm install
npm run build
npm test
```

Erwartet: **109 Tests** im Doppelkopf-Paket, **44** im Server.

### Lokal starten

Der Server braucht keine installierte Datenbank: `DATABASE_URL=pglite` startet
PostgreSQL als WebAssembly im selben Prozess und legt die Daten unter `.pglite`
ab. In Produktion ist dieser Modus gesperrt.

Erstes Terminal:

```bash
DATABASE_URL=pglite NODE_ENV=development INVITE_CODE=BRAUWEG-BETA npm run dev:server
```

Zweites Terminal:

```bash
npm run dev:client
```

Dann `http://localhost:5173` öffnen. Ohne `RESEND_API_KEY` landen
Bestätigungsmails im Serverlog statt im Postfach — der Link steht dort im
Klartext.

### Umgebungsvariablen

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindung, oder `pglite` für die eingebettete Variante |
| `PUBLIC_URL` | Basis für Links in E-Mails, bestimmt auch das Secure-Flag des Cookies |
| `RESEND_API_KEY` | Ohne Schlüssel werden Mails nur protokolliert |
| `MAIL_FROM` | Absenderadresse |
| `INVITE_CODE` | Legt diesen Einladungscode beim Start an, idempotent |
| `INVITE_CODE_MAX_USES` | Standard 100 |
| `SESSION_TTL_DAYS` | Standard 30 |
| `MIGRATE_ON_BOOT` | In Produktion Migrationen beim Start anwenden |

## Betrieb

**Ein Dienst, eine Domain.** In Produktion liefert der Server den gebauten
Client selbst aus. Damit gibt es genau einen Ursprung: Das Sitzungs-Cookie gilt
ohne Sonderfall auch für den WebSocket, es braucht kein CORS und keine zweite
Domain. In der Entwicklung übernimmt Vite diese Rolle und reicht `/api` und
`/ws` an den Server weiter.

Deployment ist in [railway.json](railway.json) beschrieben: `npm ci && npm run
build`, gestartet wird `node packages/server/dist/src/index.js`, Health-Check
auf `/api/health`.

**Datenbank.** Jeder PostgreSQL-Anbieter geht, auch Supabase. Bei Supabase muss
es der **Session Pooler** (Port 5432) sein, nicht der Transaction Pooler auf
6543: Letzterer ist für Serverless gedacht und unterstützt keine Prepared
Statements. Die Direktverbindung `db.<projekt>.supabase.co` ist ohne Add-on nur
über IPv6 erreichbar.

## Grundsätze, die nicht aufgeweicht werden

1. Ein Spielmodul ist eine reine Logikbibliothek — kein Netzwerk, keine
   Datenbank, keine Uhr, kein Zufall außer dem Seed.
2. Sichtbarkeit entsteht ausschließlich in `viewFor`. Der Client bekommt nie
   den vollen Zustand und blendet nichts selbst aus.
3. Trophäen sind nicht Teil eines Spielmoduls. Module liefern Platzierungen,
   die Plattform rechnet die Wertung.
4. Regelsatz und Währung bleiben getrennt.
5. Jede WebSocket-Nachricht trägt Spielkennung und Protokollversion, jeder
   Zustand eine Revisionsnummer.
6. Der Client baut seine Schaltflächen aus `legalActions` und `viewFor` und
   bildet keine Regeln nach.

## Was noch fehlt

Aus der Beta-Abgrenzung des Plans sind **Emotes, Freundesliste, Zuschauen für
Freunde und Verein, Revanche und der Regelsatz-Editor mit gespeicherten
Regelsätzen** noch offen. Der Server kann Regelsätze bereits versionieren und
speichern, der Client zeigt sie nur als Häkchenliste beim Tischbau.

Ranglisten, Vereine und Moderation sind laut Plan M7 und M8 und bewusst nicht
Teil dieses Stands; die Datenfelder dafür stehen aber schon.
