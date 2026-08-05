# Bildbestellung: Knöpfe, Tafeln und Symbole fürs Profil

## Warum diese Bestellung

Der Profil-Tab sieht aus wie eine Systemapp und nicht wie unsere Welt. Der
Grund ist **nicht** die Farbwahl, sondern dass es dort überhaupt kein Material
gibt: Jeder Abschnitt ist eine Farbfläche mit goldenem Strich und einem
Schatten nach unten, per CSS gezeichnet. Runde Ecken plus Verlauf plus dünner
Rand ist genau der Look, den iOS von Haus aus macht.

Dass es anders geht, zeigt das eigene Haus: `menue-blatt.webp` ist gemaltes,
gebeiztes Holz mit Messingnieten in den Ecken, `menue-feld.webp` eine
eingelassene Rille in einem Holzrahmen. Beide sind richtig gut.

**Die Knöpfe sind der Ausreißer.** `menue-knopf-holz.webp` heißt Holz, ist
aber eine flache blassoliv Pille mit dünnem beigem Strich — kein Holz, keine
Maserung, keine Tiefe. `menue-knopf-gruen.webp` dasselbe in Giftgrün.
Die alte Bestellung (`ASSETS-MENUE.md`) hatte „gemaltes Holz, warme Töne,
satte Farben, weiche Kanten" verlangt; was kam, war etwas anderes, und es ist
so eingebaut worden.

Diese Bestellung ersetzt die drei Knöpfe **und** ergänzt, was im Profil sonst
noch aus CSS gemalt ist.

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal**, sRGB.
- Geliefert wird in voller Auflösung nach `packages/client/art/`. Die
  Auslieferungsfassung unter `public/` erzeuge ich daraus als WebP —
  **die Originale gehören nicht nach `public/`.** Genau so sind schon einmal
  13,9 MB PNG ausgeliefert worden.

**Echte Transparenz — der häufigste Fehler**
Kein Schachbrettmuster und keine weiße Fläche als „Transparenz". Zur Probe:
auf knallroten Grund legen. Sichtbar wird nur, was sichtbar sein soll, ohne
hellen Saum. Das ist uns dreimal passiert.

**Was NICHT ins Bild gehört**
- **Keine Schrift.** Keine Beschriftung, keine Zahlen, keine Buchstaben.
  Jeder Knopf trägt wechselnden Text.
- **Keine Symbole in der Mitte** der Knöpfe. Haken, Kreuze und Pfeile setzt
  die App darüber.
- **Kein Schlagschatten nach außen** — den setzt die App, sonst stimmt der
  Abstand nicht.
- **Kein Alkohol**: keine Krüge, Fässer, kein Hopfen. Auch nicht angedeutet.
- **Keine Bedienelemente**, kein Handyrahmen, keine Tab-Leiste.

**Ton und Stil**
Wie `menue-blatt.webp` und `bg-profil.webp`: gemaltes, gebeiztes Holz, warmes
Messing, satte Farben, weiche Kanten, sichtbare Pinselarbeit. Handyspiel im
Stil von Clash Royale — **nicht** Fotorealismus, **nicht** Flat Design,
**nicht** Comic mit schwarzem Umriss.

> **Der Prüfsatz für jeden dieser Knöpfe:** Man muss ihn für ein Stück Holz
> oder Metall halten können, das jemand angemalt hat. Sieht er aus, als hätte
> ihn ein Programm mit einem Farbverlauf gefüllt, ist er falsch — genau das
> ist bei den drei vorhandenen Knöpfen passiert.

---

## Das Wichtigste: dehnbare Ränder

Alle Knöpfe, Tafeln und Felder werden als CSS-`border-image` benutzt: Das Bild
wird in neun Felder zerschnitten, die vier Ecken bleiben, die vier Kanten
werden gezogen, die Mitte wird auf die volle Fläche gestreckt. So trägt **ein**
Bild einen schmalen Knopf mit „Ja" genauso wie einen breiten mit
„Benachrichtigungen".

Drei Bedingungen, und an ihnen scheitert es sonst:

1. **Die Ecken müssen vollständig innerhalb des angegebenen Randmaßes
   liegen.** Ragt eine Schnitzerei weiter nach innen, wird sie mitgestreckt.
2. **Die Kanten müssen in Längsrichtung gleichförmig sein.** Maserung quer
   über die Kante ist gut, ein einzelner Nagel in der Mitte der oberen Kante
   nicht — beim Strecken wird er zum Strich.
3. **Die Mitte muss ruhig sein.** Gleichmäßige Fläche, leichte Textur erlaubt,
   aber kein Motiv, keine Lichtinsel, kein Verlauf von oben nach unten.

Faustregel zum Prüfen: das Bild einmal auf doppelte Breite und halbe Höhe
ziehen. Sieht die Mitte noch richtig aus und sind die Ecken unverzerrt,
stimmt es.

---

# Teil 1 — Die Knöpfe (dringend)

Drei Bilder, je **512 × 160**, Randmaß **40 px**. Sie ersetzen
`menue-knopf-holz`, `menue-knopf-gruen`, `menue-knopf-rot` unter demselben
Namen — Maße und Randmaß bleiben also gleich, damit kein CSS angefasst werden
muss.

Gemeinsam für alle drei:

- Aufsicht leicht von oben, wie ein Knopf, der aus dem Blatt herausragt.
- **Sichtbare Höhe:** oben eine hellere Kante (Licht von oben links), unten
  eine dunklere Standfläche von etwa 8–10 px. Genau diese Standfläche fehlt
  den jetzigen Knöpfen komplett, und deshalb wirken sie wie Aufkleber.
- Ein schmaler Messingrahmen umlaufend, 6–8 px, mit einem Hauch Patina in den
  Ecken. Nicht knallgold, nicht glatt poliert.
- Die Mitte ruhig genug zum Strecken, aber mit erkennbarer Materialtextur:
  feine Maserung längs, ein leichter Farbtonwechsel — kein glatter Verlauf.
- Ecken abgerundet mit etwa 24 px Radius, aber die Rundung muss **innerhalb**
  des 40-px-Randmaßes bleiben.

### 1 — `menue-knopf-holz.png` — der normale Knopf

Der Arbeitsknopf. „Kleiderschrank", „Fertig", „Später", „Einstellungen".

Gebeiztes **Nussbaum**, mittelbraun bis warm-rötlich, so wie der Rahmen von
`menue-blatt.webp`. Deutlich dunkler als heute — der Text darauf ist hell
(`#f4e9d4`) und braucht Grund, gegen den er steht. Die jetzige blassolive
Fläche verschluckt ihn fast.

### 2 — `menue-knopf-gruen.png` — die Hauptaktion

**Grün = tun** (DESIGN.md). „Aufgaben", „Belohnung holen", „Losspielen".

Ein tiefes, sattes Waldgrün wie lackiertes Metall über Holz, nicht das
Giftgrün von heute. Der Messingrahmen darf hier etwas breiter und heller sein
— dieser Knopf soll aus einer Reihe herausstechen, ohne zu schreien.

### 3 — `menue-knopf-rot.png` — Vorsicht

**Rot = Vorsicht.** „Abmelden", „Endgültig löschen", „Tisch verlassen".

Dunkles, gedecktes Weinrot, gealtert wirkend. **Kein Signalrot.** Der Knopf
soll ernst aussehen, nicht alarmierend — er wird auch für harmloses Abmelden
benutzt.

### 4 — `menue-knopf-holz-gedrueckt.png` — neu

Dasselbe wie Nummer 1, aber **eingedrückt**: Die untere Standfläche
verschwindet, das Licht kommt flacher, die Mitte ist einen Hauch dunkler. Wird
beim Antippen eingeblendet.

Heute macht die App das mit `transform: translateY(1px) scale(0.985)` — ein
Knopf, der beim Drücken schrumpft statt einzusinken. Mit diesem Bild wird
daraus ein echtes Eindrücken.

---

# Teil 2 — Tafeln und Felder

### 5 — `menue-tafel.png` — der Abschnittsrahmen

**768 × 512**, Randmaß **64 px**.

Der Rahmen um jeden Abschnitt im Hub: „Deine Sachen", „Trophäen", „Freunde",
„Konto" — im Shop schon jede Warengruppe. Heute ist das ein brauner
CSS-Verlauf mit goldenem Strich.

Flacher und breiter als `menue-blatt.webp`, weil er **im** Bildschirm liegt
und nicht darüber: schmalerer Rahmen, ruhigere Mitte, weniger Kontrast. Er
soll den Inhalt fassen, nicht ihn überstrahlen.

Die Mitte muss **halbdurchsichtig** sein (etwa 85 % deckend), damit die
gemalte Szene dahinter noch durchscheint. Das ist der Unterschied zwischen
„Tafel liegt in der Halle" und „Tafel klebt auf dem Bildschirm".

### 6 — `menue-tafel-kopf.png` — die Kopfleiste

**768 × 96**, Randmaß **32 px** links/rechts, oben **24 px**, unten **0**.

Sitzt oben auf der Tafel und trägt die Überschrift in Versalien. Ein
geschnitztes Querbrett, etwas heller als die Tafel darunter, mit einer
Messingschiene an der Unterkante. **Oben abgerundet, unten gerade** — es
schließt bündig an die Tafel an.

### 7 — `menue-balken-trog.png` und 8 — `menue-balken-fuellung.png`

Je **512 × 64**, Randmaß **24 px**.

Der Erfahrungsbalken („Stufe 2 · 50/60 XP"). Heute ein CSS-Verlauf von Blau
nach Gold in einer grauen Rille — der offensichtlichste Systemlook auf dem
ganzen Bildschirm.

- **Trog:** eine in Holz eingelassene Rinne, innen dunkel, mit Schattenkante
  oben. Wie `menue-feld.webp`, nur schmaler.
- **Füllung:** warmes, leuchtendes Gold-Bernstein mit leichtem Glanzstreifen
  längs. Sie wird von links auf 0–100 % Breite beschnitten, **darf also kein
  Motiv und keinen Verlauf von links nach rechts haben** — sonst sieht ein
  halb voller Balken kaputt aus.

### 9 — `menue-schild.png` — das Namensschild

**512 × 192**, Randmaß **48 px**.

Trägt Profilbild, Namen und Stufenzahl. Heute ein grüner Verlauf mit goldenem
Rand.

Ein Messingschild auf Holz, mit vier sichtbaren Schrauben in den Ecken und
einer leicht angelaufenen Fläche. Links muss Platz für ein rundes Bild von
etwa 3 rem bleiben — die **linken 140 px sollen ruhig und ungemustert sein**,
dort liegt der Pinguin darüber.

---

# Teil 3 — Symbole

Je **256 × 256**, freigestellt, PNG mit Alpha. Sie kommen auf die
Profilkacheln und in die Konto-Knöpfe.

**Stil:** gemalte kleine Gegenstände in derselben Handschrift wie
`icon-truhe.webp` und `icon-krieg.webp` — plastisch, warm, mit Licht von oben
links. **Keine Strichzeichnungen, keine Piktogramme, keine Emojis.** Jedes
Symbol soll ein Ding sein, das man anfassen könnte.

Jedes muss bei **32 px** noch erkennbar sein. Das ist die eigentliche
Schwierigkeit: eine Silhouette, drei Farbwerte, kein Kleinkram.

| Datei | Was | Hinweis |
|---|---|---|
| `icon-kleiderschrank.png` | Ein geöffneter Holzschrank mit einem Hut und einem Schal darin | Vertritt Kleidung, nicht Möbel — der Inhalt muss die Silhouette prägen |
| `icon-klanghalle.png` | Ein Grammofon oder eine Laute an einer Holzwand | **Die Klanghalle ist neu und hat noch gar kein Symbol** — sie leiht sich gerade das Zahnrad |
| `icon-aufgaben.png` | Eine Schriftrolle mit drei Haken | Nicht mit `icon-truhe` verwechselbar |
| `icon-benachrichtigung.png` | Eine Messingglocke | Klein und eindeutig |
| `icon-abmelden.png` | Eine Tür mit Klinke, halb offen | Kein Pfeil — Pfeile sehen nach Systemsymbol aus |
| `icon-freunde.png` | Zwei Pinguine nebeneinander | Passend zum Maskottchen, nicht zwei abstrakte Köpfe |
| `icon-trophaeen.png` | Ein Pokal auf einem Sockel | `pokal.png` gibt es, ist aber für 40 px zu fein — hier eine vereinfachte Fassung |

---

## Wohin die Dateien gehören

**Alles nach `packages/client/art/`** — in voller Auflösung, als PNG mit
echtem Alpha. Sonst nirgendwohin.

```
packages/client/art/menue-knopf-holz.png
packages/client/art/menue-knopf-holz-gedrueckt.png
packages/client/art/menue-knopf-gruen.png
packages/client/art/menue-knopf-rot.png
packages/client/art/menue-tafel.png
packages/client/art/menue-tafel-kopf.png
packages/client/art/menue-balken-trog.png
packages/client/art/menue-balken-fuellung.png
packages/client/art/menue-schild.png
packages/client/art/icon-kleiderschrank.png
packages/client/art/icon-klanghalle.png
packages/client/art/icon-aufgaben.png
packages/client/art/icon-benachrichtigung.png
packages/client/art/icon-abmelden.png
packages/client/art/icon-freunde.png
packages/client/art/icon-trophaeen.png
```

**Nicht** nach `public/`, **nicht** ins Archivrepo — beides mache ich. Die
Originale wandern nach `moodsteppi/brauweg-art`, die WebP-Fassungen entstehen
mit `~/bildwerkzeug/wandeln.mjs` und landen unter `public/hub/`.

---

## Abnahme — daran prüfe ich

1. **Auf rotem Grund:** kein heller Saum, kein Schachbrett, keine weiße Fläche.
2. **Gestreckt:** auf doppelte Breite und halbe Höhe ziehen. Ecken unverzerrt,
   Mitte ruhig, Kanten gleichförmig.
3. **Bei 32 px:** jedes Symbol noch erkennbar, ohne dass man raten muss.
4. **Nebeneinander mit `menue-blatt.webp`:** Sieht es nach demselben Haus aus?
   Wenn ein Knopf daneben wie aus einer anderen App wirkt, ist er falsch.
5. **Keine Schrift, keine Zahlen** im Bild. Kein Alkohol.
6. **Der Prüfsatz von oben:** Kann man es für ein bemaltes Stück Holz oder
   Metall halten?

Punkt 4 ist der, an dem es beim letzten Mal gescheitert ist. Bitte wirklich
nebeneinanderlegen.

---

## Reihenfolge, falls nicht alles auf einmal geht

1. **Die vier Knöpfe** (Teil 1). Sie stehen auf jedem Bildschirm der App, nicht
   nur im Profil — der Effekt ist am größten.
2. **Tafel und Kopfleiste** (5 und 6). Danach haben alle Hub-Tabs Material.
3. **Balken und Schild** (7–9).
4. **Die Symbole** (Teil 3). Bis dahin leihen sich die Kacheln vorhandene
   Bilder; das sieht schon jetzt nicht kaputt aus, nur ungenau.
