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
 * Zwei `#rrggbb`-Farben zur Mitte gemischt, kanalweise.
 *
 * Kein `color-mix()`: Das Ergebnis geht als Inline-Stil in einen Verlauf,
 * und dort muss es ein fertiger Wert sein — ein Verlauf mit `color-mix`
 * darin faellt auf aelteren Safari-Staenden lautlos aus, und dann hat der
 * Einschlag gar keine Farbe.
 */
export function mischfarbe(a: string, b: string): string {
  const kanal = (hex: string, i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  const hex2 = (n: number): string => Math.round(n).toString(16).padStart(2, '0');
  return `#${[0, 1, 2].map((i) => hex2((kanal(a, i) + kanal(b, i)) / 2)).join('')}`;
}

/**
 * So viele Stufen hat ein Feld hoechstens: acht Felder im Umfeld. Muss zu
 * STUFEN_MAX in packages/game-eiland/src/karte.ts passen.
 */
export const STUFEN_MAX = 8;

/**
 * Das Gold der Heimat — die Startecke, um die es geht. Nicht das Gelb des
 * gewaehlten Feldes (#ffd245): Das eine ist ein Rahmen fuer eine Sekunde, das
 * andere steht die ganze Partie, und beide liegen im selben Feld, wenn man
 * die fremde Heimat angreift.
 */
export const GOLD = '#e4b23c';

/**
 * Die Helligkeit der Stufenleiter, von Stufe 0 (blass) bis STUFEN_MAX (tief),
 * in Prozent. Ein Farbton, neun Helligkeiten: Die Stufe eines Feldes soll man
 * am Ton ablesen, und derselbe Ton bei beiden Spielern soll dieselbe Stufe
 * heissen — deshalb steht die Leiter HIER und nicht je Gebietsfarbe. Sieben
 * Prozent je Schritt sind auf dem Handy gerade noch als Schritt erkennbar;
 * die Zahl im Feld ist fuer den Fall, dass sie es nicht sind.
 */
const HELL_STUFE_0 = 82;
const HELL_STUFE_MAX = 26;

/**
 * Die Farbe eines besetzten Feldes: die Gebietsfarbe des Sitzes in der
 * Helligkeit seiner Stufe. Farbton und Saettigung bleiben, damit Orange
 * Orange und Violett Violett bleibt — nur wie tief es liegt, sagt die Stufe.
 */
export function stufenfarbe(sitz: number, stufe: number): string {
  const [h, s] = hsl(gebietsfarbe(sitz));
  const t = Math.min(STUFEN_MAX, Math.max(0, stufe)) / STUFEN_MAX;
  const l = HELL_STUFE_0 + (HELL_STUFE_MAX - HELL_STUFE_0) * t;
  return hex(h, s, l);
}

/** `#rrggbb` nach Farbton (0–360), Saettigung und Helligkeit (0–100). */
function hsl(farbe: string): [number, number, number] {
  const kanal = (i: number): number => (parseInt(farbe.slice(1 + i * 2, 3 + i * 2), 16) || 0) / 255;
  const r = kanal(0);
  const g = kanal(1);
  const b = kanal(2);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

/** Farbton, Saettigung, Helligkeit zurueck nach `#rrggbb`. */
function hex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const hell = l / 100;
  const c = (1 - Math.abs(2 * hell - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = hell - c / 2;
  const sechstel = Math.floor(h / 60) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sechstel] ?? [0, 0, 0];
  const hex2 = (n: number): string =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex2(r!)}${hex2(g!)}${hex2(b!)}`;
}

/**
 * Die Farbe eines Einschlags: die Gebietsfarbe dessen, der den Einsatz
 * gezahlt hat — zahlen beide, die Mischung. Das ist die Auskunft am Feld:
 * einfarbig heisst „einer hat gesetzt und sicher gewonnen", gemischt heisst
 * „beide haben gesetzt, die Muenze hat entschieden". Ohne Zahler gibt es
 * keinen Einschlag; Weiss ist nur der Rueckfall, damit nie ein leerer
 * Farbwert im Stil landet.
 */
export function kampffarbe(einsatz: readonly number[]): string {
  const [erster, ...weitere] = einsatz;
  if (erster === undefined) return '#ffffff';
  return weitere.reduce((bisher, sitz) => mischfarbe(bisher, gebietsfarbe(sitz)), gebietsfarbe(erster));
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
