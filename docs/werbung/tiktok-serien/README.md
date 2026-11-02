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
| `README.md` | Stil, Bildmaße, Kontaktbogen, Stand der Erzeugung |

Bilder und Videos kommen **nicht** ins Repo. Sie liegen im Creative
„TikTok-Figuren" (brotool → Creatives). Im Repo stehen nur Texte und die
Kennungen.

---

## Stand der Erzeugung

| Schritt | Stand |
|---|---|
| Steckbriefe (Text) | **fertig**, `figuren.md` |
| Creative „TikTok-Figuren" anlegen | **offen**: braucht den Mood-XPS mit versien.ai-MCP |
| 20 Bilder erzeugen | **offen**: wie oben |
| Kontaktbogen | **offen**: entsteht aus den 20 Bildern |
| Creative-Kennung | — |
| Verbrauchtes Kontingent | 0 (noch nichts erzeugt) |

Der erste Lauf (02.11.2026) landete auf einem Rechner ohne versien.ai-MCP
(DESKTOP-VL852RM, nicht Mood-XPS). Deshalb gibt es bisher nur die Texte. Wer
die Bilder erzeugt, trägt die Varianten-Kennungen in die Spalte „Variante" der
Übersicht in `figuren.md` ein und füllt die Tabelle oben aus.

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

## Kontaktbogen

Ein Bild, **5 Spalten × 4 Zeilen**, Reihenfolge wie in `figuren.md`
(Zeile 1 = die fünf Pelle-Auslegungen). Je Kachel das Bild auf 2:3, darunter
**im Kontaktbogen** Nummer und Name (der Bogen ist ein Arbeitsblatt, kein
Werbebild — dort ist Schrift erlaubt). Abgelegt im Creative, nicht im Repo.

## Was ausdrücklich nicht zu dieser Stufe gehört

- keine Videos, keine Stimmen (die Stimmbeschreibungen in `figuren.md` sind
  nur Vorgaben für ElevenLabs in einer späteren Stufe)
- nichts aus Ad 3, Variante 1 „Fehlt noch einer" (Basti, Nele, Kalle, die
  Handlung mit dem leeren vierten Platz)
