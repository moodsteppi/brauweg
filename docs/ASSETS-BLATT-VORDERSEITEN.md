# Bildbestellung: Kartenvorderseiten für die zehn neuen Blätter

Von den zehn neuen Blättern ist bisher **nur die Rückseite** gemalt und
geliefert. Die sind eingebaut und werden im Shop als „Kartenrückseiten"
verkauft — das funktioniert, weil die Rückseite das ist, was alle am Tisch
sehen.

**Was fehlt: die Vorderseiten.** Erst mit ihnen wird aus einer Rückseite ein
vollständiges Blatt, das man als Blatt auswählen kann. Ohne sie wäre das
Blatt am Tisch ein Feld aus kaputten Bildern — deshalb steht es noch nicht
zur Wahl.

**Pro Blatt 24 Karten.** Bei zehn Blättern sind das 240 Bilder. Das ist
viel; die Reihenfolge unten sagt, womit anzufangen ist, damit nach jedem
fertigen Blatt sofort etwas Spielbares dazukommt.

---

## Reihenfolge — bitte blattweise, nicht kartenweise

**Ein Blatt komplett, dann das nächste.** Ein halb fertiges Blatt ist
wertlos: Es lässt sich nicht freischalten, weil die fehlenden Karten am
Tisch als kaputte Bilder erschienen. Zehn Blätter mit je zwei fertigen
Karten sind also **nichts**, ein einziges fertiges Blatt ist **sofort
verkaufbar**.

Vorschlag für die Reihenfolge (nach Preis, günstig zuerst — dann kommen die
Blätter zuerst dazu, die sich die meisten leisten können):

1. `eiche` 2. `winterhof` 3. `sommerwiese` 4. `kupferstich` 5. `schiefer`
6. `nachthimmel` 7. `rubin` 8. `smaragd` 9. `koeniglich` 10. `pinguin`

Sag mir nach jedem fertigen Blatt Bescheid — ich schalte es einzeln frei.

---

## Format — für jede Karte gleich, ohne Ausnahme

**Das ist der wichtigste Abschnitt.** Die Karten liegen später neben den
Karten der vorhandenen Blätter im selben Fächer.

- **PNG, 744 × 1080 px** — genau wie die schon gelieferten Rückseiten.
  Seitenverhältnis 1 : 1,452, das Kartenformat der App.
- **sRGB.**
- **Abgerundete Ecken, außerhalb der Rundung echtes Alpha.** Die Karte liegt
  auf farbigem Filz — eine weiße Ecke fällt sofort auf. Rundungsradius wie
  bei der jeweiligen Rückseite desselben Blattes.
- **Randlos:** Das Motiv füllt die Karte bis an die Rundung. Kein Rahmen um
  den Rahmen.

### Echte Transparenz — der häufigste Fehler

Kein Schachbrettmuster, keine weiße Fläche als „Transparenz". Probe: Die
Karte auf **knallroten** Grund legen — sichtbar wird nur die Karte, ohne
hellen Saum an der Rundung. Das ist in diesem Projekt schon dreimal
passiert.

---

## Aufbau einer Karte — verbindlich

```
┌─────────────┐
│ D           │   ← Wert groß, darunter das Farbzeichen
│ ♥           │
│             │
│   (Motiv)   │   ← Bildfiguren: Figur; Zahlenkarten: Farbzeichen
│             │
│           ♥ │   ← gespiegelt, auf dem Kopf
│           D │
└─────────────┘
```

- **Wert und Farbzeichen stehen oben links und — um 180° gedreht — unten
  rechts.** Das ist keine Zierde: Im Fächer schaut von jeder Karte nur die
  linke obere Ecke hervor. Fehlt sie, ist die Hand unlesbar.
- **Die Ecken müssen bei 25 % Größe noch lesbar sein.** Auf einem Handy ist
  eine Handkarte etwa 50 px breit. Lieber ein Zeichen zu groß als zu fein.

### Lesbarkeit der Farben — Pflicht

- **Kreuz (♣) und Pik (♠): deutlich dunkel/schwarz.**
- **Herz (♥) und Karo (♦): deutlich rot.**

**Probe:** Eine Kreuz- und eine Herzkarte nebeneinanderlegen und aus zwei
Metern anschauen. Wer sie nicht auf einen Blick unterscheiden kann, hat ein
Blatt, mit dem man nicht spielen kann. Das gilt auch für dunkle Blätter
(`nachthimmel`, `schiefer`): Dort braucht Rot einen helleren Ton, damit es
gegen den Grund noch rot wirkt.

---

## Die 24 Karten je Blatt — Dateinamen

Vier Farben × sechs Werte. **Kleinschreibung, deutsche Namen, exakt so:**

| | Neun | Zehn | Bube | Dame | König | Ass |
| --- | --- | --- | --- | --- | --- | --- |
| **Kreuz** | `kreuz_9` | `kreuz_10` | `kreuz_b` | `kreuz_d` | `kreuz_k` | `kreuz_a` |
| **Pik** | `pik_9` | `pik_10` | `pik_b` | `pik_d` | `pik_k` | `pik_a` |
| **Herz** | `herz_9` | `herz_10` | `herz_b` | `herz_d` | `herz_k` | `herz_a` |
| **Karo** | `karo_9` | `karo_10` | `karo_b` | `karo_d` | `karo_k` | `karo_a` |

Alle mit Endung `.png`. (`b` = Bube, `d` = Dame, `k` = König, `a` = Ass.)

> **Nur diese sechs Werte.** Doppelkopf spielt mit Neun bis Ass — Zwei bis
> Acht gibt es nicht und werden **nicht** gebraucht. Beim Scharfen Doppelkopf
> fällt zusätzlich die Neun weg; die Datei wird trotzdem gebraucht, weil das
> Blatt beide Regelvarianten bedient.

---

## Die zehn Blätter — Handschrift je Blatt

Die Rückseite ist schon da und gibt den Ton vor. **Die Vorderseiten müssen
sichtbar zur eigenen Rückseite gehören** — gleiche Farbwelt, gleiche
Strichstärke, gleiche Machart.

| Ordner | Grundfarbe (wie die Rückseite) | Handschrift der Vorderseiten |
| --- | --- | --- |
| `eiche` | Eichenbraun & Messing | Warm, holzig. Klassische Figuren, kräftige Farbzeichen. |
| `winterhof` | Eisblau & Silber | Kühl und klar, silbrige Ränder, Figuren mit Fellkragen. |
| `sommerwiese` | Wiesengrün & Hellgelb | Hell und freundlich, viel Weißraum, sonnige Figuren. |
| `kupferstich` | Sepia & Kupfer | Wie ein alter Kupferstich: feine Linien, wenig Farbe. Rot bleibt trotzdem klar rot. |
| `schiefer` | Schiefergrau & Kreideweiß | Modern-reduziert: klare Flächen, dünne Kreidelinien. |
| `nachthimmel` | Tiefblau & Gold | Dunkler Grund, goldene Figuren, wie Emaille. **Rot heller ansetzen.** |
| `rubin` | Weinrot & Gold | Edel und samtig, Figuren in Hofkleidung. |
| `smaragd` | Smaragdgrün & Gold | Gegenstück zu `rubin`, gleiche Machart. |
| `koeniglich` | Purpur & Gold | Prunkvoll, Figuren groß, viel Gold. |
| `pinguin` | Brauweg-Blau & Gold | Verspielt: Bube, Dame, König als **Pinguine im Kostüm** (Zepter, Schleier, Krone). |

### Zu `pinguin`

Das ist unser Maskottchen-Blatt und darf am weitesten gehen. Aber: **Die
Zahlenkarten bleiben nüchtern lesbar** — großer Wert, großes Farbzeichen,
kein Pinguin darin. Nur Bube, Dame und König werden zu Figuren.

### Zu den Bildkarten allgemein

Bube, Dame und König brauchen **nicht** die klassische Doppelfigur (oben und
unten gespiegelt). Eine ganze Figur genügt und sieht auf dem Handy besser
aus. Wichtig ist nur, dass die **Eckenanzeige** oben links und unten rechts
steht.

---

## Ablage

Je Blatt in den Ordner, in dem die Rückseite schon liegt:

```
packages/client/public/karten/eiche/kreuz_9.png
packages/client/public/karten/eiche/kreuz_10.png
…
packages/client/public/karten/eiche/karo_a.png
```

Also **neben** die vorhandene `ruecken.png`, nicht in einen Unterordner.

Die Ordner gibt es schon alle: `eiche`, `winterhof`, `sommerwiese`,
`nachthimmel`, `rubin`, `smaragd`, `kupferstich`, `pinguin`, `koeniglich`,
`schiefer`.

---

## Prüfung vor der Übergabe — je Blatt

1. **Alle 24 Dateien da**, exakt so benannt wie in der Tabelle.
2. **Alle genau 744 × 1080**, keine Ausreißer.
3. **Kreuz und Herz nebeneinander, aus zwei Metern**: auf einen Blick
   unterscheidbar?
4. **Eine Karte auf 25 % verkleinert**: Wert und Farbzeichen in der Ecke noch
   lesbar?
5. **Auf rotem Grund**: echtes Alpha, kein Schachbrett, kein heller Saum an
   der Rundung.
6. **Neben die eigene `ruecken.png` gelegt**: erkennbar dasselbe Blatt?

---

## Was danach passiert

Sobald ein Blatt vollständig ist, trage ich es ein — eine Zeile in
`packages/client/src/decks.ts`, eine in `packages/server/src/decks.ts`, eine
im Warenkatalog (`packages/server/src/tischware.ts`). Dann steht es im Shop
als Blatt zur Wahl, zusätzlich zu seiner Rückseite, die es schon gibt.

**Bitte in voller Auflösung liefern** — nicht vorher herunterrechnen. Was
einmal weich ist, wird nicht wieder scharf.
