# TikTok-Serien — Figuren (Stufe 1)

Projekt #15 „TikTok Ads für BroweGGames", Stufe 1: 20 Figuren mit Steckbrief.
Stand 02.11.2026.

Ziel der Serien: kurze Clips, in denen der Pinguin aus dem BroweGGames-Logo
mit seinen Freunden Sachen erlebt, Karten spielt und dabei für BroweGGames
wirbt. Diese Stufe legt nur die **Figuren** fest. Videos, Stimmen und
Drehbücher kommen in späteren Stufen.

| Datei | Inhalt |
|---|---|
| `figuren.md` | 20 Steckbriefe mit Bildvorgabe (Prompt) je Figur |
| `README.md` | Stil, Bildmaße, Stand der Erzeugung |

Bilder und Videos kommen **nicht** ins Repo. Sie liegen im Creative
„TikTok-Figuren" (brotool → Creatives). Im Repo stehen nur Texte und die
Kennungen.

---

## Stand der Erzeugung — Weg geändert, Einzelbilder eingestellt

> **Entscheidung vom 02.11.2026 (Tom, Team-Raum):** Es werden **keine
> VerseIn-Münzen** mehr verbraucht, also auch keine weiteren
> Nano-Banana-Bilder. Die angefragten 650 Münzen für die übrigen 19 Bilder
> und den Kontaktbogen sind **nicht freigegeben**. Benutzt wird nur noch das
> unlimitierte **Seedance**. Statt 19 Einzelbildern und eines Kontaktbogens
> entsteht ein **Vorstellungsvideo mit den Figuren**; der Auftrag dazu kommt
> als Nachbesserung dieser Aufgabe.

Damit gilt die ursprüngliche Lieferliste (20 Bilder, Kontaktbogen,
Varianten je Figur) nicht mehr. Was diese Stufe jetzt liefert:

| Lieferung | Stand |
|---|---|
| Steckbriefe (Name, Art, Charakter, Rolle, Stimme) | **fertig**, `figuren.md` |
| Bild Nr. 1 Pelle (Grundform) | **erzeugt**, bleibt als Referenz für das Video |
| Bilder Nr. 2–20 und Kontaktbogen | **entfallen** (Entscheidung oben) |
| Vorstellungsvideo der Figuren (Seedance) | **offen**, kommt als Nachbesserung |
| Creative „TikTok-Figuren" | **fehlt**: als Worker nicht anlegbar, siehe unten; für das Video weiter nötig |
| Verbrauchtes Kontingent | **30 VerseIn-Münzen** für Bild 1 (Guthaben danach 14.210), danach keine mehr |

Die Bildvorgaben in `figuren.md` bleiben stehen: Sie beschreiben Aussehen und
Stil jeder Figur und sind genauso der Ausgangspunkt für die Prompts des
Videos.

### Was bisher erzeugt ist (VerseIn, 02.11.2026)

| Nr. | Figur | VerseIn-Aufgabe | Modell | Münzen |
|---:|---|---|---|---:|
| 1 | Pelle (Grundform) | `image_ea6a43d3-1835-44eb-b039-6eca19fed2bd` | Nano Banana Pro, 4K, 2:3 (3392 × 5056) | 30 |

- **Referenzbild:** das App-Icon `packages/client/public/icon-1024.png` (Logo
  mit den drei Pinguinen und der Giraffe), hochgeladen zu VerseIn. Pelle Nr. 1
  ist ebenfalls hochgeladen, als Referenz für die Auslegungen Nr. 2–5.
- **Ergebnis Nr. 1:** Der Stil trifft die Vorgabe (dicke Outlines, flache
  Farben, Glubschaugen), Farben und Steuerkreuz kommen aus dem Logo. Ein
  Mangel: Die Karten tragen Buchstaben (Q, K, A), obwohl nur Farbsymbole
  verlangt waren. Ab Nr. 2 deshalb im Prompt: „card faces show only suit
  symbols, no letters or numbers".
- **Wasserzeichen:** Über das MCP gibt VerseIn nur
  `…/generation-display/<aufgabe>/watermarked_v1.png` heraus, mit
  „VerseIn"-Zeichen unten rechts; andere Pfade antworten mit 403. Die Fassung
  ohne Wasserzeichen muss jemand im VerseIn-Web aus der Bibliothek laden.
  Für Steckbrief und Kontaktbogen reicht die Fassung mit Zeichen; für Werbung
  nicht.
- **Kosten:** VerseIn fragt je Aufruf ab 50 Münzen nach Bestätigung
  (`confirm_above_coins`). Die übrigen 19 Bilder hätten bei 4K 570 Münzen
  gekostet (mit Kontaktbogen bis 650); diese Freigabe ist am 02.11.2026
  abgelehnt worden (siehe oben).

**Warum noch nicht vollständig:** Der versein-MCP läuft seit diesem Lauf auch
auf DESKTOP-VL852RM. Ein Creative in brotool kann ein Worker aber nicht
anlegen (`steuerung.mjs creative …` meldet „Creative-Werkzeuge sind dem
Orchestrator vorbehalten"). Varianten kann er auch nicht anlegen, und
`creative datei hochladen` nimmt ohnehin nur Videos (mp4, webm, mov).

### Für die Nachbesserung (Vorstellungsvideo)

1. **Nur Seedance**, keine münzpflichtigen Modelle. Vor jedem Aufruf
   `estimate_cost` ansehen: Steht dort ein Münzpreis über 0, nicht
   erzeugen, sondern melden.
2. Bild Nr. 1 (Pelle) liegt schon bei VerseIn und kann als Referenzbild
   dienen; das App-Icon ebenfalls.
3. Aussehen und Stil der übrigen Figuren aus `figuren.md` (Stilblock +
   Figuren-Prompt, Negativliste) in die Video-Prompts übernehmen.
4. Das Creative „TikTok-Figuren" muss der Orchestrator oder ein Mensch
   anlegen; `creative datei hochladen` nimmt mp4, webm und mov, das Video
   passt also hinein.

---

## Stil (gilt für alle 20 Bilder)

**Angelehnt an** den Look erwachsener US-Zeichentrickserien im Stil von Rick
and Morty, **aber nicht nachgebaut**:

- dicke, gleichmäßig schwarze Outlines, leicht zittrig, wie von Hand gezogen
- flache Farbflächen mit **einer** harten Schattenstufe, keine Verläufe
- große, runde Glubschaugen mit kleinen Pupillen, oft ungleich groß
- leicht schiefe Proportionen, übergroße Köpfe, dünne Gliedmaßen
- Farben kräftig, aber nicht neon; die Logofarben (Rot-Orange, Lila, Türkis,
  Giraffengelb, Nachtblau) sind die Grundpalette

**Im Prompt steht der Serienname nicht.** Er zieht das Modell sonst zu den
echten Figuren hin (Laborkittel, Haartolle, Portal-Grün). Die Merkmale oben
stehen stattdessen als Stilblock in jedem Prompt (siehe `figuren.md`).

**Was nicht ins Bild gehört** (Regel 5 aus `CLAUDE.md`, plus Werbeauflagen aus
`docs/werbung/ad-3/konzept.md`):

- kein Text, kein Schriftzug, kein Logo im Bild, keine Spielkartenwerte mit
  Schrift (Herz-, Pik-Symbole sind erlaubt)
- kein Schachbrett als Hintergrund; Hintergrund ist eine ruhige, einfarbige
  Fläche (helles Grau-Beige `#EDE6DA`), damit sich die Figuren später
  freistellen lassen
- kein Alkohol, keine Zigaretten, kein Geld auf dem Tisch (Glücksspiel-Anmutung
  ist bei TikTok-Werbung heikel)
- keine Markenkleidung, keine echten Messenger, keine erkennbaren Handys
- keine Ähnlichkeit zu bekannten Figuren: kein Laborkittel mit Haartolle,
  kein gelber Pulli mit Hemdkragen, keine Portale, keine bekannten
  Pinguin-Figuren aus Film und Fernsehen

## Bildmaße

- je Figur ein **Ganzkörperbild**, 2:3 hochkant (z. B. 1024 × 1536), Figur
  mittig, rundum Luft, Blick leicht zur Kamera
- beste verfügbare Qualität des Bildmodells; Seedance 2.5 ist ein
  Videomodell — für die Standbilder das Bildmodell nehmen, das versien.ai
  daneben anbietet, und hier vermerken, welches es war
- Pelle (Nr. 1) zuerst erzeugen und abnehmen; die Auslegungen 2–5 als
  Bild-zu-Bild von der abgenommenen Grundform, damit es dieselbe Figur bleibt

## Kontaktbogen (entfallen am 02.11.2026)

Gilt nicht mehr, steht nur zur Nachvollziehbarkeit hier: Ein Bild, **5 Spalten × 4 Zeilen**, Reihenfolge wie in `figuren.md`
(Zeile 1 = die fünf Pelle-Auslegungen). Je Kachel das Bild auf 2:3, darunter
**im Kontaktbogen** Nummer und Name (der Bogen ist ein Arbeitsblatt, kein
Werbebild — dort ist Schrift erlaubt). Abgelegt im Creative, nicht im Repo.

## Was ausdrücklich nicht zu dieser Stufe gehört

Ausnahme seit 02.11.2026: das Vorstellungsvideo der Figuren (siehe oben).

- keine Stimmen (die Stimmbeschreibungen in `figuren.md` sind
  nur Vorgaben für ElevenLabs in einer späteren Stufe)
- nichts aus Ad 3, Variante 1 „Fehlt noch einer" (Basti, Nele, Kalle, die
  Handlung mit dem leeren vierten Platz)
