# Bildbestellung: Hintergrund für die Ladescreens

**Wofür.** Die Ladescreens (App-Start und **„Tisch wird geladen"**) sind bisher
flach dunkel, während alle Hub-Screens einen gemalten Hintergrund haben. Sie
sollen denselben warmen, gemalten Grund bekommen — darauf sitzen der
Laternen-Pinguin und der drehende Ring.

Der Code ist schon vorbereitet: als CSS-Hintergrund mit **Verlauf-Fallback**.
Bis das Bild geliefert ist, bleibt es dunkel (nicht kaputt); sobald
`bg-laden.webp` unter `public/hub/` liegt, erscheint es von selbst.

## Auftrag

**Ein Bild:** ein ruhiger, gemalter Hintergrund der Brauweg-Welt — warme
Holzstube / gemütlicher Winkel, **leicht unscharf / atmosphärisch**, wie durch
einen weichen Schleier. Es ist ein *Hintergrund*, kein Motiv: Es soll tragen,
nicht ablenken.

- **Stil:** wie die vorhandenen Hub-Hintergründe (`bg-profil.webp`,
  `bg-shop.webp`, `bg-anmeldung.webp`) — gemalt, warm, satt, freundlich. Am
  besten passt es zu `bg-anmeldung.webp`, damit App-Start und Anmeldung eine
  Familie sind.
- **Mitte ruhig halten:** In der oberen Mitte sitzen Pinguin (~8 rem), ein Wort
  Text und der Ring. Dieser Bereich muss **ruhig und eher dunkel/weich** sein,
  damit heller Text und Pinguin klar darauf lesbar sind — keine grellen Details
  oder harten Kanten in der Bildmitte.
- **Nicht ins Bild:** **kein Pinguin** (der kommt als eigene Ebene darüber),
  kein Text, kein Logo, keine Bedienelemente, kein Ladebalken.

## Technisch (nach docs/JETZT-AUSFUEHREN.md)

- **Format:** WebP, Qualität ~82. **Kein** Alphakanal nötig (Vollbild-Grund).
- **Maße:** Hochformat fürs Handy, **1080 × 1920 px** (wird per `cover`
  beschnitten — Rand darf wegfallen, die Mitte muss sitzen).
- **Dateiname & Ablage:** `packages/client/public/hub/**bg-laden.webp**`.
- **Original (PNG, volle Auflösung)** ins Archivrepo `moodsteppi/brauweg-art`
  unter `hub/`, **nicht** ins Code-Repo (`packages/client/art/` ist gitignored).
- Umwandeln mit `~/bildwerkzeug/wandeln.mjs … szene` (Vollbild ohne Alpha).

## Abnahme

- Warmer, gemalter Grund im Stil der Hub-Hintergründe, leicht unscharf.
- **Obere Bildmitte ruhig genug**, dass heller Text und der Pinguin klar
  lesbar bleiben.
- Kein Pinguin, kein Text, kein Balken im Bild. Kein Original unter `public/`.
- Auf dem Handy (Hochformat, `cover`) sitzt die Mitte, Ränder dürfen anschneiden.
