# Bildbestellung: Shop

Der Shop wird gefüllt. Vier Sorten Ware: **Kartenblätter**, **Tisch-
szenerien**, **Clanwappen** und **Emotes** (Lach-Grafiken und Sprüche). Alles
andere (Preise, Namen, Knöpfe, Vorschauraster) baut die App darüber.

Diese Datei ist eine reine **Bildbestellung** — zum Rüberkopieren in das
Werkzeug, das die Grafiken malt. Wenn die Bilder unter den unten genannten
Namen und Pfaden liegen, baue ich sie ein: Blätter in `decks.ts`,
Szenerien und Wappen in den Shop-Katalog, Emotes in das neue Reaktionsfeld.

---

## Was für ALLE vier Sorten gilt

**Ton und Stil** — verbindlich, sonst passt die Ware nicht zusammen:
- Gemalt, warm, satt, freundlich. **Handyspiel, kein Fotorealismus, kein
  harter Comic-Umriss.** Weiches Licht von oben links.
- Vorbild ist das, was schon da ist: `weltkarte.png`, `bg-clan.png`,
  `clan-wappen.png`, `pinguin.png`, die vorhandenen `szene-*.png`.
- **Kein Alkohol** — keine Krüge, Fässer, Gläser, Hopfen, auch nicht als
  „Brauweg"-Wortspiel.
- **Keine Hakenkreuze, Runen, militärischen Rangabzeichen.**

**Farbwelt** (die App-Tokens, als Orientierung für die Maltöne):
| Ton | Wert | Bedeutung |
| --- | --- | --- |
| Grün | `#4a9c78` | Re, „tun" |
| Gold | `#e2b64f` | wertvoll, Trophäe |
| Rot | `#c2564c` | Kontra, Vorsicht |
| Blau | `#5ea0f0` | Level, Freunde |
| Violett | `#a678f2` | VIP, „bald" |
| Grund | `#12181c` | dunkler Seitengrund |

**Echte Transparenz — der häufigste Fehler.** Freigestellte Teile (Wappen,
Emotes, Karten-Rückseiten mit Rand) brauchen einen **echten Alphakanal**.
Kein Schachbrettmuster, keine weiße Fläche als „Transparenz". Probe: das
Bild auf **knallroten** Grund legen — sichtbar wird nur, was sichtbar sein
soll, ohne hellen Saum.

**Volle Auflösung liefern** — ich verkleinere und wandle selbst in `.webp`
um. Nichts vorher herunterrechnen: Was einmal weich ist, wird nicht wieder
scharf.

**Schrift im Bild:** grundsätzlich **keine** — Namen, Zahlen, Preise setzt
die App. **Einzige Ausnahme:** die Spruch-Emotes in Abschnitt 4b; die
tragen bewusst Text (siehe dort).

---

# 1 — Zehn Kartenblätter

Ein „Blatt" ist das Aussehen der Spielkarten: die **Rückseite** (sieht man
bei den Gegnern und im Shop) und die **Vorderseiten**. Es gilt für
Doppelkopf: vier Farben (Kreuz, Pik, Herz, Karo), sechs Werte
(9, 10, Bube, Dame, König, Ass) — **24 Vorderseiten plus eine Rückseite**
je Blatt.

## Reihenfolge der Lieferung

Zuerst reichen mir **die zehn Rückseiten** — das ist das Vorschaubild im
Shop und das, was am Tisch von den Gegnern zu sehen ist. Damit kann der
Shop schon bestückt werden. Die Vorderseiten sind der zweite Schritt (siehe
„Vorderseiten" unten); bitte pro Blatt trotzdem gleich mitdenken, damit
Rückseite und Vorderseiten aus einer Hand wirken.

## Format — für jede Karte gleich

- **Hochkant, Seitenverhältnis genau 1 : 1,452** (Breite : Höhe) — das ist
  das Kartenformat der App. Liefere mindestens **744 × 1080 px**, gern
  größer bei gleichem Verhältnis. PNG, sRGB.
- **Abgerundete Ecken**, außerhalb der Rundung **echtes Alpha** (die Karte
  liegt auf farbigem Filz, keine weiße Ecke).
- Bei den **Vorderseiten**: Der **Wert steht groß in der oberen linken und
  (gespiegelt) unteren rechten Ecke**, das Farbzeichen darunter — so liest
  man die Karte auch, wenn sie im Fächer nur zur Hälfte hervorschaut.
- **Lesbarkeit ist Pflicht:** Kreuz und Pik deutlich **schwarz/dunkel**,
  Herz und Karo deutlich **rot** — auf einen Blick zu unterscheiden. Probe:
  eine Kreuz- und eine Herzkarte nebeneinander, aus zwei Metern erkennbar
  verschieden.

## Die zehn Blätter

Jedes Blatt ist ein geschlossenes Thema: **eine Grundfarbe, ein Zeichen für
die Rückseite, eine Handschrift für die Vorderseiten.** Die Rückseite trägt
ein **mittiges Emblem in einem Rahmen**, ringsum ruhiges Muster — wie ein
echtes Skatblatt, nur in unserem warmen Malstil.

| id (Ordner) | Grundfarbe | Rückseiten-Emblem | Handschrift der Vorderseiten |
| --- | --- | --- | --- |
| `eiche` | Eichenbraun & Messing | Eichenblatt & Eichel, gerahmt | warm, holzig; klassische Figuren, kräftige Farbzeichen |
| `winterhof` | Eisblau & Silber | Schneekristall | kühl, klar; silbrige Ränder, Figuren mit Fellkragen |
| `sommerwiese` | Wiesengrün & Hellgelb | Blüte mit Biene | hell, freundlich; Figuren sonnig, viel Weißraum |
| `nachthimmel` | Tiefblau & Gold | Mond mit Sternen | dunkler Grund, goldene Figuren, wie Emaille |
| `rubin` | Weinrot & Gold | Facettierter Rubin | edel, samtig; Figuren in Hofkleidung |
| `smaragd` | Smaragdgrün & Gold | Geschliffener Smaragd | edel, Gegenstück zu `rubin` |
| `kupferstich` | Sepia & Kupfer | Kompassrose | wie ein alter Kupferstich, feine Linien, wenig Farbe |
| `pinguin` | Brauweg-Blau & Gold | **Der Pinguin** (Maskottchen) mittig | verspielt; die Bildfiguren als Pinguine in Kostüm |
| `koeniglich` | Purpur & Gold | Krone auf Kissen | prunkvoll; Figuren groß, viel Gold |
| `schiefer` | Schiefergrau & Kreideweiß | Schlichtes Monogramm-Wappen | modern-reduziert; klare Flächen, dünne Kreidelinien |

**Hinweis zu `pinguin`:** Das ist unser Maskottchen-Blatt — hier dürfen
Bube/Dame/König als Pinguin-Figuren gemalt sein (mit Krone, mit Schleier,
mit Zepter). Die Zahlenkarten bleiben aber klar lesbar: großes Farbzeichen,
großer Wert.

## Vorderseiten — Dateinamen (zweiter Schritt)

Pro Blatt 24 Dateien, deutsche Namen, Kleinschreibung:

```
kreuz_9  kreuz_10  kreuz_b  kreuz_d  kreuz_k  kreuz_a
pik_9    pik_10    pik_b    pik_d    pik_k    pik_a
herz_9   herz_10   herz_b   herz_d   herz_k   herz_a
karo_9   karo_10   karo_b   karo_d   karo_k   karo_a
```
(`b` = Bube, `d` = Dame, `k` = König, `a` = Ass.)

## Ablage — Blätter

Je Blatt ein eigener Ordner unter dem id-Namen:

```
packages/client/public/karten/<id>/ruecken.png      ← die Rückseite (Schritt 1)
packages/client/public/karten/<id>/kreuz_9.png      ← die Vorderseiten (Schritt 2)
packages/client/public/karten/<id>/…                  (alle 24)
```

Also z. B. `packages/client/public/karten/eiche/ruecken.png`.

---

# 2 — Zehn Tischszenerien

Der Untergrund, auf dem gespielt wird — eine **persönliche** Einstellung:
jeder am Tisch sieht seine eigene. Acht gibt es schon (`szene-stube` …
`szene-nacht`); diese zehn kommen dazu.

## Die eine Regel, die über allem steht

**Auf jeder Szenerie müssen Spielkarten lesbar bleiben.** Die Spielfläche
ist **mittelhell bis mittel-dunkel**, nie fast schwarz, nie fast weiß, und
**gleichmäßig** (feine Struktur ja, Muster/Verlauf in der Mitte nein).
Probe: eine weiße Karte mit schwarzem Kreuz und eine mit rotem Herz
darauflegen — beide auf einen Blick unterscheidbar. Wenn nicht: aufhellen.

## Format — bei allen zehn gleich

- PNG, **1024 × 1536** (Hochkant 2:3), sRGB.
- **Aufteilung** (damit die App nichts umbauen muss):

| Höhe | Was dort ist |
| --- | --- |
| 0–10 % | Wand oder Rand, dunkel |
| 10–75 % | **Die Spielfläche** — volle Breite, oben/unten eine Kante |
| 75–100 % | Dunkler Rand / Tischkante — darüber liegen die Handkarten |

- **Frei bleiben:** die **Mitte** (30–70 % Breite, 30–65 % Höhe, dort liegt
  der Stich) und die **Ränder** der Fläche (dort sitzen die Mitspieler).
- **Nicht ins Bild:** Schrift, Zahlen, Karten, Hände, Bedienelemente,
  Handyrahmen, Alkohol.
- **Beschnitt:** Auf hohen Handys bleiben die mittleren **70 % der Breite**
  sichtbar — alles Wichtige dort hinein.

## Die zehn Szenerien

| Datei | Szenerie | Beschreibung (Fläche bleibt mittelhell!) |
| --- | --- | --- |
| `szene-wirtshaus.png` | Wirtsstube | Kräftiges Holz ringsum, Butzenscheiben-Fenster hinten, warmer Filz. |
| `szene-kaminzimmer.png` | Kaminzimmer | Rechts oben ein Kamin mit Glut, Filz warm angeleuchtet, Ränder tief. |
| `szene-bibliothek.png` | Bibliothek | Bücherregale in der oberen Wand, grüner Lesetisch-Filz, Leselampe. |
| `szene-berghuette.png` | Almhütte | Kiefernholz, kariertes Tuch nur am Rand, Fläche ruhiges Mittelgrün. |
| `szene-gartenlaube.png` | Gartenlaube | Filz unter Blätterdach, gesprenkeltes Licht **nur an den Rändern**. |
| `szene-marmor.png` | Marmorsalon | Heller, warmer Marmortisch mit feiner Äderung — nicht zu weiß/kalt. |
| `szene-samt-blau.png` | Blauer Samt | Mitteltiefes Taubenblau, weicher Samtschimmer, Goldkante am Rand. |
| `szene-herbst.png` | Herbstfenster | Fenster mit Herbstlaub dahinter, Fläche warmes Mittelbraun-Grün. |
| `szene-kapitaen.png` | Kajüte | Dunkles Schiffsholz, Messing, Bullauge hinten; Filz gedämpftes Grün. |
| `szene-basar.png` | Basar-Teppich | Warmer Teppich-Look am **Rand**, Mitte ruhig und flach gehalten. |

## Ablage — Szenerien

```
packages/client/public/hub/szene-<name>.png
```

---

# 3 — Zehn Clanwappen

Wappen zum Auswählen — im Clan-Tab, in der Clanliste, neben dem Namen. Acht
gibt es schon (`wappen-1` … `wappen-8`); diese zehn führen die Reihe fort
als `wappen-9` bis `wappen-18`.

## Format & Machart

- PNG mit **echtem Alpha**, **512 × 512**, Wappen **mittig, gleiche Größe**
  im Bild — sie liegen später als Raster nebeneinander und dürfen nicht
  unterschiedlich groß wirken.
- **Vorbild:** das vorhandene `clan-wappen.png` und die acht `wappen-*` —
  **gleicher Goldrand, gleiche Wölbung, gleiche Machart.** Nur **Farbe und
  Zeichen** wechseln. Ein Satz aus einer Hand, nicht zehn Einzelstücke.
- **Kein Pinguin** auf diesen (der gehört dem Brauweg-Clan selbst).
- **Keine Schrift.** Zeichen **flächig und einfach** — ein Wappen wird auch
  **40 px klein** angezeigt; feine Verzierung wird dort zu Matsch.

| Datei | Grundfarbe | Zeichen in der Mitte |
| --- | --- | --- |
| `wappen-9.png` | Silbergrau | Wolfskopf |
| `wappen-10.png` | Bronze | Adler mit gespreizten Schwingen |
| `wappen-11.png` | Grün | Vierblättriges Kleeblatt |
| `wappen-12.png` | Meerblau | Welle |
| `wappen-13.png` | Ziegelrot | Wehrturm |
| `wappen-14.png` | Gold | Strahlende Sonne |
| `wappen-15.png` | Violett | Mondsichel mit drei Sternen |
| `wappen-16.png` | Türkis | Springender Fisch |
| `wappen-17.png` | Orange | Fuchskopf |
| `wappen-18.png` | Schiefergrau mit Silberrand | Berggipfel |

## Ablage — Wappen

```
packages/client/public/hub/wappen-9.png   …   wappen-18.png
```

## Prüfung — Wappen

1. Kein Text, keine Zahlen — auch nicht im Zeichen.
2. Die zehn (mit den alten acht) nebeneinander: gleiche Größe, gleiche
   Machart, erkennbar ein Satz.
3. Auf 40 px verkleinert: Zeichen noch erkennbar?
4. Auf rotem Grund: echtes Alpha, kein Schachbrett, kein heller Saum.

---

# 4 — Emotes (Reaktionen am Tisch)

Kleine Bilder, die man den Mitspielern zuwirft — sie erscheinen kurz über
dem eigenen Sitz (dort, wo heute die Ansage-Blase auftaucht) und verblassen
wieder. Zwei Arten: **Lach-Grafiken** (4a) und **Sprüche** (4b).

## 4a — Fünf Lach-Emotes

Unser Maskottchen ist der **Pinguin**. Diese fünf sind **Pinguin-Gesichter**
in fünf Lach-Stufen — als runde, gemalte „Münze" mit dem Kopf mittig, gleich
groß, gleiche Blickrichtung, damit die Reihe im Auswahlfeld ruhig wirkt.

- PNG mit **echtem Alpha**, **256 × 256**, Kopf mittig, gleicher Randabstand
  bei allen fünf.
- Warm gemalt, weiches Licht von oben links — wie `pinguin.png`. Deutlicher,
  großzügiger Ausdruck (wird auch klein angezeigt), **kein** harter Umriss.
- Keine Schrift.

| Datei | Ausdruck |
| --- | --- |
| `emote-grinsen.png` | Breites, zufriedenes Grinsen, Augen zu Bögen. |
| `emote-lachtraenen.png` | Tränenlachen — Kopf leicht zurück, Freudentränen. |
| `emote-schmunzeln.png` | Verschmitzt-schadenfroh, ein Auge zugekniffen. |
| `emote-prusten.png` | Schallendes Lachen, Schnabel weit auf, Kopf im Nacken. |
| `emote-verlegen.png` | Verlegenes Lachen, eine Flosse vor dem Schnabel, rote Wangen. |

**Ablage:**
```
packages/client/public/hub/emote-grinsen.png   … usw.
```

## 4b — Fünf Spruch-Emotes

Fünf **Spruchbänder mit fertigem Text** — die einzige Stelle in dieser
Bestellung, wo **Text ins Bild gehört**. Ein gemaltes Holz- oder Messing-
Band mit dem Spruch in kräftiger, gut lesbarer Schrift, heller Text auf
dunklem Band.

- PNG mit **echtem Alpha**, **512 × 256** (quer), Band mittig, etwas Rand
  ringsum.
- Machart wie ein kleines Wirtshausschild: warmes Holz, schmale Goldkante,
  leichte Wölbung. Die fünf als **ein Satz** (gleiches Band, nur anderer
  Spruch).
- Text **deutsch**, genau wie unten. Schrift kräftig, mit Rand/Schatten,
  damit sie über jedem Filz lesbar bleibt.

| Datei | Spruch |
| --- | --- |
| `spruch-guter-stich.png` | „Guter Stich!" |
| `spruch-gut-gespielt.png` | „Gut gespielt!" |
| `spruch-na-sowas.png` | „Na sowas!" |
| `spruch-wird-eng.png` | „Das wird eng!" |
| `spruch-nochmal.png` | „Nochmal!" |

**Ablage:**
```
packages/client/public/hub/spruch-guter-stich.png   … usw.
```

> **Kleiner Vorbehalt zu 4b:** Weil der Text eingemalt ist, lässt er sich
> später nicht übersetzen. Für den deutschen Start ist das in Ordnung.
> Falls die App irgendwann mehrsprachig wird, liefern wir stattdessen fünf
> **leere** Bänder und lassen die App den Spruch daraufsetzen — dann sag mir
> Bescheid, dann ändere ich die Bestellung. Für jetzt: Text drauf.

---

## Sammel-Prüfliste vor der Übergabe

1. **Karten:** Kreuz-/Pik dunkel, Herz-/Karo rot, aus zwei Metern
   unterscheidbar. Ecken mit echtem Alpha.
2. **Szenerien:** Kartenprobe bestanden (weiße Karte mit Kreuz + mit Herz),
   genau 1024 × 1536, ruhige Zonen wirklich ruhig, kein Text.
3. **Wappen & Lach-Emotes:** auf rotem Grund geprüft — echtes Alpha, kein
   Schachbrett, kein heller Saum; auf 40 px noch erkennbar.
4. **Sprüche:** Text genau wie in der Tabelle, hell auf dunkel, lesbar über
   Filz.
5. **Alles zusammen:** erkennbar **eine Handschrift** — Shop-Ware aus einem
   Guss, nicht aus fünf Quellen.
