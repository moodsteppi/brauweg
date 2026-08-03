# Bildbestellung: Brauweg-Schriftzug neu

`logo.png` ist der Schriftzug mit dem Ritter-Pinguin. Er steht auf der
Startseite oben links und auf dem Anmeldebildschirm über dem Formular —
zwei der sichtbarsten Stellen der App.

**Er ist als einziges Bild nie bestellt worden**, sondern von Anfang an
mitgeliefert. Deshalb hat er zwei Fehler, die keine Bestellung je
ausgeschlossen hat.

---

## Was mit der jetzigen Datei nicht stimmt

**1. Der Alphakanal hatte Löcher im Inneren.** Helmkuppel, Visierschlitze
und Teile des Gesichts standen auf durchsichtig, obwohl die Farbe darunter
vollständig vorhanden war. Auf dem dunklen Hub sah es aus, als könne man
durch den Helm hindurchsehen.

Das ist **behelfsmäßig repariert**: Die Maske wurde aus der Farbe neu
gebaut — der Grund unter dem Bild ist reines Schwarz, das Bild selbst wird
nirgends ganz schwarz — und mit dem verlässlichen Teil des alten
Alphakanals vereint. Deckende Fläche von 46,5 auf 52,5 Prozent.

**2. Die Farben am Helm stimmen nicht.** Genau das ist der Grund für diese
Bestellung. Wo die Maske vorher durchsichtig war, lag die Farbe auf
schwarzem Grund; an halbdurchsichtigen Rändern ist sie deshalb mit Schwarz
verrechnet und wirkt stumpfer und dunkler, als sie sein müsste. Das lässt
sich nicht sauber zurückrechnen — bei Deckkraft nahe null gibt es keine
Farbe mehr, die man wiederherstellen könnte.

**Die reparierte Fassung bleibt bis zur Neulieferung in Betrieb.** Ein
farblich unsauberer Helm ist besser als ein durchsichtiger. Die kaputte
Ausgangsdatei liegt als `art/logo-original-mit-alphafehler.png` daneben.

---

## Was bestellt wird

**Format:** PNG mit **echtem Alphakanal**, **1280 × 820** (doppelt so groß
wie bisher, damit er auch auf dem Anmeldebildschirm scharf bleibt — dort
wird er breiter angezeigt als im Hub). Farbraum sRGB. Original nach
`packages/client/art/`, die Auslieferungsfassung erzeuge ich daraus.

**Motiv:** Wie bisher, das soll sich nicht ändern — der Schriftzug
„BRAUWEG" in kräftigen weißen Versalien mit dunkelblauer Fassung auf einem
leicht gebogenen Band, darunter mittig ein goldener Stern, und oben rechts
der Ritter-Pinguin, der über das Band lugt: Silberhelm mit blauem
Federbusch, goldene Ohrstücke, orangefarbener Schnabel.

**Die Farben, auf die es ankommt:**

| Teil | soll |
| --- | --- |
| Helm | helles, sauberes Silbergrau mit klaren Lichtkanten — **nicht** stumpf oder ins Schwarze gezogen |
| Federbusch | kräftiges, leuchtendes Blau |
| Ohrstücke und Stern | warmes Gold |
| Schnabel | kräftiges Orange |
| Schriftband | dunkles Blau, Schrift reinweiß |

**Echte Transparenz — hier ist es der ganze Punkt der Bestellung**
- Alles, was zum Bild gehört, ist **voll deckend**. Keine Löcher im
  Inneren: nicht in der Helmkuppel, nicht in den Visierschlitzen, nicht im
  Gesicht.
- Durchsichtig ist **ausschließlich** der Bereich außerhalb der Silhouette.
- Kein Schachbrett-Muster und keine weiße oder schwarze Fläche als
  „Transparenz".
- **Der Rand darf nicht auf Schwarz gerechnet sein.** Wenn an den weichen
  Kanten Schwarz durchschlägt, entsteht ein dunkler Saum — genau der
  Fehler, den wir jetzt haben.

**Probe:** Das Bild auf einen knallroten und auf einen weißen Grund legen.
In beiden Fällen ist nur die Silhouette zu sehen, ohne hellen oder dunklen
Saum, und der Helm ist in beiden Fällen gleich hell.

**Was NICHT ins Bild gehört**
- **Kein Slogan.** „Doppelkopf. Dein Weg." war ein zweites Bild darunter
  und ist entfernt worden; der Schriftzug steht allein.
- Kein Rahmen, kein Hintergrund, kein Schlagschatten nach außen — den
  setzt die App.
- Kein Alkohol.
