# Bildbestellung: Knopfplatten (Gold, Holz, Rot)

Die Knöpfe im Hub sind gemalte Platten, die der Client per `border-image` auf
jede Größe zieht: Ecken bleiben, Kanten und Mitte werden gestreckt. Das
funktioniert — aber die drei gelieferten Platten haben **unterschiedlich viel
Luft um das Motiv**, und das fällt auf, sobald sie untereinanderstehen.

Zwei Dinge werden hier bestellt:

1. Eine **richtig gemalte Goldplatte**. Zurzeit läuft dort eine umgefärbte
   Fassung der grünen Platte.
2. **Holz und Rot mit demselben Bildaufbau** wie die Goldplatte, damit drei
   Knöpfe untereinander gleich breit sind.

Gestaltungsregeln stehen in [DESIGN.md](DESIGN.md); sie gelten hier
unverändert.

---

## Der Befund, um den es geht

Gemessen an den gelieferten Dateien (Alphakanal auf der Mittelzeile, alle
512 × 160 px):

| Datei | Platte liegt bei x | belegt |
|---|---|---|
| `menue-knopf-holz.webp` | 21 … 490 | 92 % der Breite |
| `menue-knopf-rot.webp` | 59 … 451 | 77 % der Breite |
| `menue-knopf-gruen.webp` | 93 … 417 | **63 % der Breite** |

Alle drei werden im Client mit **demselben** Randmaß geschnitten. Bei der
grünen Platte fiel damit fast die gesamte Luft in die gestreckte Mitte: Die
Platte deckte nur noch zwei Drittel des Knopfes ab, die Beschriftung stand
rechts und links darüber hinaus, und in einer Knopfreihe sah der Hauptknopf
schmaler aus als die anderen — obwohl alle drei `width: 100 %` haben.

Behoben ist das vorerst durch **Beschneiden**: Die Goldplatte liegt jetzt als
325 × 160 im Repo und bekommt ein eigenes Randmaß. Das ist ein Notnagel, kein
Zustand — deshalb diese Bestellung.

---

## Für alle Platten verbindlich

**Format**
- **WebP wird ausgeliefert, PNG wird geliefert.** Die Umwandlung passiert hier
  (`node ~/bildwerkzeug/wandeln.mjs <quellordner> <zielordner> wappen`). Bitte
  PNG mit Alphakanal abgeben.
- **512 × 160 px**, sRGB, **echter Alphakanal**.

**Der Bildaufbau — der eigentliche Punkt dieser Bestellung**
- Die Platte **füllt die Bildbreite bis auf höchstens 8 px an jeder Seite.**
  Keine dekorative Luft, kein zentriertes Motiv auf großem Feld. Wer Abstand
  will, bekommt ihn im Client als Polsterung — im Bild kostet er Fläche.
- **Der Rahmen (inkl. Eckbeschläge) ist höchstens 30 px dick.** Er wird als
  unverzerrte Ecke stehen gelassen; alles darüber hinaus wird auf kleinen
  Knöpfen zur ganzen Fläche.
- **Der Schlagschatten sitzt unten und ist höchstens 10 px hoch.** Er gehört
  ins Bild (er verschwindet beim Drücken mit), aber er darf die Platte nicht
  optisch nach oben schieben.
- **Alle drei Platten teilen sich Rahmenbreite, Eckform und Schattenhöhe.**
  Nur die Füllung unterscheidet sich. Das ist die Bedingung dafür, dass drei
  Knöpfe untereinander eine Reihe ergeben und keine Treppe.

**Echte Transparenz — der häufigste Fehler**
Außerhalb der Platte gehört **Alpha 0**, kein Schachbrettmuster. Das ist hier
dreimal passiert (siehe CLAUDE.md). Bitte vor dem Abgeben die Datei über einen
knallroten Grund legen: Was rot durchscheint, ist richtig.

**Was NICHT ins Bild gehört**
- **Kein Text.** Die Beschriftung setzt der Client.
- **Kein Symbol, kein Icon.** Auch die kommen aus dem Client.
- **Keine abgerundete Außenkante mit Schein** — der Knopf steht auf Holz und
  auf gemalten Szenen, ein weicher Halo sieht dort aus wie ein Ausschneidefehler.

---

## 1. `menue-knopf-gold.png` — der Hauptknopf

Der wichtigste Knopf im Haus: „Spielen", „Kaufen", „Abholen", „Anmelden". Er
war bisher **grün** — als einziges Bauteil in einem Haus aus Holz und Messing.

- **Füllung:** poliertes Gold / helles Messing, warm, leicht gebürstet. Nicht
  Zitronengelb, nicht Kupferbraun — das eine wirkt giftig, das andere geht im
  Holz unter.
- **Rahmen:** derselbe Messingrahmen mit den vier Eckbeschlägen wie bei der
  grünen Platte. Der Rahmen darf **dunkler** sein als die Füllung, sonst
  verschwimmt er darin.
- **Die Mitte muss dunkle Schrift tragen können.** Der Client schreibt in
  `#3a2408` mit hellem Lichtsaum. Ein zu heller oder zu unruhiger Mittelbereich
  macht das unlesbar — die Maserung bitte fein und flach halten.

**Abnahme:** Datei über `#3a2618` legen, „SPIELEN" in `#3a2408` bei 13 px
daraufsetzen. Wenn man das aus Armlänge liest, stimmt es.

## 2. `menue-knopf-holz.png` und `menue-knopf-rot.png` — Neuschnitt

Motiv bleibt, nur der Aufbau ändert sich: Platte auf volle Breite, Rahmen und
Ecken identisch zur Goldplatte.

- Holz: dunkles Nussbraun, Schrift hell (`#f4e9d4`) — der ruhige Standardknopf.
- Rot: gedämpftes Weinrot, Schrift hell (`#ffe9e4`) — nur für Abmelden und
  Löschen, also selten und immer allein.

## 3. `menue-knopf-holz-gedrueckt.png` — bleibt

Wird nicht neu bestellt, muss aber **zum neuen Holzknopf passen**: gleiche
Plattenbreite, gleicher Rahmen, nur eingesunken und ohne Schlagschatten.

---

## Abnahmekriterien (alle Dateien)

1. 512 × 160, PNG, echter Alphakanal, auf rotem Grund geprüft.
2. Platte reicht bis ≤ 8 px an den linken und rechten Bildrand.
3. Rahmen inkl. Eckbeschlag ≤ 30 px, bei allen drei Platten gleich dick.
4. Kein Text, kein Symbol, kein Halo.
5. Drei Platten untereinander gelegt: gleiche Außenkante, gleiche Höhe.

---

## Wo die Dateien hingehören

Originale ins Archivrepo
[`moodsteppi/brauweg-art`](https://github.com/moodsteppi/brauweg-art), die
gewandelten WebP nach `packages/client/public/hub/`. Beim Einbau die
Dateigröße ansehen — eine Knopfplatte liegt bei 10–20 kB.

Ist die gemalte Goldplatte da, fällt im Stylesheet das eigene Randmaß weg
(`border-image-slice: 30 fill` bei `.hub-knopf--a-gold`, `.auth button.primary`,
`.profil-kachel.is-gold` und `.spielwahl-spielen`) — dann gilt wieder für alle
dasselbe.
