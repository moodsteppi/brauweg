# Stand der Arbeit

Übergabe für eine neue Sitzung. Was hier steht, ist am 4. August 2026
geprüft — Zahlen und Zustände stammen aus tatsächlichen Läufen, nicht aus
der Erinnerung.

---

## Wo das Projekt steht

Brauweg läuft unter **www.brauweg-spielen.de**. **Zwei Spiele sind
spielbar: Doppelkopf und Zauberer**, der Hub steht, Clans funktionieren.
Der Deploy hängt an `main`: Was dorthin gemerged wird, ist nach etwa zwei
Minuten live.

**Prüfstand:** 127 Doppelkopf-Tests, 117 Zauberer-Tests, 147 Servertests,
`tsc --noEmit` sauber. `npm test` und `npm run build` im Wurzelverzeichnis
decken beides ab.

**`main` und `staging` stehen aktuell auf demselben Commit** (`d51f77d`,
4. August 2026). Der Zweig war zusammengeführt: die Startbildschirm-Arbeit
von hier plus Cursors Rundenabschluss (`20f66cc` — Auswertungs-Blätter,
Ansage-Blasen, Verbindungsbanner). Der einzige Konflikt lag in `styles.css`,
wo beide ans Dateiende angehängt hatten; beide Blöcke stehen jetzt drin.

**Bilder:** `packages/client/public/hub/` liegt bei 6,2 MB — zu Tagesbeginn
waren es 30. Gemaltes wird als **WebP mit Qualität 85** ausgeliefert;
Originale in voller Auflösung gehören nach `packages/client/art/`, niemals
unter `public/` (siehe `docs/DESIGN.md`).

---

## Wie hier gearbeitet wird

**Gearbeitet wird gegen `staging`, nicht gegen `main`** (seit 4. August
2026): Zweig von `origin/staging`, Änderung, Zweig pushen, nach `staging`
mergen, `staging` pushen. **`main` wird aus der Sitzung heraus nicht mehr
angefasst** — was von `staging` nach `main` geht, entscheidet Jan.

Der Grund: `main` löst den Deploy aus. Bis dahin lag jede Änderung nach
zwei Minuten auf dem Produktivsystem, auch die, die man erst noch ansehen
wollte.

**Das Testsystem läuft** unter **staging.brauweg-spielen.de** — als eigene
Railway-*Umgebung* im selben Projekt, mit eigenem Postgres. Einzelheiten in
[STAGING.md](STAGING.md). Wichtigste Falle: Variablen gehören in Railway
je Umgebung; wer `STAGE` in der Produktion setzt, hat es auf staging nicht
gesetzt.

**Testkonten** (`account.is_staff`) haben alles: Premium, vollen
Münzstand, alles Kaufbare. Gesetzt wird das ausschließlich über
`STAFF_EMAILS` beim Start — kein Endpunkt, keine Oberfläche. Gefragt wird
an einer einzigen Stelle: `src/entitlements.ts`.

Vor dem Mergen immer `git fetch` — auf den Zweigen landen auch Commits aus
Cursor.

**`gh` ist nicht installiert**, und das Remote läuft über SSH. Pull
Requests lassen sich deshalb aus der Sitzung heraus nicht anlegen; gemerged
wird mit `git merge --ff-only`.

**Fragen vorab bündeln**, dann bis fertig durchbauen — nicht mittendrin
nachfragen.

**Bildbestellungen als Datei.** Neue Grafik wird nicht beschrieben, sondern
bestellt: eine Datei `docs/ASSETS-*.md` mit Maßen, Freihalte-Zonen,
Abnahmekriterien und einer Liste, was **nicht** ins Bild gehört. Der Nutzer
generiert danach und legt die Dateien unter `packages/client/public/hub/`
ab. Bis dahin laufen Platzhalter unter denselben Namen, damit der
Bildschirm vollständig funktioniert.

Drei Fehler sind dabei schon passiert und stehen deshalb in jeder
Bestellung: Schachbrett statt Alphakanal, eingebrannter Text, und
Originalauflösung unter `public/`.

**Migrationen** laufen in der Produktion automatisch (`MIGRATE_ON_BOOT` ist
gesetzt). Die Drizzle-Snapshots sind nicht durchgängig gepflegt —
`db:generate` erzeugt deshalb Anweisungen für längst vorhandene Spalten.
Migrationen werden von Hand geschrieben und im Journal eingetragen; zuletzt
`0010_testkonten` (eine Spalte `account.is_staff`, mit
`ADD COLUMN IF NOT EXISTS` — sie darf zweimal laufen, ohne zu brechen).

Die 0009 legt `account_game_theme` an und übernimmt die bisherigen Werte
aus `account.card_deck` und `account.table_scene` nach `doppelkopf`. **Die
beiden alten Spalten stehen absichtlich noch da** und werden nicht mehr
gelesen: Fällt ein Deploy zurück, läuft die vorige Fassung damit weiter.
Sie dürfen weg, sobald dieser Stand eine Weile stabil läuft.

---

## Stufen und Erfahrungspunkte

Steht seit dem 4. August. Zwei Regeln, mehr nicht:

1. **Eine gelegte Karte, ein Punkt.** Belohnt wird Mitspielen, nicht
   Gewinnen — wer verliert, geht nie leer aus.
2. **Doppelt für jeden mit positivem Trophäengewinn.** Bewusst am
   Vorzeichen festgemacht und nicht am Platz: Damit braucht die Plattform
   kein Spielwissen. Beim Doppelkopf trifft es die Plätze eins und zwei,
   beim Skat den Sieger, beim Zauberer jeden mit positivem Ergebnis.

**Keine Tabelle, eine Formel** (`packages/server/src/level.ts`). Der
Aufwand je Stufe wächst linear, die Summe damit quadratisch: 40, 60, 80 …
1000 für Stufe 50, insgesamt 25.480 Punkte. Eine Doppelkopf-Partie über
vier Runden gibt 48 Punkte, 96 für die vordere Hälfte — Stufe 50 sind also
rund 350 Partien. Die Kurve ist nach oben offen; eine Tabelle bis 50 wäre
bis Stufe 50 richtig und danach falsch.

**Die Stufe wird gerechnet, nicht gespeichert.** Sonst gäbe es zwei
Wahrheiten. In der Datenbank steht nur `account.xp` (Migration
`0011_erfahrung`). Der Client bekommt Stufe und Fortschritt fertig — wird
die Kurve nachjustiert, gilt das sofort und nicht erst nach dem nächsten
App-Update.

**Wie viele Karten eine Partie hatte, weiß nur das Modul.** Dafür gibt es
`GameModule.xpBasis`: Doppelkopf rechnet Blattgröße mal abgerechnete
Runden, der Zauberer die Summe der Rundennummern. Fehlt der Haken, gibt es
keine Punkte statt geratener. Nur abgerechnete Runden zählen — sonst wäre
Abbrechen kurz vor Schluss eine Rechenaufgabe statt einer Entscheidung.

Angezeigt wird es als Balken oben im Profil; angetippt öffnet sich die
Leiter (`/api/me/levels`, eigener Endpunkt, weil `/api/me` bei jedem Laden
läuft). Bildbestellung dafür: `docs/ASSETS-STUFEN.md` — bis dahin sind
Plakette und Balken einfache Farbflächen.

**Zum Ausprobieren einen Punktestand setzen** (es gibt bewusst keinen
Endpunkt dafür — ein Weg, sich selbst Punkte zu geben, wäre der lohnendste
Angriffspunkt der App):

```sql
UPDATE account SET xp = 330 WHERE email = 'DEINE-ADRESSE';
```

330 ergibt Stufe 5 mit 50 von 120 Punkten, also einem halb gefüllten
Balken. Die Grenzen: Stufe 2 ab 40, Stufe 3 ab 100, Stufe 4 ab 180,
Stufe 5 ab 280, Stufe 6 ab 400.

## Am 4. August fertig geworden

**Das zweite Spiel: Zauberer** (intern `wizard`, das international als
„Wizard" bekannte Stichspiel). Vollständig — Engine, Adapter, Server,
eigener Tisch, Bildbestellung. Regelwerk in `docs/wizard-spec.md`,
Gestaltung in `docs/DESIGN-WIZARD.md`.

- **Der Name ist Absicht.** „Wizard" ist eine eingetragene Marke (Ken
  Fisher / US Games Systems, hier Amigo). Regeln sind nicht schützbar, ein
  Produktname schon — und die App soll in den App Store. Die interne
  Kennung bleibt `wizard`, weil sie in Datenbankzeilen steht.
- **Die Trennung hat gehalten.** Für das zweite Spiel war am Server genau
  eine Zeile in der Registrierung nötig. Kein Schema, keine Migration:
  `game_id` ist eine Textspalte.
- **Zwei Plattform-Lücken sind dabei aufgefallen** und behoben:
  `PLACEMENT_TROPHIES` kannte nur drei bis fünf Sitze und hätte am Ende
  jeder Sechserpartie geworfen; und die Filterknöpfe der Tischauswahl waren
  fest auf „3er/4er" verdrahtet — sie kommen jetzt aus `seatCounts` des
  Moduls.
- **`rotationSize` ist beim Zauberer 1.** Die kanonische Rundenzahl
  (60 Karten / Spieler = 20/15/12/10) geht durch keine Sitzzahl auf, die
  Plattform verlangt aber ein Vielfaches der Geberrotation. Es weicht die
  Gleichverteilung, nicht die Spiellänge; die Begründung steht ausführlich
  in `ruleset.ts` und im Spec.
- **Der Spieltisch ist zerlegt.** Was jedes Kartenspiel braucht — Sitzplan,
  Avatar, Handkarte, Stichstapel, Zugtimer, letzter Stich, Regelblatt,
  Wartebereich, Partie-Ende — liegt jetzt in `packages/client/src/tisch/`.
  `Table.tsx` (Doppelkopf) und `WizardTable.tsx` bauen darauf auf.
  Doppelkopf blieb dabei unverändert: dieselben 127 Tests, gleicher Ablauf.
- **Acht Hausregeln** sind schaltbar: Der letzte sticht, Es darf nicht
  aufgehen, Bonus für angesagte Null, verdeckt ansagen, blinde erste Runde,
  Geber wählt blind, trumpffrei, Narr = Geber wählt. Der Kern (Bedienpflicht,
  Zauberer schlägt alles, 20 + 10 / −10) ist fest.
- **„Der letzte sticht"** dreht die Reihenfolge um: Dann gewinnt der zuletzt
  gelegte Zauberer statt des ersten, und ein Stich aus lauter Narren geht an
  den letzten Narren. Trumpf und Farbe bleiben unberührt — dort entscheidet
  die Höhe. Im Standard lohnt es, früh zuzustechen; mit der Regel lohnt es,
  abzuwarten.
- **Am laufenden Server geprüft**, nicht nur in Tests: Sechsertisch mit
  fünf Bots, komplette Runden, Punktetafel, und die blinde erste Runde.
- **Bildbestellung `docs/ASSETS-WIZARD.md`:** volles gemaltes Blatt
  (52 Zahlenkarten, vier verschiedene Zauberer, vier verschiedene Narren,
  Rücken), zwei Zauber-Szenerien, Trumpf-Plakette. Bis zur Lieferung läuft
  alles auf dem Textblatt — **kein Platzhalter nötig**, weil `cardImage`
  unbekannte Karten von selbst als Text zeigt.

**Die Bilder sind geliefert und eingebaut** (noch am selben Tag):

- **Blatt „Zauberwald"** unter `public/karten/zauberwald/`, 61 WebP-Dateien
  bei 360 × 523, zusammen 1,8 MB. Originale in `art/zauberwald/`.
- **Zwei Szenerien** (`zauberturm`, `sternenwiese`) — bewusst für **alle**
  Spiele wählbar: Eine Szenerie ist der Untergrund, keine Regel.
- **Trumpf-Plakette** als Hintergrundbild von `.wiz-trumpf`.
- **Blätter sind jetzt spielgebunden** (`Deck.games`). Der Wähler zeigt nur
  Passendes, und `deckForGame()` fällt auf Text zurück, falls im Konto ein
  unpassendes Blatt steht. Beides ist nötig: Ein Zauberblatt hat keine Dame,
  ein Doppelkopfblatt keine Sieben — auch die Minimal-Blätter nicht, die
  deshalb ebenfalls auf Doppelkopf beschränkt sind.
- **Themen werden jetzt groß vorgeführt.** Ein Tipp auf Blatt oder Szenerie
  übernimmt die Wahl **und** öffnet eine Vorschau im Tischformat: gewählte
  Szenerie, ein Stich in der Mitte, die eigene Hand am unteren Rand, alles in
  den Größen des echten Tisches. Der Grund: Auf zu dunklem Untergrund
  verschwinden Kreuz und Pik, und ein Daumennagel verrät das nicht.

**Nach den ersten echten Runden am Handy nachgebessert** — vier Sachen fielen
sofort auf, eine davon war größer als sie aussah:

1. **Blätter stahlen dem Filz ein Drittel der Höhe.** `.doko > *:not(.doko-bg)`
   setzte `position: relative` und holte damit auch die Blätter zurück in den
   Fluss; als Flex-Kind nahm ein offenes Blatt Höhe weg. Am Zaubertisch ist
   fast durchgehend eines offen (Ansage), deshalb fiel es dort auf — **beim
   Doppelkopf war derselbe Fehler nur unsichtbar**, weil Vorbehalt und
   Pflichtansage nur Sekunden stehen. Gemessen: Filz 285 statt 585 Pixel.
2. **Die Trumpf-Plakette lag auf dem linken Mitspieler.** Sie stand auf halber
   Höhe — genau dort sitzt in jeder Verteilung jemand. Jetzt unten links, wo
   in keiner Sitzverteilung etwas liegt.
3. **Der Plakettenrahmen passte nicht zur Karte.** Das Bild wurde auf eine
   Fläche gezogen, deren Seitenverhältnis nicht stimmte, und die Beschriftung
   lag auf der Karte. Jetzt trägt der Rahmen die Bildränder als Polsterung
   (9,2 % seitlich, 4,2 % oben) und die Karte sitzt in seinem Fenster.
4. **Drei Handkarten lagen übereinander**, obwohl die halbe Breite frei war.
   Der Kartenabstand hing an der festen Zwölf des Doppelkopfs; er hängt jetzt
   an der Handgröße.

Dazu: In der blinden Runde wird die verdeckte Karte **angetippt** statt über
einen Knopf gespielt, und sie zeigt den Rücken des gewählten Blattes statt des
Textblatt-Musters.

**Was das kostet:** `packages/client/art/` wächst um 25 MB (die gelieferten
PNG-Originale). Das folgt der Regel aus `DESIGN.md` — Originale gehören ins
Repository, nicht unter `public/`. Wer den Klon klein halten will, muss diese
Regel ändern, nicht diese Dateien einzeln löschen.

### Startbildschirm nachgebessert (nach Handy-Rückmeldung)

- **Zwischen den Tabs wird gezogen, nicht nur getippt** (`GameSelect.tsx`,
  `.front-viewport`/`.front-track` in `styles.css`). Beim waagerechten Ziehen
  folgt der Inhalt dem Finger, die Nachbarseite schaut herein, beim Loslassen
  rastet sie ein oder federt zurück. Der laufende Zug steuert den Track
  **direkt über eine Referenz** — kein Rendern je Fingerbewegung, sonst
  ruckelt es; gerendert wird nur bei Zugbeginn (um die Nachbarn zu hängen) und
  beim Einrasten. **Nachbarn hängen nur während eines Zugs am Baum**, damit
  der Startbildschirm nicht alle fünf Tabs auf einmal lädt. Nur klar
  waagerechte Züge zählen, am Rand ohne Nachbar gibt es Gummiband, und in
  einer Vollbild-Auswahl (Spielwahl, Vorschau, Kommt-bald) steuert der Zug die
  Auswahl statt den Tab. Zwei Stellschrauben, falls das Gefühl am Gerät nicht
  stimmt: die Einrast-Schwelle (`Math.min(72, breite * 0.22)`) und die
  Rand-Dämpfung (`* 0.32`).
- **Der Pinguin steht im unteren Drittel, nicht mittig** (`Pfad.tsx`,
  `FIGUR_VON_OBEN = 2/3`). Er startet unten und steigt höchstens bis an die
  Grenze des unteren Drittels — gemessen 63 % von oben bei 550 Trophäen.
- **Große Zahlen in der Kopfzeile abgekürzt** (`kompakteZahl` in `i18n.ts`):
  `550 · 1,5K · 12K · 10M`. Der siebenstellige Testkonto-Münzstand (9.999.999)
  schob sonst Name und Level ineinander. Zusätzlich gibt der Name bei Enge
  zuerst nach (`front-spieler { flex: 1 1 auto }`), die Anzeigen rechts
  behalten ihre Breite.
- **Checkpoint-Marke tritt zurück, wenn der Pinguin darauf steht.** Bei genau
  500 saßen Pinguin und Feuerberg-Marke auf derselben Mittellinie; jetzt
  blendet sich die Marke aus, solange die Figur näher als eine Drittelkachel
  darauf steht (`is-verdeckt`).

Alles am laufenden Server mit einem Staff-Konto (550 Trophäen, 9.999.999
Münzen) durchgemessen: Münzen „10M+" ohne Überlappung, Pinguin bei 63 %,
Zug mit Nachbar-Vorschau, Einrasten, Zurückfedern, senkrechtes Ziehen ohne
Wechsel, Rand-Gummiband, Guard in der Spielauswahl.

---

## Am 3. August fertig geworden

- **Gemalte Hintergründe** für Tischauswahl, Tisch erstellen und Spieltisch.
- **Clans vollständig** (Plan 9.3): gründen, suchen, beitreten — offen oder
  auf Anfrage mit Warteschlange —, Mitgliederliste, Rangstufen
  (Anführer, Vize, Ältester, Mitglied), Rauswurf, Austritt,
  Admin-Nachfolge bei Kontolöschung.
- **Acht Tischszenerien**, persönlich wählbar wie das Kartenblatt, mit
  Vorschau auf echten Karten.
- **Abschlussbildschirm** gestaltet, mit gemalten Medaillen.
- **Startseite** randlos, gemalte Wegpunkte und Ortsschilder, Knöpfe über
  dem Bild.
- **Handkarten** als gerade Reihe von Rand zu Rand, die mit jeder gespielten
  Karte zusammenrückt; Legeanimation beim Tippen, Schütteln bei gesperrten
  Karten, keine Hervorhebung.
- **Fehler behoben:** Der Erstellen-Bildschirm schaltete jede Regel ab, auch
  Hochzeit und Armut — wer zwei Kreuz-Damen hielt, bekam sie nicht
  angeboten.
- **Kontolöschung** in der Oberfläche, mit Passwortabfrage. `DELETE /api/me`
  verlangt jetzt das Passwort im Rumpf; vier neue Servertests decken
  richtig, falsch, fehlend und nicht angemeldet ab.
- **Impressum und Datenschutzerklärung** als eigenständige Seiten unter
  `packages/client/public/rechtliches/`, verlinkt aus Anmeldung und Profil.
  Echte Adressen statt eines Blattes in der App, weil App Store Connect
  eine aufrufbare Datenschutz-Adresse verlangt und die Impressumspflicht
  auch den trifft, der sich nie anmeldet.
- **Bildbestellung `docs/ASSETS-MENUE.md`:** sieben dehnbare Bausteine für
  alle Menüblätter — Blattgrund, Eingabefeld, drei Knöpfe, Umschalter an
  und aus. Bewusst **ohne** Platzhalter, siehe die Begründung am Ende der
  Bestellung. Geliefert und eingebaut: `border-image` mit `fill`, das
  Randmaß im Bild wird über `border-image-width: 1` auf die tatsächliche
  `border-width` heruntergerechnet.
- **Anmeldung gestaltet.** Sie war der einzige Bildschirm ohne eine
  einzige CSS-Regel. Erbt jetzt den gemalten Satz aus den Menüblättern,
  dazu der bestellte Hintergrund. Der zweite Knopf ist eine Textzeile — er
  wechselt den Modus und ist keine Handlung wie „Anmelden".
- **Trophäenpfad aus sechs Biom-Kacheln**, angetippt scrollbar im
  Vollbild, öffnet an der Stelle des Pinguins. Die zwanzig von Hand
  vermessenen Stützpunkte sind **weg**: Nachgemessen weicht der Weg auf
  den gelieferten Kacheln im Mittel 1,4 bis 2,9 % von der Mittellinie ab,
  höchstens 9,8 % — auf einem Handy wenige Pixel. Der Weg ist die Mitte.
  Ein siebtes Biom ist ein Bild plus eine Zeile in `BIOME`.
- **Mails mit HTML-Fassung** (`src/mail/vorlage.ts`). Tabellen und Stile
  am Element, weil Outlook über die Word-Engine rendert. Kopfbild als
  **JPEG**, nicht WebP — Outlook zeigt WebP nicht an. Überschrift und Link
  stehen zusätzlich als Text da, weil viele Programme Bilder erst nach
  Bestätigung laden.

---

## iOS

**Die App steht und läuft im Simulator.** Eigenes Repository
`Brauweg-spiel-ios` neben diesem: eine SwiftUI-Hülle um einen `WKWebView`,
die den gebauten Client aus dem App-Paket ausliefert. **Kein Capacitor** —
die Begründung und alle Einzelheiten stehen in `docs/APPSTORE.md`.

Der eine Eingriff hier im Repository ist die **Anmeldung**: Für den Server ist
die App eine fremde Herkunft und bekommt kein Cookie. Sie trägt ihr Token
selbst, per `Authorization`-Kopf und am WebSocket als Unterprotokoll. Die
frühere Empfehlung `sameSite: none` trägt nicht — für `fetch` ließe sie sich
noch retten, für den WebSocket nicht, und dort hängt der Spieltisch. Siehe
`docs/SICHERHEIT.md`.

**Im Browser ändert sich dadurch nichts.** `packages/client/src/laufzeit.ts`
fällt ohne `window.BRAUWEG_APP` auf das bisherige Verhalten zurück.

**Der Shop erscheint im App-Paket nicht** (`zeigeKaufbares` in
`GameSelect.tsx`) — im Browser bleibt er sichtbar, dort gilt weiter die Regel
aus `DESIGN.md`.

**Vor jedem Bauen der App einmal `./scripts/web-uebernehmen.sh` im
iOS-Repository laufen lassen.** Ohne das liegt kein Client im Paket; die App
sagt das dann im Klartext, statt weiß zu bleiben.

**Prüfstand jetzt: 118 Engine-Tests, 125 Servertests** (acht neue für die
Token-Anmeldung, `test/app-huelle.test.ts`).

---

## Was offen ist

### Vor dem App-Store-Release zwingend

1. ~~Kontolöschung in der Oberfläche~~ — **erledigt.** Profil-Tab ganz
   unten, kleiner Textknopf unter „Abmelden", dann ein Blatt mit Warnung
   und Passwortabfrage. Das Passwort ist Absicht: Die Sitzung hält dreißig
   Tage, ohne die Frage genügte ein kurz aus der Hand gelegtes Handy.
2. ~~Versanddienst für E-Mail~~ — **erledigt, läuft.** Resend über die
   verifizierte Domain `brauweg-spielen.de`, DKIM und SPF als TXT bei
   Strato, der MX für den Return-Path auf der eigens angelegten Subdomain
   `send`.

   **Zwei Strato-Eigenheiten, die Zeit gekostet haben:** Die MX-Maske der
   Hauptdomain kennt kein Präfix und keine Zahl als Priorität, nur
   „niedrig"/„hoch". Deshalb die Subdomain `send` mit eigener
   MX-Einstellung — der MX der Hauptdomain darf **nicht** angefasst
   werden, dort hängt eine aktive Mailbox. Und Resend wollte Priorität 10,
   Strato macht daraus 20; das stört nicht, bei einem einzigen MX-Eintrag
   ist die Zahl bedeutungslos. Die Meldung „Invalid SPF MX" verschwand von
   selbst, sobald der MX propagiert war.

   **Merke fürs nächste Mal:** Steht im Log `=== MAIL an …`, läuft der
   Server ohne Versanddienst — das ist der `ConsoleMailer`. Fehlt
   `RESEND_API_KEY`, schreibt der Start außerdem eine Zeile mit `ACHTUNG`.
   Diese beiden Suchen beantworten die Frage in einer Sekunde.
3. **Rechtstexte: Gerüst steht, Angaben fehlen.** `/rechtliches/impressum.html`
   und `/rechtliches/datenschutz.html` sind angelegt und aus Anmeldung und
   Profil verlinkt. Die offenen Stellen sind **rot umrandet** — Name,
   Anschrift, Support-Adresse, Datenbankanbieter, Aufbewahrungsdauer der
   Protokolle. **Solange Platzhalter drinstehen, erfüllen die Seiten die
   Pflicht nicht.** Der Datenschutztext beschreibt, was die Anwendung
   tatsächlich tut (am Code geprüft), ersetzt aber keine Rechtsberatung.
4. Demokonto für die Prüfer — Einzelheiten in `docs/APPSTORE.md`. Wichtig
   ist der Hinweis, dass die Prüfer freie Plätze mit Bots füllen können; wer
   allein in einer leeren Lobby steht, meldet „App funktioniert nicht".
5. ~~Capacitor-Hülle und getrennte API-Adresse~~ — **erledigt**, aber anders
   als geplant: eigene Swift-Hülle statt Capacitor. Siehe oben und
   `docs/APPSTORE.md`.

### Aus dem Plan noch nicht gebaut

- **Vereinseigener Regelsatz je Spiel.** Das Schema hat nur eine einzelne
  Spalte; ohne zweites Spiel ist nicht entscheidbar, wie die Zuordnung
  aussehen soll.
- **Vereinspunkte und die zwei Ranglisten.** Die Berechnungsformel steht in
  `docs/plattform-plan.md` selbst noch unter den offenen Fragen.
- **Clanchat, Clantruhe, Clankrieg.** Stehen als Knöpfe da und melden
  „kommt bald" — so gewollt. Chat braucht Moderation (M8).
- **Bild-Upload für Szenerien.** Bewusst zurückgestellt: ein hochgeladenes
  Vollbild braucht Moderation, und die steht aus.

### Rund um das zweite Spiel noch offen

- ~~Die Rangliste zeigt nur Doppelkopf.~~ **Erledigt.** Das Ranglisten-Blatt
  hat jetzt Reiter: „Gesamt" (Summe über alle Spiele, `/api/rankings`) und je
  spielbarem Spiel einen (`/api/rankings/:gameId`). Die Reiter kommen aus den
  spielbaren Spielen, nicht aus fester Verdrahtung — ein drittes Spiel steht
  von selbst dort; bei nur einem Spiel bleiben sie weg (`RanglisteBlatt` in
  `GameSelect.tsx`, `.front-ranking-tabs`).
- **„Neu hier?" bleibt eine Bald-Attrappe** — bewusst so: Die Beta-Spieler
  kennen alle Spiele, ein Tutorial braucht es dafür nicht. Der frühere feste
  Doppelkopf-Text ist raus, der Knopf ist jetzt spielneutral („So funktioniert
  Brauweg").
- **Bot mit Kartengedächtnis** für den Zauberer ist bewusst zurückgestellt
  (Spec Abschnitt 14). Der jetzige Bot spielt solide auf sein Soll, merkt sich
  aber keine gespielten Zauberer/Trümpfe.

### Zauberer-Tisch: dieselben Animationen wie Doppelkopf

Der Zauberer-Tisch teilt Bausteine und CSS mit dem Doppelkopf, hatte aber drei
Tisch-Bewegungen noch nicht. Jetzt angeglichen:

- **Austeil-Zeremonie, verkürzt.** `DealCeremony` gibt es jetzt in zwei
  Taktungen (`VOLL`/`KURZ`); der Zauberer nutzt die kurze, weil er jede der bis
  zu zwanzig Runden neu gibt. Ausgelöst am Rundenbeginn (volle Hände, kein
  Stich, `roundNumber` als Schlüssel), einmal je Runde, Beitritt mitten in der
  Runde zeigt sie nicht. Die zwei hohen Sechser-Sitze (`to-left-high`/
  `to-right-high`) fehlten in den Flugbahnen und sind ergänzt.
- **Trumpf dreht sich auf.** Solange ausgeteilt wird, liegt an der Plakette ein
  Rücken; danach dreht sich die aufgedeckte Karte einmal auf (`wiz-trumpf-auf`).
- **Stich zieht zum Gewinner.** Nutzt Cursors `tc-sweep` (auf staging schon für
  Doppelkopf gebaut), erweitert um die zwei hohen Sechser-Sitze
  (`sweep-left-high`/`sweep-right-high`).

### Kleinkram

- Die Rolle **„Ältester"** hat noch keine Sonderrechte; sie verhält sich wie
  „Mitglied" und ist bisher nur eine Auszeichnung.
- **`pinguin-geburtstag.png`** und die Symbolvorlage liegen unter
  `packages/client/art/`.
- **Tab-Leiste am Spieltisch: entschieden — sie kommt nicht.** Der Entwurf
  zeigte sie, der Tisch bleibt trotzdem Vollbild. Drei Gründe: Ein
  Fehlgriff mitten im Stich lässt drei Leute sitzen und kostet nach drei
  Zeitüberschreitungen zehn Trophäen; der Tisch ist ein konzentrierter
  Modus, der Weg hinaus soll eine Entscheidung sein; und die Handkarten
  reichen seit „gerade Reihe von Rand zu Rand" bis an die untere Kante —
  eine Leiste dort schnitte genau in die Fläche, deren Abschneiden erst
  kürzlich als Fehler behoben wurde. Wer zwischendurch in den Clan will,
  nimmt Zurück; der Server schickt beim Zurückkommen die volle Sicht.

---

## Was in der letzten Sitzung schieflief

Damit es nicht zweimal passiert:

- **Railway lieferte stundenlang einen alten Stand aus, ohne zu meckern.**
  Ins Feld „Watch Paths" im Dienst war der komplette Inhalt von
  `railway.json` hineinkopiert worden. Das Feld erwartet Glob-Muster, eine
  Zeile je Pfad — es bekam `{`, `"$schema": …`, `"builder": "NIXPACKS"`.
  Keines dieser „Muster" trifft je auf eine Datei zu, also fand Railway
  bei jedem Push null Änderungen und übersprang still mit „No changes to
  watched files". **Das Feld gehört leer**; dann greift `watchPatterns`
  aus `railway.json`, und dort steht `["**"]` bereits richtig.
- **Ein Redeploy holt keinen neuen Commit.** Er wiederholt die bestehende
  Auslieferung — im Zweifel also genau den alten Stand, den man loswerden
  wollte. Er meldet trotzdem „Deployment successful". Nach einer solchen
  Panne hilft ein frischer Push, nicht der Redeploy-Knopf.
- **Woran man es von außen erkennt**, ohne Zugang zu Railway: Die
  ausgelieferte `index.html` nennt die gehashten Bundlenamen. Weichen sie
  von denen aus dem eigenen `npm run build` ab, läuft dort ein anderer
  Stand — und die Dateigrößen unter `/hub/` lassen sich genauso
  vergleichen. Das beantwortet in zehn Sekunden, ob es am Server liegt
  oder am Browser.
- **Bilder vor dem Umwandeln auf den Zeitstempel prüfen.** Eine
  nachgebesserte Kachel lag bereits auf der Platte, während ich noch die
  neun Minuten ältere Fassung beurteilt und ausgeliefert habe.
- **In einem git-Arbeitsbaum liegt kein eigenes `node_modules`.** Node
  sucht nach oben und findet `C:\Brauweg\node_modules` — dort zeigt
  `@brauweg/game-api` auf die Pakete des **Hauptcheckouts**. Eine Änderung
  am Paket im Arbeitsbaum ist für den Server dort also unsichtbar, und
  `tsc` meldet Typfehler, die im Quelltext längst behoben sind. Abhilfe:
  einmalig Verzeichnis-Junctions von `<arbeitsbaum>/node_modules/@brauweg/*`
  auf die eigenen `packages/*` legen. `node_modules` ist ignoriert, das
  bleibt lokal.

- **`git add -A` sammelt ein, was gerade im Ordner liegt.** So sind 13,9 MB
  gelieferte Original-PNGs in `public/` gelandet und ausgeliefert worden.
  `.gitignore` kennt jetzt `tmp-*/`; die Regel steht in `docs/DESIGN.md`.
- **PNG8 mit 200 Farben kostet sichtbar Tiefe.** Die Weltkarte hatte 4 %
  mittlere Abweichung; WebP bei Qualität 85 war halb so groß und doppelt so
  genau. Deshalb WebP.
- **ImageMagick füllt beim SVG-Rendern weiß**, wenn `-background none`
  fehlt. Zwei Platzhalter gingen mit weißem Kasten live.
- **CSS-Regeln werden oft von späteren überschrieben.** Vor jeder Änderung
  prüfen, ob es eine zweite, spezifischere Regel gibt — sonst greift die
  Änderung nicht und man sucht an der falschen Stelle.
