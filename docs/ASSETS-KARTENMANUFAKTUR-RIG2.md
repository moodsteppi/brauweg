# Bestellung: Rig, zweite Lieferung (Ränge, Renovieren, Werkstattbuch, Baustelle)

Stand 24.10.2026 (Emile, mit Claude). Spiel: `docs/SPEZIFIKATION-KARTENMANUFAKTUR.md`.
Stil und Aufbau wie die erste Rig-Lieferung (`outputs/rig/`) und die
Bedienelemente (`outputs/ui/`, `docs/ASSETS-KARTENMANUFAKTUR-UI.md`).

**Lieferung nach `outputs/rig2/`.** Bis sie kommt, liegen unter genau diesen
Namen und Maßen Platzhalter in `packages/client/public/manufaktur/rig2/`
(erzeugt mit `node werkzeug/manufaktur-platzhalter.mjs`). Eingebaut wird
durch Austauschen der Datei — Code und Maße bleiben.

## Gemeinsamer Teil (vor jeden Text)

> Game art for a cute mobile idle game about a playing-card factory run by
> chubby penguins. Glossy soft 3D cartoon style with gentle outlines, warm
> oak wood, polished brass and gold, night-blue accents, lit from the top
> left. Single object on a fully transparent background (real alpha channel).
> No text, no letters, no numbers, no watermark, no logo.

## A — Rang-Kleidung (Rig, wie `outputs/rig/` Paket 7)

Gezeichnet für den Pinguin aus `rig-pinguin.json` (Canvas 512 × 512,
Scheitel `kopf_oben` (244, 55), Augen (256, 149)).

| Datei | Größe | Slot | Drehpunkt | Motiv |
| --- | --- | --- | --- | --- |
| `muetze-jungmeister.png` | 256 × 256 | kopf | (128, 198) — Unterkante der Mütze, Mitte | flat green work cap with a small bronze badge pin |
| `koerper-weste-meister.png` | 512 × 512 | koerper (Ersatzkörper) | wie `pinguin-koerper.png` | the penguin body wearing a dark green waistcoat with brass buttons and a silver pocket-watch chain, over the green apron |
| `flosse-vorn-weste-meister.png`, `flosse-hinten-weste-meister.png` | 256 × 256 | flosse_vorn / flosse_hinten | wie `flosse-vorn-weste.png` | matching sleeves |
| `hut-obermeister.png` | 256 × 256 | kopf | (128, 196) | tall black top hat with a gold band and a tiny gold card emblem |
| `muetze-bauhelm.png` | 256 × 256 | kopf | (128, 198) | yellow construction helmet with a small headlamp |
| `req-schaufel.png` | 256 × 256 | hand | (60, 190) — Griff | small shovel, wooden handle, steel blade |
| `req-hammer.png` | 256 × 256 | hand | (60, 190) — Griff | small wooden hammer with an iron head |

**Ersatzkörper bleibt am unveränderten Ursprung**, genau wie die
Berufskleidung — sonst springt der Pinguin beim Rangwechsel.

## B — Abzeichen und Fähigkeiten (UI, wie `outputs/ui/`)

| Datei | Größe | am Handy | Motiv |
| --- | --- | --- | --- |
| `abzeichen-bronze.png` | 128 × 128 | 20 pt | small round bronze medal with one star |
| `abzeichen-silber.png` | 128 × 128 | 20 pt | the same medal in silver with two stars |
| `abzeichen-gold.png` | 128 × 128 | 20 pt | the same medal in gold with three stars, slight glow |
| `faehigkeit-tempo.png` | 128 × 128 | 16–28 pt | lightning bolt over two speed lines, gold |
| `faehigkeit-ladung.png` | 128 × 128 | 16–28 pt | a stack of three card packs with an up arrow, brass |
| `faehigkeit-rabatt.png` | 128 × 128 | 16–28 pt | a brass price tag with a cut corner, green ribbon |
| `faehigkeit-alle.png` | 128 × 128 | 28 pt | three small lightning bolts in a ring |
| `einstellen-mappe.png` | 256 × 256 | 48 pt | a leather job-application folder with a brass clasp |

Abzeichen: **gleicher Umriss** in allen drei Farben.

## C — Renovieren

| Datei | Größe | am Handy | Motiv | Freihalten |
| --- | --- | --- | --- | --- |
| `renovierung-schild.png` | 384 × 160 | 96 × 40 pt | horizontal brass plaque with rivets, hanging from two short chains | Mitte 80 % — dort stehen bis zu vier Sterne |
| `renovierung-stern.png` | 64 × 64 | 14 pt | a polished gold star | — |
| `deko-girlande.png` | 1024 × 128 | volle Hallenbreite | a garland of small colored flags and warm string lights, sagging gently | oben 16 px durchsichtig |
| `deko-lampe.png` | 128 × 256 | 32 × 64 pt | a hanging brass factory lamp, lit | — |

## D — Werkstattbuch und Siegel

| Datei | Größe | am Handy | Motiv |
| --- | --- | --- | --- |
| `siegel.png` | 128 × 128 | 16–28 pt | a red wax seal with a golden card emblem |
| `werkstattbuch.png` | 256 × 256 | 28 pt | a thick leather-bound workshop book with brass corners |
| `werkstattbuch-seite.png` | 768 × 1024 | Blatt-Hintergrund | an open old book page, warm parchment, subtle ruled lines, empty | **ganz leer**, kein Ornament in der Mitte (dort steht Text) |
| `wb-nachtschicht.png` | 128 × 128 | 40 pt | crescent moon over a small lantern |
| `wb-ruf.png` | 128 × 128 | 40 pt | a golden laurel around a playing card |
| `wb-erfahrene.png` | 128 × 128 | 40 pt | an hourglass with a gold star |
| `wb-pausen.png` | 128 × 128 | 40 pt | a steaming coffee cup with a short clock hand |
| `wb-feilschen.png` | 128 × 128 | 40 pt | two hands shaking over a coin |
| `wb-bewerber.png` | 128 × 128 | 40 pt | a stack of application folders with a star on top |
| `wb-bautrupps.png` | 128 × 128 | 40 pt | crossed hammer and shovel |
| `wb-lager.png` | 128 × 128 | 40 pt | a big wooden crate with a brass plus |

## E — Baustelle vor Etage 5 und 8

| Datei | Größe | Motiv | Freihalten |
| --- | --- | --- | --- |
| `barriere-schutt.png` | 1024 × 320 | a wall of rubble, broken bricks and dust filling a cellar floor, same framing as `etage-gesperrt.png` | Mitte (360, 112, 304, 96) — dort hängt das Countdown-Schild |
| `barriere-geruest.png` | 1024 × 320 | wooden scaffolding with planks and ropes in front of the rubble, transparent between the poles | dieselbe Fläche frei |

## Lieferung und Abnahme

Wie bei `outputs/rig/`: `png/`, `originale/`, `proben/` (jedes Bild auf Rot,
Kleidung am Pinguin montiert), eine JSON-Datei mit Drehpunkten und
Freihalteflächen, `LIESMICH.txt`.

- Echter Alphakanal, alle Ecken durchsichtig, auf Rot geprüft.
- Abzeichen und Fähigkeiten in derselben Strichstärke und demselben Licht.
- Kleidung montiert auf dem Pinguin: kein Versatz gegenüber Paket 7.
- WebP (hier gewandelt mit `wandeln.mjs … wappen`) unter 40 kB je Element,
  Seite und Schuttwand unter 150 kB.

## Was NICHT ins Bild gehört

- **Kein eingebrannter Text**, keine Zahlen, keine Sterne-Anzahl auf dem Schild.
- **Kein Schachbrett statt Alphakanal.**
- Keine Szene, kein Hintergrund außer bei `werkstattbuch-seite`.
- Keine Originalauflösung unter `packages/client/public/`.
