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

## Stand der Erzeugung — TEILSTAND, nicht abnahmefähig

**Diese Stufe ist nicht erfüllt.** Verlangt sind laut ursprünglichem Auftrag ein
Creative „TikTok-Figuren“, 20 Bilder als Varianten, ein Kontaktbogen und das
verbrauchte Kontingent. Geliefert sind die Steckbriefe und **ein** Bild. Der
Rest hängt an einer offenen Entscheidung über Münzen (siehe unten). Diese
Datei hält fest, was es gibt und woran es hängt, und ersetzt keinen Teil
des Auftrags.

| Lieferung | Stand |
|---|---|
| Steckbriefe (Name, Art, Charakter, Rolle, Stimme) | **fertig**, `figuren.md` |
| Bild Nr. 1 Pelle (Grundform) | **erzeugt**, nur mit Wasserzeichen abrufbar (s. u.) |
| Bilder Nr. 2–20 | **offen**: kosten Münzen, nicht freigegeben |
| Kontaktbogen | **offen**: braucht die 20 Bilder |
| Creative „TikTok-Figuren“ | angelegt vom Orchestrator: `bb5cd6da-9b44-47c2-902b-3c8bf71f1a63`; noch ohne Varianten |
| Verbrauchtes Kontingent | **30 VerseIn-Münzen** (Bild 1), Guthaben 14.210 vor und nach dem Lauf vom 02.11. nachmittags |

### Woran es hängt (Verlauf am 02.11.2026)

1. **Nachmittags, Nachbesserung 4 dieser Aufgabe** (Auftragstext, 15:08 UTC):
   „KEINE Muenzen verbrauchen. Nur Seedance (unlimitiert) über den
   versein-MCP; kein Nano Banana Pro, keine weiteren Bilder gegen Münzen. […]
   Kostet ein Seedance-Aufruf Münzen […], SOFORT aufhören und melden.“ Statt
   der Einzelbilder sollte ein Vorstellungsvideo der 20 Figuren entstehen.
   Das ist die Quelle für „keine Münzen“; der ursprüngliche Auftrag selbst
   (der Videos ausschließt) ist nicht geändert worden.
2. **Prüfung im Folgelauf (Mood-XPS, DESKTOP-VL852RM):** Seedance kostet über
   den MCP sehr wohl Münzen. `estimate_cost`, 9:16, 4 s:
   - `kie-seedance-2.5` (Seedance 2.5): **520 Münzen**
   - `byteplus-seedance-2-mini` (Seedance 2.0 Mini): 80 Münzen

   VerseIn schreibt dazu: „Generating through an AI assistant is charged in
   VerseIn coins. Unlimited-plan allowances do not apply here.“ Die
   Unlimitiert-Regel gilt also **nur im VerseIn-Web**: In der Taskliste steht
   ein Seedance-2.5-Clip vom selben Tag, im Web erzeugt
   (`video_5af26cb6-…`, `via_assistant: false`), mit 0 Münzen. Nach der
   Vorgabe wurde deshalb **nichts erzeugt**, auch kein Video.
3. Damit sind beide Wege über den Worker gesperrt: Einzelbilder (Nano Banana
   Pro, 30 Münzen je 4K-Bild, zusammen 570, mit Kontaktbogen bis 650) und
   Video (Seedance über MCP, ab 520 je Clip). Ohne Münzen geht es nur über
   das VerseIn-Web, und dort muss ein Mensch klicken.

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
- **Auflösung:** 4K (3392 × 5056) statt der Beispielgröße 1024 × 1536 unter
  „Bildmaße“, weil der Auftrag „beste Qualität“ verlangt. Das Seitenverhältnis
  2:3 stimmt.
- **Wasserzeichen:** Über das MCP gibt VerseIn nur
  `…/generation-display/<aufgabe>/watermarked_v1.png` heraus, mit
  „VerseIn"-Zeichen unten rechts; andere Pfade antworten mit 403. Die Fassung
  ohne Zeichen kann nur ein Mensch mit VerseIn-Zugang im Web aus der
  Bibliothek laden. Für Steckbrief und Kontaktbogen reicht die Fassung mit
  Zeichen, für Werbung nicht.
- **Modell:** Nano Banana Pro statt Seedance 2.5, weil Seedance ein reines
  Videomodell ist und keine Standbilder erzeugt (siehe „Bildmaße“).
- **Kosten:** VerseIn fragt je Aufruf ab 50 Münzen nach Bestätigung
  (`confirm_above_coins`).

### Was ein Worker nicht kann

- Varianten im Creative anlegen: `steuerung.mjs creative …` meldet
  „Creative-Werkzeuge sind dem Orchestrator vorbehalten“.
  `creative datei hochladen` nimmt nur Videos (mp4, webm, mov).
- Im VerseIn-Web erzeugen, wo Seedance unlimitiert ist: Der MCP rechnet
  immer in Münzen ab.

### Weiter geht es auf einem dieser Wege (Entscheidung offen)

- **A — Münzen freigeben:** 19 Bilder Nano Banana Pro 4K (570 Münzen) plus
  Kontaktbogen per ffmpeg aus den Bildern (0 Münzen). Ein Worker kann das
  vollständig erledigen, dazu die Varianten über den Orchestrator.
- **B — Ein Mensch erzeugt im VerseIn-Web** mit Seedance 2.5 unlimitiert
  (Prompts aus `figuren.md`, Pelle und App-Icon als Referenz). Das ergibt
  Clips statt Standbilder, Einzelbilder und Kontaktbogen zieht danach ein
  Worker mit ffmpeg aus den Clips.
- **C — Auftrag ändern:** Stufe 1 wird förmlich auf „Steckbriefe + Bild 1“
  verkleinert, Bilder kommen in einer eigenen Aufgabe.

---

## Stil (gilt für alle Bilder und Clips der Figuren)

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

## Kontaktbogen (offen)

Ein Bild, **5 Spalten × 4 Zeilen**, Reihenfolge wie in `figuren.md`
(Zeile 1 = die fünf Pelle-Auslegungen). Je Kachel das Bild auf 2:3, darunter
**im Kontaktbogen** Nummer und Name (der Bogen ist ein Arbeitsblatt, kein
Werbebild — dort ist Schrift erlaubt). Abgelegt im Creative, nicht im Repo.

## Was ausdrücklich nicht zu dieser Stufe gehört

- keine Videos (Ausnahme nur, wenn Weg B oben gewählt wird)
- keine Stimmen (die Stimmbeschreibungen in `figuren.md` sind
  nur Vorgaben für ElevenLabs in einer späteren Stufe)
- nichts aus Ad 3, Variante 1 „Fehlt noch einer" (Basti, Nele, Kalle, die
  Handlung mit dem leeren vierten Platz)
