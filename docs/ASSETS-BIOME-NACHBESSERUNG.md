# Nachbesserung: Biom-Kacheln

## Offen: `biom-1-heimat.png`

**Diese eine Kachel fehlt noch.** Sie ist als einzige nie neu gemacht
worden, weil ich sie irrtümlich für sauber gehalten habe — sie hat
dieselben **zwei Wege** wie die anderen: den breiten Trampelpfad mit den
großen Steinen *und* die gerade Ovalkette auf der Mittellinie.

Der Irrtum kam vom Prüfverfahren: beurteilt wurde an einem 175 Pixel
breiten Mittelstreifen, und in dieser Größe verschmelzen die beiden Ketten
zu einer, die bloß unruhig wirkt. **Kacheln in voller Auflösung ansehen**,
sonst rutscht so etwas wieder durch.

Zweiter Punkt: Sie hat einen **gerahmten Rand** — abgerundete Kante mit
dunkler Umrandung, wie eine Spielkarte. Die fünf neuen laufen stattdessen
an allen vier Seiten in Wasser und Nebel aus. Im Stapel steht deshalb an
ihrem oberen Rand eine harte Linie.

**Gewünscht:** Motiv und Stimmung bleiben, wie sie sind — Wiese, Wirtshaus,
warmes Abendlicht, das ist genau richtig und die hellste Erinnerung an den
Anfang. Zu ändern sind nur zwei Dinge:

1. **Genau ein Weg**, nach der berichtigten Wegregel weiter unten.
2. **Kein Rahmen.** Alle vier Ränder laufen aus, oben und unten in Wasser
   oder Nebel, wie bei den anderen fünf.

---

## Stand

**Runde 1 ist für fünf Kacheln erledigt.** Die zweite Lieferung hat behoben, was die erste
falsch hatte: genau ein Weg pro Kachel, gerade durch die Mitte, Ränder in
Wasser und Nebel auslaufend, der Sternenhafen als Draufsicht, kein Flicken
mehr in den Wiesen. Vier der sechs Kacheln sind damit fertig —
`biom-1-heimat`, `biom-2-wiesen`, `biom-3-strand`, `biom-5-schneefeld`.

**Zwei sind beim Neumachen gekippt** und brauchen eine dritte Runde. Sie
sind eingebaut und funktionieren, aber sie haben ihr Motiv verloren.

---

## Runde 2 — nur diese zwei

Alles aus [ASSETS-BIOME.md](ASSETS-BIOME.md) gilt weiter, ebenso die
berichtigte Wegregel weiter unten. **Der Weg ist bei beiden richtig und
soll genau so bleiben** — es geht ausschließlich um das, was links und
rechts davon liegt.

### `biom-4-feuerberg.png` — das Feuer fehlt

Mittlere Helligkeit **17 %**. Die Kachel ist ein schwarzes Geröllfeld: kein
Vulkan, keine Lava, kein Glühen. Sie liest sich als Brandfläche, nicht als
Feuerberg. Zum Vergleich: Wiesen 49 %, Strand 45 %, Schneefeld 40 %,
Heimat 30 %.

Gewünscht: **Vulkankegel, glühende Spalten im Gestein, Lavaadern, die sich
durch die Kachel ziehen.** Warmes oranges Licht, das auf die umliegenden
Felsen fällt. Bedrohlich, aber nicht düster — der Weg bleibt hell und gut
sichtbar, und man soll erkennen wollen, wo man da hinläuft. Die erste
Fassung hatte das richtig; nur der doppelte Weg war ihr Problem.

### `biom-6-sternenhafen.png` — der Hafen fehlt

Mittlere Helligkeit **12 %**, die dunkelste Kachel von allen. Zu sehen sind
ein Steg, zwei Boote und drei Laternen. Es fehlen die Stadt, die
erleuchteten Fenster, die Lichterketten, die Spiegelungen im Wasser.

Das wiegt schwerer als beim Feuerberg: **Das ist das Ziel des ganzen
Weges.** Wer tausend Trophäen sammelt, kommt hier an. Es soll die
Belohnung sein und die hellste, festlichste Kachel des Satzes — nicht die
düsterste.

Gewünscht: **Hafenstadt von oben**, Häuser mit warm erleuchteten Fenstern
rings um das Becken, Boote mit Laternen, Lichterketten zwischen den
Masten, Sterne und Lichter im Wasser gespiegelt. Nacht, aber eine helle,
warme Nacht. Draufsicht wie bei den anderen fünf, kein Horizont im Bild.

---

## Die berichtigte Wegregel (gilt weiter)

> **Genau ein Weg pro Kachel.** Eine einzige Kette von Trittsteinen, sonst
> nichts Wegähnliches: kein zweiter Pfad, keine Trampelspur daneben, keine
> zusätzliche Reihe kleiner Steine. Wenn im Bild zwei Linien zu sehen sind,
> auf denen man laufen könnte, ist die Kachel falsch.
>
> **Der Weg läuft senkrecht durch die Mitte.** Er darf leicht pendeln, wie
> eine von Hand gezeichnete Linie — aber er weicht **nirgends mehr als
> 8 % der Bildbreite** von der Mittellinie ab, und an Ober- und Unterkante
> steht er bei 50 %.
>
> **Beide Ränder** laufen auf mindestens den äußeren 8 % der Höhe in Wasser
> oder Nebel aus, damit die Kachelstöße nicht als scharfe waagerechte Linie
> im Bild stehen.

---

## Was in Runde 1 schiefging, zum Nachlesen

Die erste Lieferung hatte auf fünf Kacheln **zwei** Wege: einen
malerischen und zusätzlich eine kerzengerade Kette kleiner Ovale auf der
Mittellinie. Beim Sternenhafen lief diese Kette sogar durch den
Nachthimmel, weil die Kachel damals Frontalansicht statt Draufsicht war —
in einer Frontalansicht gibt es oben keinen Boden mehr.

**Die Ursache lag in der Bestellung, nicht in der Ausführung.** Dort
standen zwei Anforderungen nebeneinander: „der Weg darf sich schlängeln,
ausholen, an Hindernissen vorbei" und „er kreuzt Ober- und Unterkante bei
genau 50 % der Breite". Erfüllt wurde beides — mit je einem eigenen Weg.

Die Lockerung auf „höchstens 8 % Abweichung" ist gedeckt: Die App braucht
die genaue Wegführung nicht mehr. Sie setzt die Figur auf die Mittellinie,
und ein Weg, der weit ausholt, wäre sogar falsch — dann liefe der Pinguin
daneben.
