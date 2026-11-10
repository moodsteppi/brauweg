# Bro Building Battle: Vorrat, Fähigkeiten und Tasten

## Gestaltungsauftrag

Eigene Vektorsymbole in der bestehenden nachtblauen Pinguin-Werkstatt.
Brassfarbene Beschläge, erkennbare Materialkanten, sparsame Lichtpunkte.
Funktionstext als HTML neben dem Motiv, nie im Bild. Keine fremden Spielassets.

| Motiv | Symbol und Farbe | Einsatz |
| --- | --- | --- |
| Turmanker | Anker, Mint | Inventar, Aktivierung, aktiver Schutz |
| Wolkensteg | Plattform mit Streben, warmes Gold | Inventar, Platziermodus |
| Steinsiegel | Facettierter Stein, Lavendel | Inventar, nächster Stein |
| Schwergewicht | Massives Gewicht, Kupfer | Inventar, Zielauswahl |
| Eisglätte | Schneekristall, Eisblau | Inventar, nächster Stein |
| Nachschub | Vierstrahliger Funke, gedämpftes Blau | Leerer Itemplatz |
| Bautasten | Links, rechts, Drehpfeil, Fallpfeil | Stets mit Text; Drehen mint, Fallen gold |
| Platzieren | Vier Richtungen, Haken, Zurück | Bautasten im Platziermodus ersetzen |

## Maße, Freiräume und Abnahme

- Symbolraster 24 × 24, Linienbreite 1,7–1,8; mindestens 2 Einheiten Rand.
- Emblem 46 × 46, Symbol 28 × 28; Beschläge außerhalb der Symbolfläche.
- Vorratplatz 68 × 92, Handy bis 72 px breit; schmale Mehrspielerbahnen 54 px.
- Bautasten mindestens 72 px hoch, mindestens 42 px bei Zielauswahl.
- Alle Aktionen haben sichtbare Namen und Tastaturfokus. Farbe allein reicht nicht.
- Neue Items einmalig weich einblenden; reduzierte Bewegung respektieren.
- Körpertexturen einmal pro Material erzeugen und für alle Spieler wiederverwenden.
- Keine eingebrannten Texte, kein Schachbrett als Transparenzersatz, keine
  hochauflösenden Originale unter `public/`, keine unbenutzten Bitmapdateien.

## Lieferung / Herkunft

Am 10.11.2026 als eigene SVG-Pfade (`BroIcon.tsx`), CSS-Embleme (`vorrat.css`)
und gecachte Canvas-Materialien (`zeichnen.ts`) umgesetzt. Keine generierten
Rasteroriginale, kein zusätzlicher Bilddownload. Plattform mit goldenen
Streben und mintfarbenem Stein; Eis mit Kristallmarkierung; Stein mit Fugen.
Bestehende Pinguin- und Weltgrafiken bleiben die gestalterische Referenz.
