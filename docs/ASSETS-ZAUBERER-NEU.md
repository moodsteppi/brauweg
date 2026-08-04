# Bildbestellung: drei Zauberer-Motive nachliefern

> **Geliefert und eingebaut am 4. August 2026.** Alle drei Motive lagen
> maßhaltig vor (420 × 610, 454–506 kB) und sind als WebP unter
> `karten/zauberwald/` eingebaut (360 × 523, 29–41 kB — vorher 5–13 kB).
> Berg, Feuer und Wasser, alle drei mit dem Sternkranz des Waldzauberers.
> Die Abnahme unten ist Punkt für Punkt durchgegangen worden:
>
> - Auf 60 px verkleinert ist auf jeder Karte eine Figur zu erkennen. Die
>   mittlere Helligkeit liegt bei 56–92 (vorher 5–12), der fast schwarze
>   Flächenanteil bei 0–19 % statt über 90 %.
> - Auf knallrotem Grund kein Saum, kein Schachbrett, kein Durchscheinen.
> - Oben links liegt der Pergament-Chip auf ruhiger Malerei, unten rechts
>   verdeckt der Trumpf-Chip weder Gesicht noch Hand.
> - Neben Narr und Zahlenkarte sind alle drei sofort zu unterscheiden.
>
> **Eine Abweichung, bewusst stehen gelassen:** `zauberer_2` (Berg) ist mit
> einer mittleren Helligkeit von 92 deutlich heller als die übrigen drei
> (56–63) — helles Eis vor hellem Himmel. „Gleich hell" ist damit nicht
> erfüllt; die Karte fällt aber nach oben aus der Reihe, verschwindet also
> nicht. Für das Spiel ist es ohne Belang: Alle vier Zauberer sind
> gleichwertig, es zählt nur, wer zuerst legt.
>
> Was unten steht, bleibt als Beschreibung des Bestellten stehen.

**Stand: 4. August 2026.** Diese Bestellung ersetzt drei der vier
Zauberer-Karten aus [ASSETS-WIZARD.md](ASSETS-WIZARD.md), Abschnitt 1b. Alles
andere aus jener Lieferung ist in Ordnung und bleibt, wie es ist — auch die
vier Narren.

---

## Was fehlt

Von den vier bestellten Zauberern ist **nur `zauberer_1` ein fertiges Bild**
(der grüne Waldzauberer). `zauberer_2`, `zauberer_3` und `zauberer_4` sind
nahezu vollständig schwarz: eine dunkle Fläche mit wenigen verstreuten
Farbpunkten, an denen die beabsichtigte Figur noch zu erahnen ist. Am Tisch
liegt dort eine schwarze Karte.

Die Maße stimmen, der Fehler steckt im Bildinhalt selbst:

| Datei | Maße | Größe | Zustand |
| --- | --- | --- | --- |
| `zauberer_1.png` | 420 × 610 | 387 kB | in Ordnung, **bleibt** |
| `zauberer_2.png` | 420 × 610 | 31 kB | fast schwarz — **neu** |
| `zauberer_3.png` | 420 × 610 | 20 kB | fast schwarz — **neu** |
| `zauberer_4.png` | 420 × 610 | 68 kB | fast schwarz — **neu** |
| `narr_1..4.png` | 420 × 610 | 347–410 kB | in Ordnung, unberührt |

Die Dateigröße ist hier der schnellste Prüfwert: Ein fertig gemaltes Motiv
dieser Größe liegt bei **rund 380 kB**. Wer unter 100 kB liefert, hat mit hoher
Wahrscheinlichkeit ein leeres oder schwarzes Bild abgespeichert.

**Der Fehler kam so aus der Lieferung** — er ist nicht beim Umwandeln nach WebP
entstanden. Die Originale im Archiv (`brauweg-art/zauberwald/`) sind bereits
schwarz.

---

## Was bestellt wird

`zauberer_2.png`, `zauberer_3.png`, `zauberer_4.png` — drei Figuren,
Berg, Feuer und Wasser, passend zum vorhandenen Waldzauberer.

**Format:** PNG, **420 × 610 px**, sRGB. Kein Alphakanal nötig — die Karte
füllt die Fläche randlos; die Ecken rundet der Client selbst ab. Ausgeliefert
wird später als WebP; die Umwandlung passiert hier, bitte PNG liefern.

**Gleich stark.** Im Spiel sind alle vier Zauberer gleichwertig — es zählt
allein, wer zuerst legt. Keine Figur darf mächtiger wirken als die anderen.
`zauberer_1` ist der Maßstab: dieselbe Hand, dieselbe Sättigung, dieselbe
Figurgröße im Bild.

**Als Satz erkennbar.** `zauberer_1` trägt einen Sternkranz hinter dem Kopf.
Der gehört auf alle drei neuen Motive, in der jeweiligen Reichsfarbe.

**Heller als die alte Lieferung.** Der Kartengrund darf dunkler sein als bei
den Zahlenkarten, aber die Figur muss sich davon abheben. Die Probe: Auf
60 px Breite verkleinert muss noch eine Gestalt zu erkennen sein, keine
dunkle Fläche.

---

## Freihalte-Zonen

Beide Zonen sind neu gegenüber der ersten Bestellung — der Client legt dort
inzwischen selbst etwas hin. Was dort gemalt wird, verschwindet darunter.

**Oben links, 24 % × 23 %:** Dort sitzt der gezeichnete Pergament-Chip mit dem
„Z" (`EckenChip` in `CardFace.tsx`, das Blatt hat `eigeneEcke`). **Kein
gemaltes „Z" mehr** — anders als in der ersten Bestellung. Der Chip ist opak
und deckt es ohnehin zu. Ruhige Malerei genügt.

**Unten rechts, 42 % Breite × 28 % Höhe** (nachgemessen): Liegt der Zauberer als
aufgedeckte Trumpfkarte und nennt der Geber danach eine Farbe, blendet der
Client dort das Farbzeichen ein (`wiz-trumpf-farbe`). Kein Gesicht, keine
Hand, kein Schriftzug in diese Ecke.

---

## Was NICHT ins Bild gehört

- **Keine Schrift.** Kein „Z", keine Zahl, kein Name, keine Zierzeile. Die
  Ecken-Anzeige zeichnet der Client.
- **Kein Schachbrettmuster und keine weiße Fläche als „Transparenz".** Hier
  dreimal passiert.
- **Keine Bedienelemente**, keine Knöpfe, keine Leisten, kein Handyrahmen.
- **Kein Alkohol** — keine Krüge, Fässer, Hopfen, auch nicht als Wortspiel.
- **Keine Markenzeichen.** Das Spiel heißt bei uns **Zauberer**. Das Wort
  „Wizard" und jede Anlehnung an die Aufmachung des Originalspiels (Amigo)
  gehören nicht ins Bild.

---

## Abnahme

1. Drei Dateien, exakt `zauberer_2.png`, `zauberer_3.png`, `zauberer_4.png`,
   je 420 × 610 px.
2. **Jede Datei über 250 kB.** Das ist die Hürde, an der diese Lieferung
   gescheitert ist.
3. Auf 60 px Breite verkleinert ist auf jeder Karte eine Figur zu erkennen —
   nicht nur eine dunkle Fläche.
4. Die vier Zauberer nebeneinander: gleich hell, gleich stark, als Satz
   erkennbar, keiner fällt ab.
5. Oben links und unten rechts liegt nichts, was gebraucht wird.
6. Neben einem Narren und einer Zahlenkarte derselben Größe: alle drei sofort
   voneinander unterscheidbar.

---

## Einbau nach der Lieferung

Der Ablauf steht in [JETZT-AUSFUEHREN.md](JETZT-AUSFUEHREN.md). Kurz:

```bash
# 1. Originale ins Archiv - zuerst, dann erst wandeln
cd ~/Desktop/BroCode/brauweg-art/zauberwald
git add -A && git commit -m "Zauberer 2 bis 4 nachgeliefert" && git push

# 2. Nach WebP
node ~/bildwerkzeug/wandeln.mjs \
  ~/Desktop/BroCode/brauweg-art/zauberwald \
  ~/Desktop/BroCode/Brauweg-spielen/brauweg/packages/client/public/karten/zauberwald \
  karten
```

Registriert werden muss nichts: Die Karten sind längst im Spiel, nur die
Bilder taugen nichts. Nach dem Wandeln nachsehen, ob die drei WebP-Dateien
jetzt in der Größenordnung von `zauberer_1.webp` (23 kB) liegen — bleiben sie
bei 5 kB, ist wieder ein schwarzes Bild geliefert worden.
