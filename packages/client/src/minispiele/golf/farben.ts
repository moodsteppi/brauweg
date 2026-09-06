/**
 * Die acht Ballfarben von Golf — an EINER Stelle, weil sie an vier gebraucht
 * werden: in der Lobby (Golfball je Spieler), im HUD (Chips), auf der Leinwand
 * (Bälle, Konfetti) und im Banner der Spielauswahl. Dieselbe Bauart wie
 * minispiele/filler/farben.ts.
 *
 * Die Reihenfolge ist Anzeige, nicht Protokoll: Über die Leitung geht kein
 * Farbwert, sondern nur der Sitz. Wer hier eine Farbe tauscht, färbt trotzdem
 * für alle um — auf jedem Gerät gleich, weil jedes dieselbe Tabelle liest.
 */

export const FARBEN = [
  '#e63946', // 0 rot
  '#1d9bf0', // 1 blau
  '#2ec27e', // 2 grün
  '#f4b400', // 3 gelb
  '#9b5de5', // 4 lila
  '#ff8c42', // 5 orange
  '#00bcd4', // 6 türkis
  '#f06292', // 7 rosa
] as const;

/**
 * Farbe eines Sitzes. Mehr als acht Sitze gibt es nicht (`seatCounts` des
 * Moduls endet bei 8) — der Rest-Operator ist trotzdem da, weil ein
 * Bildschirm, der bei einem unerwarteten Sitz `undefined` in ein
 * `fillStyle` schreibt, nicht abstürzt, sondern still schwarz malt.
 */
export function farbeVon(sitz: number): string {
  return FARBEN[((sitz % FARBEN.length) + FARBEN.length) % FARBEN.length];
}

/**
 * Dunklere Fassung derselben Farbe, für Schatten und Ränder.
 *
 * Gerechnet statt als zweite Tabelle gepflegt: Zwei Listen, die man von Hand
 * gleich halten muss, laufen beim ersten Farbwechsel auseinander.
 */
export function dunkler(farbe: string, anteil = 0.35): string {
  const zahl = Number.parseInt(farbe.slice(1), 16);
  const r = Math.round(((zahl >> 16) & 255) * (1 - anteil));
  const g = Math.round(((zahl >> 8) & 255) * (1 - anteil));
  const b = Math.round((zahl & 255) * (1 - anteil));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Hellere Fassung — für Glanzlichter auf dem Ball. */
export function heller(farbe: string, anteil = 0.45): string {
  const zahl = Number.parseInt(farbe.slice(1), 16);
  const r = Math.round(((zahl >> 16) & 255) + (255 - ((zahl >> 16) & 255)) * anteil);
  const g = Math.round(((zahl >> 8) & 255) + (255 - ((zahl >> 8) & 255)) * anteil);
  const b = Math.round((zahl & 255) + (255 - (zahl & 255)) * anteil);
  return `rgb(${r}, ${g}, ${b})`;
}
