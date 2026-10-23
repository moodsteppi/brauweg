# Ad 3 — „Ich mach nen Tisch auf" (drei Drehbuch-Varianten)

Stand 21.10.2026. Grundlage ist Story-Richtung A aus
`docs/werbung/vergleich-ads.md`, Abschnitt 5 (Muster 1, 2, 5 und 7; Vorbild K5
Spades Plus). Ein Mensch sagt in die Handykamera, dass er heute Abend einen
Doppelkopftisch aufmacht. Er schickt den Link in den Gruppenchat, drei andere
tippen ihn an drei Orten an, und der Tisch öffnet sich im Browser. Beim ersten
Stich wird gestichelt. Am Ende sagt die Person in die Kamera, wo man den
Tisch aufmacht.

Robins Vorgaben vom 21.10.2026: rund **20 s** (nicht 30), 9:16. Jede Variante
legt die **Spannung** an eine andere Stelle. Die Bilder sind **gemischt**:
Einige Szenen dreht Robin selbst mit dem Handy, andere erzeugt er im
Runway-Web als KI-Clip (Seedance 2.5). App-Szenen sind echte
Bildschirmaufnahmen.

Was die drei Varianten unterscheidet:

| Variante | Spannung liegt … | Ein Satz |
|---|---|---|
| **1 — „Fehlt noch einer"** | beim Letzten, der antippt | Drei sitzen sofort, der vierte Platz bleibt leer, und dann kommt Basti doch noch. |
| **2 — „Re. Natürlich."** | im ersten Stich | Der Gastgeber sagt groß „Re" an, und der erste Stich geht ausgerechnet gegen ihn. |
| **3 — „Wer verliert, backt"** | in der Stichelei und ihrer Pointe | Eine Wette im Gruppenchat, drei Sprüche zurück, und am Ende steht der Gastgeber mit der Rührschüssel da. |

---

## Was für alle drei gilt

Die Regeln aus `docs/werbung/drehbuecher.md` („Was für alle vier gilt",
„Gemeinsame Endkarte") und die Lehren aus `docs/werbung/ad-1/konzept.md` §9
gelten unverändert. Hier stehen nur die Stellen, an denen sie diese Ad konkret
treffen.

- **Nur Doppelkopf.** Skat und Partykiste kommen nur auf der Endkarte vor.
- **Kein Alkohol im Bild,** auch nicht im Hintergrund der Handyszenen: keine
  Flasche auf der Arbeitsplatte, kein Glas auf dem Balkontisch. In Ad 1 hat
  genau eine Flasche im Hintergrund eine Retusche gekostet (§9.2).
- **Keine Marken.** Kein Handy mit sichtbarem Logo (Rückseite nie zur Kamera,
  oder abgeklebt). Kein Pullover mit Aufdruck, keine Markenverpackung in der
  Küche.
- **Kein echter Messenger im Bild.** WhatsApp, Signal und Telegram sind Marken.
  Der Gruppenchat erscheint deshalb **als Einblendung im Schnitt**: neutrale
  Sprechblasen auf dunklem Grund, ohne App-Rahmen. Dazu kommt ein zweiter
  Grund: Das Teilen-Fenster des Handys zeigt bei einem Doppelkopftisch als
  Titel „Partykiste bei Brauweg" (siehe „Offene Punkte").
- **Handybildschirme in Robins Aufnahmen und in KI-Clips** zeigen nie lesbaren
  Inhalt. Was auf dem Bildschirm passiert, zeigt die Bildschirmaufnahme im
  nächsten Schnitt.
- **App-Szenen sind echte Bildschirmaufnahmen** mit `werkzeug/store/clips.mjs`
  (1080 × 1920). Im Schnitt stehen sie im schlichten dunklen Handyrahmen wie in
  Ad 1. Die nötigen Aufnahmen gibt es noch nicht, siehe „Was an
  Bildschirmaufnahmen fehlt".
- **Ohne Ton verständlich.** Alles Gesprochene steht als Untertitel im Bild.
  Die Untertitel sind kurz genug, um sie in der Szenendauer zu lesen.
- **Kein Schwarzbild:** Jede Szene wird nach dem Schnitt auf ihr dunkelstes
  Bild gemessen (Ad 1, §9.5).
- **Namen.** Gastgeber ist „Robin" (oder wen Robin vor die Kamera holt; dann
  im ganzen Text ersetzen), dazu Basti, Nele und Kalle. Die Namen aus Ad 1
  (Jule, Tarek, Mira) und Ad 2 (Lena, Tobi, Sara, Jonas) kommen bewusst nicht
  vor.
- **Endkarte:** die gemeinsame Endkarte aus `drehbuecher.md`, hier 2 s. Der
  letzte Satz in die Kamera nennt die Adresse schon. Die Endkarte wiederholt
  sie nur, damit man sie lesen kann.

### Der Weg in der App, den alle drei zeigen

So läuft es heute in der App (Stand `staging`, 21.10.2026). Die Ad zeigt
nichts, was es dort nicht gibt.

1. Doppelkopf → neuer Tisch → Sichtbarkeit **„Privat — mit Einladung"**
   (`screens/Lobby.tsx`).
2. Im Wartesaal steht **„Leute dazuholen"**: Code, QR-Code und der Knopf
   **„Link teilen"** (`minispiele/partykiste/Einladung.tsx`, für private
   Kartentische eingebunden in `tisch/index.tsx`).
3. Wer den Link `…/beitritt/<CODE>` antippt, landet **im Browser** ohne
   Download, meldet sich an oder spielt als Gast und wartet dann auf die
   Zusage (`App.tsx`, Bildschirm `anfrage`).
4. Der Gastgeber **lässt ihn herein** (`tisch/Anfragen.tsx`).
5. Am Tisch gibt es **Zurufe**, unter anderem „Na sowas!", „Guter Stich!" und
   „Das wird eng!" (`emotes.ts`). Echte Sticheleien in der App sind also
   möglich, ohne dass ein Chat erfunden werden muss.

### Runway: Stil und Leitplanke

Jeder Runway-Prompt unten ist vollständig und lässt sich so hineinkopieren.
Stil und Leitplanke stehen deshalb in jedem Prompt mit drin. Sie sind aus
Ad 1, §9.1 übernommen und für einen einzelnen Menschen an einem Ort gekürzt.

- **Modell:** Seedance 2.5 im Runway-Web, Text zu Video, **9:16, 720p**.
- **Länge:** erzeugt wird jeweils die kürzeste angebotene Länge (angenommen
  5 s). Im Schnitt werden davon 1,5–2,5 s genutzt. Der Prompt legt die
  Handlung deshalb in die **ersten 3 Sekunden**.
- **Eine Person je Clip,** die nur einmal vorkommt. So muss kein Gesicht über
  mehrere Clips gleich aussehen, und genau das gelingt KI am schlechtesten
  (`drehbuecher.md`, Drehbuch B, „KI-Risiko").
- **Kein lesbarer Text im Clip.** Der Bildschirm des Handys im Clip ist ein
  schlichtes, helles Leuchten.
- **Prüfen vor dem Übernehmen:** Hände (fünf Finger, Handy nicht verformt),
  Hintergrund (Flaschen, Logos, Schrift), und ob die Handlung wirklich
  passiert. Ad 1 hat gezeigt, dass Videos ohne klare Handlung ziellos wabern.

### Robins Handyszenen: wie gedreht wird

- Hochkant, Hauptkamera (nicht Selfie-Kamera, wenn jemand anders hält; bei
  Selbstaufnahme die Frontkamera mit Armlänge Abstand), 1080p, 30 fps.
- Abends bei Raumlicht, eine warme Lampe, kein Ringlicht. Es soll aussehen wie
  eine Sprachnachricht mit Bild, nicht wie ein Werbedreh.
- Jeden Satz drei- bis viermal sprechen. Den Satz erst sagen, wenn die Kamera
  ruhig ist, und danach 1 s still halten, damit es Luft für den Schnitt gibt.
- Alle Handyszenen einer Variante am selben Ort mit derselben Kleidung drehen.
  Der Gastgeber ist die einzige Figur, die mehrmals vorkommt.

---

## Variante 1 — „Fehlt noch einer" (Spannung: wer tippt als Letzter an)

> **Ausspielen und Hochladen erst nach Veröffentlichung der App im App Store.**
> Bis dahin wird nur erzeugt und geschnitten. Die Endkarte dieser Variante
> zeigt das App-Store-Abzeichen, und das darf erst sichtbar werden, wenn die
> App dort erschienen ist (`docs/werbung/drehbuecher.md`, „Gemeinsame Endkarte").

**Robins Wahl vom 21.10.2026:** Diese Variante wird umgesetzt. Abweichend von
„Was für alle drei gilt" und „Robins Handyszenen" wird hier **alles erzeugt und
nichts selbst gefilmt**. Die früheren Handyszenen H1–H3 sind jetzt Runway-Szenen.
Die Hauptfigur heißt **Bro** statt Robin. Nur die App-Szenen B1–B3 bleiben echte
Bildschirmaufnahmen, wie überall.

**Bogen:** Bro macht den Tisch auf, zwei sitzen sofort. Der Zähler bleibt bei
3 von 4 stehen, und Bro schaut ungeduldig in die Kamera. Schnitt auf Basti an
der Bushaltestelle, der den Link in letzter Sekunde antippt. Am Tisch bekommt
Basti den ersten Stich und schickt „Na sowas!".

| Sek. | Bild | Einblendung | Quelle |
|---|---|---|---|
| 0,0–2,5 | Bro auf dem Sofa, Handy in der Hand, schaut hoch und spricht in die Kamera | „Ich mach heute Abend nen Doppelkopftisch auf." | **Runway** (H1, Bild→Video vom Startbild S0) |
| 2,5–4,5 | Wartesaal des privaten Tisches, Daumen tippt „Link teilen"; darüber erscheint eine neutrale Chat-Blase mit dem Link | Chat-Blase: „Heute 20 Uhr. Wer ist dabei?" + Link | **Bildschirmaufnahme** (B1) + Einblendung |
| 4,5–6,0 | Frau in der Küche tippt mit dem Knöchel aufs Handy, die Hände sind nass | „Nele: Bin drin." | **Runway** (R1) |
| 6,0–7,5 | Mann auf dem Sofa unter einer Decke tippt und grinst | „Kalle: Bin drin." | **Runway** (R2) |
| 7,5–9,5 | Bro lässt zwei Anfragen herein, drei Plätze sind voll (Bro, Nele, Kalle), der vierte bleibt leer | „3 von 4. Fehlt: Basti." | **Bildschirmaufnahme** (B2) |
| 9,5–11,5 | Bro schaut erst aufs Handy, dann mit hochgezogenen Augenbrauen in die Kamera | „Basti …?" | **Runway** (H2, Bild→Video vom Startbild S0) |
| 11,5–13,5 | Nachts an einer Bushaltestelle: Basti zieht das Handy aus der Jackentasche, tippt und hebt den Kopf, weil der Bus kommt | „Basti: Bin im Bus. Bin drin." | **Runway** (R3) |
| 13,5–17,0 | Vierter Platz besetzt (Bro, Nele, Kalle, Basti), Karten werden ausgeteilt, erster Stich geht an Basti, über seinem Sitz steht „Na sowas!" | „Erster Stich: Basti." | **Bildschirmaufnahme** (B3) |
| 17,0–19,0 | Bro lacht kurz über sein Handy, schaut dann in die Kamera | „Euren Tisch macht ihr auf www.brauweg-spielen.de auf." | **Runway** (H3, Bild→Video vom Startbild S0) |
| 19,0–21,0 | Endkarte für Ad 3 (siehe unten) | Adresse + Abzeichen „Laden im App Store" | Schnitt |

Gesamt 21 s. Soll es genau 20 s sein, wird H2 auf 1,5 s gekürzt.

**Die Sätze stehen als Untertitel im Bild.** Bro bewegt in H1–H3 zwar den Mund,
als spräche er, aber nicht lippensynchron. Der Ton der Clips wird nicht
verwendet, die Ad ist ohnehin ohne Ton verständlich gebaut. Dass der Mund
nicht genau zum Untertitel passt, fällt bei 2 s ohne Ton nicht auf. Ein
lippensynchroner Clip würde dagegen jedes falsche Wort sichtbar machen.

### Bro: eine Figur über alle Szenen

Die Leitplanke „Eine Person je Clip" (oben unter „Runway: Stil und Leitplanke")
gilt für Nele, Kalle und Basti weiter. Bro kommt dreimal vor, und ein Gesicht
gleich zu halten, gelingt KI am schlechtesten. Deshalb läuft es in zwei
Schritten:

1. **Zuerst das Startbild S0** von Bro als eigener Schritt (Runway, Text zu
   Bild, 9:16). Davon werden mehrere Fassungen erzeugt, und **eine** wird
   ausgewählt. Sobald H1 daraus läuft, wird dieses Bild nicht mehr
   ausgetauscht.
2. **H1, H2 und H3 starten als Bild zu Video** (Seedance 2.5, 720p, 9:16) von
   genau diesem Bild. Alle drei beginnen also im selben Bild am selben Ort. Das
   passt zur Geschichte, denn Bro sitzt den ganzen Abend auf dem Sofa.

**Bros Aussehen und Kleidung (fest, in jedem Bro-Prompt wörtlich gleich):**
Ein Mann Mitte 30, kurze, etwas unordentliche dunkelblonde Haare, Dreitagebart,
ein freundliches, gewöhnliches Gesicht ohne Modelzüge. Er trägt einen
**schlichten dunkelgrünen Strickpullover mit Rundhals ohne Aufdruck**. Er sitzt
seitlich auf einem **hellgrauen Stoffsofa mit einem senfgelben Kissen**, links
eine warme Stehlampe, hinten ein schlichtes Regal ohne lesbare Buchrücken. Das
Handy hält er mit ausgestrecktem Arm leicht von oben, als filme er sich selbst.

Auf Englisch steht das in jedem Bro-Prompt so:

> a man in his mid-thirties with short, slightly messy dark-blond hair,
> three-day stubble and a friendly, ordinary non-model face, wearing a plain
> dark-green crew-neck knitted sweater without any print, sitting sideways on
> a light-grey fabric sofa with a mustard-yellow cushion, a warm floor lamp to
> his left, a plain shelf behind him with no readable book spines

Bro ist eine erfundene Figur. Der Prompt beschreibt keinen echten Menschen und
nennt keinen Namen, auch nicht „Bro".

**Prüfen vor dem Übernehmen,** zusätzlich zu den Punkten oben: H1, H2 und H3
nebeneinanderlegen. Gesicht, Haare, Pullover, Kissen und Lampe müssen in allen
drei gleich sein. Kippt einer weg, wird nur dieser Clip neu erzeugt, vom selben
Startbild aus.

### Runway-Prompts

**S0 — Startbild von Bro (Text zu Bild, 9:16).**
Bro auf dem Sofa, Handy in der Hand, er schaut aufs Handy. Das ist das erste
Bild von H1, H2 und H3. Deshalb schaut er hier noch nicht in die Kamera, den
Blick hebt er erst im Video.

```text
Vertical 9:16 photo, a single frame from an ordinary smartphone selfie video. A man in his mid-thirties with short, slightly messy dark-blond hair, three-day stubble and a friendly, ordinary non-model face, wearing a plain dark-green crew-neck knitted sweater without any print, sitting sideways on a light-grey fabric sofa with a mustard-yellow cushion, a warm floor lamp to his left, a plain shelf behind him with no readable book spines. He holds the phone at arm's length slightly above eye level as if filming himself, and at this moment he is looking down at the phone screen with a relaxed expression. Evening, light only from the warm floor lamp, visible sensor grain, slight softness, imperfect off-center framing, no color grading, not a film still and not an advertisement. Real skin with pores and small blemishes. Ordinary lived-in living room. No bottles, no beer, no wine, no glasses, no alcohol, no logos, no brand names, no readable text anywhere, no other people.
```

**H1 (0–2,5 s) — Bro schaut hoch und sagt es in die Kamera.**
Bild zu Video vom Startbild S0. Bro hebt den Blick vom Handy und spricht
gelassen in die Kamera. Kein Gruß und kein Vorlauf, der Blick kommt gleich zu
Beginn. Dauer 5 s, genutzt 2,5 s.

```text
Vertical 9:16 smartphone selfie video, 5 seconds, starting exactly from the provided image. The man in his mid-thirties with short, slightly messy dark-blond hair, three-day stubble and a plain dark-green crew-neck knitted sweater sits sideways on the light-grey sofa with the mustard-yellow cushion. Within the first half second he lifts his eyes from the phone straight into the camera and casually says one short sentence with a relaxed, slightly mischievous half-smile, his mouth moving naturally, then holds the look for a moment. Ordinary smartphone held at arm's length by himself, slight natural hand shake, candid, not a film still and not an advertisement. Light only from the warm floor lamp, visible sensor grain, slight softness, imperfect off-center framing, no color grading. Real skin with pores. His face, hair, sweater, sofa, cushion and lamp stay exactly as in the provided image. No bottles, no beer, no wine, no alcohol, no logos, no brand names, no readable text anywhere, no subtitles, no other people. No zoom, no cuts.
```

**H2 (9,5–11,5 s) — Bro wartet: „Basti …?"**
Bild zu Video vom Startbild S0. Bro schaut 1 s aufs Handy und trommelt mit dem
Daumen auf den Rand. Dann hebt er den Blick mit hochgezogenen Augenbrauen in
die Kamera und sagt halblaut ein Wort. Dauer 5 s, genutzt 2 s.

```text
Vertical 9:16 smartphone selfie video, 5 seconds, starting exactly from the provided image. The man in his mid-thirties with short, slightly messy dark-blond hair, three-day stubble and a plain dark-green crew-neck knitted sweater sits sideways on the light-grey sofa with the mustard-yellow cushion. For the first second he keeps looking down at the phone and impatiently drums his thumb on its edge, then he looks up into the camera with both eyebrows raised in a questioning, slightly impatient expression and quietly says a single word, his mouth moving naturally. Ordinary smartphone held at arm's length by himself, slight natural hand shake, candid, not a film still and not an advertisement. Light only from the warm floor lamp, visible sensor grain, slight softness, imperfect off-center framing, no color grading. Real skin with pores. His face, hair, sweater, sofa, cushion and lamp stay exactly as in the provided image. The phone screen, if visible, is only a plain soft glow with no readable content. No bottles, no beer, no wine, no alcohol, no logos, no brand names, no readable text anywhere, no subtitles, no other people. No zoom, no cuts.
```

**H3 (17–19 s) — Bro lacht und sagt, wo man den Tisch aufmacht.**
Bild zu Video vom Startbild S0. Bro lacht kurz über sein Handy, als hätte er
gerade den Stich gesehen. Dann schaut er in die Kamera und spricht einen Satz.
Dauer 5 s, genutzt 2 s.

```text
Vertical 9:16 smartphone selfie video, 5 seconds, starting exactly from the provided image. The man in his mid-thirties with short, slightly messy dark-blond hair, three-day stubble and a plain dark-green crew-neck knitted sweater sits sideways on the light-grey sofa with the mustard-yellow cushion. Within the first second he lets out a short, genuine laugh at something on his phone, shaking his head slightly, then looks into the camera with a warm grin and says one short sentence, his mouth moving naturally. Ordinary smartphone held at arm's length by himself, slight natural hand shake, candid, not a film still and not an advertisement. Light only from the warm floor lamp, visible sensor grain, slight softness, imperfect off-center framing, no color grading. Real skin with pores and laugh lines. His face, hair, sweater, sofa, cushion and lamp stay exactly as in the provided image. No bottles, no beer, no wine, no alcohol, no logos, no brand names, no readable text anywhere, no subtitles, no other people. No zoom, no cuts.
```

**R1 (4,5–6,0 s) — Nele in der Küche, tippt mit dem Knöchel.**
Eine Frau um die 35 steht am Spülbecken, die Hände sind nass. Das Handy liegt
auf der Arbeitsplatte und leuchtet auf. Sie tippt es mit dem trockenen
Fingerknöchel an und nickt. Dauer 5 s, genutzt 1,5 s.

```text
Vertical 9:16 smartphone video, 5 seconds. A woman around 35 stands at a kitchen sink in the evening, her hands wet from washing dishes. A phone lying face up on the counter next to her lights up. Within the first two seconds she leans over and taps the phone screen once with a dry knuckle, then gives a small satisfied nod and goes back to the dishes. Shot on an ordinary smartphone held by a friend, candid, not a film still and not an advertisement. Natural warm evening light from a ceiling lamp, visible sensor grain, slight softness, imperfect off-center framing, no color grading. Real skin with pores and small blemishes, ordinary non-model face, plain clothes without print. Ordinary lived-in kitchen: plain mugs, a dish rack, a tea towel. The phone screen is only a plain soft glow with no readable content. No bottles, no beer, no wine, no alcohol, no logos, no brand names, no readable text anywhere, no other people. Handheld camera, no zoom, no cuts.
```

**R2 (6,0–7,5 s) — Kalle auf dem Sofa, grinst.**
Ein Mann um die 40 liegt halb unter einer Wolldecke auf dem Sofa. Das Handy
vibriert in seiner Hand, er tippt einmal und grinst. Dauer 5 s, genutzt 1,5 s.
Kalles Sofa ist nicht Bros Sofa: abgewetzt, mit Strickdecke, kein senfgelbes
Kissen und kein grüner Pullover. Sonst hält man Kalle im Schnitt für Bro.
Deshalb steht im Prompt ausdrücklich, dass beides fehlt.

```text
Vertical 9:16 smartphone video, 5 seconds. A man around 40 lies half under a knitted blanket on a worn dark-brown sofa in the evening, holding a phone in one hand. He wears no green clothing and there is no yellow cushion. Within the first two seconds the phone buzzes, he taps the screen once with his thumb, and a slow, slightly smug grin spreads across his face. Shot on an ordinary smartphone held by someone across the room, candid, not a film still and not an advertisement. Light only from a warm floor lamp, visible sensor grain, slight softness and a touch of motion blur, imperfect off-center framing, no color grading. Real skin with pores and stubble, ordinary non-model face, plain sweater without print. Ordinary living room with cushions and a plain mug of tea on a side table. The phone screen is only a plain soft glow with no readable content, the back of the phone shows no logo. No bottles, no beer, no wine, no alcohol, no logos, no brand names, no readable text anywhere, no other people. Handheld camera, no zoom, no cuts.
```

**R3 (11,5–13,5 s) — Basti an der Bushaltestelle, in letzter Sekunde.**
Ein Mann um die 30 steht nachts an einer Bushaltestelle. Er zieht das Handy aus
der Jackentasche, tippt einmal, und Scheinwerferlicht streift ihn, weil der Bus
kommt. Dauer 5 s, genutzt 2 s.

```text
Vertical 9:16 smartphone video, 5 seconds. At night, a man around 30 in a plain dark jacket waits at a simple bus stop shelter under a street lamp. Within the first three seconds he pulls a phone out of his jacket pocket, taps the screen once with his thumb, then looks up as bright headlights sweep across his face from the left, as if a bus is arriving. Shot on an ordinary smartphone by a friend standing next to him, candid, not a film still and not an advertisement. Only street light and the passing headlights, visible sensor grain and noise, slight motion blur, imperfect framing, no color grading. Real skin, ordinary non-model face. The bus shelter has no posters, no advertising, no signs, no route numbers. The phone screen is only a plain soft glow with no readable content, the back of the phone shows no logo. No bottles, no alcohol, no logos, no brand names, no readable text anywhere, no other people in focus. Handheld camera, no zoom, no cuts.
```

### Endkarte für Ad 3 (2 s)

Ad 3 geht erst nach der Veröffentlichung im App Store hinaus. Deshalb gilt hier
schon die Endkarte für die Zeit danach (`drehbuecher.md`, „Gemeinsame
Endkarte"). Gesetzt wird sie im Schnitt, nicht im KI-Bild:

> **Brauweg · Doppelkopf · Skat**
> Jetzt im Browser spielen: **www.brauweg-spielen.de**
> *[offizielles Abzeichen „Laden im App Store"]*

- **Nur App Store, kein Google Play.** Ad 3 nennt Google Play nicht und zeigt
  auch nicht dessen Abzeichen. Die Textzeile „App bald im App Store und bei
  Google Play" fällt weg, an ihrer Stelle steht das Abzeichen.
- **Spiele-Zeile ohne Partykiste.** Seit `95b0197b` steht die Partykiste in der
  App auf „Kommt bald" (`packages/server/src/games/registry.ts`, `FREIGABE`:
  `partykiste: { web: 'spielbar', app: 'bald' }`). Im Browser ist sie zwar
  spielbar. Direkt über dem App-Store-Abzeichen liest man die Zeile aber als
  „das gibt es in der App", und wer die App wegen der Partykiste lädt, findet
  dort nur „Kommt bald". Die Zeile nennt deshalb nur Doppelkopf und Skat, also
  was im Browser **und** in der App spielbar ist. Kommt die Partykiste in die
  App zurück, wird sie hier wieder ergänzt.
- **Das Abzeichen ist das offizielle von Apple,** in der deutschen Fassung
  „Laden im App Store". Es wird nicht nachgebaut, nicht aus einem Screenshot
  ausgeschnitten und nicht von KI erzeugt.
  - **Quelle:** Apple Marketing-Ressourcen, „App Store Badges"
    (`developer.apple.com/app-store/marketing/guidelines/`). Geladen wird über
    die App Store Marketing Tools (`toolbox.marketingtools.apple.com`), dort
    liegt eine Fassung je Sprache. Die schwarze Fassung ist die Regel.
  - **Unverändert:** keine andere Farbe, nicht beschneiden, drehen oder
    verzerren, keine Animation des Abzeichens selbst, keine Schatten oder
    Effekte. Als Ganzes ein- und ausblenden ist erlaubt.
  - **Mindestgröße:** auf Bildschirmen mindestens **40 px hoch**. Bei
    1080 × 1920 wird es ohnehin deutlich größer gesetzt, damit man es am Handy
    lesen kann.
  - **Freiraum:** rundherum mindestens **ein Viertel der Abzeichenhöhe** frei,
    ohne Text, Bild oder Bildkante darin.
  - **Sprache passt zur Ad:** eine deutsche Ad bekommt das deutsche Abzeichen.
  - Die Zahlen oben stammen aus Apples Richtlinien in der zuletzt bekannten
    Fassung. Apples Seite war beim Schreiben (21.10.2026) von hier aus nicht
    erreichbar. **Vor dem Schnitt die aktuelle Seite einmal gegenlesen,** auch
    darauf, ob im Video ein Markenhinweis („Apple und das Apple-Logo sind
    Marken der Apple Inc. …") verlangt ist.
- **Die Grafik liegt nicht im Repo.** Sie wird zum Schnitt frisch bei Apple
  geladen. So bleibt kein veraltetes oder verändertes Abzeichen liegen.

**Warum es taugt:** Der Zähler „3 von 4" ist eine Frage, die jeder ohne Ton
versteht, und die Antwort kommt nach vier Sekunden. Die Spannung zeigt
zugleich das Produkt: Wer zu spät kommt, ist trotzdem in Sekunden am Tisch, im
Bus und ohne Download. Die Pointe (der Nachzügler holt den ersten Stich)
braucht nur einen Satz.

---

## Variante 2 — „Re. Natürlich." (Spannung: der erste Stich kippt)

**Bogen:** Der Tisch füllt sich in einem schnellen Dreierschnitt. Robin sagt
siegessicher „Re" in die Kamera. Der erste Stich wird vor der vierten Karte
angehalten, und die vierte Karte nimmt ihm den Fuchs weg. Schnitt auf Neles
Jubel und auf Robins Gesicht.

| Sek. | Bild | Einblendung | Quelle |
|---|---|---|---|
| 0,0–2,0 | Robin am Küchentisch, Handy in der Hand, spricht in die Kamera | „Ich mach heute Abend nen Doppelkopftisch auf." | **Handy** (H1) |
| 2,0–3,5 | Wartesaal, Daumen tippt „Link teilen"; Chat-Blase mit Link | Chat-Blase: „20 Uhr. Link:" + Link | **Bildschirmaufnahme** (B1) + Einblendung |
| 3,5–4,5 | Hand auf dem Sofa tippt aufs Handy | „Nele" | **Runway** (R1) |
| 4,5–5,5 | Hand am Schreibtisch tippt aufs Handy | „Kalle" | **Runway** (R2) |
| 5,5–6,5 | Hand auf einer Fensterbank tippt aufs Handy | „Basti" | **Runway** (R3) |
| 6,5–8,5 | Anfragen zulassen, vier Namen am Tisch, Karten werden ausgeteilt | „Tisch voll. Im Browser." | **Bildschirmaufnahme** (B2) |
| 8,5–10,0 | Robin schaut auf seine Karten, dann in die Kamera, tippt sich zweimal an die Brust | „Re. Natürlich." | **Handy** (H2) |
| 10,0–13,5 | Erster Stich: Robin legt den Fuchs (Karo-Ass), zwei Karten folgen. **Standbild 0,8 s** vor der vierten Karte, dann sticht die vierte, und der Stich geht an Nele | erst „Und jetzt …", dann „Fuchs weg." | **Bildschirmaufnahme** (B3) |
| 13,5–15,5 | Nele auf dem Sofa reißt die Faust hoch und lacht | „Nele: Danke für den Fuchs." | **Runway** (R4) |
| 15,5–18,0 | Robin schaut kurz aufs Handy, schüttelt den Kopf, grinst dann in die Kamera | „Revanche? Tisch aufmachen auf www.brauweg-spielen.de." | **Handy** (H3) |
| 18,0–20,0 | Gemeinsame Endkarte | (siehe `drehbuecher.md`) | Schnitt |

Gesamt 20 s.

### Drehanweisungen (Handy)

- **H1 (0–2 s):** Küchentisch, Robin sitzt und hält das Handy mit beiden
  Händen vor der Brust, die Kamera liegt etwas tiefer als die Augen. Er sagt
  sofort und gut gelaunt in die Kamera: „Ich mach heute Abend nen
  Doppelkopftisch auf."
- **H2 (8,5–10 s):** Gleicher Platz. Robin schaut 1 s aufs Handy, als sähe er
  gerade sein Blatt, dann mit einem überlegenen Lächeln in die Kamera. Er tippt
  sich zweimal mit zwei Fingern an die Brust und sagt nur: „Re."
- **H3 (15,5–18 s):** Gleicher Platz. Robin schaut aufs Handy, schüttelt den
  Kopf und atmet hörbar aus. Dann grinst er in die Kamera und sagt: „Revanche?
  Tisch aufmachen auf www.brauweg-spielen.de."

### Runway-Prompts

R1 bis R3 zeigen **nur Hände**. Drei Gesichter in drei Sekunden prägen sich
nicht ein und sind dreimal das Risiko „sieht nach KI aus". Hände an drei
unterschiedlichen Orten erzählen „drei Orte" genauso.

**R1 (3,5–4,5 s) — Hand auf dem Sofa.**
Nahaufnahme: Eine Frauenhand hält das Handy über einem gemusterten
Sofakissen, der Daumen tippt einmal. Dauer 5 s, genutzt 1 s.

```text
Vertical 9:16 smartphone video, 5 seconds. Close-up of a woman's hand holding a phone above a patterned sofa cushion in the evening. Within the first second her thumb taps the screen once firmly. A knitted sleeve is visible at the wrist. Shot on an ordinary smartphone, candid, not a film still and not an advertisement. Warm lamp light, visible sensor grain, slight softness, imperfect framing, no color grading. Natural hand with visible knuckle lines, short unpainted nails, exactly five fingers. The phone screen is only a plain soft glow with no readable content, the back of the phone shows no logo. No bottles, no alcohol, no logos, no brand names, no readable text anywhere, no faces. Handheld camera, no zoom, no cuts.
```

**R2 (4,5–5,5 s) — Hand am Schreibtisch.**
Nahaufnahme: Eine Männerhand neben einer Tastatur greift nach dem Handy, das
auf dem Schreibtisch liegt, und tippt einmal. Dauer 5 s, genutzt 1 s.

```text
Vertical 9:16 smartphone video, 5 seconds. Close-up of a man's hand on a cluttered home desk in the evening, next to a plain keyboard without any lettering and a plain mug. Within the first second the hand reaches for a phone lying face up on the desk and taps the screen once. Shot on an ordinary smartphone, candid, not a film still and not an advertisement. Cool light from an off-screen monitor mixed with a warm desk lamp, visible sensor grain, slight softness, imperfect framing, no color grading. Natural hand with hair on the back of the hand, exactly five fingers. The phone screen is only a plain soft glow with no readable content. No bottles, no alcohol, no logos, no brand names, no readable text anywhere, no faces. Handheld camera, no zoom, no cuts.
```

**R3 (5,5–6,5 s) — Hand auf der Fensterbank.**
Nahaufnahme: Eine Hand nimmt das Handy von einer Fensterbank mit Topfpflanze,
draußen ist es dämmrig, der Daumen tippt einmal. Dauer 5 s, genutzt 1 s.

```text
Vertical 9:16 smartphone video, 5 seconds. Close-up of a hand picking up a phone from a window sill with a small potted plant, dusky blue evening sky outside the window. Within the first second the thumb taps the screen once. Shot on an ordinary smartphone, candid, not a film still and not an advertisement. Mixed light: blue dusk from the window and warm room light, visible sensor grain, slight softness, imperfect framing, no color grading. Natural hand, exactly five fingers. The phone screen is only a plain soft glow with no readable content, the back of the phone shows no logo. No bottles, no alcohol, no logos, no brand names, no readable text anywhere, no faces, no people outside. Handheld camera, no zoom, no cuts.
```

**R4 (13,5–15,5 s) — Nele jubelt.**
Eine Frau um die 35 sitzt im Schneidersitz auf dem Sofa (dasselbe gemusterte
Kissen wie in R1). Sie schaut aufs Handy, reißt die Faust hoch und lacht laut.
Dauer 5 s, genutzt 2 s.

```text
Vertical 9:16 smartphone video, 5 seconds. A woman around 35 sits cross-legged on a sofa with a patterned cushion beside her in the evening, holding a phone in one hand and looking at it. Within the first two seconds she throws her other fist up in triumph and bursts out laughing, leaning back. Shot on an ordinary smartphone by someone sitting across from her, candid, not a film still and not an advertisement. Warm lamp light only, visible sensor grain, slight motion blur on the fist, imperfect off-center framing, no color grading. Real skin with pores and laugh lines, ordinary non-model face, plain knitted sweater without print. The phone screen is only a plain soft glow with no readable content, the back of the phone shows no logo. No bottles, no beer, no wine, no alcohol, no logos, no brand names, no readable text anywhere, no other people. Handheld camera, no zoom, no cuts.
```

**Warum es taugt:** Das Standbild vor der vierten Karte ist die einzige Stelle
in allen drei Varianten, an der die App selbst die Spannung trägt. Wer
Doppelkopf kennt, sieht den Fuchs liegen und weiß, was kommt. Robins „Re" macht
aus dem Stich eine kleine Blamage, über die man lacht. Das ist Muster 5 („die
Reibung ist der Witz") ohne erfundenen Chat.

**Risiko:** B3 braucht einen bestimmten Stich, in dem Robins Sitz den Fuchs
legt und ihn verliert. Die Aufnahme muss so lange Partien spielen, bis das
passiert, oder einen Seed finden, bei dem es sicher passiert. Ohne diesen
Stich fällt die Pointe weg.

---

## Variante 3 — „Wer verliert, backt" (Spannung: Stichelei mit Pointe)

**Bogen:** Robin macht den Tisch auf und setzt eine Wette: Wer verliert, backt
am Sonntag den Kuchen. Drei antworten an drei Orten mit je einem Spruch.
Am Tisch fliegen die Zurufe. Eine Stunde später steht Robin in der Küche mit
der Rührschüssel und sagt, wo man den Tisch aufmacht.

| Sek. | Bild | Einblendung | Quelle |
|---|---|---|---|
| 0,0–2,5 | Robin im Flur mit Jacke halb aus, spricht in die Kamera | „Ich mach heute Abend nen Doppelkopftisch auf. Wer verliert, backt Sonntag." | **Handy** (H1) |
| 2,5–4,0 | Wartesaal, Daumen tippt „Link teilen"; Chat-Blase mit Link | Chat-Blase: „Wer verliert, backt. 20 Uhr." + Link | **Bildschirmaufnahme** (B1) + Einblendung |
| 4,0–6,0 | Mann auf dem Sofa tippt, zieht eine Augenbraue hoch | „Kalle: Ich nehm Käsekuchen." | **Runway** (R1) |
| 6,0–8,0 | Frau auf dem Balkon mit Gießkanne tippt und lacht | „Nele: Du hast letztes Mal die Dulle verschenkt." | **Runway** (R2) |
| 8,0–10,0 | Mann am Herd rührt in einem Topf, tippt mit der freien Hand | „Basti: Ich back sicher nicht." | **Runway** (R3) |
| 10,0–14,0 | Anfragen zulassen, vier Namen, Karten raus, der erste Stich geht nicht an Robin; über einem Sitz „Das wird eng!" | „Das wird eng!" kommt aus der App, keine eigene Einblendung | **Bildschirmaufnahme** (B2) |
| 14,0–15,0 | Texttafel auf Brauweg-Nachtblau, nicht auf Schwarz (kein Schwarzbild, Ad 1 §9.5) | „Eine Stunde später." | Schnitt |
| 15,0–18,0 | Robin in der Küche, hält eine Rührschüssel mit Mehl im Arm, schaut ergeben in die Kamera | „Ich back dann mal. Euren Tisch macht ihr auf www.brauweg-spielen.de auf." | **Handy** (H2) |
| 18,0–20,0 | Gemeinsame Endkarte | (siehe `drehbuecher.md`) | Schnitt |

Gesamt 20 s.

### Drehanweisungen (Handy)

- **H1 (0–2,5 s):** Flur, Robin kommt gerade nach Hause, die Jacke halb
  ausgezogen, und hält das Handy in der freien Hand. Er sagt im Gehen
  direkt in die Kamera: „Ich mach heute Abend nen Doppelkopftisch auf." Nach
  einer kleinen Pause und mit erhobenem Zeigefinger: „Wer verliert, backt
  Sonntag."
- **H2 (15–18 s):** Küche, gleiche Kleidung wie in H1, aber ohne Jacke. Robin
  hält eine Rührschüssel mit Mehl im Arm (Schneebesen drin, keine
  Markenpackung im Bild), stellt das Handy gegen etwas an der Arbeitsplatte
  und schaut ergeben hinein. Er sagt trocken: „Ich back dann mal. Euren Tisch
  macht ihr auf www.brauweg-spielen.de auf."

### Runway-Prompts

**R1 (4,0–6,0 s) — Kalle auf dem Sofa, Augenbraue hoch.**
Ein Mann um die 40 sitzt auf dem Sofa, liest auf dem Handy, tippt kurz und zieht
mit einem schiefen Grinsen eine Augenbraue hoch. Dauer 5 s, genutzt 2 s.

```text
Vertical 9:16 smartphone video, 5 seconds. A man around 40 sits on a worn sofa in the evening reading something on his phone. Within the first two seconds he types a quick reply with his thumb, then looks up past the camera with one eyebrow raised and a crooked, cheeky grin. Shot on an ordinary smartphone held by someone across the room, candid, not a film still and not an advertisement. Light only from a warm floor lamp, visible sensor grain, slight softness, imperfect off-center framing, no color grading. Real skin with pores and stubble, ordinary non-model face, plain sweater without print. Ordinary living room, a plain mug of tea on the side table. The phone screen is only a plain soft glow with no readable content, the back of the phone shows no logo. No bottles, no beer, no wine, no alcohol, no logos, no brand names, no readable text anywhere, no other people. Handheld camera, no zoom, no cuts.
```

**R2 (6,0–8,0 s) — Nele auf dem Balkon, lacht.**
Eine Frau um die 35 gießt auf einem kleinen Balkon Kräuter. Das Handy in der
anderen Hand vibriert, sie liest, tippt und lacht laut auf. Dauer 5 s,
genutzt 2 s.

```text
Vertical 9:16 smartphone video, 5 seconds. On a small city balcony at dusk, a woman around 35 waters potted herbs with a small plain watering can, holding a phone in her other hand. Within the first two seconds she glances at the phone, taps a reply with her thumb and bursts out laughing, tilting her head back. Shot on an ordinary smartphone by a friend standing in the balcony door, candid, not a film still and not an advertisement. Natural blue dusk light with a warm glow from the apartment behind, visible sensor grain, slight softness, imperfect framing, no color grading. Real skin with pores and laugh lines, ordinary non-model face, plain cardigan without print. The phone screen is only a plain soft glow with no readable content, the back of the phone shows no logo. No bottles, no glasses, no alcohol, no logos, no brand names, no readable text anywhere, no people on other balconies. Handheld camera, no zoom, no cuts.
```

**R3 (8,0–10,0 s) — Basti am Herd, tippt mit der freien Hand.**
Ein Mann um die 30 rührt in einem Topf auf dem Herd. Mit der freien Hand tippt
er auf das Handy, das an die Wand gelehnt steht, und schüttelt grinsend den Kopf.
Dauer 5 s, genutzt 2 s.

```text
Vertical 9:16 smartphone video, 5 seconds. A man around 30 stands at a stove stirring a pot of pasta sauce with a wooden spoon. A phone leans upright against the tiled wall next to the stove. Within the first two seconds he taps the phone screen once with his free hand, then shakes his head with a confident grin and keeps stirring. Shot on an ordinary smartphone by someone at the kitchen table, candid, not a film still and not an advertisement. Warm light from the cooker hood lamp, a little steam, visible sensor grain, slight softness, imperfect framing, no color grading. Real skin, ordinary non-model face, plain t-shirt without print. Ordinary kitchen with plain jars without labels. The phone screen is only a plain soft glow with no readable content. No bottles, no wine, no beer, no alcohol, no logos, no brand names, no readable text anywhere, no other people. Handheld camera, no zoom, no cuts.
```

**Warum es taugt:** Die Wette im ersten Satz ist eine Frage, die bis zum Ende
offenbleibt: Wer backt? Die Antwort steht im letzten Bild, ohne dass ein
Spielstand erklärt werden muss. Die Rührschüssel ist die Pointe, und sie ist
gutmütig, so wie eine Runde unter Freunden. Der Nachteil: Drei
Chat-Sprüche in sechs Sekunden sind viel Text für eine Ad, die ohne Ton
funktionieren muss.

---

## Kosten in Runway (grob)

Annahme aus bro-server `docs/creatives/runway-pruefung.md`: **30 Credits je
Sekunde bei 720p.** Ob das im Runway-Web für Seedance 2.5 genauso gilt, ist
nicht bestätigt. Erzeugt wird je Szene die kürzeste Länge (angenommen 5 s).
Ad 1 brauchte bei einer von fünf Szenen einen zweiten Versuch. Für Hände,
Gesichter und Hintergründe ohne Fehler rechnen wir hier mit **zwei Versuchen
je Szene**.

| Variante | Runway-Szenen | ein Versuch je Szene | mit 2 Versuchen je Szene | Anteil am Pro-Monat (2.250) |
|---|---|---|---|---|
| 1 „Fehlt noch einer" (alt, mit Handyszenen) | 3 (R1–R3) | 3 × 5 s × 30 = **450** | **900** | 40 % |
| **1 „Fehlt noch einer" (gewählt, alles erzeugt)** | 6 (H1–H3, R1–R3) + Startbild S0 | 6 × 5 s × 30 = 900 + S0 8 = **908** | 1.800 + S0 4 × 8 = **1.832** | 81 % |
| 2 „Re. Natürlich." | 4 (R1–R4) | 4 × 5 s × 30 = **600** | **1.200** | 53 % |
| 3 „Wer verliert, backt" | 3 (R1–R3) | 3 × 5 s × 30 = **450** | **900** | 40 % |

Alle drei mit Nachschlägen ergeben rund 3.000 Credits und damit mehr als ein
Pro-Monat. Zwei Varianten passen hinein.

**Variante 1 in der gewählten Fassung** (Robin, 21.10.2026) braucht für sich
allein rund 1.830 Credits und damit gut vier Fünftel eines Pro-Monats. Daneben
passt keine zweite Variante mehr. Gerechnet ist so:

- **H1–H3** sind Bild zu Video mit Seedance 2.5, 720p, 5 s. Angenommen ist
  derselbe Satz wie für Text zu Video, also 30 Credits je Sekunde. Bestätigt
  ist das nicht.
- **Startbild S0:** angenommen **8 Credits je Bild** (Runway, Text zu Bild).
  Auch das ist nicht bestätigt. Gerechnet wird mit **vier Fassungen**, weil an
  diesem einen Bild alle drei Bro-Szenen hängen und sich ein schwaches Gesicht
  später nicht mehr tauschen lässt.
- **Zwei Versuche je Videoszene** wie oben. Kippt Bros Gesicht in einem Clip
  weg (siehe „Prüfen vor dem Übernehmen" in Variante 1), wird dieser Clip neu
  erzeugt. Das ist der zweite Versuch, kein zusätzlicher.

---

## Was an Bildschirmaufnahmen fehlt

`werkzeug/store/clips.mjs` nimmt bisher nur Tische mit Bots auf, dazu Szene 14
für Ad 2. Szene 14 übernehmen wir nicht: Sie zeigt die Namen aus Ad 2, und
Ad 3 soll nichts aus Ad 2 übernehmen. Für Ad 3 braucht es neue Szenen, die das
Skript heute noch nicht kann. Diese Aufgabe ändert keinen Code. Die Erweiterung
ist ein eigener Auftrag.

| Kürzel | Inhalt | gebraucht in |
|---|---|---|
| B1 | Privater Doppelkopftisch, Wartesaal mit „Leute dazuholen", der Daumen tippt „Link teilen" | 1, 2, 3 |
| B2 | Anfragen kommen an, der Gastgeber lässt herein, die Plätze füllen sich mit Robin (in Variante 1: **Bro**), Nele, Kalle, Basti, dann wird ausgeteilt. Für Variante 1 eine Fassung, in der **3 von 4** Plätzen kurz stehen bleiben | 1, 2, 3 |
| B3 | Erster Stich an einem Tisch mit vier Menschen ohne Bot-Namen, mit einem Zuruf über einem Sitz. Variante 1: der Stich geht an Basti, Zuruf „Na sowas!". Variante 2: Robin legt den Fuchs und verliert ihn an Nele. Variante 3: der Stich geht nicht an Robin, Zuruf „Das wird eng!" | je Variante eine |

Zwei Dinge sind bei der Aufnahme zu beachten:

- **Die Adresse im Wartesaal.** Aufgenommen wird gegen `staging`. Unter dem
  QR-Code steht deshalb die Staging-Adresse, und der QR-Code führt auch dorthin.
  Im Schnitt diesen Bereich abdecken oder so zuschneiden, dass er nicht zu sehen
  ist. Die Adresse in der Chat-Blase setzt der Schnitt mit der echten
  Produktionsadresse; die vor dem Schnitt einmal von Hand im Browser prüfen.
- **Der Teilen-Knopf** öffnet am Rechner kein Teilen-Fenster, sondern kopiert
  und zeigt „Link kopiert — jetzt in den Gruppenchat einfügen." Das passt zur
  Geschichte und darf so im Bild bleiben.

---

## Offene Punkte

- **Teilen-Titel „Partykiste bei Brauweg" an Doppelkopftischen.**
  `Einladung.tsx` setzt beim Teilen immer `einladung.teilenTitel`, und der lautet
  fest „Partykiste bei Brauweg". Das gilt auch an privaten Kartentischen. Für
  diese Ad ist das kein Hindernis, weil der Chat eine Einblendung ist. Wer
  aber echt teilt, sieht das falsche Spiel. Gemeldet als Karte auf dem
  Issueboard.
- **Länge der Runway-Clips.** Die kürzeste Länge von Seedance 2.5 im
  Runway-Web ist hier mit 5 s angenommen. Ist sie länger, steigen die Credits
  im selben Verhältnis.
- **Empfehlung:** Variante 1 zuerst. Ihre Spannung („3 von 4") zeigt
  denselben Weg, den die Ad verkauft. Sie ist ohne Ton lesbar, und keine
  Pointe hängt an einem bestimmten Kartenverlauf. Variante 2 kommt als
  Gegentest dazu, sobald B3 mit dem Fuchs aufgenommen ist.
