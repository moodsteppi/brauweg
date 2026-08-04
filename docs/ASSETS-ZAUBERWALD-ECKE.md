# Bestellung: Zauberwald-Karten ohne Eck-Kästchen

**Warum.** Die App zeichnet die Ecken-Anzeige (Wert + Farbzeichen oben links)
seit dem Chip-Update selbst — als scharfen, mitskalierenden Pergament-Chip
(`CardFront` in `packages/client/src/CardFace.tsx`, `deck.eigeneEcke`). Solange
das gemalte weiße Kästchen im Bild liegt, verdeckt der Chip es nur. Sauber wird
es, wenn die Karten **ohne** das Kästchen kommen: dann sitzt der Chip auf reiner
Malerei, und die Ecke ist bei jeder Kartengröße gestochen statt verwaschen.

**Was sich ändert:** nur die obere linke Ecke. Sonst bleibt jede Karte, wie sie
ist — dasselbe Motiv, dieselbe Rahmengrafik, dieselbe große Zahl/Symbol in der
Mitte.

## Auftrag

Alle **60** Zauberwald-Karten neu ausspielen, **ohne** das weiße, gerundete
Eck-Kästchen mit Wert und Farbe oben links. An seiner Stelle läuft die Malerei
einfach weiter (Pergament bzw. Blattwerk), keine reservierte Fläche, kein
eingebranntes Zeichen.

- **Freihalte-Zone:** obere linke Ecke, etwa **32 % der Breite × 31 % der Höhe**
  (etwas größer als der App-Chip von 29 × 28 %, damit die Chip-Kanten auf ruhiger
  Malerei liegen, nicht auf einem Wirbel aus Details). Dort ruhig und
  kontrastarm halten — der Chip legt sich darüber.
- **Nicht ins Bild:** kein Wert, kein Farbzeichen, kein weißes Feld, kein Rahmen
  in dieser Ecke. Der Wert steht weiterhin **groß und mittig** wie gehabt.
- Alles andere **unverändert**: Motiv, Blattwerk-Rahmen, Pilze, die zentrale
  Zahl bzw. das zentrale Symbol, die Sonderkarten-Illustrationen (Zauberer,
  Narr).

## Technisch (wie gehabt)

- **Maße:** 360 × 523 px (Hochformat, wie bisher).
- **Format:** WebP, Qualität 85.
- **Dateinamen unverändert**, gleiche Ablage
  `packages/client/public/karten/zauberwald/`:
  - `kreuz_1`…`kreuz_13`, `pik_1`…`pik_13`, `herz_1`…`herz_13`,
    `karo_1`…`karo_13`
  - `zauberer_1`…`zauberer_4`, `narr_1`…`narr_4`
  - (`ruecken.webp` bleibt wie es ist — hat keine Ecke.)
- Originale in voller Auflösung nach `packages/client/art/`, **nicht** unter
  `public/`.

## Abnahme

- Oben links keine gemalte Anzeige und kein weißes Feld mehr.
- Der App-Chip (29 × 28 %) deckt die Ecke vollständig ab, ohne dass darunter
  Reste hervorschauen.
- Die zentrale Zahl/Symbol und der Rahmen sehen aus wie vorher.
