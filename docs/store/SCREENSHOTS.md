# Store-Screenshots

Erzeugt von `werkzeug/store/screenshots.mjs` gegen staging, als App (App-Herkunft
und `window.BRAUWEG_APP` gesetzt — die Auswahl zeigt also genau die drei
freigegebenen Spiele, keinen Shop). Gespielt wird als frisches **Gastkonto
mit Vogelnamen**, alle Mitspieler sind **Bots** — keine echten
Personendaten im Bild.

**Die Bilder liegen nicht im Repository** (1–3 MB je Stück). Letzter Lauf:
23.09.2026 nach `C:\Broweg\pruef\brauweg-wt\app-store-lauf\screenshots\`
(Mood XPS), 14 Bilder, alle ohne Fehler.

```bash
cd werkzeug/store
npm ci
npx playwright install chromium     # nur, wenn der Browser noch fehlt
node screenshots.mjs --ziel ../../../app-store-lauf/screenshots
node screenshots.mjs --geraet play --motiv 05   # ein einzelnes Bild neu
```

Das Skript leitet alles, was der Client an `https://www.brauweg-spielen.de`
schickt, nach staging um (damit der QR-Code im Bild auf die echte Adresse
zeigt) und lässt nichts zur Produktion durch. Warum, steht im Kopf des
Skripts.

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
| `06-partykiste-einstellungen` | Menü: Trinkspiel / Alkoholfrei, Runden, Härte, Modi | Zeigt den Schalter — gut für die Prüfung. Der Kopftext sagt „Zwölf Minispiele" (CHECKLISTE A3). |
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
