# Kartenspiel-Plattform — Umsetzungsplan

Übergabedokument für die Umsetzung mit Claude Code.

**Produktname: Brauweg.** Entschieden am 01.08.2026. Domain
**brauweg-spielen.de** (zum Zeitpunkt der Entscheidung frei, Registrierung über
Strato). Paket-Namensraum im Code: `@brauweg/*`.

Damit sind die drei Dinge freigegeben, die auf den Namen gewartet haben:
Domain-Registrierung, Repository-Anlage und erste Datenbank-Migration.

---

## 1. Zielbild

Eine App für mehrere klassische Kartenspiele: Doppelkopf, Skat, Schafkopf,
Rommé, Mau-Mau. Man wählt beim Start das Spiel, spielt an Tischen mit **frei
konfigurierbaren Regelsätzen**, und es gibt Ranglisten je Spiel sowie eine
spielübergreifende Gesamtwertung.

### Marktlage, ehrlich

Mehrere Kartenspiele unter einem Dach ist **kein** Alleinstellungsmerkmal. Die
Spiele-Palast GmbH deckt Doppelkopf, Skat, Schafkopf, Rommé, Mau-Mau und
weitere bereits ab, ebenso StammtischGames einen Teil davon.

Zwei Dinge sind bei den Großen aber tatsächlich offen:

1. **Frei konfigurierbare Regelsätze.** Die Wettbewerber spielen nach festen
   Hausregeln. Das bleibt das eigentliche Unterscheidungsmerkmal.
2. **Eine App statt getrennter Apps je Spiel, mit gemeinsamer Rangliste.** Der
   Palast führt Doppelkopf Palast, Skat Palast und Schafkopf Palast getrennt.

Das Produktversprechen lautet also nicht "viele Spiele", sondern "spiel nach
euren Regeln, über alle Spiele hinweg gewertet".

### Ausdrücklich nicht im Plan

Ein Auto-Battler. Das ist ein anderes Genre, nicht ein weiteres Kartenspiel:
eigene Karten, eigene Grafik, laufendes Balancing, kaum
Publikumsüberschneidung mit dem Doppelkopf-Verein. Als Fernziel möglich, aber
er darf keine Architekturentscheidung von heute beeinflussen.

---

## 2. Was fertig ist

### Doppelkopf-Engine

TypeScript, 97 Tests, keine Laufzeitabhängigkeiten. Vollständiges Regelwerk,
Regelsatz-Validator, Rundenablauf-Maschine mit Sichtbarkeitsfilter,
Partie-Maschine mit Geberrotation und Bock, Bot, Trophäenberechnung.

### Spielmodul-Schnittstelle (`game-api`)

`GameModule` beschreibt, was ein Kartenspiel können muss. Server, Lobby und
Client kennen **nur** diese Schnittstelle und wissen nicht, dass es Doppelkopf
gibt. Ein weiteres Spiel ist damit ein neues Paket, kein Eingriff in Server
oder Client.

### Doppelkopf-Adapter

Erfüllt die Schnittstelle mit der bestehenden Engine. **Prüft typfehlerfrei
gegen den echten Engine-Code**, die Abstraktion trägt also nachweislich. Die
Engine selbst blieb unverändert.

Zwei Dinge ergänzt der Adapter, weil die Engine sie bewusst nicht kennt:

- Zusammenführung von Rundensicht und Partiestand
- **Zuschauersicht ohne jede Hand** (`spectatorView`)

---

## 3. Architekturgrundsätze

Diese Punkte sind der Grund, warum jetzt umgebaut wird und nicht später:

1. **Ein Spielmodul ist eine reine Logikbibliothek.** Kein Netzwerk, keine
   Datenbank, keine Uhr, kein Zufall außer dem Seed. Gleicher Zustand plus
   gleiche Aktion ergibt immer gleiches Ergebnis.
2. **Sichtbarkeit entsteht ausschließlich in `viewFor`.** Der Client bekommt
   nie den vollen Zustand und blendet nichts selbst aus.
3. **Trophäen sind nicht Teil eines Spielmoduls.** Ein Modul liefert nur
   Platzierungen, die Plattform rechnet daraus die Wertung. Genau deshalb
   funktioniert eine spielübergreifende Rangliste ohne Umbau.
4. **Regelsatz und Währung bleiben getrennt.** Ein Regelsatz enthält niemals
   Einsatz, Topf oder Preise.
5. **Nichts wird doppelt implementiert.** Die Module laufen unverändert auf
   Server und Client.

### Paketstruktur

```
packages/
  game-api/            Schnittstelle, kennt kein einzelnes Spiel
  game-doppelkopf/     bestehende Engine + Adapter
  game-skat/           spaeter
  server/              Tische, Konten, Ranglisten, WebSocket
  client/              React PWA
```

---

## 4. Beta-Abgrenzung

Die Beta beantwortet eine Frage: Fühlt sich das Spielen zu viert mit einem
selbst gebauten Regelsatz gut an?

**Enthalten:** Registrierung mit E-Mail-Bestätigung und Einladungscode,
Spielauswahl, Lobby mit Filtern, Regelsatz-Editor, Spieltisch,
Rundenabrechnung, Partie-Ende, Revanche, Bot und Timeouts, Emotes,
Freundesliste.

**Spielbar ist nur Doppelkopf.** Skat, Schafkopf, Rommé und Mau-Mau erscheinen
in der Spielauswahl als Vorschau, **mit Abstimmung, welches zuerst kommt.**

Das ist zugleich der günstigste Marktforschungsmoment, den du bekommst: Die
Reihenfolge der nächsten Monate wird von den Leuten bestimmt, die tatsächlich
spielen.

**Nicht in der Beta:** Werbung, Abo, Münzen und Shop, Trophäen und Ranglisten,
Vereine, Missbrauchserkennung, Push, iOS.

**Trotzdem sofort mitzudenken:** Protokollversionierung (siehe 6.3),
Internationalisierung über Schlüssel, Trophäen- und Vereinsfelder im
Datenmodell, aggregierte Statistikzähler ab dem ersten Tag,
Sichtbarkeitsfilter serverseitig, und `game_id` an jedem Tisch, Regelsatz und
Ergebnis.

---

## 5. Entscheidungsübersicht

| Bereich | Entscheidung |
|---|---|
| Reihenfolge | Web zuerst, iOS danach via Capacitor |
| Hosting | Railway (EU), Code auf GitHub, Domain über Strato |
| Name und Domain | Brauweg, `brauweg-spielen.de` |
| Datenbank | PostgreSQL |
| Datenbankzugriff | Drizzle, Migrationen über drizzle-kit |
| Anmeldung | E-Mail und Passwort, Bestätigungslink vor erster Anmeldung |
| Beta-Zugang | ein gemeinsamer, mehrfach nutzbarer Einladungscode |
| Sprache | Deutsch, Englisch technisch vorbereitet |
| Layout | Hoch- und Querformat |
| Optik | Dunkel, reduziert, kontrastreiche Karten |
| Blattbild | Französisch Standard, deutsches Blatt später kaufbar |
| Kartensortierung | Automatisch nach Trumpfordnung |
| Kommunikation | Vorgefertigte Emotes, kein Freitext |
| Zuschauen | Freunde und Verein, **neutrale Sicht ohne Hände** |
| Gesamtrangliste | Summe der Trophäen über alle Spiele |
| Rechtsträger | Unternehmen kommt zur Beta dazu |

---

## 6. M4 — Server und Persistenz

### 6.1 Zustandshaltung

**Der Server hält die laufende Partie maßgeblich im Arbeitsspeicher und
schreibt nach jeder Aktion einen Snapshot in die Datenbank.**

Railway startet den Container bei jedem Deploy neu; reiner Arbeitsspeicher
würde alle laufenden Tische verwerfen. Serialisierung läuft über
`GameModule.serialize`, der Server kennt den Inhalt nicht.

Dass alle vier dasselbe sehen, folgt nicht aus der Speicherung, sondern aus der
Serverhoheit: Kein Client berechnet Zustand.

### 6.2 Datenmodell (Postgres)

```
account            id, email, email_verified_at, password_hash, display_name,
                   created_at, premium_until, coins, anonymized_at
account_game_stat  account_id, game_id, trophies, highest_checkpoint,
                   parties, wins          -- Rangliste je Spiel
invite_code        code, max_uses, uses, active
game_vote          account_id, game_id    -- Abstimmung ueber Vorschau-Spiele
rule_set           id, game_id, owner_account_id, club_id, version, name,
                   config jsonb
table_             id, game_id, rule_set_id, rule_set_version, visibility,
                   club_id, status, seats, max_rounds, created_at,
                   last_activity_at, filters jsonb
table_seat         table_id, seat_index, account_id, is_bot, joined_at
party              id, table_id, game_id, seed, rounds, status,
                   started_at, ended_at
party_snapshot     party_id, revision, state jsonb, updated_at
round_summary      party_id, round_index, summary jsonb
trophy_ledger      account_id, game_id, party_id, delta, reason, created_at
stat_counter       account_id, game_id, key, value      -- dauerhaft
pairing_log        account_a, account_b, party_id, created_at
block              account_id, blocked_account_id
friendship         account_a, account_b, status
club               id, name, admin_account_id, default_rule_set_id,
                   join_mode, min_trophies, max_members
club_member        club_id, account_id, role, joined_at
report             reporter_id, target_id, reason, free_text, created_at
purchase           account_id, sku, provider, amount, created_at
```

**`game_id` gehört an Tisch, Regelsatz, Partie und Statistik.** Das
nachzurüsten wäre eine Migration über alle Kernfelder.

`round_summary` speichert bewusst nur `jsonb`: Die Struktur einer Runde ist
spielabhängig, der Server darf sie nicht kennen.

**Aufbewahrung:** `party_snapshot` und `round_summary` nur für die **letzten 20
Partien** je Account. `stat_counter` dauerhaft und aggregiert, damit die
Premium-Statistiken darüber hinaus funktionieren. `pairing_log` schlank und
länger, ausschließlich für Missbrauchserkennung. `trophy_ledger` dauerhaft.

**Kontolöschung** erfolgt als **Anonymisierung**. Würde man Zeilen entfernen,
zerfielen die Partiehistorien aller Mitspieler. Personenbezug ist weg,
Nachvollziehbarkeit bleibt.

### 6.3 Protokoll — harte Vorbedingung

WebSocket. **Jede Nachricht trägt Spielkennung und Protokollversion. Das gehört
in die erste Zeile Servercode, nicht in eine spätere Aufräumrunde.**

Grund: Die Webversion ist nach dem Deploy sofort aktuell, ein App-Store-Update
dauert Tage und wird erst nach Wochen installiert. An einem Tisch sitzen dann
ein Client von heute und einer von vor drei Wochen. Mit mehreren Spielen
verschärft sich das, weil jedes Modul seine eigene `protocolVersion` hat.

```
Client -> Server   { v, game, type: "action", tableId, action }
Server -> Client   { v, game, type: "view",   tableId, revision, view }
                   { v, game, type: "party",  tableId, standings }
                   { v, type: "error", code, messageKey }
```

Regeln:

1. **Nur additive Änderungen.** Neue Felder ja, umbenannte oder entfernte nein.
2. **Server unterstützt mindestens die letzten zwei Versionen je Modul.**
3. **Mindestversion beim Tischbeitritt erzwingen**, nicht mitten in der Partie.
4. **Regelsatz-Version mitschicken.** Kennt ein Client eine Option nicht, lehnt
   er den Tisch ab, statt falsch darzustellen.
5. **Revisionsnummer je Zustand.** Der Client verwirft veraltete Nachrichten.

**Der Server validiert jede Aktion doppelt:** erst, dass der Absender für
seinen eigenen Sitz handelt, dann über `GameModule.act`, ob die Aktion
regelkonform ist.

### 6.4 Reconnect

Reconnect ist der Normalfall: iOS trennt die Verbindung bei jedem Sperren des
Bildschirms. Verbindungsverlust pausiert nichts, der Zugtimer läuft weiter.
Beim Wiederverbinden schickt der Server die vollständige aktuelle Sicht plus
Partiestand. Der Client hält keinen eigenen Verlauf.

### 6.5 Timeouts, Verlassen, Tischende

- **60 Sekunden** je Zug, serverseitig gemessen
- Läuft er ab: Bot spielt, **Spieler bleibt am Tisch**
- **Drei aufeinanderfolgende Timeouts** gelten als Verlassen
- Dann: laufende Runde mit Bot zu Ende, **eine Karenzrunde**, dann Auflösung
- **Push beim Rauswurf** (ab iOS-Ausbaustufe): die Chance zurückzukommen
- **Strafe:** −10 Trophäen im betroffenen Spiel plus Wertung als Letzter,
  **durchbricht den Checkpoint-Schutz**
- Punkte gehen an den Account, nie an den Bot
- **Bot-Übernahme ist für alle sichtbar**
- Lobby verlassen vor Spielstart ist straffrei
- **Kontolöschung während laufender Partie gilt als Verlassen**
- **Alle Sitze offline:** nach 5 Minuten Auflösung **mit Wertung**
- **Tisch ohne Aktivität:** verfällt nach 24 Stunden

### 6.6 Lobby und Tische

- **Erste Ebene ist die Spielauswahl**, danach erst die Tischliste
- Sichtbarkeit: öffentlich, auf Anfrage, nur Vereinsmitglieder
- **Start automatisch bei vollen Plätzen, mit kurzem Countdown zum Abbrechen**
- Filter: Spielerzahl, Rundenzahl, Trophäenbereich, einzelne Sonderregeln.
  Die verfügbaren Filter kommen aus dem Spielmodul, nicht aus fester Verdrahtung
- Nachrücker-Warteschlange, Menschen bevorzugt
- Namen eindeutig und änderbar, Änderung immer kostenpflichtig
- Blockierte Spieler nur bei öffentlichen Tischen ausgeschlossen

**Rundenobergrenzen:**

| Tischart | Maximum | Pausieren |
|---|---|---|
| Öffentlich und privat | 20 Runden | nein |
| Vereinstisch | 100 Runden | ja |

Öffentliche Tische müssen in einer Sitzung durchlaufen, daher die niedrigere
Grenze. Die zulässigen Rundenzahlen liefert das Modul über `suggestedRounds`,
weil die Geberrotation spielabhängig ist.

**Revanche:** Alle müssen zustimmen, Frist **30 Sekunden**, Schweigen gilt als
Ablehnung.

### 6.7 E-Mail

Bestätigungslink vor der ersten Anmeldung, dazu Passwort-Zurücksetzen.
Erfordert einen Versanddienst (Resend, Postmark). Selbst versendete Mails
landen zuverlässig im Spam.

---

## 7. M5 — Client (Web)

React als PWA, später via Capacitor für iOS, **eine Codebasis**.
Internationalisierung von Anfang an über Schlüssel.

### 7.1 Gestaltung

- **Dunkle, ruhige Tischfläche**, damit die Karten der einzige helle Bereich
  sind
- **Große, kontrastreiche Kartenwerte.** Auf dem Handy liegen zwölf Karten
  nebeneinander, von den meisten ist nur ein schmaler Streifen sichtbar. Farbe
  und Wert müssen in diesem Streifen stehen
- Sparsame Animationen, Hoch- und Querformat

### 7.2 Bildschirme

Anmeldung, **Spielauswahl**, Lobby, Tisch erstellen, Wartebereich, Spieltisch,
Rundenabrechnung, Partie-Ende, Profil, Einstellungen mit Kontolöschung.
Später: Verein, Shop.

**Spielauswahl:** spielbare Spiele oben, Vorschau-Spiele darunter mit Hinweis
und Abstimmungsknopf.

### 7.3 Spieltisch

Der Client baut seine Schaltflächen aus `legalActions` und `viewFor`. **Er
bildet keine Regeln nach**, sonst entstehen zwei Wahrheiten.

- Handkarten automatisch nach Trumpfordnung sortiert
- Nur legale Karten anwählbar, illegale sichtbar abgedunkelt
- Zugtimer als Balken
- Ansage-Schaltflächen mit sichtbarer Restfrist
- Pflichtansage-Dialog: ab 30 Augen nur Bestätigen, bei 29 ablehnbar
- Letzter Stich, Punktestand und Kartenanzahl jederzeit sichtbar
- Armut in zwei getrennten Schritten
- Bot-Übernahme deutlich markiert

### 7.4 Abrechnungsansicht

Wichtiger als sie klingt. Bei multiplikativen Ansagen und Bock will jeder
nachvollziehen, wie 48 Punkte zustande kamen. Ist das intransparent, wird jedes
ungewohnte Ergebnis als Fehler gemeldet. Additive Posten einzeln, dann
Ansagen-Faktor, dann Bock-Faktor, dann Verteilung.

### 7.5 Emotes

| Gruppe | Sprüche |
|---|---|
| Höflich | Gut gespielt, Danke, Schönes Spiel, Viel Glück |
| Spielbezogen | Gut geschmiert, Der saß, Da war nichts zu machen |
| Reaktion | Autsch, Puh knapp, Endlich |
| Selbstkritik | Mein Fehler |
| Funktional | Bin gleich zurück |

Bewusst ohne Ironiefähiges wie "Sicher?" oder "Mutig!". Solche Sprüche wirken
harmlos und werden verlässlich zum Sticheln benutzt.

Keine Häufigkeitsbegrenzung, dafür Stummschalten einzelner Mitspieler. Gekaufte
Emotes dürfen Ton und Animation mitbringen, deshalb zusätzlich ein **globaler
Schalter "Emote-Töne aus"**.

### 7.6 Zuschauen

Nur für **Freunde und Vereinsmitglieder**, ausschließlich über
`GameModule.spectatorView`, also **ohne jede Hand**.

**Nicht verwässern:** Bei verdeckter Partnerschaft wäre ein Zuschauer mit
Handeinsicht ein perfekter Komplize. Er müsste nur mitteilen, wer die zweite
Kreuz-Dame hält.

---

## 8. M6 — Beta

10 bis 20 Personen aus dem eigenen Doppelkopf-Verein, nur Web, Zugang über
einen gemeinsamen Einladungscode.

Zu beobachten: Ansagefenster, Länge des 60-Sekunden-Balkens,
Verständlichkeit der Abrechnung, tatsächlich genutzte Regelsätze, Häufigkeit
der Timeout-Regel — und **das Abstimmungsergebnis zum nächsten Spiel**.

---

## 9. M7 — Trophäen, Ranglisten, Vereine

### 9.1 Trophäen

Aus der **Platzierung über die gesamte Partie**, nie aus Spielpunkten. Deshalb
sind sie regelunabhängig und tragen jedes Spiel ohne Umbau.

| Sitze | Verteilung |
|---|---|
| 3 | +6 / 0 / −6 |
| 4 | +9 / +3 / −3 / −9 |
| 5 | +12 / +6 / 0 / −6 / −12 |

Gleichstand erhält den Mittelwert; die Werte sind so gewählt, dass er
ganzzahlig bleibt.

- **Startwert 0, Untergrenze 0**
- Checkpoints alle **100 bis 1000**, danach in **250er-Schritten**
- **Ausnahme:** Die Verlassen-Strafe durchbricht den Schutz

### 9.2 Ranglisten

- **Je Spiel** eine eigene Liste aus `account_game_stat`
- **Gesamtliste: Summe der Trophäen über alle Spiele**
- Ewig, keine Saisons. 3er-Tische mit Bot und Trainingsmodus zählen nicht

**Drei bekannte Konsequenzen, bewusst akzeptiert:**

1. Checkpoints brechen die Nullsumme, es entsteht Inflation.
2. Start bei 0 mit Untergrenze 0 heißt, dass Anfänger nicht verlieren können.
   Die unteren Ränge sind reine Spielmengenleiter.
3. Die Summe über alle Spiele stellt jemanden mit vier Spielen über einen
   stärkeren Spieler mit nur einem.

Zusammen misst die Gesamtliste damit überwiegend Spielmenge. Solange das
bekannt ist, ist es vertretbar; falls es später stört, lässt sich eine zweite,
spielstärkebasierte Liste danebenstellen, ohne das Trophäensystem anzufassen.

### 9.3 Vereine

- Jeder gründet kostenlos, **bis 50 Mitglieder**
- Rollen: Admin, Mitglied, Gast
- **Beitritt:** Der Admin stellt ein, ob offen oder auf Anfrage, und ob ein
  Trophäen-Mindestwert gilt
- Vereinseigener Regelsatz je Spiel als Vorgabe
- Zwei Ranglisten: globale Trophäen der Mitglieder und Vereinspunkte aus
  Vereinstischen
- **Löscht der Admin sein Konto, rückt das älteste Mitglied nach**

---

## 10. M8 — Moderation

Melden mit Grundauswahl und Freitext. Blockieren (nur öffentliche Tische).
Stummschalten. **Absprache-Erkennung** über `pairing_log`, Ergebnis zunächst
**nur eine Verdachtsliste zur manuellen Prüfung**. Automatische Sperren erst
nach der Beta.

**Zwei Grenzen:** Manuelle Prüfung skaliert nicht über einige tausend Nutzer.
Und dauerhaftes Blockieren kostet Matchmaking — bei kleinem Spielerkreis werden
Tische sonst nicht mehr voll.

---

## 11. Monetarisierung (nach der Beta)

**Premium**, monatlich und jährlich: werbefrei, detaillierte Statistiken,
unbegrenzt gespeicherte Regelsätze, regelmäßig geschenkte Münzen.
Vereinsgründung ist nicht Premium-gebunden.

**Das Regelsatz-Limit betrifft nur das Speichern.** Ein Nicht-Premium-Konto
speichert einen Regelsatz, kann beim Erstellen eines Tisches aber weiterhin
jede Option frei einstellen. Das Alleinstellungsmerkmal bleibt für alle
nutzbar — es zu beschneiden würde genau den Vorteil aufgeben, der die App vom
Palast unterscheidet.

**Werbung:** Unterbrechung zwischen Partien für Nicht-Premium; freiwillige
Werbung für Münzen für **alle**, auch Premium.

**Münzen und Shop:** kaufbar und über freiwillige Werbung erwerbbar. **Nur
Direktkauf zu festen Preisen, keine Zufallsboxen, nichts handelbar.** Angebot:
Blattbilder, Emotes mit Ton und Animation, Namensdekoration. Namensänderung
immer kostenpflichtig.

**Zahlung:** Web über Stripe, iOS über Apples In-App-Kauf (15 bis 30 Prozent).
**Anspruch serverseitig führen**, damit ein im Web gekauftes Abo auch auf dem
iPhone gilt.

**Bewusst nicht:** kein Einsatz- und Topfsystem. Verwettete virtuelle Währung
ist in Deutschland glücksspielrechtlich eine Grauzone.

---

## 12. M9 — Release

**Web zuerst**, ohne Review aktualisierbar und die bessere Bühne für die Beta.

**Technisch:** Fehler-Tracking, Monitoring, Lasttest, Datenbank-Backup mit
erprobter Wiederherstellung, automatisches Löschen alter Partiedetails.

**Rechtlich (Deutschland):** Datenschutzerklärung, Impressum, AGB. DSGVO mit
Auskunft, Löschung als Anonymisierung, Datenminimierung. **Kontolöschung muss
in der App funktionieren.** Widerrufsrecht bei digitalen Inhalten.
Altersfreigabe. Einwilligungsdialog für Werbung. Umsatzsteuer und
Zahlungsdienstleister, sobald Abo und Münzen kommen.

**Für iOS zusätzlich:** Entwicklerkonto 99 USD jährlich, **Sign in with Apple**
wird Pflicht sobald weitere Anmeldeverfahren dazukommen, Push über APNs,
Hintergrundverhalten und Reconnect gründlich testen.

---

## 13. Offene Punkte

1. ~~Produktname, danach Domain und Repository~~ — entschieden: **Brauweg**.
   Domain `brauweg-spielen.de` am 01.08.2026 bei Strato bestellt (Paket "Nur
   Domain"). Offen bleibt das Anlegen des GitHub-Repositories und, sobald
   Railway steht, der DNS-Eintrag auf den Dienst. Für den Mailversand gilt
   weiterhin 6.7: Bestätigungs- und Passwortmails laufen über Resend oder
   Postmark, nicht über Strato.
2. Konkrete Preise für Abo und Münzpakete
3. Berechnungsformel für Vereinspunkte
4. Werbenetzwerk und Einwilligungslösung
5. Rot-Grün-Schwäche: zurückgestellt, vor dem öffentlichen Release prüfen
6. Reihenfolge der nächsten Spiele — entscheidet die Beta-Abstimmung

---

## 14. Reihenfolge

```
M4  Server und Persistenz       erledigt
M5  Client Web                  weit gediehen: Hub, alle Doko-Bildschirme,
                                gemalte Szenen, Profil, Freundesliste,
                                Kontoloeschung. Offen: Emotes (7.5),
                                Zuschauen (7.6), Regelsatz-Editor, Revanche
M7  Vereine (9.3)               vorgezogen und erledigt: Clans mit Raengen
M6  Beta mit dem Verein         <- naechstes Ziel, sobald der Mailversand
                                haengt und der Regelsatz-Editor steht
M7  Trophaeen und Ranglisten    Rest offen
M8  Moderation
M9  Release Web
    danach: naechstes Spielmodul, Monetarisierung, iOS

Vereine sind vor M6 gebaut worden, weil der Verein als Clan der natuerliche
Rahmen fuer die Beta ist. Der Plan zaehlt sie weiter unter M7; die
Reihenfolge hier ist die tatsaechliche.
```

Innerhalb von M4: Datenmodell und Migrationen, dann Auth mit E-Mail-Bestätigung
und Einladungscode, dann Spielregistrierung und Tischverwaltung gegen
`GameModule`, dann die WebSocket-Schicht **mit Versionierung von Anfang an**,
zuletzt Timer und Verlassen-Logik.

**Erst wenn zwei Browser gegeneinander eine Partie beenden können, geht es an
die Gestaltung.**

**Stand 01.08.2026: Diese Bedingung ist erfüllt.** M4 steht vollständig
(Datenmodell, Auth mit Einladungscode und E-Mail-Bestätigung, Tischverwaltung
gegen `GameModule`, WebSocket mit Versionierung, Timer und Verlassen-Logik),
dazu ein roher Client. Der Nachweis liegt als Integrationstest vor: zwei
getrennte WebSocket-Verbindungen spielen eine vollständige Partie zu Ende.

Beim Bau sind vier Fehler in der Übergabe aufgefallen und behoben worden:

1. `legalActions` des Adapters lieferte weder Ansagen noch Armut, Pflichtansage
   oder „gesund". Ein Client, der seine Schaltflächen daraus baut, wäre bei der
   ersten Armut festgelaufen.
2. `serialize`/`deserialize` reichten den Zustand nur durch. `PartyState.bock`
   ist eine Klasse; nach dem Weg durch die Datenbank fehlten ihre Methoden.
   Jeder Railway-Neustart hätte laufende Tische zerstört.
3. Das Doppelkopf-Paket exportierte den Adapter nicht — die Plattform kam an
   das Spielmodul gar nicht heran.
4. Die Bot-Übernahme nach einem Timeout galt dauerhaft. Damit konnten nie drei
   Timeouts hintereinander auflaufen und die Verlassen-Regel lief ins Leere.

Ergänzt wurde `GameModule.completedSegments`, weil `round_summary` sonst nicht
befüllbar gewesen wäre, ohne dass der Server Doppelkopf-Interna liest.
