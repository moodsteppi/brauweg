# Bildbestellung: `biom-2-wiesen` neu

**Nur eine Kachel.** Die zweite Station des Trophäenpfads (`biom-2-wiesen`,
Checkpoint 100) wird **ersetzt**. Alle anderen fünf Biome bleiben, wie sie
sind.

## Warum neu

Die jetzige `biom-2-wiesen` und die `biom-1-heimat` darunter sehen sich zu
ähnlich: **beide sattes, schattiges Wiesengrün** in derselben Machart. Der
einzige echte Unterschied ist, dass die Heimat ein Haus hat und die Wiesen
einen Bach — im kleinen Startseiten-Fenster verschmelzen sie zu „zweimal
dieselbe grüne Wiese". Für die *nächste Welt* fehlt der Sprung.

**Das Ziel: ein klarer Kontrast zur Heimat.** Die Heimat ist schattig, satt,
Abendstimmung, dicht bewachsen. Die neue Wiese ist ihr Gegenteil: **hell,
offen, sonnig, weit** — man tritt aus dem Garten hinaus ins Freie.

---

## Das neue Motiv — `biom-2-wiesen`

Eine **sonnige, offene Blütenwiese mit sanften Hügeln.** Vormittags- bis
Mittagslicht, warm und klar. Weites, helles Gelbgrün bis Goldgrün, über das
der Blick frei läuft — viel offene Fläche, wenig Gestrüpp.

**Darauf verteilt:**
- **Blüten in Tupfern:** roter Mohn, blaue Kornblumen, weiße Margeriten,
  ein paar lila Lavendel- oder Glockenblumen-Flecken. Bunt, aber locker
  gestreut — kein Blumenteppich, der den Weg zuwuchert.
- **Sanfte Hügelwellen**, die dem Bild Tiefe geben.
- **Vereinzelt** ein blühender Laubbaum oder ein runder Busch — **luftig
  gesetzt**, an den Rändern, nicht als Wald. (Die Heimat ist die dichte,
  die Wiese die weite.)
- Optional als feine Tupfer an den Rändern: ein, zwei Schmetterlinge oder
  Bienen. Klein, dezent, nicht in die Mitte.

**Was hier NICHT hingehört** (steht in anderen Biomen):
- **Kein Bach, kein Wasserlauf** quer durchs Bild — der wandert weg. (Wasser
  gibt es nur an den Rändern als Kachelübergang, siehe unten.)
- **Keine Nadelbäume** — die gehören zum Schneefeld.
- **Kein Haus, kein Zaun, kein Steg-Gebäude** — das ist die Heimat.

**Helligkeit:** deutlich heller als die Heimat (die liegt bei ~35 %).
Zielbereich der Fläche **etwa 55–62 %** — sonnig, nicht ausgebleicht. Genau
dieser Helligkeitssprung macht den Unterschied im kleinen Fenster sichtbar.

---

## Verbindlich (damit die Kachel in den Satz passt)

**Format**
- PNG, **1024 × 1024**, quadratisch, sRGB, kein Alpha nötig.
- Original nach `packages/client/art/` liefern — **nicht** nach `public/`.
  Die ausgelieferte `.webp` erzeuge ich daraus.

**Der Weg — der rote Faden über alle sechs Kacheln**
- **Genau EIN Weg.** Eine einzige Kette **heller, runder Trittsteine** —
  sonst nichts Wegähnliches. Keine zweite Spur, keine parallele Steinreihe,
  keine Trampelspur daneben. Sind zwei Linien zu sehen, auf denen man laufen
  könnte, ist die Kachel falsch.
- **Senkrecht durch die Mitte:** Der Weg **betritt die Kachel unten bei
  genau 50 % der Breite** und **verlässt sie oben bei genau 50 %**. Er darf
  leicht pendeln wie eine von Hand gezogene Linie, weicht aber **nirgends
  mehr als 8 % der Bildbreite** von der Mittellinie ab. An Ober- und
  Unterkante läuft er auf den letzten 5 % der Höhe **senkrecht** — kein
  Bogen kurz vor der Kante.
- Der Weg ist **derselbe** wie in den anderen fünf Biomen: helle,
  runde Trittsteine. **Wichtig auf der hellen Wiese:** damit er nicht im
  hellen Grün untergeht, bekommen die Trittsteine einen leichten **erdigen
  Rand / weichen Schatten** — auf ganzer Länge sichtbar, auch wo Stein und
  Wiese ähnlich hell sind.

**Die Ränder (Kachelübergang)**
- Ober- und unterer Rand sind **kein Land**, sondern laufen auf den äußeren
  ~8 % der Höhe in **Wasser** aus (eine flache Küste/Uferkante) — so passt
  die Kachel oben wie unten an die Nachbarn. **Nebel bitte vermeiden**: Am
  oberen Rand hing zuletzt eine Nebelbank in der Luft, das sah nach
  Bildbegrenzung aus. Wasser ist der sauberere Übergang.
- Nur der **Weg** kreuzt diese Ränder — als Trittsteine übers Wasser.

**Stil — muss zum Satz passen**
- Gemalt, warm, satt, freundlich. **Draufsicht aus leichter Schräge**, wie
  eine Schatzkarte. Kein Fotorealismus, kein Comic-Umriss.
- **Licht von links oben**, gleiche Strichstärke und Sättigung wie die
  anderen fünf Kacheln — es soll wie aus derselben Hand wirken, nur eben die
  **helle, sonnige** unter ihnen.

**Nicht ins Bild**
- Keine Schrift, keine Zahlen, keine Checkpoint-Marken (die setzt die App).
- Kein Pinguin (die Spielfigur läuft als eigenes Bild darüber).
- Keine Bedienelemente, kein Handyrahmen, kein Alkohol.

**Beschnitt**
- Auf hohen Handys bleiben die **mittleren 70 % der Breite** sichtbar
  (15 %–85 %). Weg und alles Wichtige gehören dorthin, Beiwerk an die Seiten.

---

## Abnahme (bitte vor der Übergabe)

1. **In voller Auflösung ansehen**, nicht nur klein — im 175-px-Streifen
   verschmelzen zwei Wege zu einem, der bloß unruhig wirkt. Genau **ein**
   Weg?
2. **Neben die Heimat gelegt:** klarer Unterschied? Die Heimat schattig und
   satt, die Wiese hell und offen — auf einen Blick zwei verschiedene Welten,
   nicht zweimal Grün.
3. Weg betritt/verlässt die Kachel bei 50 %, an den Kanten senkrecht, nirgends
   mehr als 8 % Abweichung.
4. Trittsteine auf ganzer Länge sichtbar, auch auf dem hellen Grün.
5. Ober- und Unterrand laufen in Wasser aus, keine Nebelbank.

---

## Ablage & was danach passiert

- Original (1024 × 1024 PNG) nach `packages/client/art/`.
- Ich erzeuge daraus die `biom-2-wiesen.webp`, ersetze die alte in
  `packages/client/public/hub/` und prüfe die Wegführung gegen die Nachbarn.
  Am Code (`Pfad.tsx`, `BIOME`) ändert sich **nichts** — Name und Checkpoint
  bleiben, nur das Bild wird getauscht.
