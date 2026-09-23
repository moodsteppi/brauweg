/**
 * Die Farben von Filler — an EINER Stelle, weil sie an drei gebraucht werden:
 * auf dem Brett (screens/Filler.tsx), im Banner der Spielauswahl (Banner.tsx)
 * und, abgeschrieben, im Zeichenskript fuer das stehende Banner
 * (scripts/filler-banner-zeichnen.py). Wer hier etwas aendert, laesst das
 * Skript neu laufen. Dieselbe Bauart wie minispiele/eiland/farben.ts.
 */

import type { Variante } from './sicht';

/**
 * Die sechs Farben des Vorbilds, in dieser REIHENFOLGE — plus eine siebte
 * (Orange), die nur die Spielart Extreme benutzt. Die anderen Spielarten
 * zaehlen bis sechs und sehen sie nie.
 *
 * Wie viele Farben es je Spielart gibt, entscheidet das Modul
 * (FARBEN_JE_SPIELART in packages/game-filler/src/regeln.ts). Ein Eintrag
 * weniger hier, und src/vertrag/filler.test.ts wird rot — sonst zeichnete
 * `farbeVon` die fehlende Farbe still als Rot.
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
  '#ff8c2a', // 6 Orange — nur in Extreme (sieben Farben)
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

/**
 * Wie viele Farben eine Spielart hat — gelesen aus der Vorgabe des Moduls,
 * fuer die Farbtupfer und das Vorschaubrett im Menue.
 *
 * BIS ZUM 23.09.2026 stand die Sieben fuer Extreme hier im Client und ging
 * mit jedem neuen Tisch als `farben` an den Server — sie ueberstimmte das
 * Modul, und niemand haette es gemerkt, wenn dort die Zahl anders
 * geschnitten wuerde. Jetzt traegt die Vorgabe `farbenJeSpielart`, und der
 * Bildschirm schickt gar keine Farbzahl mehr mit. Eine ausdrueckliche
 * `farben` in der Vorgabe gilt zuerst, wie im Modul (`farbzahl`).
 *
 * Die Sechs ist der Notnagel, solange die Antwort des Servers noch unterwegs
 * ist: die Farben des Vorbilds, also alles ausser dem Orange. Ob die Palette
 * fuer die Zahlen des Moduls reicht, prueft src/vertrag/filler.test.ts.
 */
export function farbzahlAus(vorgabe: Record<string, unknown> | null, variante: Variante): number {
  const fest = vorgabe?.['farben'];
  if (typeof fest === 'number') return fest;
  const tabelle = vorgabe?.['farbenJeSpielart'];
  const wert =
    typeof tabelle === 'object' && tabelle !== null
      ? (tabelle as Record<string, unknown>)[variante]
      : undefined;
  return typeof wert === 'number' ? wert : FARBEN.length - 1;
}
