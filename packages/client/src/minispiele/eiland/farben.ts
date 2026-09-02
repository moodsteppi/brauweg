/**
 * Die Farben von Eiland — an EINER Stelle, weil sie an drei gebraucht werden:
 * auf der Karte (Eiland.tsx), im Banner der Spielauswahl (Banner.tsx) und,
 * abgeschrieben, im Zeichenskript fuer das stehende Banner
 * (scripts/eiland-banner-zeichnen.py). Wer hier etwas aendert, laesst das
 * Skript neu laufen.
 */

/**
 * Die Farben der beiden Gebiete, in dieser REIHENFOLGE nach Sitznummer.
 *
 * Warm gegen kalt und nicht zwei Bunttoene: Auf einer Karte aus Gruen und Blau
 * muessen die Gebiete auf den ersten Blick vom Gelaende zu unterscheiden sein,
 * und Rot gegen Violett waere daneben nur "irgendeine Farbe mehr".
 */
export const GEBIET = ['#e2603f', '#7b4fd0'] as const;

/**
 * Die Graustufen des Nebels.
 *
 * Sie muessen zwei Dinge zugleich: sich untereinander unterscheiden (sonst
 * sieht man das Raster nicht mehr) und sich klar vom Gelaende abheben. Deshalb
 * liegen sie alle im mittleren Band, weit weg von Gruen, Blau und Braun.
 *
 * Die Anzahl muss zu GRAUTOENE in packages/game-eiland/src/partie.ts passen.
 */
export const GRAUTOENE = ['#9a9a9a', '#a6a6a6', '#b1b1b1', '#bcbcbc', '#c6c6c6'] as const;

export function gebietsfarbe(sitz: number): string {
  return GEBIET[sitz % GEBIET.length] ?? GEBIET[0];
}

/**
 * Die Tönung eines gewählten Feldes: die eigene Gebietsfarbe, halb
 * durchsichtig über dem Gelände.
 *
 * Als `background-image` und nicht als `background-color`, weil die
 * Geländefarbe aus dem Stylesheet kommt (`[data-art]`) — ein Verlauf aus
 * einer einzigen Farbe legt sich darüber, ohne sie zu ersetzen. So sieht man
 * beides: was das Feld IST und dass es gleich mir gehören soll.
 */
const GEBIET_TON = ['rgba(226, 96, 63, 0.62)', 'rgba(123, 79, 208, 0.62)'] as const;

export function auswahlton(sitz: number): string {
  const ton = GEBIET_TON[sitz % GEBIET_TON.length] ?? GEBIET_TON[0];
  return `linear-gradient(${ton}, ${ton})`;
}
