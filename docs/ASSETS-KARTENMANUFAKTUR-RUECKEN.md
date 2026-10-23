# Bestellung: Kartenrücken der Kartenmanufaktur

Stand 23.10.2026 (Emile, mit Claude). Spiel: `docs/SPEZIFIKATION-KARTENMANUFAKTUR.md`.

Wer eine Manufaktur abschließt (umzieht), bekommt ihren Kartenrücken; den
Kartenpalast schließt das erste Jubiläum ab. Die Rücken sind **nur zu
erspielen**, nicht zu kaufen, und erscheinen am Tisch bei allen Kartenspielen
(Rückseiten-Wähler unter Blatt).

Der Server schenkt sie schon. Gezeigt werden sie erst, wenn die Bilder da sind:
`MANUFAKTUR_RUECKEN_VORHANDEN` in `packages/client/src/decks.ts` auf `true`.

## So geht's (ChatGPT)

1. Neuen Chat öffnen, **eine Datei je Rücken**. Den gemeinsamen Teil und den
   Text des Rückens zusammen einfügen.
2. Herunterladen und in den Chat legen — ich wandle in WebP
   (`node ~/bildwerkzeug/wandeln.mjs … karten`), lege das Original ins Archiv
   `moodsteppi/brauweg-art` (`manufaktur/ruecken/`) und baue es ein.

### Gemeinsamer Teil (vor jeden Text)

> A single playing card back, seen perfectly flat and straight from the front,
> filling the whole image edge to edge, portrait 744×1080, rounded corners
> drawn inside the image with a thin dark margin. Symmetric ornamental design
> (mirror symmetric top/bottom and left/right, like a real card back), rich
> but readable when the card is small on a phone. Glossy soft 3D cartoon
> style matching a cute mobile card game with chubby penguins, night-blue and
> gold palette with warm wood and brass accents. No text, no letters, no
> numbers, no logo, no watermark, no penguin face in the center.

## Die Rücken

| Datei | Manufaktur | Motiv (in den Text einsetzen) |
| --- | --- | --- |
| `dorf.png` | Werkstatt im Dorf | warm oak wood frame, small half-timbered houses as a repeating border, a golden printing press emblem in the center |
| `fluss.png` | Fabrik am Fluss | deep blue water waves in a border, a golden water wheel emblem in the center, brick red accents |
| `berg.png` | Bergdruckerei | snowy mountain peaks as a border pattern, ice blue and silver, a golden gear and snowflake emblem in the center |
| `hafen.png` | Hafen-Druckhaus | ropes and anchors as a border, sea green and brass, a golden ship's wheel emblem in the center |
| `palast.png` | Kartenpalast | rich gold and royal purple, tiny palace towers and fireworks in the border, a jeweled crown emblem in the center — the most precious one |

Text je Rücken: `<gemeinsamer Teil> Design: <Motiv>.`

## Maße und Abnahme

- **744 × 1080**, kein Alpha nötig (die Karte füllt das Bild), wie
  `public/karten/*/ruecken.webp`.
- Spiegelsymmetrisch: Am Tisch liegen Karten auch gedreht.
- Das Mittelmotiv bleibt bei 60 px Breite erkennbar (Handkarte am Handy).
- WebP unter 120 kB je Rücken (Profil `karten`), Original nur im Archiv.
- Ablage: `packages/client/public/manufaktur/ruecken/<datei>.webp`.

## Was NICHT ins Bild gehört

- **Kein eingebrannter Text** — keine Schrift, keine Zahlen, kein Name der Manufaktur, kein „Brauweg".
- Keine Kartenwerte, keine Vorderseite, kein Stapel, keine Schrägansicht — nur der flache Rücken.
- **Kein Schachbrett statt Alphakanal** (hier ohnehin ohne Alpha: die Ecken sind dunkler Rand, nicht durchsichtig).
- Keine Originalauflösung unter `packages/client/public/` — dort nur WebP.
