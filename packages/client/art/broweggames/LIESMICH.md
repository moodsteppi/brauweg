# BroweGGames — Logo, finale Ablage

Stand 28.10.2026. Alles in diesem Ordner ist fertig und kann so verwendet werden.
Die Dateien eine Ebene höher (`logo-A` bis `logo-E`, `trace*.jsx`, `*flach*.png`)
sind Zwischenschritte und werden **nicht** mehr gebraucht.

---

## 1  Die Quelldatei

| Datei | Wofür |
|---|---|
| `BroweGGames-Logo-Master.svg` | **Das Original.** Alles andere kommt hier raus. |
| `BroweGGames-Logo-Master.ai`  | Dasselbe als Illustrator-Datei zum Bearbeiten. |

203 Pfade, **14 Farben**, Hintergrund transparent, Maßstab beliebig.
Jede Farbe lässt sich einzeln austauschen (in Illustrator: Auswahl → Gleich → Flächenfarbe).

### Die Palette

| Farbe | Hex | Wo |
|---|---|---|
| Navy | `#152246` | Konturen, Augen |
| Navy hell | `#27304C` | Pinguinkörper |
| Creme | `#FBF3E3` | Gesichter, Bäuche, Karten, Plus, Punkte |
| Lila | `#9234E3` | Pinguin oben |
| Lila dunkel | `#4A3A9D` | Schattierung |
| Orangerot | `#FC522C` | Pinguin links |
| Rot dunkel | `#CC3021` | Schattierung |
| Schnabel | `#FF7738` | alle Schnäbel |
| Türkis | `#019BA2` | Pinguin rechts |
| Türkis hell | `#14BEBF` | Schattierung |
| Gold | `#FCA729` | Giraffe |
| Gold hell | `#F3BF4B` | Schattierung |
| Gold dunkel | `#DA8529` | Schattierung |
| Braun | `#8A2E0B` | Giraffenflecken |

---

## 2  Die fünf Varianten

Siehe `VARIANTEN.png` zum Draufgucken.

| # | Datei | Wann |
|---|---|---|
| 1 | `png/BroweGGames-Marke-transparent-*.png` | Standard. Auf hellen Flächen, in Dokumenten, auf Folien. |
| 2 | `png/BroweGGames-Marke-creme-1024.png` | Wenn eine geschlossene Fläche gebraucht wird (Kachel, Avatar). |
| 3 | `png/BroweGGames-Marke-navy-1024.png` | Auf dunklem Untergrund. Die Marke sitzt auf einer cremefarbenen Scheibe, sonst verschwindet die dunkle Kontur. |
| 4 | `app-icons/iOS-Dark-1024.png` | iOS-Dark-Mode-Icon. |
| 5 | `app-icons/iOS-Tinted-1024.png` | iOS-Tinted-Icon (Graustufen, iOS färbt selbst ein). |

**Regel:** auf dunklem Untergrund nie Variante 1 — die Navy-Kontur geht unter.
Dann immer Variante 3.

---

## 2b  Der Schriftzug

Vier fertige Dateien, je als `.svg`, `.ai` und `.png` (3000 px breit, transparent).
Übersicht: `LOCKUPS.png`.

| Datei | Wann |
|---|---|
| `BroweGGames-Logo-vertikal` | Standard. Marke oben, Schrift drunter. Für alles Quadratische — Profilbilder, Kacheln, Plakate. |
| `BroweGGames-Logo-horizontal` | Marke links, Schrift rechts. Für Kopfzeilen, Briefbogen, breite Banner, Stream-Overlay. |
| `BroweGGames-Logo-vertikal-dunkel` | dasselbe für dunklen Untergrund |
| `BroweGGames-Logo-horizontal-dunkel` | dasselbe für dunklen Untergrund |

**Schrift: Mulish Black.** Kostenlos (Google Fonts, SIL Open Font License),
kommerziell nutzbar, liegt schon auf dem Rechner. Im Logo ist sie in Pfade
umgewandelt — es muss also niemand die Schrift installiert haben, um die Datei
richtig zu sehen.

Die beiden **G stehen in Gold** (`#FCA729`), der Rest in Navy bzw. auf Dunkel in
Creme. Das ist der ganze Trick an „BroweGGames": das GG springt raus, ohne dass
man es erklären muss.

Auf dunklem Untergrund sitzt die Marke auf einer cremefarbenen Scheibe. Ohne die
verschwindet die Navy-Kontur im Hintergrund — das ist kein Stilmittel, sondern
ein Fehler.

**Andere Schrift gewünscht?** `SCHRIFT-AUSWAHL.png` zeigt drei Alternativen, die
auch schon auf dem Rechner liegen. Umbauen dauert eine Minute — in `zwischenschritte/lockup.jsx`
oben steht `var SCHRIFT = "Mulish-Black";`, das ist die einzige Stelle.

---

## 3  Was zu Apple geht

Der Ordner `app-icons/AppIcon.appiconset/` ist fertig für Xcode:
in den Finder ziehen nach

    <Projekt>/Assets.xcassets/

Die bestehende `AppIcon.appiconset` ersetzen. Drin liegen genau die drei
Varianten, die Xcode 16 / iOS 18 erwartet: Light, Dark, Tinted, je 1024×1024.
Alle weiteren Größen rechnet Xcode selbst.

**Technisch geprüft:**
- `AppStore-1024.png` hat **keinen Alphakanal** — das ist Apples harte Anforderung, daran scheitern die meisten Uploads.
- Keine abgerundeten Ecken drin. Die Maske setzt Apple selbst.
- sRGB, 1024×1024.

Für App Store Connect (Produktseite) reicht `app-icons/AppStore-1024.png`.
Für Google Play: `app-icons/PlayStore-512.png`.

### Hub-Icon oder Spiel-Icon?

Dieses Icon zeigt die Plattform, nicht ein einzelnes Spiel. Bevor es irgendwo
eingesetzt wird, muss klar sein, ob die App der **Hub** ist oder ein **Spiel**
darin. Bei einem einzelnen Spiel bleibt dessen eigenes Icon stehen, und
BroweGGames kommt nur klein als Herausgebermarke rein (siehe unten).

---

## 4  Wo das Logo in einer App auftaucht

Wenn die App ein einzelnes Spiel ist, gehört BroweGGames als
**Herausgebermarke** rein — klein, nicht als Hauptmotiv:

| Stelle | Was |
|---|---|
| Splash Screen, unten | Marke transparent, ~40 pt, darunter „ein BroweGGames-Spiel" |
| Einstellungen / Über | Marke + Version + Link auf die Plattform |
| Lobby- oder Startkopf | optional, nur wenn Platz ist |

Dafür in iOS ein Image-Set `BroweGGamesMarke.imageset` anlegen mit
`BroweGGames-Marke-transparent-256.png` (1x), `-512.png` (2x), `-1024.png` (3x).

**Nicht** in den Spielbildschirm. Während des Spiels stört jede Marke.

Ist die App der Hub selbst, dann umgekehrt: BroweGGames wird das App-Icon und
der Kopf der Startseite, die einzelnen Spiele behalten ihre eigenen Zeichen in
der Spieleliste.

---

## 5  Web

Dateien in `web/`. In den `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:image" content="/og-image-1200x630.png">
```

`site.webmanifest`:

```json
{
  "name": "BroweGGames",
  "short_name": "BroweGGames",
  "theme_color": "#152246",
  "background_color": "#FBF3E3",
  "display": "standalone",
  "icons": [
    { "src": "/pwa-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/pwa-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/pwa-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

---

## 6  Was noch offen ist

**Das Favicon bei 16 px ist Matsch.** Ab 48 px sitzt alles, bei 32 px wird es
grenzwertig, bei 16 px sieht man nur noch Farbflecken. Das liegt nicht an der
Datei, sondern am Motiv: vier Tiere plus drei Symbole passen nicht in
16 Pixel. Dafür braucht es eine **reduzierte Marke** — ein Element statt sieben,
zum Beispiel nur ein Pinguinkopf oder das GG. Sag Bescheid, dann baue ich die.

**Die Wortmarke fehlt.** Hier liegt nur das Bildzeichen. Für die Wortmarke
„BroweGGames" muss die Schrift bestimmt werden (WhatTheFont auf den alten
Entwurf) und dann als **echter Text** gesetzt werden — nicht mitvektorisiert,
sonst wackeln die Rundungen.

**Für ganz großen Druck.** Messebanner, Fahrzeug, Hauswand: da sieht man, dass
die Konturen nachgezeichnet und nicht gezeichnet sind. Für alles bis Plakat-
format reicht es. Eine saubere Handnachzeichnung kostet als Freelancer-Auftrag
100 bis 200 Euro und wäre vor dem ersten großen Druck sinnvoll.

---

## 7  Wie die Datei entstanden ist

Falls das nochmal jemand nachbauen muss: das Pixelbild wurde zuerst mit
ImageMagick auf exakt 15 Farben gezwungen und zweimal median-gefiltert
(`snap.ps1` und die Befehle im Protokoll), erst danach in Illustrator
vektorisiert (`trace4.jsx`). Ohne diesen Zwischenschritt kommen 628 Pfade und
97 Farben raus statt 203 Pfade und 14 Farben.

Wichtig dabei: `ignoreWhite` muss auf `false` bleiben und der weiße Hintergrund
wird hinterher per Skript über die Füllfarbe gelöscht. Andersherum verschwinden
die cremefarbenen Gesichter mit.
