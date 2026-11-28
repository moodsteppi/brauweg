# Startseite neu (28.11.2026): Mittelknopf, BroweG-Bock, Spielarten

Bestellung nach CLAUDE.md Regel 5. Gehört zu `docs/STARTSEITE-UMBAU-PLAN.md`.
Stil wie `docs/ASSETS-START-EINSTIEGE.md`: warme Pinguin-Spielstube, dunkles
Walnussholz, Waldgrün, Messing/Gold, gerendert wie `aufgaben.webp` und
`lernen.webp` (beide als Stilvorlage an den Generator gegeben).

## 1. Mittelknopf „Zu den Spielen“ — `hub/start-einstiege/spiele.webp`

**Seit dem 28.11.2026 abends:** grünes Medaillon mit goldenem Controller
(Entwurf 3 von sechs, `art/mittelknopf/`), 448², ~60 kB, ohne Schrift; der
Name steht am Knopf. Das Pfeilschild unten wirkte aufgesetzt (Robin) und ist
entfernt — der Abschnitt bleibt als Geschichte.

### Früher: Schild — `hub/start-einstiege/schild.webp` (entfernt)

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

## 3. Spielart-Karten — `hub/spielarten/<spiel>-<id>.webp`

25 freigestellte Motive (256², je ~25 kB) für die Spielart-Karten der
Spiel-Einstiege (`docs/STARTSEITE-UMBAU-PLAN.md` Abschnitt 11): doppelkopf
anfaenger/normal/standard/hart, skat normal/klassisch/hart, zauberer
normal/profi/chaos, cambio normal/hart, poker locker/abend/hoch, eiland
klar/nebel, brochess bullet/blitz/schnell/spezial, partykiste
turnier/eskalation/themenabend/team. Über codex mit `aufgaben.webp`/`lernen.webp`
als Stilvorlage erzeugt, auf Rot geprüft (Kontaktbogen), Spielkarten nur mit
Farbsymbolen, ohne Buchstaben/Zahlen. Farbduell (Vorschaubrett) und Golf
(Bahnminiatur) bleiben gezeichnet. Prompts und Originale:
`packages/client/art/spielarten/` (lokal), Archiv `brauweg-art`.
