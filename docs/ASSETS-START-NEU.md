# Startseite neu (28.11.2026): Schild und BroweG-Bock

Bestellung nach CLAUDE.md Regel 5. Gehört zu `docs/STARTSEITE-UMBAU-PLAN.md`.
Stil wie `docs/ASSETS-START-EINSTIEGE.md`: warme Pinguin-Spielstube, dunkles
Walnussholz, Waldgrün, Messing/Gold, gerendert wie `aufgaben.webp` und
`lernen.webp` (beide als Stilvorlage an den Generator gegeben).

## 1. Schild „Zu den Spielen“ — `hub/start-einstiege/schild.webp`

- Breites, **leeres** Holzschild als Pfeil nach rechts, Walnuss mit Messingrand
  und Nieten, vertiefte Mittelfläche für den Text.
- Ersetzt den runden Play-Knopf in der Mitte des Start-Mosaiks; die Schrift
  „Zu den Spielen“ setzt der Bildschirm als echtes HTML darauf.
- Maße: Original 1536 × 768, ausgeliefert ~640 px breit (Anzeige ~200 px,
  dreifache Dichte), Ziel unter 60 kB.
- Abnahme: echter Alphakanal (auf Rot geprüft), Mittelfläche ohne jede Schrift
  oder Gravur, Pfeilspitze rechts klar erkennbar.

## 2. BroweG-Bock — `hub/start-einstiege/bock.webp`

- Freigestellter Champion-Pinguin mit goldenem Pokal, dessen Henkel
  Ziegenbockhörner sind, Lorbeerkranz, zu Füßen Karten, Würfel, Golfball,
  Spielfigur — „mehrere Spiele, ein Sieger“.
- Maße: Original 1024², ausgeliefert 256² (Anzeige ~84–90 px), Ziel unter 40 kB.
- Abnahme: Alpha auf Rot geprüft, liest sich bei 90 px, kein Text.

## Nicht ins Bild

Kein eingebrannter Text, keine Buchstaben/Zahlen, keine Logos, kein
Schachbrett als Transparenz, kein Boden/Schatten, keine Originalauflösung unter
`public/`.

## Nebenbei

Die vorhandenen `aufgaben/lernen/browort/play.webp` liegen als 1254² mit
240–320 kB im Repo, gezeigt werden sie bei ~84 px. Sie werden beim Umbau auf
256² verkleinert (Originale liegen schon im Archiv `brauweg-art`).

Originale: `packages/client/art/start-neu/` (lokal, `.gitignore`), danach ins
Archiv `moodsteppi/brauweg-art`.
