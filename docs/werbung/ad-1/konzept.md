# Ad 1 — „Dir fehlt der Vierte?" (Konzept und Storyboard)

Erste echte Werbung für Brauweg Spielen. Dieses Blatt ist **nur das Konzept**:
Es wird hier nichts erzeugt. Erzeugt wird in der Folgekarte, und zwar nach dem
Verfahren in bro-server `docs/creatives/ki-ads-verfahren.md` (Referenzen →
Figur/Charakterbogen → Ankerbild → Szenen als Stapel → **Freigabe des
Storyboards** → Video nur aus freigegebenen Bildern → Schnitt und Ton).

Stand 19.10.2026. Was in der App gezeigt wird, ist ausschließlich Version 1.0:
Doppelkopf, Skat, Partykiste (`docs/store/PRUEFHINWEISE.md`, Notes). Alles
andere steht in der App auf „Bald" und kommt nicht vor.

---

## 1. Zielgruppe und Kernbotschaft

**Zielgruppe:** Leute zwischen 25 und 55, die eine feste Doppelkopf- oder
Skatrunde haben oder hatten — Freundeskreis, Familie, WG. Sie kennen die
Regeln und brauchen keine Erklärung. Ihr Problem ist nicht das Spiel, sondern
die Runde: Einer sagt ab, und dann fällt der Abend aus.

**Kernbotschaft (eine):** *Fehlt einer, spielt ihr trotzdem — ein Bot nimmt
den freien Platz.*

**Zum Vorschlag „Dir fehlt der Vierte? Bots springen ein / spiel mit Freunden
online":** Der erste Teil trägt, der zweite ist eine zweite Botschaft. „Online
mit Freunden" ist ein anderer Nutzen (Entfernung) als „Bot statt Absage"
(Vollständigkeit), und 25 Sekunden reichen für einen. Deshalb:

- **„Dir fehlt der Vierte?"** bleibt als Hook — wörtlich, weil Doppelkopf vier
  braucht und genau diese Frage in jeder Runde schon einmal gefallen ist.
- **„Bots springen ein"** ist die Auflösung. Belegt durch die App: freie Plätze
  füllt „+ Bot", Bots in drei Stärken (`docs/store/TEXTE.md`).
- **„Mit Freunden online"** fällt aus dieser Ad heraus und taugt als Ad 2
  (siehe offene Fragen). Mitgemeint ist es trotzdem: Die drei am Tisch spielen
  jeder am eigenen Handy am selben Tisch in der App, der Bot sitzt als Vierter.

---

## 2. Hook und Geschichte (9:16, 28 s)

**Hook, 0–2 s:** Ein Handy auf dem Küchentisch vibriert neben einem
Kartenstapel, eine Hand hält mitten im Mischen inne. Einblendung: **„Dir fehlt
der Vierte?"** Die Musik bricht ab. Wer je eine Runde organisiert hat, weiß in
diesem Moment, was auf dem Display steht.

**Geschichte, 2–28 s:** Sonntagabend, drei Freunde an einem Küchentisch, ein
vierter Stuhl bleibt leer. Jule, die die Runde ausrichtet, seufzt — dann grinst
sie, greift zum Handy: Tisch erstellen, „+ Bot", die Karten werden ausgeteilt.
Die drei spielen weiter, jeder am eigenen Handy, der Bot sticht mit. Ein guter
Stich, Gelächter am Tisch. Kurzer Ausblick: auch beim Skat. Endkarte.

Bogen: **Absage (Verlust) → Griff zum Handy (Wende) → Abend gerettet (Lohn)**.
Kein Sprecher; die Geschichte tragen Bild, Einblendung und Musik, damit sie
auch stumm im Feed funktioniert.

---

## 3. Szenenliste

KI = Standbild aus Nano Banana Pro, dann mit Kling (Bild zu Video) bewegt.
Bildschirmaufnahme = Clip aus `werkzeug/store/clips.mjs` (Dateiname wie in
`liste.md`; die Clips sind 5–10 s lang und werden im Schnitt gekürzt).

| Nr | Zeit | Art | Bildinhalt | Kamera/Bewegung (für den Video-Prompt) | Dauer | Texteinblendung | Ton |
|---|---|---|---|---|---|---|---|
| 1 | 0–2 s | KI | Nah: Handy auf Holztisch leuchtet auf, daneben Kartenstapel; Jules Hände halten mitten im Mischen inne | statisch, minimaler Push-in aufs Handy; Hände stoppen | 2 s | **Dir fehlt der Vierte?** | Vibrieren, Musik bricht ab |
| 2 | 2–5 s | KI | Halbtotale: drei Freunde am Küchentisch unter Hängelampe, vierter Stuhl leer, Jule blickt aufs Handy und seufzt | langsamer Push-in auf den leeren Stuhl | 3 s | Sonntag. Doppelkopf. Einer sagt ab. | Raumton, Seufzer |
| 3 | 5–8 s | KI | Nah auf Jule: Enttäuschung kippt in ein Grinsen, sie hebt das Handy | Schwenk vom leeren Stuhl auf Jule, leichte Handkamera | 3 s | — | Musik setzt mit Beat ein |
| 4 | 8–12 s | Bildschirmaufnahme **02-doppelkopf-austeilen** | Letzter Bot setzt sich, Karten werden ausgeteilt, „gesund" | — (Clip, im Handyrahmen) | 4 s | Bot rein. Karten raus. | Karten-Wischen, Beat |
| 5 | 12–15 s | KI | Über die Schulter: alle drei beugen sich über ihre eigenen Handys, der leere Stuhl stört niemanden mehr | langsame halbe Kreisfahrt um den Tisch | 3 s | Ihr drei am Tisch. Der Bot als Vierter. | Musik, Tippen |
| 6 | 15–19 s | Bildschirmaufnahme **04-doppelkopf-stich** | Vierte Karte schließt den Stich, Stich wird eingezogen | — (Clip, im Handyrahmen) | 4 s | Der Bot spielt mit — in drei Stärken. | Karten-Klack auf dem Beat |
| 7 | 19–22 s | KI | Reaktion: Freund schlägt lachend auf den Tisch, Jule reißt triumphierend die Faust hoch | Handkamera, kurzer Ruck mit der Bewegung | 3 s | — | Lachen, Musik-Höhepunkt |
| 8 | 22–25 s | Bildschirmaufnahme **06-skat-reizen** | Reizen mit Reizrechner, „18 sagen" | — (Clip, im Handyrahmen) | 3 s | Beim Skat fehlt der Dritte auch nie. | Beat läuft weiter |
| 9 | 25–28 s | Endkarte (vorhandene **df3fdc38**), dahinter gedimmt **01-spielauswahl** | Brauweg-Logo, „Doppelkopf · Skat · Partykiste", „Bald im App Store", brauweg-spielen.de | — | 3 s | Brauweg — Doppelkopf, Skat, Partykiste. Bald im App Store. | Musik klingt aus |

**Bewusst nicht verwendet:** Clip **10-partykiste-start** zeigt den Schalter
„Trinkspiel / Alkoholfrei" im Menü — passt nicht zur Regel „kein Alkohol" in
Werbung. Die Partykiste kommt deshalb nur als Name auf der Endkarte vor. Die
Clips 11–13 (Allgemeinwissen) wären unbedenklich, passen aber nicht zur
Kernbotschaft (Partykiste heißt: alle sind da).

**Handyrahmen für die Clips:** Die Aufnahmen sind 1080 × 1920 und füllen das
Bild. Im Schnitt werden sie leicht verkleinert in einem schlichten dunklen
Handyrahmen auf nachtblauem Grund gezeigt, damit klar ist: Das ist die App, und
die KI-Szenen sind der Abend drumherum. Kein Gerätemodell eines Herstellers
nachbilden (Marke).

---

## 4. Hauptfigur(en)

**Jule (Hauptfigur)** — Anfang 30, richtet die Runde aus. Schulterlange,
dunkelbraune Locken, locker zusammengebunden; warmes, offenes Gesicht mit
Sommersprossen; senfgelber Strickpullover über weißem Shirt, Jeans; schmale
goldene Ohrstecker. Ausdruck: lebhaft, schnell vom Frust zum Plan.
Senfgelb ist gewählt, weil es das Gold der App aufnimmt (`--hb-gold`
`#f5c02e`) und sich vom dunklen Raum abhebt.

**Nebenfiguren** — Tarek (Mitte 30, kurzer Bart, nachtblaues Hemd) und Mira
(Ende 20, kurze blonde Haare, grüne Strickjacke). Sie stehen in Szene 2, 5 und
7 nur halb im Bild oder in der Unschärfe. Einen eigenen Charakterbogen
bekommt zunächst **nur Jule**; Tarek bekommt einen zweiten nur dann, wenn er in
Szene 7 im Storyboard nicht wiedererkennbar bleibt (im Kostenvoranschlag als
Reserve gerechnet).

**Ablauf:** Erst 4 Porträtvarianten von Jule (Prompt unten), eine auswählen,
dann den Charakterbogen mit dem ausgewählten Porträt als Referenz.

Porträt-Prompt (4 Varianten):

```text
Portrait of a woman in her early thirties, shoulder-length dark brown curls loosely tied back, freckles, warm open face, mustard-yellow knit sweater over a white t-shirt, small gold stud earrings. Warm evening light from a single lamp, dark cozy kitchen behind her. Lively, a little mischievous expression. Natural, photographic, no makeup look.
```

Charakterbogen-Prompt (Referenz: ausgewähltes Porträt):

```text
Character reference sheet of the woman in the reference image, same face, hair and clothing. Top row: full body standing, front view, three-quarter view, side view, back view, like a 3D model turnaround, neutral pose. Bottom row: close-ups of the face — front, three-quarter left, three-quarter right, profile, and one smiling. Plain light grey background, even soft light, consistent proportions across all views. No text, no labels.
```

---

## 5. Look — Referenzen

Keine fremden Filmstills (Rechte). Die Referenzen werden als Beschreibung
gegeben bzw. sind eigene Screenshots aus `werkzeug/store/screenshots.mjs`.

| R | Beschreibung | Trägt |
|---|---|---|
| R1 | **Küchentisch am Abend:** Holztisch, eine tief hängende Lampe mit warmem Licht (Glühbirnenton), der Rest des Raums fällt ins Dunkel; im Fenster dahinter blaue Stunde. | Ort, Licht |
| R2 | **Farbklang Nachtblau & Gold** wie im neuen Hub (`docs/DESIGN.md`: `#0e1a3d`, `#f5c02e`): Schatten kühl-blau, Lichter warm-golden; ein grüner Akzent (`#48d56b`) nur sparsam an Requisiten. | Farbe |
| R3 | **Eigener Screenshot des Doppelkopf-Tischs** (dunkler Filz, Kartenfächer) aus `screenshots.mjs` — als Farbe für das Displaylicht, das auf Gesichter fällt. | Bildschirmlicht |
| R4 | **Nähe wie in einem Dokumentarfilm unter Freunden:** Augenhöhe, geringe Schärfentiefe, Hände und Gesichter groß, nichts Gestelltes. | Bildsprache |
| R5 | **Requisiten:** Teetassen, Wasserkaraffe, eine Schale Brezeln, ein abgegriffenes Kartenblatt ohne Aufdruck eines Herstellers, Block mit Strichliste. | Detail |

**Nicht ins Bild** (gilt für jeden Prompt, steht im Ankerbild als Negativliste):
Gläser mit Wein oder Bier, Flaschen, Kneipe, Bierdeckel; lesbarer Text, Logos,
Markenkarten; Handys mit erkennbarem Herstellerlogo; Spielinhalte anderer
Spiele (Würfel, Brettspiele); Rauchen.

---

## 6. Prompts

Die Prompts sind englisch: Sie sind Eingabe für die Modelle, keine
Oberflächentexte, und beide Modelle folgen englischen Anweisungen am
verlässlichsten. Einblendungen und Endkarte bleiben deutsch und entstehen im
Schnitt, nicht im Bild.

### 6.1 Ankerbild

Eingänge: Charakterbogen Jule + R3 (eigener Screenshot). 9:16, 1K, 3 Varianten.

```text
Sunday evening in a cozy kitchen. Three friends at a wooden table under a single warm hanging lamp, the room fading into dark blue shadows, blue hour in the window. The woman from the character sheet shuffles a deck of plain playing cards, mugs of tea and a bowl of pretzels on the table. The fourth chair is empty. Warm gold light against cool navy shadows, intimate, a little melancholic. No alcohol, no bottles, no readable text, no logos.
```

### 6.2 Szenen-Prompts für den Stapel (20, gegen das Ankerbild)

Je KI-Szene vier Prompts (verschiedene Blickwinkel bzw. Momente), damit für die
Freigabe eine Wahl bleibt. Eingang jeweils: Ankerbild + Charakterbogen.

```json
[
  "S1a: Close-up of a phone lighting up on the wooden table next to a card deck, her hands frozen mid-shuffle, warm lamp light, quiet tension",
  "S1b: Top-down view of the table: card deck, tea mug, glowing phone face-up, her hands paused above the cards",
  "S1c: Macro of her fingers holding half-shuffled cards, blurred glowing phone in the foreground",
  "S1d: Low angle across the tabletop, phone vibrating in focus, her face soft in the background, expectant",

  "S2a: Medium shot of three friends at the table, the fourth chair empty in the foreground, she looks at her phone and sighs",
  "S2b: Wide shot from the kitchen door, warm pool of light on the table, one empty chair, dark room around",
  "S2c: Over the empty chair towards the three friends, slightly disappointed faces",
  "S2d: She leans back with the phone in hand, friends shrug, the empty chair between them",

  "S3a: Close-up of her face, disappointment turning into a sly grin, phone raised",
  "S3b: Medium close-up, she holds up the phone to her friends with a confident smile, they look curious",
  "S3c: Her face lit by the phone screen, determined, lamp light on her hair",
  "S3d: Profile shot, she taps the phone, a smile spreading, friend in soft focus behind",

  "S4a: Over-the-shoulder, all three leaning over their own phones, the empty chair in the frame, nobody minds it anymore",
  "S4b: Top-down view of the table: three pairs of hands with glowing phones, the empty place with an untouched tea mug",
  "S4c: Wide shot, the three friends focused and smiling at their screens, screen light on their faces, the empty chair beside them",
  "S4d: Close-up of the empty chair, friends laughing over their phones in soft focus behind it",

  "S5a: Reaction: the bearded friend slaps the table laughing, she throws her fist up in triumph",
  "S5b: Medium shot, all three laughing loudly, cards and phones on the table, warm joyful light",
  "S5c: Close-up of her triumphant grin, friend's hand clapping her shoulder",
  "S5d: Wide shot from outside the window, the lit kitchen full of laughter in the blue night"
]
```

S1–S5 gehören zu den Szenen 1, 2, 3, 5 und 7 der Tabelle (die
Bildschirmaufnahmen brauchen keinen Prompt). 20 von höchstens 30 Prompts; die
übrigen 10 sind Reserve für Nachbesserungen nach der ersten Sichtung.

### 6.3 Video-Prompts (Kling, Bild zu Video, je freigegebenem Standbild)

Nur Kamera und Handlung — wie es aussieht, steckt im Bild. 5 s je Clip,
geschnitten wird auf die Dauer der Tabelle.

| Szene | Video-Prompt |
|---|---|
| 1 | Static shot with a very slow push-in on the phone. The phone vibrates once, her hands stop shuffling and hold still. |
| 2 | Slow push-in towards the empty chair. She lowers the phone and sighs, the friends glance at each other. |
| 3 | Camera pans from the empty chair to her face, slight handheld movement. Her disappointed look turns into a grin and she lifts the phone. |
| 5 | Slow half orbit around the table. The three friends tap on their phones and lean in, the empty chair stays in view. |
| 7 | Handheld, short jolt with the movement. The friend slaps the table laughing, she throws her fist up. |

**Verkettung (K5):** Szene 2 → 3 ist eine fortlaufende Bewegung (Stuhl →
Gesicht). Das letzte Bild von Szene 2 wird Startbild von Szene 3, falls das
freigegebene Standbild von Szene 3 im Schnitt nicht anschließt.

---

## 7. Kostenvoranschlag

Preise aus der Modellliste in bro-server, `origin/staging`,
`src/lib/creatives/ki-anbieter.ts` (`KI_MODELLE`):

- **Nano Banana Pro** (`kennung: "nano-banana-pro"`, Endpunkt
  `fal-ai/nano-banana-pro/edit`): 15 ct je Bild in 1K, Stand 19.10.2026.
- **Kling 2.5 Turbo Pro, Bild zu Video** (`kennung: "kling-bild"`, Endpunkt
  `fal-ai/kling-video/v2.5-turbo/pro/image-to-video`): 0,07 $ je Sekunde,
  gebucht 7 ct/s — **5 s = 35 ct**, 10 s = 70 ct. Stand 18.10.2026.

Gebucht wird der Dollarbetrag als Euro-Cent (Kopf von `ki-anbieter.ts`), die
Zahlen unten liegen also eher über dem echten Preis.

**Standbilder (Ziel ≤ 5 €)**

| Posten | Bilder | Kosten |
|---|---|---|
| Porträtvarianten Jule | 4 | 0,60 € |
| Charakterbogen Jule (2 Versuche) | 2 | 0,30 € |
| Ankerbild (3 Varianten) | 3 | 0,45 € |
| Szenen-Stapel (20 Prompts × 1) | 20 | 3,00 € |
| Reserve: Charakterbogen Tarek oder Nachbesserungen | 4 | 0,60 € |
| **Summe** | **33** | **4,95 €** |

**Videos (Ziel ≤ 15 €) — nur für freigegebene Standbilder**

| Posten | Clips | Kosten |
|---|---|---|
| 5 KI-Szenen × 2 Varianten × 5 s | 10 | 3,50 € |
| Nachdrehs (Szene misslungen, z. B. Hand zieht zurück) | 6 | 2,10 € |
| Verkettung Szene 2 → 3 (K5), 2 Versuche | 2 | 0,70 € |
| **Summe** | **18** | **6,30 €** |

**Gesamt: höchstens 11,25 €** — innerhalb eines Tageslimits von 20 €
(`TAGESLIMIT_VORGABE_CENT` in `src/lib/creatives/kosten.ts`), also an einem
Tag erzeugbar. Bildschirmaufnahmen und Endkarte kosten nichts (vorhanden).

Hinweis: Das Verfahren nennt Kling 3.0 als Empfehlung; angebunden ist bei uns
Kling 2.5 Turbo Pro. Für diese Ad genügt das — die Bewegungen sind klein.

---

## 8. Freigabe und Schnitt

1. Storyboard (je Szene das gewählte Standbild + die drei Clips 02, 04, 06 als
   Standbild) geht an Robin zur Freigabe (K2), **bevor** ein Video entsteht.
2. Videos nur aus freigegebenen Bildern.
3. Schnitt von Hand, Einblendungen in der Schrift der App, Ton (K7): Musik
   mit einem Einsatz bei Sekunde 5 (Szene 3), Geräusche Vibrieren, Kartenmischen,
   Kartenklack, Lachen.

Der Bot ist **kein** Gerät: Kein Bild zeigt ein „viertes Handy" auf dem leeren
Platz. Das wäre ein schönes Sinnbild, behauptet aber, man brauche ein weiteres
Gerät — der Bot sitzt nur in der App (Szenen 4 und 6).
