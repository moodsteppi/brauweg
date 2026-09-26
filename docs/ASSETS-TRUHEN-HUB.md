# Bildbestellung: Bronze- und Diamanttruhe fürs neue Hub

Das neue Hub „Nachtblau & Gold" (DESIGN.md, Abschnitt „Das neue Hub") zeigt
gemalte Truhen: `truhe-holz`, `truhe-silber`, `truhe-gold`, `truhe-gold-offen`
unter `packages/client/public/hub/`. Für **Bronze** und **Diamant** fehlten
Bilder; bis zu dieser Lieferung standen dort Holz bzw. die offene Goldtruhe.

Bestellt am 26.09.2026 bei ChatGPT (GPT Image), im selben Chat wie Vorlage die
drei vorhandenen Truhen.

## Verbindlich

- **Gleicher Satz wie die vorhandenen:** Perspektive, Größe im Bild, Licht von
  links oben, Sättigung.
- **Echter Alphakanal**, kein Schachbrett, kein weißer Grund. Probe: Ecke
  `alpha = 0`, auf Rot und Weiß ohne Saum.
- **Kräftige Formen**: angezeigt wird mit 40–56 pt.
- **Nicht ins Bild:** Schrift, Zahlen, Münzen außerhalb der Truhe, Rahmen.
- **Größe:** Original 1024er PNG ins Archiv `brauweg-art/hub-nachtblau/`;
  ausgeliefert als WebP 200 px breit (dreifache Anzeigegröße), gewandelt mit
  `wandeln.mjs … wappen`.

| Datei | Motiv |
| --- | --- |
| `truhe-bronze.webp` | Bronzetruhe, geschlossen: warmes Bronze- und Kupfermetall mit Nieten, zwischen Holz und Silber in der Wertigkeit, kleines Schloss vorne |
| `truhe-diamant.webp` | Diamanttruhe, geschlossen: dunkles Nachtblau-Metall mit Gold, darin eingelassene hellblaue Diamanten, leichtes Leuchten; wertvollste der Reihe |
