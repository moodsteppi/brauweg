# Store-Screenshots

Erzeugt von `werkzeug/store/screenshots.mjs` gegen staging, als App (App-Herkunft
und `window.BRAUWEG_APP` gesetzt — die Auswahl zeigt also genau die drei
freigegebenen Spiele, keinen Shop). Gespielt wird als frisches **Gastkonto
mit Vogelnamen**, alle Mitspieler sind **Bots** — keine echten
Personendaten im Bild.

**Die Bilder liegen nicht im Repository** (1–3 MB je Stück). Letzter Lauf:
23.09.2026 18:40 gegen staging mit #242 und #243 nach
`C:\Broweg\pruef\brauweg-wt\app-store-lauf\screenshots\` (Mood XPS), 14 Bilder,
alle ohne Fehler. Der vorige Lauf liegt daneben in `screenshots-alt\`.

```bash
cd werkzeug/store
npm ci
npx playwright install chromium     # nur, wenn der Browser noch fehlt
node screenshots.mjs --ziel ../../../app-store-lauf/screenshots
node screenshots.mjs --geraet play --motiv 05   # ein einzelnes Bild neu
```

## 1.0 (27.10.2026) — ersetzt alle Sätze unten für den App Store

Die Bilder vom 14.10. zeigen die Partykiste, die es in der App nicht mehr
gibt (Apple 2.3.3). Umfang 1.0: Doppelkopf (mit „Doppelkopf lernen"), Skat,
BroChess, Farbduell, Browort/Clanwort, Kartenmanufaktur — kein Shop, keine
Edelsteine, keine Partykiste. Der Satz entsteht wieder mit
`werkzeug/store/screenshots.mjs` gegen **staging** (nie gegen die
Produktion — das Skript bricht bei `--basis` auf www ab), als iOS-App
(Herkunft `brauweg://app`, `BRAUWEG_APP.plattform = 'ios'`), Gastkonto mit
Vogelnamen, Mitspieler Bots.

Weil staging ohne `UMFANG` läuft und deshalb alles zeigt (Partykiste und
Abstimmung unter „Kommt bald"), schreibt das Skript `/api/games` und
`/api/me` so um, wie der Server es mit dem 1.0-Umfang aus
`docs/APP-RELEASE.md` täte (`--umfang alles` schaltet das ab). Die
Oberfläche bleibt die echte. **Keine Statusleiste** in allen Bildern
(Chromium hat keine, eine nachgemalte wäre erfunden).

Ablage (nicht im Repo): `~/Broweg/release-brauweg/screenshots-1-0/ios-6.9/`,
1320 × 2868, PNG ohne Alpha (geprüft mit
`sips -g pixelWidth -g pixelHeight -g hasAlpha`).

```bash
cd werkzeug/store
npm ci
node screenshots.mjs --geraet ios --ziel ~/Broweg/release-brauweg/screenshots-1-0
node screenshots.mjs --geraet ios --motiv 05 --ziel ~/Broweg/release-brauweg/screenshots-1-0   # ein Bild neu
```

| Datei | Was zu sehen ist | Hinweis |
| --- | --- | --- |
| `01-spiele` | Reiter „Spiele": Kartenspiele (Doppelkopf, Skat), Denken & Strategie (BroChess, Farbduell), darunter „Allein" mit der Kartenmanufaktur | Zeigt die **Farbduell-Kachel mit dem alten Banner** — nach Emiles neuem Banner neu erzeugen. |
| `02-doppelkopf` | Doppelkopf zu viert gegen drei Bots, zwei Karten im Stich, du bist dran | Spielart hängt an der Saat (am 27.10. ein Pik-Solo eines Bots). |
| `03-doppelkopf-lernen` | Lektion „Bedienen & Stiche": Ole spielt Pik-Ass, beide Pik-Karten markiert und grün geprüft, „Richtig!" | Lektion 1 schließt das Skript über `/api/lernpfad/lektion/karten/fertig` ab, damit Lektion 2 frei ist. |
| `04-skat-reizen` | Skat gegen zwei Bots: „Du bist am Reizen", „23 sagen" / „Rechner" / „Weg" | Reizwert hängt an der Saat. |
| `05-browort` | Browort, drei Versuche (KARTE, STERN, LAUNE) mit Farben, Tastatur | Farben hängen am Tageswort. |
| `06-kartenmanufaktur` | Werkstatt mit Versandhalle, Lieferwagen, Paternoster, drei Etagen mit Pressen und Meistern | Aus `/probe/manufaktur?fall=mitte`: die echte Manufaktur mit festem Stand (ein frisches Konto hat nur eine leere Presse). |
| `07-brochess` | BroChess gegen den Bot, Eröffnung, eigener Läufer angewählt mit Zielpunkten, „Du bist am Zug" | Optional. Farbe entscheidet das Los. |

Kein Farbduell-Motiv: Dessen Banner wird gerade neu gemalt.
**Vorschlag für den Store:** 01–06, 07 nach Wahl.

## iOS V1 (14.10.2026) — durch 1.0 ersetzt

Mit der ersten iOS-Fassung (fünf Spiele, Partykiste-Szenen, Pinguin-Schach)
stimmen die alten Bilder nicht mehr. Der neue Satz ist **im Simulator** (iPhone
17 Pro Max, 1320 × 2868, PNG ohne Alpha) aus der echten App gegen einen
lokalen Server entstanden, nicht mit `screenshots.mjs`: Das Skript kennt die
neuen Bildschirme (Bot-Schach, Farbduell, Flasche) nicht. Statusleiste über
`xcrun simctl status_bar … override` auf 9:41, volles Netz und Akku. Gespielt
als Gast „Kiebitz", Mitspieler sind Bots oder Testgäste mit Vogelnamen;
Partykiste **alkoholfrei**. Die Bilder liegen nicht im Repo.

| Datei | Was zu sehen ist |
| --- | --- |
| `01-spiele` | Reiter „Spiele": Kartenspiele, Trinkspiele, Denken & Strategie, „Kommt bald" zugeklappt |
| `02-doppelkopf` | Doppelkopf gegen drei Bots, Hochzeit, zwei Karten im Stich, du bist dran |
| `03-skat` | „Du bist am Reizen", „22 sagen" / „Rechner" / „Weg" |
| `04-brochess` | Pinguin-Figuren gegen den Bot, Läufer angewählt mit Zugpunkt |
| `05-farbduell` | Farbduell (Normal) gegen die KI, 7 : 7 |
| `06-busfahren` | Bus fahren als Fahrer: Buslinie, erste Karte richtig, „Höher oder tiefer?" |
| `07-koenigsbecher-flasche` | Königsbecher: Karte pendelt über der Flasche, „Tippen, wenn die Karte über der Flasche ist!" |

Zwei Fehler sind dabei aufgefallen und behoben: Beim Skat fehlte im Blatt
„Klassisch" die Sieben/Acht als kaputtes Bild statt Textkarte, und auf dem
hellen Farbduell war die weiße Statusleiste unlesbar.

## Web-Lauf mit dem Skript (23.09.2026)

Das Skript leitet alles, was der Client an `https://www.brauweg-spielen.de`
schickt, nach staging um (damit der QR-Code im Bild auf die echte Adresse
zeigt) und lässt nichts zur Produktion durch. Warum, steht im Kopf des
Skripts.

## Clips für Werbevideos (19.10.2026)

`werkzeug/store/clips.mjs` nimmt mit derselben Technik (App-Modus, Gastkonto
mit Vogelnamen, nur Bots, Umleitung Produktion → staging) kurze Clips auf:
hochkant 9:16, 1080 × 1920, je Szene 5–10 s, als WebM (VP8 aus Playwrights
`page.screencast`). Szenen: Reiter „Spiele“, Doppelkopf (Austeilen,
Ausspielen, Stich), Skat (Reizen mit Rechner, ggf. Ansage, Stich), Partykiste
**alkoholfrei** (Menü, Quizfrage, Auflösung, Weiter). Fragen mit Marken
Dritter verwirft es wie das Screenshot-Skript; Zauberer kommt nicht vor.
Neben die Clips schreibt es `liste.md` (Datei, Spiel, Szene, Länge, Eignung
als Hook/Spielszene/Endkarte). MP4 (H.264) legt es nur an, wenn ein ffmpeg
mit H.264 im PATH liegt — Playwrights eigenes kann nur VP8.

```bash
cd werkzeug/store
npx playwright install chromium ffmpeg
node clips.mjs --ziel C:/Users/robin/Broweg/material/demo-ad/brauweg-spielen
node clips.mjs --ziel … --szene skat     # nur eine Szene
```

Die Clips liegen nicht im Repository (`*.webm`/`*.mp4` in `.gitignore`).
Beim Bau ist aufgefallen: `screenshots.mjs` findet seit dem neuen Hub
(Leiste unten, Spielseite mit „Zum Spiel“) den Knopf „Spielauswahl“ nicht
mehr — jedes Motiv scheitert. `clips.mjs` geht über den Reiter „Spiele“.

## Größen

| Ordner | Pixel | Wofür | Quelle |
| --- | --- | --- | --- |
| `ios-6.9/` | **1320 × 2868** | App Store, iPhone 6,9" — **Pflichtgröße**, wenn die App auf dem iPhone läuft; kleinere iPhones skaliert Apple selbst herunter | [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications) |
| `play-phone/` | **1080 × 1920** (9:16) | Google Play, Telefon. Mindestens 2, für die großen Spiele-Empfehlungen mindestens 3 in 9:16 ab 1080 × 1920 | [Play-Hilfe Grafiken](https://support.google.com/googleplay/android-developer/answer/9866151) |

PNG ohne Alphakanal (Farbtyp 2, das Skript prüft es nach jedem Bild) — Apple
lehnt Bilder mit Transparenz ab. **iPad-Bilder braucht es nicht:** Die App
ist nur fürs iPhone eingestellt (`docs/APPSTORE.md`, Einstellungen).
Apple nimmt 1–10 Bilder je Größe, Play 2–8.

## Motive (Reihenfolge im Store)

| Datei | Was zu sehen ist | Hinweis |
| --- | --- | --- |
| `01-spielauswahl` | „Jetzt spielbar: 3 von 21" mit Doppelkopf, Skat, Partykiste, darunter „Kommt bald" | Die Kachel sagt „9 Minispiele" — veraltet (CHECKLISTE A3). Nach der Korrektur neu erzeugen. |
| `02-doppelkopf-tisch` | Doppelkopf zu viert gegen Bots, erste Runde, ein Stich in der Mitte | Die Spielart (Solo, Normalspiel) hängt an der Saat, jedes Bild ist anders. |
| `03-skat-reizen` | „Du bist am Reizen", Knöpfe „18 sagen", „Rechner", „Weg" | |
| `04-partykiste-runde` | Allgemeinwissen, **alkoholfrei**, eine Frage mit vier Antworten | Fragen mit Marken Dritter (Simpsons u. a.) verwirft das Skript und zieht neu. |
| `05-einladung-qr` | Wartesaal: Code groß, QR-Code, „Link teilen", `https://www.brauweg-spielen.de/beitritt/<CODE>` | Der Code ist echt auf staging und verfällt; auf der Produktion führt er ins Leere. |
| `06-partykiste-einstellungen` | Menü: Trinkspiel / Alkoholfrei, Runden, Härte, Modi | Zeigt den Schalter — gut für die Prüfung. |
| `07-partykiste-trinkspiel` | wie 04, aber im Trinkspiel-Modus | **Nicht hochladen.** Robin hat am 23.09.2026 die alkoholfreie 04 gewählt. |

**Vorschlag für den Store:** 01, 02, 03, 04, 05, 06 — sechs Bilder, auf beiden
Stores dieselben. Ohne Beschriftung (keine eingebrannten Texte, CLAUDE.md
Regel 5); wer Rahmen mit Werbezeilen will, bestellt sie als Grafik.

## Was noch fehlt

- **Play-Feature-Grafik 1024 × 500** — Pflicht zum Veröffentlichen. Bestellt
  in `docs/ASSETS-STORE.md`.
- **App-Symbol** in endgültiger Fassung (1024 × 1024 für Apple ohne Alpha,
  512 × 512 für Play) — heute Platzhalter aus dem Web-Symbol
  (`docs/APP-RELEASE.md` Abschnitt 6).
- Gastnamen bekommen auf staging eine Zahl angehängt („Eisvogel 52"), weil
  frühere Läufe die Namen schon belegt haben. Stört es, eine längere
  Namensliste in `NAMEN` im Skript.
