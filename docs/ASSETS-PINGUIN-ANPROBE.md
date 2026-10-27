# Bestellung: Pinguin-Kleidung „am Pinguin anprobiert"

Stand 21.10.2026 (Emile). Ersetzt nach und nach die Ebenen unter
`packages/client/public/hub/pinguin/`.

## Das Problem

Jedes Stück war bisher ein eigenes, für sich gemaltes Bild, das über den
fertigen Pinguin gelegt wird. Es kannte den Körper nicht: Der Frack bringt
eigene Schultern und Ärmel mit, die Flossen bleiben daneben stehen, die Krone
schwebt über dem Kopf. Der Pinguin **trägt** nichts, die Sachen liegen vor ihm.

## Die Lösung

Jedes Stück wird **am Basis-Pinguin gemalt**, so wie er es anhat — gleiche
Haltung, gleiche Größe, gleiche Stelle im Bild. Erst danach wird das Stück
herausgeschnitten (`werkzeug`: Differenz gegen den nackten Pinguin, siehe
unten). Dadurch sitzen Ärmel um die Flossen, Hüte auf dem Kopf, Schuhe an
den Füßen, und alles bleibt frei kombinierbar.

## So geht's (ChatGPT)

1. Neuen Chat öffnen, **`vorlage-pinguin.png`** hochladen (der nackte Pinguin
   auf Grün, 1024 × 1024).
2. Den Text des Stücks unten einfügen, **ein Stück je Bild**.
3. Das Bild herunterladen und hier in den Chat legen. Name egal, ich ordne zu.
4. Sieht der Pinguin anders aus als in der Vorlage (andere Größe, Kopf
   gedreht, andere Augen), lieber einmal neu erzeugen — das Ausschneiden
   klappt nur, wenn alles außer dem Stück gleich bleibt.

### Gemeinsamer Teil (steht in jedem Text schon drin)

> Edit the uploaded image. Keep the penguin EXACTLY as it is: same pose, same
> size, same position in the frame, same face, same eyes, same lighting, same
> camera, same pure green #00FF00 background. Do not move, rotate, scale or
> redraw the penguin. Only dress it in the item described below, worn
> naturally on its body, in the same glossy soft 3D cartoon render style.
> Output 1024×1024. No text, no logo, no extra objects, no shadow on the
> background.

### 1 · Frack (`oberteil-frack`)

```
Edit the uploaded image. Keep the penguin EXACTLY as it is: same pose, same size, same position in the frame, same face, same eyes, same lighting, same camera, same pure green #00FF00 background. Do not move, rotate, scale or redraw the penguin. Only dress it in the item described below, worn naturally on its body, in the same glossy soft 3D cartoon render style. Output 1024x1024. No text, no logo, no extra objects, no shadow on the background.

Item: a black tailcoat (tuxedo) WORN by the penguin. The jacket wraps around the penguin's round body and follows its shape. The two flippers go INTO the sleeves: the sleeves cover the upper half of each flipper, the lower flipper tips stay visible below the white shirt cuffs, flippers stay exactly where they are. White shirt front with a small black bow tie at the neck, just below the beak. The coat stays open over the white belly, short tails behind. Nothing covers the face or the feet.
```

### 2 · Krone (`hut-krone`)

```
Edit the uploaded image. Keep the penguin EXACTLY as it is: same pose, same size, same position in the frame, same face, same eyes, same lighting, same camera, same pure green #00FF00 background. Do not move, rotate, scale or redraw the penguin. Only dress it in the item described below, worn naturally on its body, in the same glossy soft 3D cartoon render style. Output 1024x1024. No text, no logo, no extra objects, no shadow on the background.

Item: a golden royal crown SITTING ON the penguin's head. The crown's band rests on the top of the head and is slightly hidden behind the head's curve at the back, slightly tilted with the head, casting a soft shadow onto the dark head feathers. Five points, a blue gem in front, small red gems on the side. The crown must not float above the head and must not cover the eyes.
```

### 3 · Pulli (`oberteil-pulli`)

```
Edit the uploaded image. Keep the penguin EXACTLY as it is: same pose, same size, same position in the frame, same face, same eyes, same lighting, same camera, same pure green #00FF00 background. Do not move, rotate, scale or redraw the penguin. Only dress it in the item described below, worn naturally on its body, in the same glossy soft 3D cartoon render style. Output 1024x1024. No text, no logo, no extra objects, no shadow on the background.

Item: a cozy green knitted sweater WORN by the penguin, with a ribbed collar just below the beak and a ribbed hem around the lower belly. The knit wraps around the round body and follows its shape with soft folds. The flippers go INTO short sleeves: the sleeves cover the upper part of each flipper, flipper tips stay visible, flippers stay exactly where they are. The feet stay uncovered.
```

### 4 · Gummistiefel (`schuhe-gummistiefel`)

```
Edit the uploaded image. Keep the penguin EXACTLY as it is: same pose, same size, same position in the frame, same face, same eyes, same lighting, same camera, same pure green #00FF00 background. Do not move, rotate, scale or redraw the penguin. Only dress it in the item described below, worn naturally on its body, in the same glossy soft 3D cartoon render style. Output 1024x1024. No text, no logo, no extra objects, no shadow on the background.

Item: a pair of short yellow rubber boots WORN on the penguin's two orange feet. Each boot is exactly where a foot is, same size as the foot, the feet are inside the boots, the boot tops end just below the body. Glossy rubber, small dark sole. Nothing else changes.
```

## Was ich daraus mache

- Ausrichten auf den 480 × 512-Rahmen (`RAHMEN` in `pinguin.tsx`).
- Ausschneiden: alles, was sich gegenüber dem nackten Pinguin geändert hat,
  plus ein weicher Rand; das Grün wird entfernt. Was das Stück verdeckt
  (Flossenansatz unter dem Ärmel), ist damit automatisch richtig verdeckt.
- WebP über `~/bildwerkzeug/wandeln.mjs`, Original ins Archiv
  `moodsteppi/brauweg-art` (`pinguin/anprobe/`).

## Abnahme

- Auf **rotem Grund** geprüft, einzeln und gestapelt: kein Schachbrett,
  kein grüner Saum, keine undurchsichtigen Ecken.
- Gestapelt auf `pinguin-basis.webp` sieht der Pinguin aus wie im
  ChatGPT-Bild — kein Versatz an Kopf, Flossen oder Füßen.
- Unter 25 kB je WebP.

## Was NICHT ins Bild gehört

- **Kein eingebrannter Text**, kein Logo.
- **Kein Schachbrett statt Hintergrund** — der Hintergrund ist reines Grün.
- Kein veränderter Pinguin (andere Augen, anderer Schnabel, gedreht, größer).
- Keine zweite Figur, kein Boden, kein Schatten auf dem Grün.
- Keine Originalauflösung unter `packages/client/public/`.
