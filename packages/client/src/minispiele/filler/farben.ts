/**
 * Die Farben von Filler — an EINER Stelle, weil sie an drei gebraucht werden:
 * auf dem Brett (screens/Filler.tsx), im Banner der Spielauswahl (Banner.tsx)
 * und, abgeschrieben, im Zeichenskript fuer das stehende Banner
 * (scripts/filler-banner-zeichnen.py). Wer hier etwas aendert, laesst das
 * Skript neu laufen. Dieselbe Bauart wie minispiele/eiland/farben.ts.
 */

/**
 * Die sechs Farben des Vorbilds, in dieser REIHENFOLGE.
 *
 * Die Reihenfolge ist Protokoll: Ueber die Leitung geht nur die Nummer. Wer
 * hier etwas einschiebt, faerbt jede laufende Partie um — und zwar auf beiden
 * Geraeten verschieden, solange nur eines neu geladen hat.
 */
export const FARBEN = [
  '#f5325a', // 0 Rot
  '#92d84e', // 1 Gruen
  '#fed42a', // 2 Gelb
  '#35b4f0', // 3 Blau
  '#6b4fb5', // 4 Lila
  '#3c3c3c', // 5 Dunkelgrau
] as const;

/**
 * Die Graustufen des Nebels.
 *
 * Sie muessen zwei Dinge zugleich: sich untereinander unterscheiden (sonst
 * saehe man das Raster nicht mehr) und sich klar vom dunklen Spielgrau
 * abheben (sonst haelt man ein verdecktes Feld fuer ein besetztes). Deshalb
 * liegen sie alle im mittleren Band — dunkler als der Hintergrund, viel
 * heller als `#3c3c3c`.
 *
 * Die Anzahl muss zu GRAUTOENE in packages/game-filler/src/partie.ts passen.
 */
export const GRAUTOENE = ['#949494', '#a3a3a3', '#b2b2b2', '#c0c0c0', '#cbcbcb'] as const;

export function farbeVon(nr: number): string {
  return FARBEN[nr] ?? FARBEN[0];
}
