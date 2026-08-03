# Brauweg — Design-Richtlinien (allgemein)

Diese Datei ist verbindlich für alles außerhalb des Spieltischs (der hat
seine eigene: [DESIGN-DOKO.md](DESIGN-DOKO.md)). Wer etwas Neues baut, hält
sich daran — wer davon abweichen will, ändert erst diese Datei.

## Grundhaltung

Brauweg ist ein **Spiel**, kein Verwaltungsprogramm: bunt, warm, mit
Druckpunkt und Augenzwinkern — aber nie auf Kosten der Lesbarkeit.
**Handy zuerst:** Alles wird für Hochkant-Handys entworfen; im breiten
Browser bleibt die Fläche auf Handybreite begrenzt (`max-width: 30rem`,
zentriert). Eine Hand, ein Daumen: Alles Wichtige ist unten erreichbar.

## Farben

Immer über die CSS-Variablen aus `styles.css`, nie als neue Hex-Werte
mitten im Code:

| Variable | Wert | Verwendung |
| --- | --- | --- |
| `--bg` | `#12181c` | Seitengrund |
| `--panel` | `#1b2429` | Flächen, Karten |
| `--line` | `#2c383f` | Ränder, Trennlinien |
| `--text` | `#e8eef1` | Text |
| `--muted` | `#8fa3ad` | Nebentext |
| `--accent` | `#4a9c78` | Grün: Aktionen, „los geht's" |
| `--gold` | `#e2b64f` | Gold: Trophäen, Checkpoints, Wertvolles |
| `--lila` | `#a678f2` | Lila: Kommendes (VIP, „Bald") |
| `--blau` | `#5ea0f0` | Blau: Level, Freunde |
| `--danger` | `#c2564c` | Fehler, Verluste |

Bedeutung ist fest: **Grün = tun**, **Gold = wert**, **Lila = bald**,
**Rot = Vorsicht**. Nicht mischen (kein goldener Abbrechen-Knopf).

## Startbereich (`front-*`)

- Fester Rahmen: Ressourcen-Leiste oben (Level, Name, Münzen, VIP),
  Tab-Leiste unten (Shop · Clan · Spielen · Blatt · Profil), Inhalt
  rollt dazwischen. „Spielen" ist mittig und größer; jeder Tab leuchtet
  aktiv in seiner eigenen Farbe.
- **Clan** ist spielübergreifend (nicht nur Doppelkopf): Chat, Clankrieg,
  Clan-Rangliste und ähnliche Bausteine stehen schon als Oberfläche mit
  „Bald"-Marke — wie in Clash Royale. Freunde hängen am Clan-Tab, nicht
  als eigener Tab. Intern heißt die Tabelle weiter `club_*`.
- Der Hauptschirm ist der **Trophäenpfad** (siehe `Pfad.tsx`): Inseln als
  Checkpoints, jede eine eigene Welt. Neue Welten sind neue SVG-Szenen im
  selben Zuschnitt (`viewBox="-80 0 500 240"`).
- Was es noch nicht gibt, steht trotzdem in der Oberfläche — mit ehrlicher
  Null und **„Bald"-Marke** (lila). Antippen öffnet das „Kommt bald"-Blatt,
  nie einen toten Knopf.

## Bausteine

Vorhandenes wiederverwenden statt neu erfinden:

- **Blatt von unten** (`doko-sheet` + `doko-sheet-card`): für alles, was
  eine Entscheidung oder Nachlese ist. Tipp auf den Hintergrund schließt.
- **Regelkacheln** (`regeln` / `regel`): Bild + Name, aktiv = goldener Rand
  mit Haken. Bilder kommen aus `regelbilder.ts`.
- **Chips** (`lobby-chip`): kleine antippbare Auswahl (Zahlen, Optionen).
- **Pillen** (`front-waehrung`, `doko-badge`): runde Anzeigen für Zahlen
  und Zustände.
- **Vollbild-Auswahl** (`spielwahl`): Listen mit einem gemalten Bild je
  Eintrag.
- **Kommt-bald-Blatt** (`BaldBlatt` in `GameSelect.tsx`): einheitliche
  Antwort auf alles Unfertige.

## Bilder und Icons

- **Alles gemalt, nichts geladen:** Szenen und Spielbilder sind SVGs im
  Bundle. Keine externen Bilddateien, keine Webfonts.
- **Bedien-Icons** sind Strich-SVGs (`stroke="currentColor"`,
  `strokeWidth 1.8`, runde Enden) — siehe die Icon-Funktionen in
  `GameSelect.tsx`. Keine Emojis in der Tab-Leiste oder auf Knöpfen.
- **Emojis nur als Bildchen** (Regelkacheln, Shop-Regale, Kommt-bald) —
  dort, wo sie Schmuck sind und ein Ausfall nicht wehtut.
- Frei nutzbare Pakete, wenn echte Zeichnungen gebraucht werden:
  Kenney (CC0, keine Auflagen), game-icons.net (CC BY — Namensnennung auf
  der Über-Seite), Lucide/Tabler (ISC/MIT).

## Bewegung

- Bewegung ist **Zierde**: Flaggen wehen, Lichter blinken, Lava glüht —
  dezent, langsam (≥ 2s Zyklen), nie informationstragend.
- Jede Animation endet ersatzlos unter
  `@media (prefers-reduced-motion: reduce)`. Keine Ausnahme.
- Knöpfe haben **Druckpunkt**: harter Schlagschatten unten
  (`box-shadow: 0 4px 0 …`), beim Drücken 2–3px nach unten.

## Sprache

- Deutsch, Du-Form, kurze Sätze. Knöpfe sagen, was passiert („Bestätigen",
  „Tisch erstellen", „Reinkommen!") — nie nur einen Zustand.
- Fehlermeldungen sagen, was los ist und was zu tun ist, ohne
  Entschuldigungsfloskeln.
- Alle Texte laufen über `i18n.ts` (`t()`), der Server liefert nur
  Schlüssel. Fehlt eine Übersetzung, erscheint der rohe Schlüssel —
  sichtbar hässlich statt unsichtbar kaputt. Dieses Prinzip gilt überall.

## Code-Konventionen fürs Design

- Klassennamen deutsch und mit Bereichs-Präfix: `front-*` (Startbereich),
  `lobby-*` (Tischerstellung), `doko-*` (Spieltisch), `pf-*`
  (Pfad-Animationen), `insel-*`, `spielwahl-*`, `regel*`.
- Zustände als `is-*`-Klassen (`is-an`, `is-zu`, `is-offen`,
  `is-schwebend`).
- Keine Inline-Hex-Farben für Bedeutungstragendes — Variablen benutzen.
- Breite Inhalte rollen im eigenen Container (`overflow-x: auto`), die
  Seite selbst rollt nie quer.
