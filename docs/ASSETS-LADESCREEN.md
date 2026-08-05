# Bildbestellung: Ladescreen-Pinguin

**Wofür.** Der Ladeindikator ist jetzt überall derselbe ruhige Ring
(`Ladekreis.tsx`). Der **Vollbild-Ladescreen beim App-Start** (App.tsx, „Einen
Moment…") darf dazu ein Bild bekommen: ein wartender Pinguin über dem Ring. Die
kleinen In-Screen-Loader (Profil, Clan, Shop …) bleiben schlicht nur der Ring —
ein großes Bild in einer halben Zeile wäre dort fehl am Platz.

## Auftrag

**Ein Bild:** der Maskottchen-Pinguin in einer **geduldigen Warte-Pose** —
freundlich, ruhig, „gleich geht's los". Ideen: sitzt und schaut erwartungsvoll
nach oben, hält eine Laterne, tippt mit dem Flügel auf eine Taschenuhr. Kein
Hektik-Motiv.

- **Stil:** genau wie der **aktuelle Pinguin** (3D-gerendert, wie die
  Ausstattung — siehe `docs/ASSETS-PINGUIN.md`). Der Ladescreen soll aussehen
  wie derselbe Pinguin, nicht wie ein fremdes Maskottchen.
- **Freigestellt:** transparenter Hintergrund, der Pinguin allein. Kein Boden,
  kein Schatten nach außen (den setzt die App), kein Rahmen.
- **Nicht ins Bild:** keine Schrift, kein Ladebalken, kein Spinner (den zeichnet
  die App als Ring darunter), kein Hintergrund.

## Technisch (nach docs/JETZT-AUSFUEHREN.md)

- **Maße:** quadratisch, **512 × 512 px** (wird klein angezeigt, ~8 rem, aber
  scharf bleiben).
- **Format:** WebP mit echtem Alphakanal. Alphaprobe auf Rot **und** Weiß —
  sichtbar nur der Pinguin, ohne Saum.
- **Original (PNG, volle Auflösung)** ins Archivrepo **`moodsteppi/brauweg-art`**
  unter `pinguin/` (oder `hub/`), **nicht** ins Code-Repo — `packages/client/art/`
  ist gitignored.
- **WebP** nach `packages/client/public/hub/`, Dateiname **`lade-pinguin.webp`**.
- Umwandeln mit `~/bildwerkzeug/wandeln.mjs … wappen` (das `wappen`-Profil
  schützt den Alphakanal).

## Danach (Code, macht die App-Seite)

Der Ladekreis bekommt eine optionale Grafik; der App-Start-Loader setzt sie:
`<Ladekreis bild="/hub/lade-pinguin.webp" text="Einen Moment…" />`. Bis das Bild
liegt, **kein `<img>`** darauf — ein weißer Kasten sähe nach Fehler aus, der
Ring allein nach Absicht.

## Abnahme

- Ein freigestellter Pinguin, 512 × 512, WebP mit Alpha, kein Saum auf Rot/Weiß.
- Erkennbar **derselbe** Pinguin wie im Hub, ruhige Warte-Pose.
- Keine Schrift, kein Balken, kein Hintergrund, kein Original unter `public/`.
