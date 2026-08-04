# Bildbestellung: Stufen

Das Stufensystem steht, aber es ist nackt: eine blaue Plakette mit einer
Zahl, ein Balken aus zwei Farbflächen, und in der Leiter eine Liste aus
Rechtecken. Alles andere im Hub ist gemalt — die Stufen fallen deshalb auf.

Bestellt werden **vier Bilder**. Vorhandenes wird weiterverwendet:
`menue-blatt.webp` trägt das Blatt der Leiter, `tafel.png` die Zeilen,
`pokal.png` bleibt die Trophäe.

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal**, Farbraum sRGB.
- Originale nach `packages/client/art/`. Die Auslieferungsfassung als WebP
  erzeuge ich daraus — **Originale gehören nicht nach `public/`**. So sind
  schon einmal 13,9 MB mitgeliefert und ausgeliefert worden.

**Echte Transparenz — der häufigste Fehler**
Kein Schachbrett-Muster und keine weiße oder schwarze Fläche als
„Transparenz". Probe: auf knallroten **und** auf weißen Grund legen —
sichtbar ist nur die Silhouette, ohne hellen oder dunklen Saum, und in
beiden Fällen gleich hell. Am Schriftzug ist genau das schiefgegangen:
Die Farbe war auf Schwarz gerechnet und wirkte stumpf.

**Was NICHT ins Bild gehört**
- **Keine Zahlen und keine Schrift.** Die Stufe steht als Text darüber und
  geht bis in den dreistelligen Bereich — eine eingebrannte Zahl wäre nach
  einer Woche falsch.
- Keine Bedienelemente, kein Rahmen, kein Schlagschatten nach außen.
- Kein Alkohol.

**Ton und Stil**
Wie die Menüblätter und der Trophäenpfad: gemalt, warm, satt. Handyspiel,
kein Fotorealismus.

---

## 1 — `stufe-plakette.png`

**Wozu:** Der Träger der Stufenzahl. Steht oben links im Hub neben dem
Namen und im Profil, und in der Leiter einmal je Zeile.

**Format:** PNG mit Alpha, **256 × 256**, Motiv mittig, ringsum etwas Luft.

**Motiv:** Ein Schild oder Wappen, leicht gewölbt, mit schmaler Goldfassung
— verwandt mit den Clan-Wappen, aber schlichter, denn es steht klein und
trägt eine Zahl darüber. Die **Mitte muss ruhig und eher dunkel** sein:
Dort steht die Zahl in Weiß, und sie muss auch dreistellig lesbar bleiben.

**Abnahme:** Auf 32 × 32 px verkleinert ist es noch als Schild erkennbar,
und eine weiße „100" darauf ist lesbar.

---

## 2 und 3 — `stufe-balken-rahmen.png`, `stufe-balken-fuellung.png`

**Wozu:** Der Fortschrittsbalken „noch so viele XP bis zur nächsten Stufe".

**Format:** je PNG mit Alpha, **512 × 64**, Randmaß **24 px** — beide
werden als `border-image` gedehnt. Es gilt dieselbe Regel wie bei den
Menüblättern: Ecken innerhalb des Randmaßes, Kanten in Längsrichtung
gleichförmig, Mitte ruhig. Faustregel: einmal auf doppelte Breite ziehen —
sieht die Mitte noch richtig aus, stimmt es.

**Motiv Rahmen:** eine eingelassene Rinne aus dunklem Holz oder Metall,
innen fast schwarz.
**Motiv Füllung:** dasselbe Maß, gefüllt mit warmem Gold, das nach rechts
heller wird, mit einer feinen Lichtkante oben.

**Abnahme:** Rahmen und Füllung übereinandergelegt passen genau; die
Füllung schaut nirgends über den Rahmen hinaus.

---

## 4 — `stufe-auf.png`

**Wozu:** Der Moment des Aufstiegs. Bisher passiert beim Stufenaufstieg
gar nichts — die Zahl wird beim nächsten Laden einfach höher.

**Format:** PNG mit Alpha, **768 × 768**.

**Motiv:** Ein Strahlenkranz mit dem Pinguin davor, wie er den Helm hebt
oder jubelt — freigestellt, ohne Grund. Die App legt die neue Stufenzahl
mittig darüber, also bleibt **die Mitte frei**: Der Kranz wirkt von außen,
die inneren 40 % der Fläche bleiben ruhig und dunkel genug für eine große
weiße Zahl.

**Abnahme:** Auf dunklem und auf hellem Grund gleich gut lesbar, ohne Saum.

---

## Danach

Die Plakette ersetzt `.front-level` und `.stufe-marke`, die beiden
Balkenteile `.stufe-balken`, alles in `styles.css`. Der Aufstiegskranz
braucht zusätzlich eine kleine Anzeige im Client — die gibt es noch nicht
und kommt mit dem Bild.

**Keine Platzhalter unter diesen Namen.** Ein leeres `border-image` reißt
das ganze Element auf, und weiße Kästen sind hier schon zweimal live
gegangen. Bis zur Lieferung bleiben die Farbflächen; sie sind schlicht,
aber sie funktionieren.
