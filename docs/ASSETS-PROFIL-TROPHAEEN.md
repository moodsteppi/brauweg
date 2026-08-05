# Bildbestellung: Profil neu — Trophäen, Einstellungen, Benachrichtigungen

## Warum diese Bestellung

Im Profil-Tab sind die **Trophäen** der sichtbare Fremdkörper: großer Hero,
2×2-Kacheln und Spielzeilen sind **blaue CSS-Verläufe** (`#3a7fd4` → `#2458a8`)
mit goldenem Strich — iOS-Kartenoptik, nicht unsere Holz/Messing-Welt.

Die Konto-Knöpfe (Einstellungen, Benachrichtigungen, Abmelden) nutzen schon
WebP-Pfade, wirken aber noch wie System-/Emoji-Ersatz oder fallen neben dem
blauem Block auseinander. Einstellungen und Benachrichtigungen sollen **eigene
gemalte Bilder** bekommen — keine Unicode-Emojis, keine Flat-Piktogramme.

**Diese Bestellung überschreibt den Statistik-/Konto-Block einmal komplett:**
Hintergründe, Pokale, Kachel-Rahmen, Einstellungs- und Benachrichtigungs-Icons.
Danach kann Claude Layout + CSS verdrahten (Holz statt Blau, neue Anordnung).

Verwandt, aber **nicht** diese Bestellung:
- `ASSETS-PROFIL.md` — Menüknöpfe, Tafeln, Einstiegs-Icons (teilweise schon in `art/`)
- `ASSETS-STUFEN.md` — Stufenplakette und XP-Balken
- `ASSETS-PINGUIN.md` — 2D-Kosmetik

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal**, sRGB.
- Ablage: `packages/client/art/` (volle Auflösung).
- WebP nach `public/hub/` macht der Mensch danach mit `wandeln.mjs`.
- **Keine Originale nach `public/`.**

**Echte Transparenz**
Auf knallroten Grund legen: nur die Silhouette sichtbar, kein heller Saum,
kein Schachbrett als Pixel.

**Was NICHT ins Bild gehört**
- **Keine Schrift, keine Zahlen** (Trophäenzahl und Labels setzt die App).
- Kein Schlagschatten nach außen.
- Kein Alkohol.
- Keine Emojis, keine Flat-Icons à la iOS SF Symbols.
- Kein Handyrahmen, keine Tab-Leiste.

**Ton**
Wie `menue-blatt.webp` / `bg-profil.webp`: gemaltes Holz, warmes Messing,
Clash-Royale-Nähe. Prüfsatz: Man muss es für bemaltes Holz oder Metall halten
können.

**Dehnbare Flächen (border-image)**
Wo Randmaß genannt ist: Ecken im Slice, Kanten gleichförmig, Mitte ruhig.
Stretch-Probe: doppelte Breite, halbe Höhe.

---

# Teil 1 — Trophäen-Block (ersetzt das Blau)

Heute: `StatHero`, `StatKachel`, `StatSpiel` in `hub.tsx` + blaue CSS-Klassen
`.hub-stat-hero`, `.hub-stat-kachel`, `.hub-stat-spiel`.

Ziel: dieselben drei Bauformen, aber **gemalte Träger** statt `linear-gradient` Blau.
Neue Anordnung (Vorschlag für Claude, Bilder so schneiden dass es geht):

```
┌─────────────────────────────────────┐
│  [Pokal]  1247                      │  ← Hero: Pokal links, Zahl groß,
│           TROPHÄEN GESAMT           │     darunter Label (Text App)
├──────────────┬──────────────────────┤
│ Partien      │ Siege                │  ← 2×2 Kacheln
│ Checkpoint   │ Siegquote            │
├─────────────────────────────────────┤
│ [Spiel-Icon] Doppelkopf      🏆 42  │  ← eine Zeile je Spiel
│ [Spiel-Icon] Wizard          🏆 18  │
└─────────────────────────────────────┘
```

Hero darf **breiter** wirken als die Kacheln; Spielzeilen volle Breite.
Alles sitzt weiter in einer `Tafel titel="Trophäen"` (Rahmen kommt aus
`menue-tafel`, nicht hier bestellen).

### 1 — `stat-hero-grund.png`

**Wozu:** Hintergrund der großen Trophäenzahl (ersetzt blauen Hero).

**Format:** 768 × 256, Randmaß **48 px**, border-image.

**Motiv:** Dunkles Nussbaum-Brett mit Messingrand, etwas erhabener als eine
normale Kachel — „Pokal-Podest“. Mitte ruhig und dunkel genug für goldene
Zahl `#ffe08a`. Oben etwas hellere Kante (Licht), unten Standfläche ~8 px.
**Kein Pokal im Bild** — den liefert Datei 3 darüber.

### 2 — `stat-kachel-grund.png`

**Wozu:** Hintergrund jeder 2×2-Statistik-Kachel (Partien, Siege, …).

**Format:** 512 × 384, Randmaß **40 px**.

**Motiv:** Flacheres Holzfeld, Messing-Hauch am Rand, ruhige Mitte. Etwas
weniger Kontrast als der Hero (Nebenrolle). Platz oben für kleines Icon,
darunter Zahl + Label (alles App-Text).

### 3 — `stat-spiel-grund.png`

**Wozu:** Hintergrund einer Spielzeile (Doppelkopf / Wizard mit Trophäenzahl).

**Format:** 768 × 128, Randmaß **32 px**.

**Motiv:** Querbrett, links Platz für Spiel-Icon (~64 px ruhig), rechts Platz
für Mini-Pokal + Zahl. Keine eingebrannten Symbole.

### 4 — `pokal-hero.png`

**Wozu:** Großer Pokal über/neben der Gesamtzahl. Ersetzt `/hub/pokal.png`
im Hero (das alte ist zu fein und „System-Gold“).

**Format:** 256 × 256, freigestellt.

**Motiv:** Plastischer Siegerpokal, warmes Gold, Sockel, bei **64 px** noch
klar als Pokal lesbar. Verwandt mit `icon-trophaeen.png` aus ASSETS-PROFIL,
aber **größer und feierlicher** (Hero, nicht Kachel-Icon).

### 5 — `pokal-zeile.png`

**Wozu:** Mini-Pokal in der Spielzeile und ggf. Ranglisten.

**Format:** 128 × 128, freigestellt.

**Motiv:** Vereinfachte Fassung von (4), Silhouette bei **24 px** noch klar.
Keine Sternchen-Kleinkram.

### 6 — `icon-stat-partien.png`
### 7 — `icon-stat-siege.png`
### 8 — `icon-stat-quote.png`
### 9 — `icon-stat-checkpoint.png`

**Wozu:** Die vier Kachel-Symbole (ersetzen bunte Fremd-Icons / Tab-Leihgaben).

**Format:** je 256 × 256, freigestellt, bei **32 px** erkennbar.

| Datei | Motiv |
|---|---|
| `icon-stat-partien` | Aufgefächerter kleiner Kartenstoß (kein Blatt-Index lesbar) |
| `icon-stat-siege` | Kleine Krone oder Lorbeer — nicht mit Clan-Krieg verwechselbar |
| `icon-stat-quote` | Einfache Waage oder Zielscheibe mit einem Treffer |
| `icon-stat-checkpoint` | Wegstein / Meilenstein mit kleinem Wimpel (kein Text) |

### 10 — `icon-spiel-doppelkopf.png`
### 11 — `icon-spiel-wizard.png`

**Wozu:** Links in der Spielzeile (statt generischem `tab-spielen.webp`).

**Format:** 256 × 256.

| Datei | Motiv |
|---|---|
| `icon-spiel-doppelkopf` | Zwei überkreuzte Eicheln/Blätter oder Doko-Tisch von oben — ohne lesbare Kartenwerte |
| `icon-spiel-wizard` | Zauberhut / Sternenkarte — klar „Wizard“, nicht Fantasy-RPG-Held |

---

# Teil 2 — Einstellungen (eigene Bilder, keine Emojis)

Blatt: `Einstellungen.tsx` — heute nur Text + HTML-Range. Braucht gemalte
Träger und Zeilen-Icons.

### 12 — `einstellungen-blatt.png`

**Wozu:** Hintergrund der Einstellungs-Karte (Sheet), falls nicht schon
`menue-blatt` reicht. Wenn `menue-blatt.webp` optisch passt: **dieses Bild
weglassen** und in der Lieferung vermerken „blatt = menue-blatt“.

**Format:** 768 × 1024, Randmaß 64 px, Mitte ~85 % deckend — wie `menue-tafel`.

### 13 — `icon-einstellung-sounds.png`
### 14 — `icon-einstellung-musik.png`

**Wozu:** Links neben den Reglern „Sounds“ und „Musik“.

**Format:** 256 × 256.

| Datei | Motiv |
|---|---|
| Sounds | Kleine Glocke oder Lautsprecher aus Holz/Messing (kein Unicode-🔊) |
| Musik | Laute oder Notenblatt auf Holz — verwandt mit `icon-klanghalle`, aber einfacher |

### 15 — `einstellung-regler-trog.png`
### 16 — `einstellung-regler-knopf.png`

**Wozu:** Lautstärke-Regler: Rinne + Schieber-Knopf (ersetzt nacktes `<input type=range>`-Blau).

**Format:**
- Trog: 512 × 64, Randmaß 24 px (wie XP-Balken-Trog)
- Knopf: 128 × 128, freigestellte Messing-Perle / Holzknauf

---

# Teil 3 — Benachrichtigungen (eigene Bilder)

Der Knopf existiert (`icon-benachrichtigung`), der Screen ist „Bald“. Für die
komplette Überschreibung jetzt mitbestellen, damit Claude nicht mit Emojis
füllen muss.

### 17 — `icon-benachrichtigung.png` (Ersatz, falls vorhanden zu „Emoji“)

**Wozu:** Konto-Knopf + künftiger Screen-Titel. Messingglocke, plastisch,
bei 32 px klar. **Überschreibt** die aktuelle Datei gleichen Namens, wenn die
alt wirkt.

### 18 — `icon-benachrichtigung-leer.png`

**Wozu:** Leerer Zustand „Keine Nachrichten“.

**Format:** 256 × 256 — Glocke mit weichem „Ruhe“-Strahl oder geschlossenem
Klöppel, nicht niedlich-Emoji.

### 19 — `icon-benachrichtigung-freund.png`
### 20 — `icon-benachrichtigung-clan.png`
### 21 — `icon-benachrichtigung-belohnung.png`

**Wozu:** Zeilen-Typen in der künftigen Liste.

| Datei | Motiv |
|---|---|
| Freund | Zwei kleine Pinguine oder Handschlag-ohne-Emoji |
| Clan | Kleines Wappen-Schild (ohne Clan-Text) |
| Belohnung | Mini-Truhe oder Sternen-Münze |

### 22 — `benachrichtigung-zeile-grund.png`

**Wozu:** Hintergrund einer Benachrichtigungs-Zeile.

**Format:** 768 × 128, Randmaß 32 px — wie Spielzeile, etwas ruhiger.

---

# Teil 4 — Konto-Knöpfe (Feinschliff / Überschreiben)

Falls die aus `ASSETS-PROFIL` gelieferten Icons noch emojihaft wirken:
**neu liefern und alte ersetzen** (gleicher Dateiname).

### 23 — `icon-einstellungen.png` — Zahnrad aus Messing an Holzbrett
### 24 — `icon-abmelden.png` — Tür halb offen (kein Pfeil-Emoji)
### 25 — `icon-konto-loeschen.png` — optional: gebrochene Plakette / Warnschild Holz, für den roten Löschen-Weg (heute nur Text)

---

## Dateiliste (Ablage `packages/client/art/`)

```
stat-hero-grund.png
stat-kachel-grund.png
stat-spiel-grund.png
pokal-hero.png
pokal-zeile.png
icon-stat-partien.png
icon-stat-siege.png
icon-stat-quote.png
icon-stat-checkpoint.png
icon-spiel-doppelkopf.png
icon-spiel-wizard.png
icon-einstellung-sounds.png
icon-einstellung-musik.png
einstellung-regler-trog.png
einstellung-regler-knopf.png
icon-benachrichtigung.png
icon-benachrichtigung-leer.png
icon-benachrichtigung-freund.png
icon-benachrichtigung-clan.png
icon-benachrichtigung-belohnung.png
benachrichtigung-zeile-grund.png
icon-einstellungen.png
icon-abmelden.png
icon-konto-loeschen.png
```

Optional: `einstellungen-blatt.png` nur wenn `menue-blatt` nicht reicht.
**Bei dieser Lieferung weggelassen** — Einstellungs-Sheet weiter `menue-blatt` nutzen.

**Anzahl:** 24 Pflicht + 1 optional.

---

## Anordnung für Claude (nach Bildlieferung)

1. Blaue CSS-Verläufe an `.hub-stat-*` **entfernen**; stattdessen `border-image`
   bzw. `background-image` mit den neuen Gründen.
2. `StatHero` / `StatKachel` / `StatSpiel` in `hub.tsx`: neue Icon-Pfade,
   Hero-Layout Pokal links + Zahl (nicht alles zentriert gestapelt, wenn das
   Bild das hergibt).
3. `Einstellungen.tsx`: Icons neben Reglern, Range durch Trog+Knopf stylen
   (oder native Range unsichtbar über gemaltem Trog).
4. Benachrichtigungen-Screen: Zeilen mit `benachrichtigung-zeile-grund` + Typ-Icons;
   leerer Zustand mit `icon-benachrichtigung-leer`.
5. Konto-Knöpfe: sicherstellen, dass WebP aus den neuen PNGs kommen
   (`icon-einstellungen`, `icon-benachrichtigung`, `icon-abmelden`).

Server-Logik und Zahlen **unverändert**.

---

## Abnahme

1. Roter Grund: sauberes Alpha.
2. Stretch-Probe bei allen `*-grund` und Regler-Trog.
3. Icons bei 32 px erkennbar, Pokale bei 24/64 px.
4. Nebeneinander mit `menue-blatt`: **kein Blau**, gleiche Materialsprache.
5. Keine Schrift im Bild, keine Emojis.

---

## Reihenfolge beim Erzeugen

1. Drei Gründe (Hero, Kachel, Spielzeile) + beide Pokale — größter Sicht-Effekt.
2. Vier Stat-Icons + zwei Spiel-Icons.
3. Einstellungs-Icons + Regler.
4. Benachrichtigungs-Satz.
5. Konto-Icons überschreiben.
