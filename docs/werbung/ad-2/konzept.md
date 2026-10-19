# Ad 2 — „Drei Städte, eine Runde" (Konzept und Storyboard)

Die erste Brauweg-Ad, die ausgestrahlt werden soll. Ad 1
(`docs/werbung/ad-1/konzept.md`) bleibt die Probe. Grundlage ist das
Drehbuch B aus `docs/werbung/drehbuecher.md`, das Robin am 19.10.2026
freigegeben hat.

Dieses Blatt ist **nur das Konzept**. Erzeugt wird hier nichts: keine
fal-Aufrufe und kein Creative. Das übernimmt die Folgekarte, nach dem
Verfahren in bro-server `docs/creatives/ki-ads-verfahren.md`: Referenzen,
dann Figur und Charakterbogen, dann Ankerbild, dann die Szenen als Stapel.
Danach kommt die **Freigabe des Storyboards**. Erst dann entsteht Video, und
zwar nur aus freigegebenen Bildern, zuletzt Schnitt und Ton. Dazu kommen die
Lehren aus Ad 1, Abschnitt 9: realer Look, echte und sinnvolle Bewegungen,
kein Schwarzbild.

Stand 19.10.2026. In der App wird nur Version 1.0 gezeigt: Doppelkopf, Skat
und Partykiste (`docs/store/PRUEFHINWEISE.md`). Ad 2 zeigt davon nur
Doppelkopf, die beiden anderen Spiele stehen auf der Endkarte.

---

## 1. Zielgruppe und Kernbotschaft

**Zielgruppe:** Menschen zwischen 25 und 55, die früher eine feste
Doppelkopfrunde hatten, aus Schule, Studium oder WG. Heute ist die Runde über
mehrere Städte verteilt. Die Regeln kennen sie. Was fehlt, ist der Tisch.

**Kernbotschaft (eine):** *Eure Runde gibt es noch — sie spielt jetzt in der
App, von überall.*

Ausdrücklich **nicht** erzählt wird:

- **„Es fehlt einer":** Das war Ad 1. In Ad 2 sind alle vier da.
- **„Ein Bot spielt mit":** Am Tisch in der App sitzen vier Menschen. Ein Bot
  als Pointe würde die Geschichte umdrehen, denn dann wäre die Runde eben
  nicht mehr vollständig.

Der Aufruf am Ende geht ins Web, weil die App dort sofort läuft:
**brauweg-spielen.de**, im Browser spielbar. Die Stores werden nur
angekündigt.

---

## 2. Hook und Geschichte (9:16, 28 s)

**Hook, 0–3 s:** Ein ausgedrucktes, verblasstes Foto: vier junge Leute an einem
WG-Küchentisch, Karten in der Hand, einer lacht mit offenem Mund. Darüber steht
**„Früher: jeden Sonntag."** Wer so eine Runde hatte, erkennt sie in diesem
Moment wieder.

**Geschichte, 3–28 s:** Das Leben zieht die vier auseinander: ein
Umzugskarton, ein Bahnsteig, der Küchentisch von damals, jetzt leer. Schnitt
auf heute, Sonntag 19:00. Lena sitzt in Hamburg, Tobi und Sara in Köln, Jonas
in Leipzig, alle mit dem Handy auf dem Sofa. In der App liegt ein Stich auf
dem Doppelkopftisch und wird eingezogen. Danach sieht man alle drei
Wohnzimmer in derselben Sekunde: Lena lacht, Tobi schüttelt den Kopf, Jonas
reckt die Faust. Endkarte.

Der Bogen geht von **Nähe (früher)** über **Trennung (das Leben)** zu
**derselben Nähe auf Entfernung (heute)**. Es gibt keinen Sprecher. Bild,
Einblendung und Musik tragen die Geschichte, damit sie auch ohne Ton im Feed
funktioniert.

---

## 3. Szenenliste

Was die Arten bedeuten:

- **KI:** ein Standbild aus Nano Banana Pro, bewegt mit Kling (Bild zu Video).
- **KI, Schnittzoom:** ein Standbild ohne Kling. Bewegt wird es im Schnitt
  mit einem langsamen `zoompan`. Ein Foto ist ein Foto, darin bewegt sich
  niemand. Kling würde die Gesichter im Abzug zum Leben erwecken, und das wäre
  falsch.
- **Bildschirmaufnahme:** ein Clip aus `werkzeug/store/clips.mjs`. Szene 6
  braucht dafür eine neue Variante, siehe den Absatz unter der Tabelle.

| Nr | Zeit | Art | Bildinhalt | Kamera/Bewegung | Dauer | Texteinblendung | Ton |
|---|---|---|---|---|---|---|---|
| 1 | 0–3 s | KI, Schnittzoom | Nah auf einen verblassten, leicht vergilbten Fotoabzug (ca. 2010): die vier jung am WG-Küchentisch, Karten in der Hand, Tobi lacht mit offenem Mund; die Ränder des Abzugs sind sichtbar, er liegt auf Holz | sehr langsamer Push-in auf die Gesichter (im Schnitt) | 3 s | **Früher: jeden Sonntag.** | leises Papierrascheln, Musik setzt zart ein |
| 2a | 3,0–4,3 s | KI | Hände kleben einen Umzugskarton zu, auf dem Karton liegt ein abgegriffenes Kartenspiel | Handkamera, kurze Bewegung mit dem Klebeband | 1,3 s | **Dann kam das Leben.** (steht über 2a–2c) | Klebeband-Ratschen |
| 2b | 4,3–5,6 s | KI | Bahnsteig in der Dämmerung, Lena mit Rucksack (jung) dreht sich ein letztes Mal um und winkt | Handkamera, Zug fährt unscharf durchs Bild | 1,3 s | (weiter) | Zuggeräusch |
| 2c | 5,6–7,0 s | KI | Derselbe Küchentisch wie auf dem Foto, leer, vier Stühle, Abendlicht | statisch, Licht wird langsam dunkler | 1,4 s | (weiter) | Stille, Musik hält |
| 3a | 7,0–8,3 s | KI | **Hamburg:** Lena (heute) auf grauem Sofa, Regen am Fenster, Handy in der Hand, Blick hebt sich | leichter Push-in | 1,3 s | **Heute: immer noch Sonntag.** · klein: Hamburg · So 19:00 | Regen, Musik zieht an |
| 3b | 8,3–9,6 s | KI | **Köln:** Tobi und Sara (heute) nebeneinander auf einem Cordsofa, jeder mit eigenem Handy, Sara stupst ihn an | leichter Schwenk | 1,3 s | (weiter) · klein: Köln | Lachen leise |
| 3c | 9,6–11,0 s | KI | **Leipzig:** Jonas (heute) im Altbauwohnzimmer mit Dielen, lehnt sich zurück, Handy hoch | leichter Push-in | 1,4 s | (weiter) · klein: Leipzig | Musik-Beat bei 11 s |
| 4 | 11–17 s | Bildschirmaufnahme **NEU: `14-doppelkopf-runde-stich`** (siehe unten) | Doppelkopftisch mit vier Menschen namens Lena, Tobi, Sara, Jonas; die vierte Karte schließt den Stich, der Stich wird eingezogen | — (Clip, bildfüllend oder im schlichten Handyrahmen wie in Ad 1) | 6 s | **Doppelkopf. Wie früher. Nur weiter weg.** | Karten-Klack auf dem Beat |
| 5 | 17–23 s | KI ×3, im Schnitt **dreigeteilt** (drei Streifen übereinander, je 1080 × 640) | oben Hamburg: Lena lacht laut, Hand vor dem Mund · Mitte Köln: Tobi schüttelt den Kopf, Sara lacht und knufft ihn · unten Leipzig: Jonas reckt die Faust | Handkamera, je eine Bewegung; alle drei Streifen starten gleichzeitig | 6 s | — | Lachen aus drei Räumen, Musik-Höhepunkt |
| 6 | 23–28 s | Endkarte (neu, im Schnitt gesetzt) | Brauweg-Logo; drei Zeilen wie unten | — | 5 s | **Brauweg · Doppelkopf · Skat · Partykiste** / Jetzt im Browser spielen: **brauweg-spielen.de** / App bald im App Store und bei Google Play | Musik klingt aus |

**Endkarte:** Die vorhandene Endkarte aus Ad 1 (`5cb9ef8c`) trägt den Text
„Bald im App Store" und passt deshalb nicht. Für Ad 2 wird sie neu gesetzt,
vollformatig 1080 × 1920, mit Logo und den drei Zeilen aus
`drehbuecher.md`. Es gibt **kein Store-Badge**, und das Apple- bzw.
Google-Logo darf vor der Veröffentlichung nicht erscheinen.

**Szene 4 braucht eine neue Aufnahme.** Die vorhandenen Doppelkopf-Clips
02–05 kommen aus `clips.mjs`, und dort sind „alle Mitspieler Bots" (Kopf des
Skripts). Der Tisch zeigt freie Bots als „Bot 2", „Bot 3" usw.
(`packages/client/src/screens/Table.tsx`, `Bot ${seat + 1}`). Damit wäre
ausgerechnet die Pointe zu sehen, die Ad 2 nicht erzählen will. Die
Folgekarte erweitert `clips.mjs` deshalb um eine Szene mit **vier
Gastkonten**. Das Skript legt Gäste ohnehin mit Namen an (`appSeite`,
`POST /api/auth/gast` mit `name`). Die Namen sind dann Lena, Tobi, Sara und
Jonas: Einer erstellt den Tisch, drei treten bei, drei Seiten spielen
automatisch, und aufgenommen wird die Seite von Lena. Danach muss jemand
prüfen, dass im Bild kein „Bot" steht und kein Bot-Stärkeregler zu sehen
ist. Kann die Szene nicht als echte Partie mit vier Konten entstehen, ist die
Szene offen. Ein KI-Bild der App ist kein Ersatz.

**Bekannte Falle der Aufnahme:** In Ad 1 sind beim Stich-Clip
(`04-doppelkopf-stich`) für 4 Bilder drei Karten verschwunden, und im Schnitt
erschien dort ein Schwarzbild (Ad 1, 9.3 und 9.5). Die neue Aufnahme muss
deshalb vor dem Schnitt Bild für Bild auf solche Aussetzer geprüft werden
(YAVG im Bildschirmausschnitt, wie in 9.5).

---

## 4. Figuren mit Charakterbögen (vier Freunde, je jung und heute)

Hauptrisiko dieser Ad: **Auf dem Foto von 2010 müssen dieselben vier Gesichter
zu sehen sein wie 2026 in den Wohnzimmern.** Deshalb bekommt jede Figur zwei
Bögen, einen für heute und einen für die junge Fassung. Der junge Bogen
entsteht *aus* dem Bogen von heute und nicht frei. So bleibt das Gesicht der
Anker, und nur das Alter ändert sich.

Jede Figur hat ein **Erkennungsmerkmal, das über die Jahre bleibt**. Daran
erkennt man sie auch in 1,3 s:

| Figur | Stadt heute | Merkmal (bleibt) | Jung, ca. 2010 (~21) | Heute, 2026 (~37) |
|---|---|---|---|---|
| **Lena** | Hamburg | rote Haare, Sommersprossen | lange rote Haare mit Pony, ausgeleierter grüner Wollpullover | rotes Haar als kinnlanger Bob, dünne Brille, dunkelgrüner Strickpullover; Lachfalten |
| **Tobi** | Köln | dichte dunkle Augenbrauen, breites Lachen, kräftige Statur | glattrasiert, dunkles Haar etwas länger, Kapuzenpulli ohne Aufdruck | kurz geschorenes Haar, Vollbart mit ersten grauen Stellen, kariertes Flanellhemd |
| **Sara** | Köln (mit Tobi zusammen) | schwarze Locken, goldene Creolen | Locken hochgebunden, Jeansjacke, Creolen | Locken schulterlang, cremefarbener Pullover, dieselben Creolen |
| **Jonas** | Leipzig | runde Metallbrille, schmales Gesicht, blond | lange blonde Haare unter einer schlichten Strickmütze, einfarbiges Shirt | kurzes, dünner werdendes blondes Haar, dieselbe Art Brille, dunkelblauer Pullover |

**Vier Handys statt drei.** Im Drehbuch steht „drei Sofas, drei Handys".
Weil Tobi und Sara zusammen in Köln sitzen und jeder Sitz am Tisch ein eigenes
Gerät braucht, zeigt Ad 2 **drei Sofas und vier Handys**. Das ist ehrlich zur
App, und das Paar in Köln erzählt „Dann kam das Leben" gleich mit. Es ist eine
Abweichung vom Wortlaut, aber nicht vom Sinn des freigegebenen Drehbuchs.

**Ablauf je Figur** (das sind die Posten aus Abschnitt 7):

1. **Porträt heute:** 2 Varianten. Ein Mensch wählt eine aus.
2. **Charakterbogen heute:** aus dem gewählten Porträt.
3. **Charakterbogen jung:** aus dem Bogen von heute, mit dem Verjüngungs-Prompt.
4. **Gegenprobe vor dem Stapel:** die vier Bögen „jung" nebeneinander und die
   vier Bögen „heute" nebeneinander. Erkennt jemand, der die Figuren nicht
   kennt, die Paare richtig zu, geht es weiter. Wenn nicht, wird der junge
   Bogen der betroffenen Figur neu erzeugt (Reserve).

Porträt-Prompt heute (Vorlage; die Merkmale je Figur aus der Tabelle
einsetzen, Beispiel Lena):

```text
Candid smartphone portrait of an ordinary woman around 37, chin-length red bob, freckles, thin-rimmed glasses, dark green knit sweater, faint laugh lines. Sitting on a grey sofa in a lived-in living room in the evening, warm lamp light, rain on the window behind her. Real skin with pores and small blemishes, not a model, no makeup look, slight sensor grain, imperfect framing. No text, no logos.
```

Charakterbogen-Prompt (Referenz: das gewählte Porträt):

```text
Character reference sheet of the person in the reference image, same face, hair and clothing. Top row: full body standing, front view, three-quarter view, side view, back view, like a 3D model turnaround, neutral pose. Bottom row: close-ups of the face — front, three-quarter left, three-quarter right, profile, and one laughing. Plain light grey background, even soft light, consistent proportions across all views. Real skin texture, not stylized. No text, no labels.
```

Verjüngungs-Prompt (Referenz: Charakterbogen heute):

```text
Character reference sheet of the SAME person as in the reference sheet, but about sixteen years younger, around 21, in the year 2010. Keep the identical face structure, eye shape, nose, ears and the distinctive features ({MERKMAL}); only age and hairstyle change: {JUNG}. Same layout: top row full body front, three-quarter, side, back; bottom row face close-ups front, three-quarter left, three-quarter right, profile, laughing. Plain light grey background, even soft light. Real skin, not stylized, not airbrushed. No text, no labels.
```

`{MERKMAL}` und `{JUNG}` werden je Figur aus der Tabelle übernommen. Die
Prompts kommen aus einer Datei, nie über die Kommandozeile (Ad 1, 9: `$P$G`).

---

## 5. Look — Referenzen

Fremde Filmstills werden nicht verwendet, wegen der Rechte. Die Referenzen
stehen als Beschreibung hier oder sind eigene Screenshots aus
`werkzeug/store/screenshots.mjs`. Für jedes Bild gilt der **Handy-Look aus
Ad 1, 9.1**: wie mit einem gewöhnlichen Handy geknipst, kein Filmstill, keine
Werbeoptik, keine Farbkorrektur und kein Teal-and-Orange-Look. Die Haut ist
echt, mit Poren, die Gesichter sind ganz normale Gesichter.

| R | Beschreibung | Trägt |
|---|---|---|
| R1 | **WG-Küche um 2010:** abgewetzter Holztisch, unpassende Stühle, Lichterkette und Kühlschrank mit Zetteln, Licht von einer billigen Hängelampe. Als Foto: ein ausgedruckter Abzug, verblasst, die Farben ins Gelbe verschoben, leichte Knicke an der Ecke | Szene 1, 2c |
| R2 | **Drei Wohnzimmer heute, deutlich verschieden:** Hamburg mit grauem Sofa, Regenfenster und kühlem Licht. Köln mit Cordsofa, Pflanzen und warmer Stehlampe. Leipzig als Altbau mit Dielen, hoher Decke, Bücherregal und gelber Leselampe | Szene 3, 5 |
| R3 | **Farbklang Nachtblau & Gold** (`docs/DESIGN.md`: `#0e1a3d`, `#f5c02e`): Schatten kühl-blau, Lichter warm. Grün (`#48d56b`) nur sparsam an Pflanzen oder Kleidung | Farbe |
| R4 | **Eigener Screenshot des Doppelkopf-Tischs** aus `screenshots.mjs`. Daraus kommt die Farbe des Displaylichts in den Gesichtern | Bildschirmlicht |
| R5 | **Requisiten:** abgegriffene Karten ohne Herstelleraufdruck, Block mit Strichliste, Teebecher, Leitungswasser in schlichten Gläsern, Chipsschale, Ladekabel. 2010: Röhrenlampe, Lichterkette | Detail |

**Nicht ins Bild** (gilt für jeden Prompt und steht als Negativliste im
Ankerbild):

- **Alkohol:** keine Flaschen und keine Bier- oder Weingläser. Das gilt
  ausdrücklich auch für die WG-Küche von 2010, wo die Modelle gern
  Bierflaschen dazudichten.
- **Text und Marken:** keine Logos, kein lesbarer Text, keine Markenkarten,
  keine Handys mit erkennbarem Herstellerlogo, keine Bandshirts mit Aufdruck.
  Auch kein Ortsschild und kein Bahnhofsschild mit Namen; die Städte stehen
  nur als Einblendung da.
- **Sonst:** keine anderen Spiele (Würfel, Brettspiele), kein Rauchen und
  keine fünfte Person.

---

## 6. Prompts

Die Prompts sind englisch, denn sie sind Eingabe für die Modelle. Die
Einblendungen und die Endkarte bleiben deutsch und entstehen im Schnitt.
An jeden Szenen-Prompt wird der **Stil-Anhang** gehängt. Er ist der aus Ad 1,
9.1, ergänzt um die Negativliste von oben:

```text
Shot on an ordinary smartphone, candid snapshot, not a film still and not an advertisement. Natural light only from the lamps in the room, visible sensor grain, slight softness and a touch of motion blur, imperfect off-center framing, no color grading, no teal-and-orange look. Real skin with pores, fine lines, small blemishes, ordinary non-model faces. No bottles, no beer, no wine, no alcohol, no logos, no brand names, no readable text, no signs, no extra people.
```

### 6.1 Ankerbilder (zwei Zeiten, je 2 Varianten, 1K)

**Anker früher.** Eingänge sind die vier Charakterbögen „jung" und R1 als
Beschreibung, Format 9:16.

```text
A Sunday evening around 2010 in a shabby shared-flat kitchen. Four friends in their early twenties — the four people from the reference sheets — sit around a worn wooden table playing cards, mismatched chairs, a cheap hanging lamp, fairy lights, a fridge covered in notes. Mugs of tea, a bowl of crisps, a scoring pad. The guy with the thick eyebrows laughs with his mouth open. Warm, a bit chaotic, very close friends.
```

**Anker heute.** Eingänge sind die vier Charakterbögen „heute" und R2 bzw. R4,
Format 16:9, weil die Wohnzimmer im Schnitt gestapelt werden.

```text
Sunday evening, present day. A lived-in living room, a person from the reference sheets on the sofa holding a phone with both hands, the screen lighting their face softly with a dark green glow. Warm lamp light against cool blue window light. Quiet, cozy, expectant.
```

### 6.2 Szenen-Stapel (22 Prompts, gegen das passende Ankerbild)

Szene 1 und 2c laufen gegen „Anker früher". 2a und 2b laufen gegen
„Anker früher" plus den passenden jungen Bogen. 3a–3c und 5 laufen gegen
„Anker heute" plus den Bogen heute der jeweiligen Figur. Szene 1 und 2 sind
9:16, Szene 3 und 5 sind 16:9.

```json
[
  "S1a: Close-up of a faded printed photo from around 2010 lying on a wooden table, edges and a bent corner visible, colours shifted to yellow: the four young friends at the shared-flat kitchen table with cards, the guy with thick eyebrows laughing",
  "S1b: The same faded print held by an adult hand at the edge of the frame, the four young friends clearly recognisable, warm lamp light on the paper",
  "S1c: Top-down view of the faded print on a table next to a worn deck of plain cards and a scoring pad",
  "S1d: Slightly angled macro of the faded print, focus on the four laughing faces, paper texture and fading visible",

  "S2a1: Hands taping a cardboard moving box shut, a worn deck of plain cards lying on top, cluttered room in the background",
  "S2a2: Close-up of a half-packed moving box, a young hand drops a deck of plain cards inside",
  "S2b1: The young red-haired woman with a backpack on a train platform at dusk, turning back once and waving, train blurred behind her, no signs",
  "S2b2: Wide shot of a platform at dusk, the young red-haired woman small in the frame waving, motion-blurred train",
  "S2c1: The same shared-flat kitchen table from the photo, empty, four chairs, evening light fading",
  "S2c2: Close-up of the empty table top, a single forgotten playing card, light fading",

  "S3a1: Hamburg flat: the red-haired woman around 37 on a grey sofa, rain on the window, phone in hand, she looks up expectantly",
  "S3a2: Over-the-shoulder of the red-haired woman on the sofa, phone screen glowing, rainy window",
  "S3b1: Cologne flat: the bearded man and the curly-haired woman around 37 side by side on a corduroy sofa, each with their own phone, she nudges him",
  "S3b2: Medium shot of the couple on the corduroy sofa among plants, both leaning into their phones, warm floor lamp",
  "S3c1: Leipzig flat: the blond man with round glasses around 37 in an old apartment with wooden floorboards and bookshelves, leaning back on the sofa, phone raised",
  "S3c2: Wide shot of the high-ceilinged old living room, the blond man alone on the sofa under a yellow reading lamp, phone glowing",

  "S5a1: The red-haired woman on the grey sofa bursts out laughing, hand over her mouth, phone in the other hand",
  "S5a2: Close-up of the red-haired woman laughing hard, leaning back into the sofa",
  "S5b1: The bearded man shakes his head in mock disbelief, the curly-haired woman next to him laughs and elbows him",
  "S5b2: Close-up of the couple, he covers his face with one hand, she laughs at him",
  "S5c1: The blond man with round glasses throws his fist up in triumph on the sofa, phone in the other hand",
  "S5c2: Medium shot of the blond man jumping up from the sofa with a fist pump, reading lamp swinging slightly"
]
```

Szene 4 ist eine Bildschirmaufnahme und Szene 6 die Endkarte, beide brauchen
keinen Prompt. Die 22 Prompts sind Erstversuche, die Reserve steht in
Abschnitt 7.

### 6.3 Video-Prompts (Kling, Bild zu Video, 5 s je freigegebenem Standbild)

Die Prompts beschreiben nur Kamera und Handlung, und zwar je eine konkrete
Handlung (Ad 1, 9). Jeder endet mit der Leitplanke aus Ad 1, 9.1, angepasst:

> Only the people already in the frame, nobody enters, no new objects, phone
> screens stay a plain glow, handheld without zoom.

| Szene | Video-Prompt |
|---|---|
| 1 | — kein Kling. Im Schnitt `zoompan` von 100 auf 106 % über 3 s, Mitte auf den Gesichtern |
| 2a | Handheld close-up. The hands pull the tape across the box lid in one movement and press it down; the cards on top wobble slightly. |
| 2b | Handheld. She turns her head back over her shoulder, raises one hand and waves once, then turns away; the blurred train passes behind her. |
| 2c | Static shot. Nothing moves except the light: the evening light on the table slowly dims. |
| 3a | Slow push-in. She glances at the rainy window, then down at her phone and starts to smile. |
| 3b | Slight pan. She nudges him with her elbow, he grins without looking up from his phone. |
| 3c | Slow push-in. He leans back into the sofa, lifts the phone closer and taps once. |
| 5a | Handheld. She bursts out laughing and claps her free hand over her mouth, shoulders shaking. |
| 5b | Handheld. He slowly shakes his head and drops it back against the sofa, she laughs and elbows him. |
| 5c | Handheld, small jolt with the movement. He throws his fist up once and pulls it down, grinning. |

**Verkettung:** Es gibt keine. Die Szenen sind bewusst harte Schnitte zwischen
Orten und Zeiten. Damit entfällt K5, und das spart die Kosten dafür.

---

## 7. Kostenvoranschlag

Die Preise stammen aus der Modellliste in bro-server, `origin/staging`
(Commit `f9f1f44`, Datei zuletzt geändert in `138b8a3`),
`src/lib/creatives/ki-anbieter.ts`, `KI_MODELLE`:

- **Nano Banana Pro** (`kennung: "nano-banana-pro"`, Endpunkt
  `fal-ai/nano-banana-pro/edit`, bis zu 14 Referenzbilder): 15 ct je Bild in
  1K, Stand 19.10.2026.
- **Kling 2.5 Turbo Pro, Bild zu Video** (`kennung: "kling-bild"`, Endpunkt
  `fal-ai/kling-video/v2.5-turbo/pro/image-to-video`): 0,07 $ je Sekunde,
  gebucht 7 ct/s, **5 s = 35 ct**. Stand der Preise laut Kopf der Liste:
  18.10.2026.

Gebucht wird der Dollarbetrag als Euro-Cent (Kopf von `ki-anbieter.ts`). Die
Zahlen liegen deshalb eher über dem echten Preis.

**Standbilder**

| Posten | Bilder | Kosten |
|---|---|---|
| Porträts heute: 4 Figuren × 2 Varianten | 8 | 1,20 € |
| Charakterbögen heute: 4 × 1 | 4 | 0,60 € |
| Charakterbögen jung (aus dem Bogen heute): 4 × 1 | 4 | 0,60 € |
| Ankerbilder: früher 2 + heute 2 | 4 | 0,60 € |
| Szenen-Stapel (22 Prompts × 1) | 22 | 3,30 € |
| Reserve: junger Bogen nach Gegenprobe, Retusche (z. B. Flasche im Hintergrund wie in Ad 1) | 4 | 0,60 € |
| **Summe** | **46** | **6,90 €** |

**Videos (nur aus freigegebenen Standbildern)**

| Posten | Clips | Kosten |
|---|---|---|
| Szene 1 | 0 (Schnittzoom) | 0,00 € |
| Szenen 2a–2c, 3a–3c, 5a–5c: 9 × 1 × 5 s | 9 | 3,15 € |
| Nachdrehs (misslungene Handlung) | 3 | 1,05 € |
| **Summe** | **12** | **4,20 €** |

**Gesamt: höchstens 11,10 €** und damit unter der Vorgabe von 12 €. Das liegt
auch unter dem Tageslimit von 20 € (`TAGESLIMIT_VORGABE_CENT = 2000` in
`src/lib/creatives/kosten.ts`), die Ad lässt sich also an einem Tag erzeugen.
Die Bildschirmaufnahme, der Schnittzoom und die Endkarte kosten nichts.

**Wo der Puffer dünn ist:** Bis zur Grenze bleiben 0,90 €, das sind sechs
Bilder oder zwei Videos. Der Nachdreh von Ad 1 hat 11 Bilder und 7 Videos
gebraucht. Ein gescheiterter Aufruf wurde dort trotzdem gebucht (Ad 1, 9.4).
Reicht die Reserve nicht, wird nicht einfach weiter erzeugt. Dann gilt diese
Reihenfolge: zuerst je Szene 5 auf ein gemeinsames Video verzichten (im
Schnitt ein Standbild mit Zoom), dann fragen.

Ein Hinweis zum Modell: Das Verfahren empfiehlt Kling 3.0, angebunden ist
Kling 2.5 Turbo Pro. Ein stärkeres Bild-zu-Video-Modell bietet die
Creatives-Anbindung nicht an (Ad 1, 9.1). Die Handlungen hier sind klein
genug dafür.

---

## 8. Freigabe und Schnitt

1. **Gegenprobe der Gesichter** (Abschnitt 4, Schritt 4), bevor der Stapel
   läuft.
2. **Storyboard an Robin zur Freigabe (K2):** je Szene das gewählte Standbild
   und ein Standbild aus der neuen Doppelkopf-Aufnahme. Das passiert,
   **bevor** ein Video entsteht. Jedes Bild wird auch auf den Hintergrund
   geprüft, nicht nur auf die Gesichter (Flasche in Ad 1, 9.2).
3. **Videos nur aus freigegebenen Bildern.** Die Prompts kommen aus einer
   Datei.
4. **Schnitt:**
   - Szene 5 als drei Streifen übereinander, je 1080 × 640, aus 16:9-Videos
     mittig beschnitten, mit dünnen dunklen Trennlinien. Die drei Streifen
     starten auf demselben Bild.
   - Szene 3 mit Ortsnamen klein in einer Ecke. „So 19:00" steht nur einmal
     da, bei 3a.
   - Die Einblendungen sind in der Schrift der App gesetzt, der Ton kommt von
     Hand (K7): Die Musik setzt leise bei 0 s ein und zieht bei 7 s an
     (heute), der Beat liegt bei 11 s (App). Dazu Geräusche: Klebeband, Zug,
     Regen, Kartenklack, Lachen.
   - Das KI-Kennzeichen „KI-generiert" brennt nur der Server-Schnitt ein
     (`lib/creatives/schnitt.ts`, Ad 1, 9.4). Wird von Hand geschnitten, muss
     die Kennzeichnung vor der Ausstrahlung eigens geklärt werden.
5. **Kein Schwarzbild (Ad 1, 9.5):** Vor dem Hochladen wird jedes Bild im
   Bildschirmausschnitt der Szene 4 und in allen drei Streifen der Szene 5
   gemessen (YAVG, kein Bild unter 40). `freezeframes` braucht **zwei
   Eingänge** (`split[a][b];[a][b]freezeframes=…`). Mit nur einem Eingang
   läuft ffmpeg ohne Fehlermeldung durch und lässt das Bild unverändert.
6. Ergebnis als Creative-Asset hochladen und hier als Abschnitt 9 nachtragen
   (Asset-Kennung, Länge, Größe, Lautheit, sha256, Kosten), so wie in Ad 1.
