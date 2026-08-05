# Bildbestellung: Truhen als zwei Ebenen (Körper + Deckel) — für die 3-D-Öffnung

**Wofür.** Die Öffnungsanimation dreht die Truhe leicht im Raum und **klappt den
Deckel dreidimensional auf** (`packages/client/src/TruhenOeffnung.tsx`). Damit
das funktioniert, braucht sie jede Truhe als **zwei getrennte Bilder**: den
**Körper** (die Kiste) und den **Deckel** — nicht als ein fertiges Bild. Eine
neue Truhe ist dann nur ein neuer Satz Ebenen; die Animation bleibt gleich.

> **Ersetzt für die Animation eine ältere Bestellung.** In `docs/ASSETS-TRUHEN.md`
> sind Truhen als *fertige* „geschlossen"/„offen"-Vollbilder bestellt. Die
> 3-D-Öffnung braucht stattdessen **getrennte** Körper- und Deckel-Ebenen. Der
> geschlossene Zustand entsteht von selbst (Deckel liegt auf Körper) — die
> Vollbilder werden dafür nicht zusätzlich gebraucht. Bitte im Team abstimmen,
> damit nicht beide Sätze gemalt werden.

---

## Für alle Bilder verbindlich

- **Echter Alphakanal**, sRGB. Probe: auf **Rot und auf Weiß** legen — sichtbar
  ist nur die Truhe, ohne Saum, beide Male gleich hell. Kein Schachbrett, keine
  weiße/schwarze Fläche als „Transparenz".
- **Nicht ins Bild:** keine Schrift/Zahlen, kein Inhalt (keine Münzen), kein
  Rahmen, **kein Schlagschatten nach außen** (den setzt die App), kein
  Hintergrund, kein Lichtkegel.
- **Ton/Stil:** wie die vorhandenen Hub-Bilder — gemalt, warm, satt, freundlich.
- **Licht von schräg oben links**, gleiche Blickrichtung bei allen Bildern.
- **Grad an der Form erkennbar, nicht nur an der Farbe** (Rot-Grün-Schwäche):
  mehr Beschläge/Zierrat mit steigendem Grad. Die fünf nebeneinander müssen eine
  Leiter ergeben — niemand hält Silber für wertvoller als Gold.

## Die zwei Ebenen je Grad

Für **Holz, Bronze, Silber, Gold, Diamant** je zwei Bilder:

1. **Körper** — die offene Kiste in Vorderansicht, leicht von oben. **Oben
   offen**, mit sichtbarem dunklem Innenraum (damit die Kiste hohl wirkt, wenn
   der Deckel auffliegt). **Kein Deckel** auf diesem Bild. Front mit Schloss.
2. **Deckel** — nur der Deckel als loses Teil, gleiches Material. **Die untere
   Kante ist die Scharnierkante** und muss **waagerecht ganz unten am Bildrand**
   liegen — die Animation dreht den Deckel um genau diese Kante nach hinten auf.
   Es reicht die **Außenseite** (die Innenseite wird beim Aufklappen verdeckt).

**Material je Grad:** Holz mit dunklen Eisenbeschlägen · Bronze · Silber (feine
Gravur) · Gold (Zierleisten, größeres Schloss) · Diamant (hell, Kristalle an den
Ecken, großer Stein am Schloss).

### So müssen Körper und Deckel zusammenpassen

- **Gleiche Bildbreite und gleiche Mitte** bei Körper und Deckel eines Grades.
- Legt man den Deckel mit seiner Unterkante auf den oberen Rand des Körpers,
  ergibt sich eine **geschlossene, stimmige Truhe**.
- Zur Passungskontrolle je Grad ein **„geschlossen"-Vergleichsbild** mitliefern
  (Körper + Deckel zusammengesetzt) — nur zum Prüfen, wird im Spiel nicht
  benutzt.

## Maße & Namen

- **Körper:** 512 × 360 px. **Deckel:** 512 × 200 px (Scharnier bündig unten).
  Gleiche Breite ist Pflicht.
- Dateinamen (die WebP im Spiel): `holz-koerper`, `holz-deckel`,
  `bronze-koerper`, `bronze-deckel`, `silber-koerper`, `silber-deckel`,
  `gold-koerper`, `gold-deckel`, `diamant-koerper`, `diamant-deckel`.

## Lieferweg (nach docs/JETZT-AUSFUEHREN.md)

- **Originale (PNG, volle Auflösung)** ins **Archivrepo `moodsteppi/brauweg-art`**
  unter `truhe/` — **nicht** ins Code-Repo. `packages/client/art/` ist
  gitignored, dorthin gehören keine Originale mehr.
- **Nach WebP wandeln** mit `~/bildwerkzeug/wandeln.mjs … wappen` (das
  `wappen`-Profil schützt den Alphakanal) und die WebP nach
  `packages/client/public/hub/truhe/` legen.

## Abnahme

1. Zehn Dateien (fünf Körper, fünf Deckel), exakt benannt, transparent.
2. Deckel-Scharnier bündig an der Unterkante; zusammengelegt eine geschlossene
   Truhe (Vergleichsbild).
3. Fünf Grade an der Form auseinanderzuhalten. Keine Schrift, kein Inhalt, kein
   Hintergrund. Alphaprobe Rot/Weiß ohne Saum.
4. **Kein Original unter `public/`** — nur die 512er-WebPs.

## Danach (Code, macht die App-Seite)

In `TruhenOeffnung.tsx` in `designFuer(grad)` die SVG-Platzhalter durch die URLs
ersetzen: `koerper: '/hub/truhe/' + grad + '-koerper.webp'`, `deckel:
'/hub/truhe/' + grad + '-deckel.webp'`. Die Lichtfarbe (`glut`) bleibt im Code.
