# Bildbestellung: Menüblätter

Die Wappen im Clan-Menü sind gemalt, der Rahmen darum ist noch nacktes
Dunkelblau: graue Kästen, ein flacher grüner Knopf, ein Umschalter aus zwei
Rechtecken. Das Blatt liegt über einer gemalten Halle und sieht aus, als
gehöre es zu einer anderen App.

Diese Bestellung deckt **alle** Blätter auf einmal ab, nicht nur das
Clan-Menü: Tischerstellung, Regelsatz, Rangliste, „Kommt bald" und das neue
Blatt zur Kontolöschung benutzen dieselben Bausteine. Sieben Bilder ersetzen
damit das flache Dunkelblau überall.

**Vorhandenes wird weiterverwendet:** `schild.png` bleibt die Überschrift,
`tafel.png` bleibt der Rahmen für Listenzeilen, die acht `wappen-*.png`
bleiben unverändert.

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal**, Farbraum sRGB.
- Geliefert wird in voller Auflösung nach `packages/client/art/`.
  Die Auslieferungsfassung unter `public/` erzeuge ich daraus als WebP —
  **die Originale gehören nicht nach `public/`**. Genau so sind schon
  einmal 13,9 MB PNG mitgeliefert und ausgeliefert worden.

**Echte Transparenz — der häufigste Fehler**
Kein Schachbrett-Muster und keine weiße Fläche als „Transparenz". Zur
Probe: auf knallroten Grund legen — sichtbar wird nur, was sichtbar sein
soll, ohne hellen Saum. Das ist uns schon dreimal passiert.

**Was NICHT ins Bild gehört**
- **Keine Schrift.** Keine Beschriftung, keine Zahlen, keine Buchstaben.
  Jeder dieser Knöpfe trägt später wechselnden Text — „Speichern",
  „Abbrechen", „Endgültig löschen". Eingebrannter Text macht das Bild
  unbrauchbar.
- **Keine Symbole in der Mitte.** Keine Haken, keine Kreuze, keine Pfeile.
- **Keine Bedienelemente**, keine Tab-Leiste, kein Handyrahmen, kein
  Schlagschatten nach außen (den setzt die App).
- **Kein Alkohol**: keine Krüge, Fässer, Hopfen.

**Ton und Stil**
Wie `bg-clan.png` und `bg-spieltisch.png`: gemaltes Holz, warme Töne, satte
Farben, weiche Kanten. Handyspiel, kein Fotorealismus, kein Comic-Umriss.
Die Blätter liegen **über** einer gemalten Szene und müssen sich davon
abheben — also eher dunkles, gebeiztes Holz als helles Pergament.

---

## Das Wichtigste: dehnbare Ränder

Alle sieben Bilder werden im Browser als `border-image` benutzt. Das heißt:
Das Bild wird in neun Felder zerschnitten, die vier Ecken bleiben wie sie
sind, die vier Kanten werden in die Länge gezogen, die Mitte wird auf die
volle Fläche gestreckt. So trägt **ein** Bild ein kurzes Blatt mit zwei
Zeilen genauso wie ein langes mit acht.

Daraus folgen drei Bedingungen, und an ihnen scheitert es sonst:

1. **Die Ecken müssen vollständig innerhalb des angegebenen Randmaßes
   liegen.** Ragt eine geschnitzte Ecke weiter nach innen, wird sie
   mitgestreckt und verzerrt.
2. **Die Kanten müssen in Längsrichtung gleichförmig sein.** Eine Maserung
   quer über die Kante ist in Ordnung, ein einzelner Nagel in der Mitte
   der oberen Kante nicht — er würde beim Strecken zum Strich.
3. **Die Mitte muss ruhig sein.** Gleichmäßige Fläche, leichte Textur
   erlaubt, aber kein Motiv, kein Farbverlauf von oben nach unten, keine
   Lichtinsel. Sie wird auf jede Größe gezogen.

Faustregel zum Prüfen: das Bild in einem Grafikprogramm einmal auf die
doppelte Breite und die halbe Höhe ziehen. Sieht die Mitte danach noch
richtig aus und sind die Ecken unverzerrt, stimmt es.

---

## 1 — `menue-blatt.png`

**Wozu:** Der Grund jedes Blattes. Trägt im Clan-Menü Name, Spruch, Wappen,
Beitritt und die Knöpfe; im Löschblatt eine Warnung und ein Passwortfeld.

**Format:** PNG mit Alpha, **768 × 1024**, Randmaß **96 px** auf allen
Seiten.

**Motiv:** Eine gebeizte Holzplatte mit umlaufendem, geschnitztem Rahmen.
Ecken leicht betont, etwa durch eine schlichte Verzierung oder einen
Messingbeschlag — aber flach und ohne Symbolik. Oben darf der Rahmen
kräftiger sein als unten. Die Innenfläche ist ruhiges, dunkles Holz, an dem
sich heller Text gut abhebt.

**Abnahme:** Auf ein Blatt von 340 × 300 px gezogen sind die Ecken
unverzerrt und der Rahmen umlaufend gleich breit.

---

## 2 — `menue-feld.png`

**Wozu:** Eingabefelder. Im Clan-Menü Name, Spruch und „ab Trophäen", im
Löschblatt das Passwortfeld.

**Format:** PNG mit Alpha, **512 × 128**, Randmaß **32 px**.

**Motiv:** Eine in die Platte eingelassene Vertiefung — dunkler als das
Blatt, mit schmalem Schattenrand oben und einer feinen Lichtkante unten,
damit sie eingesenkt wirkt. Innen fast schwarz und völlig ruhig: Hier steht
später der eingetippte Text, er muss lesbar bleiben.

**Abnahme:** Auf 300 × 48 px gezogen wirkt es noch wie eine Rille und nicht
wie ein Balken.

---

## 3 — `menue-knopf-gruen.png`

**Wozu:** Der Hauptknopf. „Speichern", „Gründen", „Beitreten", „Belohnung
holen".

**Format:** PNG mit Alpha, **512 × 160**, Randmaß **40 px**.

**Motiv:** Ein satt grüner, leicht gewölbter Knopf mit schmaler Goldfassung.
Lichtkante oben, Schatten unten, Ecken rund. Das Grün darf kräftiger sein
als das jetzige — es ist der Knopf, den man treffen soll.

---

## 4 — `menue-knopf-holz.png`

**Wozu:** Der Nebenknopf. „Abbrechen", „Behalten", „Zurück",
„Benachrichtigungen".

**Format:** PNG mit Alpha, **512 × 160**, Randmaß **40 px**.

**Motiv:** Dieselbe Form und Wölbung wie der grüne, aber aus hellerem Holz
mit dunkler Fassung. Er soll ruhig und zurückgenommen wirken, ohne
ausgegraut auszusehen — er ist nicht gesperrt, nur zweitrangig.

---

## 5 — `menue-knopf-rot.png`

**Wozu:** Der Knopf für Unumkehrbares. „Endgültig löschen", „Rauswerfen",
„Clan verlassen".

**Format:** PNG mit Alpha, **512 × 160**, Randmaß **40 px**.

**Motiv:** Dieselbe Form wie die anderen beiden, in gedecktem Dunkelrot mit
dunkler Fassung. **Nicht signalrot und nicht leuchtend** — der Knopf soll
ernst wirken, nicht alarmieren. Wer ihn drückt, hat sich das vorher
überlegt.

---

## 6 und 7 — `menue-schalter-an.png`, `menue-schalter-aus.png`

**Wozu:** Der Umschalter mit genau zwei Möglichkeiten. Im Clan-Menü
„Offen / Auf Anfrage", beim Tischbau ähnliche Paare.

**Format:** PNG mit Alpha, je **512 × 160**, Randmaß **40 px**. Beide
**exakt gleich groß** und mit identischer Außenkontur — sie liegen
nebeneinander, und ein Größenunterschied fällt sofort auf.

**Motiv:**
- `menue-schalter-an.png`: gewählte Seite. Heller, wie hervorgehoben, mit
  goldener Fassung und leichtem Schein nach innen.
- `menue-schalter-aus.png`: nicht gewählte Seite. Dunkler und flacher, wie
  in die Platte eingelassen, ohne Goldfassung.

Der Unterschied muss auch ohne Farbe erkennbar sein — hell gegen dunkel,
erhaben gegen eingesenkt. Wer rot-grün-schwach ist, soll den Schalter
trotzdem lesen können.

---

## Danach

Wenn die sieben Bilder liegen, tausche ich sie in `styles.css` gegen die
jetzigen Flächen — betroffen sind `.doko-sheet-card`, `.hub-knopf` samt
seinen Spielarten, die Eingabefelder in `.hub-loeschen` und der Umschalter
im Clan-Menü.

**Bis dahin bleibt das Menü, wie es ist.** Bewusst keine Platzhalter unter
diesen Namen: Ein leeres oder weiß gefülltes Bild als `border-image` reißt
das ganze Blatt auf, und genau so sind schon zwei Platzhalter mit weißem
Kasten live gegangen. Das flache Dunkelblau ist unschön, aber es
funktioniert.
