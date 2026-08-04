# Bildbestellung: Pinguin und Ausstattung

Der Pinguin ist anpassbar geworden: fünf Plätze, siebenundzwanzig Stücke,
Kleiderschunter unter Profil, Shop-Regal, Mini-Pinguin in der Kopfzeile. **Alles
davon funktioniert schon** — es läuft auf gezeichneten SVGs im Bundle
(`packages/client/src/pinguin.tsx`). Diese Bestellung tauscht sie gegen gemalte
Bilder.

**Nichts davon blockiert etwas.** Bis zur Lieferung bleiben die Zeichnungen. Sie
sind schlicht, aber sie sitzen maßhaltig und sind vollständig.

Die Gestaltungsregeln stehen in [DESIGN.md](DESIGN.md).

---

## Das Wichtigste zuerst: ein Rahmen für alles

**Jedes Bild dieser Bestellung liegt auf demselben Rahmen: 480 × 512 px.**
Der Pinguin und jedes Ausstattungsstück füllen diesen Rahmen vollständig; das
Stück selbst steht an seiner Stelle darin, alles andere ist transparent.

Warum so und nicht freigestellt-auf-eigener-Fläche: Die App stapelt die Ebenen
schlicht übereinander — kein Ausrichten, kein Skalieren, keine Ankerpunkte je
Stück. Ein Hut, der auf eigener Leinwand geliefert wird, müsste von Hand
positioniert werden, und zwar siebenundzwanzig Mal.

**Die Passvorlage liegt bei:** `packages/client/art/pinguin/pinguin-zonen.png`
(dazu die Quelle `pinguin-zonen.svg`). Sie zeigt den Pinguin in genau der Lage,
die er im Spiel hat, und die fünf Zonen als gestrichelte Kästen. **Diese Vorlage
gehört als Referenzbild in jede Bildgenerierung** — sie ist der Unterschied
zwischen „ein Hut" und „ein Hut, der sitzt".

Die Kästen und ihre Beschriftung dürfen in den gelieferten Bildern **nicht**
erscheinen.

### Die fünf Zonen

Koordinaten im Rahmen 240 × 256 (also **× 2** für die Lieferung auf 480 × 512):

| Platz | Zone (x, y – x, y) | Was dort sitzt |
| --- | --- | --- |
| `hut` | 58, 8 – 182, 74 | Kopfbedeckung, sitzt auf der Kalotte |
| `oberteil` | 52, 104 – 188, 214 | Rumpf, über der weißen Bauchfläche |
| `schuhe` | 72, 212 – 168, 254 | beide Füße |
| `hand` | 166, 112 – 238, 214 | rechte Flosse (aus Sicht des Betrachters rechts) |
| `aura` | ganzer Rahmen | ringsum, **hinter** dem Pinguin |

Ein Stück darf seine Zone leicht überschreiten, wenn das Motiv es verlangt (ein
breiter Hutrand, ein langer Wanderstab). Es darf aber **nie in eine andere Zone
hineinragen**, sonst überdecken sich zwei Stücke, die zusammen getragen werden.

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal**, **480 × 512** px, sRGB.
- Originale nach `packages/client/art/pinguin/`. Die Auslieferungsfassung als
  WebP erzeuge ich daraus — **Originale gehören nicht nach `public/`**. So sind
  schon einmal 13,9 MB mitgeliefert und ausgeliefert worden.

**Echte Transparenz — der häufigste Fehler**
Kein Schachbrett-Muster und keine weiße oder schwarze Fläche als
„Transparenz". Hier wiegt es schwerer als sonst: Diese Bilder liegen
**übereinander**. Eine weiße Matte am Hut löscht den halben Pinguin.
Probe: alle Ebenen eines Outfits übereinanderlegen — sichtbar ist der Pinguin
mit Hut, nicht ein Pinguin hinter einer Scheibe.

**Was NICHT ins Bild gehört**
- **Kein Pinguin** — außer in Nummer 1. Ein Hut wird als Hut geliefert, nicht
  als Pinguin mit Hut. Sonst liegen am Ende fünf Pinguine übereinander.
- **Keine Zonenkästen, keine Beschriftung, keine Maßangaben** aus der
  Passvorlage.
- **Keine Schrift**, keine Zahlen.
- Keine Bedienelemente, kein Rahmen, kein Schlagschatten nach außen (den setzt
  die App über CSS, für alle Ebenen gemeinsam).
- **Kein Alkohol** — keine Krüge, Fässer, Hopfen, auch nicht als Wortspiel.
  Das betrifft besonders den Platz `hand`: Der Becher dort ist **Kakao**.

**Ton und Stil**
Wie die vorhandenen Hub-Bilder (`weltkarte.webp`, `bg-shop.webp`,
`pinguin.png`): gemalt, warm, satt, freundlich — Handyspiel, kein
Fotorealismus, kein Comic-Umriss.

**Lesbar bei 40 Pixeln.** Der Mini-Pinguin in der Kopfzeile ist 2,6 rem hoch,
die Shop-Kacheln 2,8 rem. Ein Stück, das erst in Großansicht erkennbar wird,
ist an der Stelle wirkungslos, an der es am häufigsten zu sehen ist. Große
Form, klare Silhouette, wenige Farben.

---

## 1 — Der Basis-Pinguin

`pinguin-basis.png`

**Wozu:** Die Grundgestalt, auf die alles andere gelegt wird.

**Warum überhaupt:** `pinguin.png` liegt schon im Ordner, ist aber ein **Ritter
mit Helm, Schwert, Brustpanzer und Umhang** — damit vier der fünf Plätze belegt.
Ein Hut auf einem Helm sieht aus wie ein Fehler. Der Ritter bleibt, wo er heute
steht (Trophäenweg, Vorgabe fürs Profilbild); der Kleiderschrank braucht einen
nackten Pinguin.

**Motiv:** Aufrecht stehender Pinguin, freundlich, frontal, symmetrisch, **ohne
jede Kleidung und ohne Gegenstände**. Dunkler Rücken, helle Bauch- und
Gesichtsmaske, orangefarbener Schnabel und orangefarbene Füße. Beide Flossen
hängen seitlich am Körper.

**Lage:** Genau wie in der Passvorlage. Der Kopfmittelpunkt liegt bei
(120, 80), die Kalotte endet oben bei y ≈ 26; der Körper bei (120, 150); die
Füße stehen auf y ≈ 248. Abweichungen von wenigen Pixeln sind in Ordnung,
zwanzig nicht — dann sitzt kein Hut mehr.

**Wichtig für die Ebenen darüber:**
- Der Kopf muss **oben eine ruhige Kalotte** haben, auf der ein Hut aufliegen
  kann — keine Federbüschel, keine Frisur.
- Die **Bauchfläche muss glatt** sein, damit ein Oberteil darauf sitzt.
- Die **rechte Flosse** (Betrachter rechts) hält später Dinge. Sie zeigt leicht
  nach vorn, mit einer greifbaren Spitze bei etwa (188, 180).

**Abnahme:** Auf 40 px Höhe verkleinert ist es ein Pinguin und kein dunkler
Fleck. Auf knallrotem und auf weißem Grund gleich hell, ohne Saum.

---

## 2 — Kopf (6 Stücke)

**Zone:** 58, 8 – 182, 74. Sitzt auf der Kalotte und darf sie leicht
überlappen, aber **nicht die Augen** (die liegen bei y = 80).

| Datei | Motiv |
| --- | --- |
| `hut-wollmuetze.png` | Gestrickte Mütze mit Umschlag und Bommel oben. Warmes Lila. Das freie Stück — es soll sympathisch sein, nicht billig. |
| `hut-strohhut.png` | Breiter Strohhut mit dunklem Band. Der Rand darf bis x = 44 und x = 196 reichen. |
| `hut-zylinder.png` | Zylinder, dunkel, mit rotem Band. Schlank, nicht albern hoch — obere Kante bei y ≈ 6. |
| `hut-bergsteiger.png` | Kletterhelm mit Stirnlampe. Die Lampe darf leuchten, aber ohne Lichtkegel ins Bild. |
| `hut-krone.png` | Goldkrone mit Zacken und drei Edelsteinen. Legendär — das prächtigste Stück des Platzes. |
| `hut-partyhut.png` | Spitzer Partyhut mit Streifen und Pompon. **Nicht kaufbar**, nur zum Geburtstag. |

---

## 3 — Oberteil (5 Stücke)

**Zone:** 52, 104 – 188, 214. Deckt die weiße Bauchfläche, lässt Kopf und Füße
frei. Der Halsausschnitt liegt bei y ≈ 112.

| Datei | Motiv |
| --- | --- |
| `oberteil-pulli.png` | Grober Strickpulli, Grün, mit sichtbaren Strickreihen und Bündchen unten. Das freie Stück. |
| `oberteil-trikot.png` | Vereinstrikot, weiß mit zwei roten Längsstreifen. **Ohne Nummer und ohne Schrift** — die wäre nach einer Woche falsch. |
| `oberteil-weste.png` | Offene Lederweste, braun, mit zwei Messingknöpfen. Die Bauchmitte bleibt sichtbar. |
| `oberteil-regenjacke.png` | Gelbe Regenjacke mit Reißverschluss und zwei Taschen. |
| `oberteil-frack.png` | Frack mit weißem Hemd und Fliege. Legendär — sauber gearbeitet, nicht als Kostüm. |

---

## 4 — Schuhe (5 Stücke)

**Zone:** 72, 212 – 168, 254. **Immer beide Füße**, Mittelpunkte bei x = 97 und
x = 143. Die Füße stehen auf y ≈ 248; ein Schuh darf bis y = 254 reichen, tiefer
nicht — dort endet der Rahmen.

| Datei | Motiv |
| --- | --- |
| `schuhe-flossen.png` | **Fast leer:** nur ein zartes Glanzlicht auf den nackten Füßen. Das ist das „nichts an" des Platzes und muss sichtbar eine Wahl sein, nicht ein fehlendes Bild. |
| `schuhe-gummistiefel.png` | Rote Gummistiefel mit dickerer Sohle. |
| `schuhe-turnschuhe.png` | Weiße Turnschuhe mit blauem Streifen und Schnürung. |
| `schuhe-schlittschuhe.png` | Weiße Schlittschuhe mit silbernen Kufen unter der Sohle. |
| `schuhe-goldstiefel.png` | Goldene Stiefel mit Stulpe. Legendär. |

---

## 5 — Flosse (5 Stücke)

**Zone:** 166, 112 – 238, 214. Der Gegenstand wird von der **rechten Flosse**
gehalten (Betrachter rechts), Griffpunkt bei etwa (188, 180). Er darf über die
Zone nach oben hinausragen, aber nicht über x = 238 (Rahmenrand) und nicht nach
links in die Bauchzone.

| Datei | Motiv |
| --- | --- |
| `hand-kakao.png` | Becher heißer Kakao mit Henkel, zwei zarte Dampffäden. **Kakao, kein Bier** — siehe DESIGN.md. |
| `hand-kartenfaecher.png` | Fächer aus drei Spielkarten, Rückseiten teils sichtbar, ein Kreuz- und ein Herzzeichen erkennbar. Keine vollständigen Kartenwerte. |
| `hand-wanderstab.png` | Hölzerner Wanderstab mit Knauf, leicht schräg. |
| `hand-laterne.png` | Sturmlaterne mit Bügel, innen warmes Licht. Kein Lichtkegel ins Bild. |
| `hand-zauberstab.png` | Zauberstab mit Stern an der Spitze und zwei Funken. Legendär. **Keine Anlehnung an bekannte Marken.** |

---

## 6 — Aura (6 Stücke)

**Zone:** der ganze Rahmen — aber **nur der Rand**. Die Aura liegt *hinter* dem
Pinguin; was hinter seinem Körper läge, ist unsichtbar und verschwendet.

**Freihaltezone:** Die Ellipse um (120, 150) mit Radien 72 × 88 bleibt leer.
Alles Motiv liegt außerhalb davon, also in den vier Ecken und an den Rändern.

| Datei | Motiv |
| --- | --- |
| `aura-glitzer.png` | Sechs bis acht kleine goldene Lichtpunkte, unregelmäßig verteilt. Das freie Stück — sparsam. |
| `aura-blaetter.png` | Wirbelnde Blätter in zwei Grüntönen. |
| `aura-schneeflocken.png` | Sechs Schneeflocken, hell und fein. |
| `aura-funken.png` | Aufsteigende Glutfunken, orange und gelb, unten dichter als oben. |
| `aura-sterne.png` | Kranz aus goldenen Sternen in zwei Größen. Legendär. |
| `aura-konfetti.png` | Buntes Konfetti in fünf Farben. **Nicht kaufbar**, nur zum Geburtstag. |

**Abnahme der Aura:** Mit dem Basis-Pinguin darübergelegt darf keine Form
angeschnitten wirken. Ein halber Stern, der genau an der Silhouette endet, sieht
nach Fehler aus.

---

## Abnahme, gesamt

1. **Alle 28 Dateien vorhanden**, exakt so benannt, alle 480 × 512.
2. **Stapelprobe:** Basis + `hut-zylinder` + `oberteil-frack` +
   `schuhe-goldstiefel` + `hand-zauberstab` + `aura-sterne` übereinandergelegt
   ergibt einen vollständig gekleideten Pinguin — nichts überdeckt Augen oder
   Schnabel, nichts schwebt, nichts schneidet ins Nachbarstück.
3. **Kleinprobe:** dasselbe auf 40 px Höhe. Jedes Stück ist noch als solches zu
   erkennen.
4. **Alphaprobe:** jede Datei auf knallrotem und auf weißem Grund, gleich hell,
   ohne Saum.
5. Kein Bild enthält Schrift, Zonenkästen oder einen zweiten Pinguin.

---

## Danach

Der Einbau ist eine Zeile je Stück: In `packages/client/src/pinguin.tsx` steht
jedes Stück als `{ zeichnung: … }` im Katalog `AUSSEHEN`. Kommt ein `bild`
dazu, wird es statt der Zeichnung gelegt:

```ts
'hut-zylinder': { zeichnung: (…), bild: '/hub/pinguin/hut-zylinder.webp' },
```

Der Weg für die Lieferung selbst:

1. **Umwandeln:** auf dreifache Anzeigegröße verkleinern, dann WebP Qualität 85.
   Die Ausstattung wird höchstens 11 rem hoch gezeigt (Kleiderschrank), also
   reichen 528 px — die 480 der Lieferung passen damit unverändert.
2. **Ablegen** unter `packages/client/public/hub/pinguin/`, Originale nach
   `packages/client/art/pinguin/`.
3. **`bild` eintragen**, Stück für Stück. Die Zeichnung darf dabei stehen
   bleiben: Sie ist der Rückfall, wenn ein Bild fehlt.

**Der Katalog selbst wird nicht angefasst.** Welche Stücke es gibt, was sie
kosten und zu welchem Platz sie gehören, steht am Server
(`packages/server/src/kosmetik.ts`) — dort ändert die Lieferung nichts.

**Keine Platzhalter unter diesen Namen.** Solange ein `bild` fehlt, zeichnet die
App; ein leeres PNG unter dem künftigen Namen wäre ein weißer Kasten, und die
sind hier schon zweimal live gegangen.
