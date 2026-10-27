# Bildbestellung: Ladebild für den App-Start

Der Start der App im neuen Hub (Robin, 26.09.2026, nach dem Vorbild von
Supercell und Clash Royale) hat **zwei Bildschirme nacheinander**: kurz das
Brauweg-Logo auf dunklem Grund, dann ein gemaltes Ladebild mit dem Logo oben
und einer Ladeleiste mit Prozentzahl unten (`screens/Startbildschirm.tsx`).
Dieses Ladebild ist hier bestellt. Der alte Ladescreen („Einen Moment…",
`ASSETS-LADESCREEN.md`) bleibt für das alte Hub und für Nachladen im Betrieb.

Bestellt am 26.09.2026 bei ChatGPT (GPT Image), mit Bildern aus dem neuen Hub
als Vorlage für Stil und Farben.

## Verbindlich

- **Hochformat 2 : 3**, Original 1024 × 1536 PNG. Die App zeigt es unten bündig
  in voller Breite (höchstens 34 rem); darüber läuft es oben in Nachtblau aus.
- **Oben ruhig:** Das obere Viertel ist Himmel ohne Figuren, dort liegt das
  Logo. Die App blendet die obere Kante weich aus, eine harte Linie darf das
  Bild dort nicht haben.
- **Unten ruhig:** Die unteren ~12 % sind dunkler Stein oder Boden, dort liegt
  die Ladeleiste.
- **Nachtblau & Gold** wie im neuen Hub: Nacht, warmes Licht aus Laternen und
  Fenstern, kein Tageslicht.
- **Nicht ins Bild:** Schrift, Logo, Ladebalken, Zahlen, Rahmen. Das zeichnet
  alles die App.

| Datei | Motiv |
| --- | --- |
| `hub/ladebild.webp` | Der Ritter-Pinguin mit Schwert und Sternschild in der Mitte, um ihn die Pinguine der Spiele (Karten mit Zylinder, Golf, Koch mit Pfanne, Partykiste mit Fliegerbrille an einer offenen Truhe); dahinter eine Burg bei Nacht mit Wimpeln |

## Ablage

- Original: `moodsteppi/brauweg-art`, `hub-nachtblau/ladebild.png`
  (brauweg-art#3).
- Ausgeliefert: `packages/client/public/hub/ladebild.webp`, 1024 × 1536,
  gewandelt mit `wandeln.mjs … szene`.
