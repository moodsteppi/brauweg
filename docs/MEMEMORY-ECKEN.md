# Mememory: Ecken, Farben, Puck

Seit dem **27. August 2026** steht am Brett nicht mehr oben und unten je eine
Leiste, sondern in jeder Ecke ein Spieler. Zwei Gründe, und nur der zweite
ist Geschmack:

1. **Die Leisten konnten genau zwei Spieler.** Vier hätten sich in derselben
   Zeile gegenseitig aus dem Bild geschoben. Seit dem Nachmittag desselben
   Tages hat ein Tisch wirklich zwei bis vier Sitze — siehe
   `MEMEMORY-MEHRSPIELER.md`.
2. **Zu zweit sieht es besser aus.** Die Leisten nahmen die volle Breite für
   je einen Namen und eine Zahl. Das Brett hat jetzt mehr Höhe.

---

## Wer sitzt wo

Gerechnet wird in `packages/client/src/minispiele/mememory/eckenplan.ts`,
gezeichnet in `Ecken.tsx`.

| Von mir aus | Ecke |
| --- | --- |
| ich selbst | unten links |
| nächster Sitz | oben rechts |
| übernächster | oben links |
| vierter | unten rechts |

**Jeder sieht sich selbst unten links.** Zu zweit ist der Gegner damit
diagonal gegenüber — der größte Abstand, den ein Handy hergibt, und niemand
muss beim Blick auf den eigenen Stand die Augen quer über das Brett ziehen.
Erst der dritte Spieler füllt oben links, der vierte unten rechts.

Gezählt wird über die **Position in der Sitzliste**, nicht über die
Sitznummer: Ein Tisch muss nicht bei 0 anfangen und nicht lückenlos sein.
Ein Zuschauer (kein eigener Sitz) bekommt die Ecken schlicht der Reihe nach.

**Oben links teilt sich die Ecke mit dem Zurück-Knopf** und rückt an ihm
vorbei (`left: 58px` statt 12). Zu zweit und zu dritt ist dort ohnehin
niemand.

---

## Die Farben

| Sitz | Farbe | Punktzahl | Karte des Besitzers | Puck |
| --- | --- | --- | --- | --- |
| 0 | blau | `#7fb3ff` | `#3f82ff` | hell `#9ec6ff` → dunkel `#3f6dae` |
| 1 | rot | `#ff8a80` | `#ea4b40` | `#ffa79e` → `#b04a41` |
| 2 | gelb | `#e8c96a` | `#d8a828` | `#f3dc93` → `#a8862c` |
| 3 | grün | `#86c48f` | `#3f9b55` | `#a6d9ad` → `#4c8a58` |

**Die Farbe hängt am SITZ, nicht daran, wer zusieht.** Wer bei sich blau ist,
ist auch beim Gegner blau — sonst widerspräche ein Bildschirmfoto des einen
dem des anderen, und „der Blaue hat das Paar" wäre kein Satz mehr, den zwei
Leute im selben Raum sagen können. Der Sitz ist zugleich die
Beitrittsreihenfolge: Die Plattform setzt jeden Neuen auf den kleinsten
freien Platz.

**Der Name ist weiß, die Zahl trägt die Farbe**, dazwischen ein
Halbhochpunkt: `Anna · 7`. Ein Name in Farbe wäre auf der dunklen Decke
schlechter zu lesen, und die Zahl ist ohnehin das, was man sucht.

Die Zeile liegt auf einem dunklen Kissen mit Weichzeichner. Ohne läge sie
mal auf der Decke, mal auf einer hellen Karte — und wäre dort nicht mehr zu
lesen.

**Auch die Tischdecke trägt die Farbe des Spielers, der am Zug ist.** Dafür
gibt es jetzt fünf Decken statt drei; wie Gelb und Grün entstanden sind,
steht in `ASSETS-MEMEMORY.md`. Ein Tisch lädt nur die, deren Farbe an ihm
sitzt.

---

## Die Punktzahl steht innen, die Stufe neben dem Namen

Seit dem **28. August 2026** gilt in der Ecke eine Leserichtung, die von der
Ecke abhängt:

| Ecke | Reihenfolge im Bild |
| --- | --- |
| unten links, oben links | Name · Stufe · **Zahl** |
| oben rechts, unten rechts | **Zahl** · Stufe · Name |

Gedreht wird das **Blatt** (`flex-direction: row-reverse`), nicht der Text: Im
Blatt bleibt die Reihenfolge dieselbe, und damit auch das, was ein
Vorleseprogramm sagt.

**Der Grund ist der Blick.** Während einer Partie sucht man den Stand, und zwar
alle vier. Aussen an den Bildschirmrändern wären das vier weit
auseinanderliegende Punkte; innen liegen sie dicht beieinander. Gemessen auf
375 px Breite (Bildmitte 187,5), Abstand der Zahl zur Mitte gegen den des
Namens:

| Ecke | Name | Zahl |
| --- | --- | --- |
| ul | 150 px | **112 px** |
| or | 158 px | **75 px** |
| ol | 112 px | **21 px** |
| ur | 158 px | **67 px** |

In allen vier Ecken liegt die Zahl näher an der Mitte als der Name.

**Neben dem Namen steht die Spielstärke**, aber nur, wo ein Bot sitzt: „KI ·
Schwer". Sie ist ein kleines graues Schildchen und nicht Teil des Namens — am
Namen hängt das Abschneiden bei zu wenig Platz (`text-overflow`), und ein
abgeschnittenes „KI · Schw…" wäre schlechter als gar keine Stufe.

**Sie kommt aus der Sicht des Moduls**, nicht aus dem Gedächtnis des Clients.
`sichtFuer` legt jeder Sicht `stufen` bei (Sitz → Stufe), sobald `botStufen` im
Regelsatz stehen — auch der eines Menschen und der eines Zuschauers. Ein Leck
ist das nicht: Eingestellt hat sie, wer den Tisch aufgemacht hat, und über die
Lage der Karten sagen sie nichts. Der Client, der den Tisch aufmacht, wüsste es
zwar auch selbst — aber nur bis zum nächsten Neuladen, und danach stünde an der
Ecke des Gegners nichts mehr.

---

## Der Puck

Ein flacher Chip in der Spielerfarbe. Er steht bei dem, der am Zug ist, und
liegt **über** dem Namen (untere Ecken) bzw. **darunter** (obere) — in den
oberen Ecken stieße er sonst an die Statusleiste des Telefons. Das macht das
Blatt über `flex-direction: column-reverse`; die Reihenfolge im Text bleibt
für beide dieselbe.

Sein Fach behält die Höhe auch leer. Ohne das rutschte der Name bei jedem
Zugwechsel um zehn Pixel.

### Zwei Fallen, beide getreten

**Maßgeblich ist `dran`, nicht „ist jemand am Zug".** Während der Schaupause
(die 1,1 s, in denen zwei ungleiche Karten offen liegen) ist streng genommen
niemand am Zug. Die erste Fassung ließ den Puck deshalb verschwinden — und
gemessen kam dabei `ul → nichts → or → nichts → ul` heraus: ein Blinken nach
jedem zweiten Aufdecker, kein Wandern. Die Tischdecke hält es genauso und
bleibt während der Pause bei der Farbe des Ziehenden.

**Er wandert per FLIP, nicht per Übergang.** Beim Zugwechsel baut React den
Puck in der neuen Ecke NEU auf — er wäre also einfach woanders, ohne Weg
dorthin. `Ecken.tsx` misst deshalb vor und nach dem Wechsel und spielt die
Differenz über `animate()` zurück. Wer `prefers-reduced-motion` gesetzt hat,
bekommt den Sprung ohne Weg.

---

## Reaktionen fliegen aus der Ecke

Ein geworfenes Meme startet in der Ecke **dessen, der es geschickt hat**, und
fliegt in die Mitte. Bis zum 27. August fiel jede fremde Reaktion von oben
herein; das ging, solange es genau einen Gegner gab, und sagt bei dreien
nichts mehr darüber, wer da ruft. Der Sitz steht in der Nachricht und wird
vom **Server** gestempelt, nie vom Client behauptet.

**Ein Flug sind zwei Knoten**, und das ist der Kern der Sache:

- **Außen** ein Kasten über die ganze Bühne. Er trägt die Bewegung, und seine
  Prozentangaben rechnen gegen sich selbst — also gegen die Bühne. „Von der
  Ecke in die Mitte" ist damit auf jedem Gerät derselbe Bruchteil, ohne dass
  eine Strecke in Pixeln ausgerechnet und bei jeder Drehung des Telefons neu
  gemessen werden müsste.
- **Innen** das Zeichen an der Ecke. Es bewegt sich selbst nie.

Der **Drehpunkt** des äußeren Kastens liegt in der Ecke und nicht in seiner
Mitte. Sonst zöge das Kleinerwerden am Anfang das Zeichen aus der Ecke
heraus — es startete sichtbar neben dem, der es geworfen hat.

Gemessen am 27. August (375 × 812, Anteil an der Bühne): Start bei
(86–89 %, 11 %) aus der Ecke oben rechts, Ziel (48–54 %, 50 %). Die Streuung
am Ziel ist der gewollte seitliche Versatz, damit zwei Reaktionen desselben
Augenblicks nicht übereinander liegen.

**Die Reaktionsfläche selbst ist geblieben, wo sie war:** unten in der Mitte,
über den unteren Ecken.

---

## Ein Meme je Sekunde

Emojis dürfen weiterhin viermal je Sekunde kommen, **Motive nur einmal**
(`MOTIV_PAUSE_MS` im Client, eigener Deckel `letztesMotiv` im Gateway). Ein
Emoji ist ein Zeichen von 34 px am Rand, ein Meme ein Bild von 92 px quer
über das Brett — und der Gegner will sich in derselben Zeit Karten merken.

Gedeckelt wird je **Verbindung**, wie schon beim Zuruf und beim Takt: Der
Sitz hängt an der Partie, die Bremse an der Leitung. Wer zwei Fenster
aufmacht, bekommt zwei Deckel; das gilt für Zurufe seit jeher und ist den
Aufwand nicht wert.

Geprüft in `packages/server/test/reaktion-motiv.test.ts`: Das zweite Motiv
nach 400 ms ist am Emoji-Deckel (250 ms) vorbei und fällt trotzdem — also am
Motiv-Deckel. Das Emoji dazwischen kommt an.
