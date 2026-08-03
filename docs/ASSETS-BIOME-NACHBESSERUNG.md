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

## Stand: fünf von sechs sind fertig

| Kachel | Helligkeit | |
| --- | --- | --- |
| `biom-1-heimat` | 28 % | **offen** — zwei Wege, gerahmter Rand, siehe oben |
| `biom-2-wiesen` | 44 % | fertig |
| `biom-3-strand` | 42 % | fertig |
| `biom-4-feuerberg` | 29 % | fertig — Vulkan mit Lava wieder da |
| `biom-5-schneefeld` | 42 % | fertig |
| `biom-6-sternenhafen` | 38 % | fertig — Hafen mit Lichtern wieder da |

Runde 2 hat die doppelten Wege behoben, die Ränder auslaufen lassen, den
Sternenhafen auf Draufsicht gedreht und den rechteckigen Flicken in den
Wiesen entfernt. Dabei verloren Feuerberg und Sternenhafen ihr Motiv —
17 % und 12 % Helligkeit, schwarzes Geröll und ein dunkler Steg. Runde 3
hat beide zurückgeholt.

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
