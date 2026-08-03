# Nachbesserung: fünf Biom-Kacheln

Die sechs Kacheln aus [ASSETS-BIOME.md](ASSETS-BIOME.md) sind geliefert und
eingebaut. **Fünf davon müssen neu**, und der Fehler liegt an der
Bestellung, nicht an der Ausführung.

## Was schiefging

In der Bestellung standen zwei Anforderungen nebeneinander:

1. Der Weg darf sich schlängeln, ausholen, an Hindernissen vorbei.
2. Er kreuzt Ober- und Unterkante bei **genau 50 %** der Breite, und läuft
   dort auf den letzten 5 % senkrecht.

Erfüllt wurden beide — mit **zwei** Wegen: einem malerischen, der sich
schlängelt, und zusätzlich einer kerzengeraden Kette kleiner Ovale exakt
auf der Mittellinie, die die Geometrie einhält. Übereinander sieht das aus
wie ein Darstellungsfehler.

**Betroffen sind fünf Kacheln:**

| Kachel | Befund |
| --- | --- |
| `biom-1-heimat` | **In Ordnung, bitte nicht neu machen.** Genau ein Weg |
| `biom-2-wiesen` | Zwei Wege. Dazu ein **rechteckiger Flicken** mit harten Kanten im unteren Drittel — unscharfes Gras, hineinkopiert |
| `biom-3-strand` | Zwei Wege |
| `biom-4-feuerberg` | Zwei Wege: breiter Steinweg plus Ovalkette an seinem linken Rand |
| `biom-5-schneefeld` | Die dunklen Steine bilden zwei verschlungene Ketten statt einer |
| `biom-6-sternenhafen` | Zwei Wege — und der deutlichste Fall: Die gerade Ovalkette läuft in der oberen Bildhälfte **durch den Nachthimmel**, Trittsteine schweben über dem Hafen zwischen den Sternen. Dazu die falsche Perspektive, siehe unten |

**`biom-1-heimat.png` ist die Vorlage.** Wie dort der Weg liegt — eine
einzige Kette, leicht versetzt, ruhig — so soll es überall aussehen.

## Die berichtigte Regel

Alles aus [ASSETS-BIOME.md](ASSETS-BIOME.md) gilt weiter — Maße, Format,
Ablage, Stil, Beschnitt, „was nicht ins Bild gehört". **Ersetzt wird nur
der Abschnitt zum Wegverlauf**, und zwar durch:

> **Genau ein Weg pro Kachel.** Eine einzige Kette von Trittsteinen, sonst
> nichts Wegähnliches: kein zweiter Pfad, keine Trampelspur daneben, keine
> zusätzliche Reihe kleiner Steine. Wenn im Bild zwei Linien zu sehen sind,
> auf denen man laufen könnte, ist die Kachel falsch.
>
> **Der Weg läuft senkrecht durch die Mitte.** Er darf leicht pendeln, wie
> eine von Hand gezeichnete Linie — aber er weicht **nirgends mehr als
> 8 % der Bildbreite** von der Mittellinie ab, und an Ober- und Unterkante
> steht er bei 50 %. Er soll nicht ausholen und keine Bögen schlagen; die
> Landschaft liegt links und rechts davon.

Die Lockerung ist inzwischen gedeckt: Die App braucht die genaue
Wegführung nicht mehr. Sie zeichnet die Figur auf die Mittellinie, und
nachgemessen liegt der Weg auf den gelieferten Kacheln ohnehin im Mittel
nur 1,4 bis 2,9 % daneben. Ein Weg, der weit ausholt, wäre sogar falsch —
dann liefe der Pinguin am Weg vorbei.

## Zwei weitere Punkte, die am Gerät auffallen

**Der Sternenhafen hat die falsche Perspektive.** Die anderen fünf sind
Draufsicht aus leichter Schräge, wie eine Schatzkarte. Der Sternenhafen ist
ein Frontalblick: Man schaut vom Wasser aus auf den Hafen, mit Horizont und
Himmel im oberen Drittel. Im Stapel ist der Bruch sofort sichtbar, und er
ist auch die Ursache dafür, dass die Ovalkette dort in den Himmel läuft —
in einer Frontalansicht gibt es oben schlicht keinen Boden mehr.

Bitte auch den Sternenhafen als **Draufsicht**: der Hafen von oben gesehen,
Anleger und Boote von oben, Wasser ringsum. Nachthimmel und Sterne dürfen
sich im Wasser spiegeln — aber es gibt keinen Horizont im Bild.

**Die Kachelstöße sind harte Kanten.** In der Bestellung stand, Ober- und
Unterkante seien Wasser oder Dunst. Beim Sternenhafen ist die Unterkante
Dunst, die Oberkante des Schneefelds darunter aber fester Schnee — an der
Naht steht deshalb eine scharfe waagerechte Linie quer durchs Bild. Bitte
bei allen Kacheln **beide** Ränder als Wasser oder Nebel auslaufen lassen,
und zwar auf mindestens den äußeren 8 % der Höhe. Dann verschwimmen die
Stöße, statt sich abzuzeichnen.

## Zum Flicken in `biom-2-wiesen`

Im unteren Drittel sitzt ein Rechteck mit harten Kanten, in dem das Gras
unscharf und anders belichtet ist. Das ist kein Motiv, sondern ein
Bildfehler. Bitte darauf achten, dass die neue Fassung keine solchen
Flicken hat — bei ganzflächigen Kacheln fällt so etwas sofort auf, weil
nichts drüberliegt, das es verdecken könnte.

## Bis dahin

Die vorhandenen Kacheln bleiben eingebaut. Sie sind unschön, aber sie
funktionieren, und ein leerer Platzhalter an ihrer Stelle wäre schlechter —
bei bildschirmfüllenden Kacheln besonders auffällig. Die neuen Dateien
kommen unter **denselben Namen** nach `packages/client/art/`, dann tausche
ich die Auslieferungsfassung aus; im Code ändert sich nichts.
