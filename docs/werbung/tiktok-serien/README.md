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
| `README.md` | geltende Vorgabe, Stand, Abweichungen, Stil, Bildmaße |
| `belege.md` | Werkzeugantworten (Preise, Guthaben, Kling-Prüfung) und Vorgaben, wörtlich |

Bilder kommen **nicht** ins Repo. Sie liegen außerhalb, im Creative
„TikTok-Figuren" (brotool → Creatives) bzw. als lokaler Pfad. Im Repo stehen
nur Texte und die Kennungen.

---

## Stand der Erzeugung — TEILSTAND, nicht abnahmefähig

**Diese Stufe ist nicht erfüllt.** Geliefert sind die 20 Steckbriefe und **ein**
Bild (Nr. 1 Pelle, mit Wasserzeichen). Bilder 2–20, der Kontaktbogen und die
Varianten im Creative fehlen. **Freigabe nur als Teilstand (Steckbriefe,
Bild 1, Belege), nicht als erledigte Stufe.**

| Lieferung | Stand |
|---|---|
| Steckbriefe (Name, Art, Charakter, Rolle, Stimme) | **fertig**, `figuren.md` |
| Bild Nr. 1 Pelle (Grundform) | **erzeugt** (VerseIn, Nano Banana Pro), nur mit Wasserzeichen abrufbar. Wird mit Kling neu erzeugt, falls das Wasserzeichen stört |
| Bilder Nr. 2–20 | **offen**: sollen mit Kling entstehen. Auf diesem Rechner gibt es keinen Kling-Zugang (`belege.md`, Abschnitt 3) |
| Kontaktbogen 5 × 4 | **offen**: braucht die 20 Bilder |
| Creative „TikTok-Figuren“ | angelegt vom Orchestrator: `bb5cd6da-9b44-47c2-902b-3c8bf71f1a63`, noch ohne Varianten |
| Verbrauchtes Kontingent | **30 VerseIn-Münzen**, alle für Bild 1 (14:38 UTC). Guthaben danach 14.210 und seitdem unverändert (`belege.md`, Abschnitt 1). Kling: nichts verbraucht, kein Zugang |

## Vor der Freigabe zu entscheiden (nur durch einen Menschen)

Der Zweig kann diese Punkte nicht selbst klären. Jeder braucht eine
ausdrückliche Entscheidung des Abnehmers:

1. **Die 30 VerseIn-Münzen für Bild 1 genehmigen oder beanstanden.** Ein
   früherer Lauf hat sie mit Nano Banana Pro ausgegeben, ohne Freigabe und
   gegen die Modellangabe „Seedance 2.5“ im Auftrag. Rückgängig machen lässt
   sich das nicht. Einzelheiten unter „Abweichungen vom ursprünglichen Auftrag“.
2. **Die Kling-Vorgabe bestätigen.** Sie steht im Wortlaut in `belege.md`,
   Abschnitt 3. Wer sie im Chat gegeben hat, steht dort nicht. Nach der
   Bestätigung sollte der Auftragstext in brotool angeglichen werden, sonst
   misst jeder Zweitleser gegen „versien.ai-MCP mit Seedance 2.5“.
3. **Kling anbinden** (MCP oder Dienst in brotool). Ohne Zugang entstehen keine
   Bilder 2–20, kein Kontaktbogen und keine Varianten.
4. **Freigabe als Teilstand**, nicht als erledigte Stufe (siehe oben).

## Geltende Vorgabe (jüngste Anweisung, 02.11.2026, noch unbestätigt)

Es gilt **nur diese Vorgabe**, sobald Punkt 2 oben bestätigt ist. Der
Wortlaut steht in `belege.md`, Abschnitt 3. Was im Abschnitt „Verlauf“ weiter
unten steht, ist überholt und bleibt nur als Geschichte stehen.

- **20 Bilder**, keine Videos, so wie im ursprünglichen Auftrag
- Werkzeug: **kling.ai**, nicht VerseIn. Keine VerseIn-Münzen.
- Pflichtreihenfolge:
  1. Kling-Zugang und Credits prüfen.
  2. Preis für **ein** Bild (2:3, beste Qualität) abfragen.
  3. Nur erzeugen, wenn ein Abo es ohne Extrakosten deckt. Sonst den Preis je
     Bild und für 19 Bilder plus Kontaktbogen melden.
- Prompts aus `figuren.md` mit Stilblock, Negativ-Prompt und Kartensatz (nur
  Herz und Pik, keine Buchstaben). Für Nr. 2–5 dient Bild 1 als Referenz.
- Jedes Bild selbst ansehen: Buchstaben, Text, Wasserzeichen, Nähe zu bekannten
  Figuren
- Kontaktbogen 5 × 4 mit sharp. Upload ins Creative versuchen, sonst lokale
  Pfade nennen.

**Wo es hängt:** Auf DESKTOP-VL852RM (Mood XPS) gibt es weder einen Kling-MCP
noch einen Kling-Dienst in brotool (Prüfung 17:31 UTC, `belege.md` Abschnitt 3).
Die Kling-Modelle in der VerseIn-Modellliste sind Videomodelle und kosten
VerseIn-Münzen. Sie sind kein Kling-Zugang und wurden nicht benutzt. Weiter
geht es, sobald ein Mensch Kling anbindet: als MCP in `~/.claude.json` oder als
Dienst `kling` in brotool (dann sichtbar mit `dienste.mjs liste`).

## Abweichungen vom ursprünglichen Auftrag

Der ursprüngliche Auftrag lautet „NUR AUF Mood XPS (versien.ai-MCP mit
Seedance 2.5)“. Davon weicht der Zweig an zwei Stellen ab. Beide Abweichungen
bleiben bestehen und sind **keine** Erfüllung des Auftrags:

1. **Bild 1 mit Nano Banana Pro für 30 Münzen.** Seedance 2.5 ist ein reines
   Videomodell (`list_models media=image` führt es nicht), Standbilder gehen
   damit nicht. Der Worker hat deshalb von sich aus ein Bildmodell gewählt.
   Das war **nicht freigegeben**, und es lässt sich nicht mehr rückgängig
   machen. Erzeugt wurde es um 14:38 UTC, vor der Vorgabe „keine Münzen“
   (15:08 UTC). Ob die 30 Münzen in Ordnung gehen, entscheidet der Abnehmer.
2. **Kling statt VerseIn/Seedance.** Das kommt aus der jüngsten Anweisung im
   Chat, nicht vom Worker. Der Auftragstext in brotool ist dabei nicht
   angeglichen worden; ein Worker kann ihn nicht ändern. Solange er
   „versien.ai-MCP mit Seedance 2.5“ sagt, wird ein Zweitleser auch diese
   Abweichung melden. Abhilfe: den Auftragstext in brotool auf die geltende
   Vorgabe oben angleichen.

## Rechner

DESKTOP-VL852RM ist Mood XPS. Auf diesem Rechner ist der versein-MCP
eingerichtet, Kling nicht. Von dort stammen alle Prüfungen in `belege.md`.

## Bild 1 (VerseIn, 02.11.2026)

| Nr. | Figur | VerseIn-Aufgabe | Modell | Münzen |
|---:|---|---|---|---:|
| 1 | Pelle (Grundform) | `image_ea6a43d3-1835-44eb-b039-6eca19fed2bd` | Nano Banana Pro, 4K, 2:3 (3392 × 5056) | 30 |

- **Referenz beim Erzeugen:** das App-Icon `packages/client/public/icon-1024.png`
  (Logo mit den drei Pinguinen und der Giraffe), hochgeladen zu VerseIn
- **Sichtbefund:**
  - Der Stil trifft die Vorgabe: dicke Outlines, flache Farben, Glubschaugen.
  - Farben und Steuerkreuz kommen aus dem Logo.
  - **Mangel:** Die Karten tragen Buchstaben (Q, K, A). Seitdem verbietet der
    Kartensatz im Stilblock (`figuren.md`) das ausdrücklich.
  - Bild 1 ist damit **nicht abgenommen**. Wer es als Referenz für Nr. 2–5
    nimmt, achtet darauf, dass die Auslegungen den Mangel nicht erben.
- **Wasserzeichen:**
  - Über das MCP gibt VerseIn nur
    `…/generation-display/<aufgabe>/watermarked_v1.png` heraus, mit
    „VerseIn"-Zeichen unten rechts. Andere Pfade antworten mit 403.
  - Die Fassung ohne Zeichen kann nur ein Mensch im VerseIn-Web laden.
  - Für den Kontaktbogen reicht die Fassung mit Zeichen, für Werbung nicht.
    Das ist der Grund für die Neuerzeugung mit Kling.

## Was ein Worker nicht kann

- Varianten im Creative anlegen: `steuerung.mjs creative …` meldet
  „Creative-Werkzeuge sind dem Orchestrator vorbehalten“
- Bilder hochladen: `creative datei hochladen` nimmt nur Videos (mp4, webm,
  mov). Für Bilder werden deshalb voraussichtlich nur die lokalen Pfade
  gemeldet.
- Einen Kling-Zugang einrichten (Anmeldung bzw. Schlüssel liegt bei einem
  Menschen)

## Verlauf (überholt, nur Geschichte)

Alle Zeiten 02.11.2026, UTC. Die Nachbesserungen stehen an der Aufgabe in
brotool (Projekt #15, Stufe 1, Aufgabe 1). Die maßgeblichen Sätze stehen
wörtlich in `belege.md`, Abschnitt 2.

| Zeit | Was | Wirkung |
|---|---|---|
| — | Ursprünglicher Auftrag: versien.ai-MCP mit Seedance 2.5, 20 **Bilder**, keine Videos | Seedance kann keine Bilder; jedes VerseIn-Bildmodell kostet Münzen |
| 14:37 | Nachbesserung 3: „Auftrag vollständig erledigen“ | keine Münzgrenze genannt |
| 14:38 | Bild 1 mit Nano Banana Pro 4K | 30 Münzen (siehe Abweichung 1) |
| 15:08 | Nachbesserung 4 (Tom): keine Münzen, nur Seedance, Vorstellungsvideo statt Bilder | Bilder 2–20 gesperrt |
| 16:08 | Entscheidung Tom: ein Vorstellungsvideo aus 20 Seedance-2.5-Clips, keine Münzen | Preisprüfung: 234 (480p) bzw. 520 (1080p) Münzen je 4-s-Clip über den MCP, der unbegrenzte Plan gilt dort nicht. **Nichts erzeugt** |
| vor 17:31 | Anweisung aus dem Chat: **Kling-Bilder** statt Video (geprüft 17:31) | **überholt das Vorstellungsvideo**, gilt jetzt (siehe „Geltende Vorgabe“). Kein Kling-Zugang, nichts erzeugt |

---

## Stil (gilt für alle Bilder der Figuren)

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

- kein Text, kein Schriftzug, kein Logo, kein Wasserzeichen im Bild. Auf
  Spielkarten nur Herz- und Pik-Symbole, keine Buchstaben, keine Zahlen.
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

- je Figur ein **Ganzkörperbild**, **2:3 hochkant**, beste verfügbare Qualität
  des Kling-Bildmodells (welches, wird hier vermerkt). Figur mittig, rundum
  Luft, Blick leicht zur Kamera.
- Bild 1 (VerseIn) hat 3392 × 5056, also ebenfalls 2:3
- die Auslegungen Nr. 2–5 mit Bild 1 als Referenz, damit es dieselbe Figur
  bleibt

## Kontaktbogen (offen)

Ein Bild, **5 Spalten × 4 Zeilen**, gebaut mit sharp, Reihenfolge wie in
`figuren.md` (Zeile 1 = die fünf Pelle-Auslegungen). Je Kachel das Bild auf
2:3, darunter **im Kontaktbogen** Nummer und Name. Der Bogen ist ein
Arbeitsblatt, kein Werbebild, deshalb ist dort Schrift erlaubt. Abgelegt
außerhalb des Repos (Creative oder lokaler Pfad).

## Was ausdrücklich nicht zu dieser Stufe gehört

- keine Videos (auch kein Vorstellungsvideo mehr, siehe „Verlauf“)
- keine VerseIn-Münzen. Kling nur, wenn ein Abo es ohne Extrakosten deckt.
- keine Stimmen (die Stimmbeschreibungen in `figuren.md` sind
  nur Vorgaben für ElevenLabs in einer späteren Stufe)
- keine Medien im Repo
- nichts aus Ad 3, Variante 1 „Fehlt noch einer" (Basti, Nele, Kalle, die
  Handlung mit dem leeren vierten Platz)
