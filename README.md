# Brauweg

Kartenspiel-Plattform mit **frei konfigurierbaren Regelsätzen**. Mehrere
klassische Kartenspiele unter einem Dach, eigene Rangliste je Spiel plus
spielübergreifende Gesamtwertung.

- **Domain:** `www.brauweg-spielen.de` (die nackte Domain leitet per 301 dorthin)
- **Live:** https://www.brauweg-spielen.de
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
  APPSTORE.md          Die iOS-App
```

Die **iOS-App** liegt in einem eigenen Repository, `Brauweg-spiel-ios`. Sie
ist eine Hülle um einen `WKWebView` und liefert genau diesen Client aus dem
App-Paket aus — keine zweite Oberfläche. Einzelheiten in
[docs/APPSTORE.md](docs/APPSTORE.md).

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

Erwartet: **128 Tests** im Doppelkopf-Paket, **117** im Zauberer-Paket,
**259** im Server.

`npm run build` und `npm test` gehören ins **Wurzelverzeichnis**, nicht
`--workspace @brauweg/server`: Sonst ist die `.d.ts` von `@brauweg/game-api`
der alte Stand und `tsc` meldet Felder als fehlend, die längst da sind. Nach
einem Zweigwechsel `packages/*/dist` löschen, sonst laufen Tests aus einem
alten Übersetzerstand mit.

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

**Eine Ausnahme: die iOS-App.** Sie lädt den Client aus dem App-Paket und ist
damit eine zweite Herkunft (`brauweg://app`). Cookies gehen dorthin nicht, sie
trägt ihr Sitzungstoken selbst — per `Authorization`-Kopf und am WebSocket als
Unterprotokoll. Der Browserweg bleibt davon unberührt; siehe
[docs/SICHERHEIT.md](docs/SICHERHEIT.md).

Deployment ist in [railway.json](railway.json) beschrieben: `npm install
--include=dev && npm run build`, gestartet wird
`node packages/server/dist/src/index.js`, Health-Check auf `/api/health`.

Zwei Railway-Eigenheiten stecken darin: `npm ci` scheitert dort mit `EBUSY`,
weil ein Build-Cache unter `node_modules/.cache` eingehängt ist, und der
Builder setzt die npm-Option `production`, was `tsc` und `vite` weglassen
würde.

**Watch Paths müssen leer bleiben.** Beim Import erkennt Railway das Monorepo
und setzt für den Dienst `/packages/server/**`. Das ist hier falsch: Der Dienst
baut das gesamte Repository und liefert den Client mit aus. Mit dieser
Einschränkung werden Änderungen am Client stillschweigend mit „No changes to
watched files" übersprungen und **nie ausgeliefert** — ohne Fehlermeldung, der
Dienst bleibt einfach auf dem alten Stand.

**Domain.** Die eigentliche Adresse ist `www.brauweg-spielen.de`; die nackte
Domain leitet per 301 dorthin. Ein CNAME am Zonen-Apex ist nach DNS-Regel nicht
erlaubt, und Strato bietet weder ALIAS noch CNAME-Flattening — deshalb `www`
als Ziel und eine Weiterleitung davor.

**Datenbank.** Jeder PostgreSQL-Anbieter geht, auch Supabase. Bei Supabase muss
es der **Session Pooler** (Port 5432) sein, nicht der Transaction Pooler auf
6543: Letzterer ist für Serverless gedacht und unterstützt keine Prepared
Statements. Die Direktverbindung `db.<projekt>.supabase.co` ist ohne Add-on nur
über IPv6 erreichbar.

## Kartenblätter

Jedes Konto wählt sein Blatt selbst (`account.card_deck`, Vorgabe `text`). Die
Wahl gehört an das Konto und nicht in den Browser: Wer am Rechner ein Blatt
aussucht, will es am Telefon nicht erneut suchen.

| Kennung | Blatt |
|---|---|
| `text` | Farbe und Wert als Zeichen (`♣D`). Lädt nichts nach, Vorgabe |
| `minimal2` | Flache Bildkarten, klassisch zweifarbig |
| `minimal4` | Dieselben Karten als Vierfarbenblatt |
| `klassisch` | Gezeichnete Bildkarten |

Die Bilder liegen unter
[`packages/client/public/karten/<kennung>/`](packages/client/public/karten) und
heißen `<farbe>_<rang>` — also `kreuz_9`, `pik_10`, `herz_b`, `karo_d`,
`kreuz_k`, `herz_a`, dazu `ruecken`. Das Protokoll benennt Karten englisch
(`H`/`J`); übersetzt wird das an genau einer Stelle, in
[`packages/client/src/decks.ts`](packages/client/src/decks.ts).

**Der Server kennt nur die Kennungen**
([`src/decks.ts`](packages/server/src/decks.ts)), damit nichts Fremdes in der
Spalte landet — wie ein Blatt aussieht, weiß allein der Client. Ein weiteres
Blatt ist deshalb ein Verzeichnis mit Bildern, ein Eintrag in beiden Listen und
sonst nichts.

Woher die Bilder stammen und unter welcher Lizenz sie stehen, steht in
[CREDITS.md](CREDITS.md).

Bei den Bildblättern steht der ausgeschriebene Kartenname im `alt`-Text.
Vorlesegeräte und ein nicht geladenes Bild ergeben damit dieselbe Ausgabe wie
das Textblatt; ohne diesen Umweg wäre die Umstellung auf Bilder ein Rückschritt
für alle, die nicht sehen.

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
