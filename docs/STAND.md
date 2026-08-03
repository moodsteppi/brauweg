# Stand der Arbeit

Übergabe für eine neue Sitzung. Was hier steht, ist am 3. August 2026
geprüft — Zahlen und Zustände stammen aus tatsächlichen Läufen, nicht aus
der Erinnerung.

---

## Wo das Projekt steht

Brauweg läuft unter **www.brauweg-spielen.de**. Doppelkopf ist spielbar,
der Hub steht, Clans funktionieren. Der Deploy hängt an `main`: Was dorthin
gemerged wird, ist nach etwa zwei Minuten live.

**Prüfstand:** 118 Engine-Tests, 115 Servertests, `tsc --noEmit` sauber.
`npm test` und `npm run build` im Wurzelverzeichnis decken beides ab.

**Bilder:** `packages/client/public/hub/` liegt bei 6,2 MB — zu Tagesbeginn
waren es 30. Gemaltes wird als **WebP mit Qualität 85** ausgeliefert;
Originale in voller Auflösung gehören nach `packages/client/art/`, niemals
unter `public/` (siehe `docs/DESIGN.md`).

---

## Wie hier gearbeitet wird

**Zweig, PR, selbst mergen.** Nie direkt auf `main` arbeiten: Zweig von
`origin/main`, Änderung, Zweig pushen, nach `main` mergen, `main` pushen.
Vor dem Mergen immer `git fetch` — auf `main` landen auch Commits aus
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
`0008_clan_raenge`.

---

## Heute fertig geworden

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
  Bestellung.

---

## Was offen ist

### Vor dem App-Store-Release zwingend

1. ~~Kontolöschung in der Oberfläche~~ — **erledigt.** Profil-Tab ganz
   unten, kleiner Textknopf unter „Abmelden", dann ein Blatt mit Warnung
   und Passwortabfrage. Das Passwort ist Absicht: Die Sitzung hält dreißig
   Tage, ohne die Frage genügte ein kurz aus der Hand gelegtes Handy.
2. **Versanddienst für E-Mail.** Code-seitig fertig — `ResendMailer` steht,
   `MAIL_FROM` hat den richtigen Standard, „neuen Link anfordern" gibt es
   im Client. **Es fehlt nur noch DNS bei Strato und `RESEND_API_KEY` in
   Railway**, Klickstrecke in `docs/RESEND.md`. Bis dahin stehen die
   Bestätigungslinks nur im Railway-Protokoll und niemand aus dem Verein
   kann sich selbst registrieren.
3. **Rechtstexte: Gerüst steht, Angaben fehlen.** `/rechtliches/impressum.html`
   und `/rechtliches/datenschutz.html` sind angelegt und aus Anmeldung und
   Profil verlinkt. Die offenen Stellen sind **rot umrandet** — Name,
   Anschrift, Support-Adresse, Datenbankanbieter, Aufbewahrungsdauer der
   Protokolle. **Solange Platzhalter drinstehen, erfüllen die Seiten die
   Pflicht nicht.** Der Datenschutztext beschreibt, was die Anwendung
   tatsächlich tut (am Code geprüft), ersetzt aber keine Rechtsberatung.
4. Demokonto für die Prüfer — Einzelheiten in `docs/APPSTORE.md`.
5. Capacitor-Hülle und getrennte API-Adresse.

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
