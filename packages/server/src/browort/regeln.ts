/**
 * Browort: die Regeln als reine Funktionen (Emile, 23.10.2026).
 *
 * Fuenf Buchstaben, sechs Versuche. Jeder Versuch bekommt je Buchstabe eine
 * Farbe: richtig an dieser Stelle, im Wort aber woanders, oder gar nicht im
 * Wort. Hier steht nur Rechnung — keine Datenbank, keine Uhr. So laesst sich
 * jede Lage pruefen, ohne einen Tag zu warten (test/browort.test.ts).
 */

import { LOESUNGEN } from './woerter.js';

export const WORTLAENGE = 5;
export const MAX_VERSUCHE = 6;

/** g = an der richtigen Stelle, v = im Wort, aber woanders, x = nicht im Wort. */
export type Farbe = 'g' | 'v' | 'x';

/**
 * Die Farben eines Versuchs.
 *
 * Zwei Durchgaenge, damit doppelte Buchstaben stimmen: Erst nimmt jeder
 * Treffer an der richtigen Stelle seinen Buchstaben aus dem Vorrat, dann
 * duerfen die uebrigen nur noch, was im Vorrat bleibt. Bei „EBENE" gegen
 * „ESSEN" wird so nur EIN zweites E gelb und nicht drei — genau die Stelle,
 * an der viele Nachbauten falsch zaehlen.
 */
export function farben(versuch: string, loesung: string): Farbe[] {
  const ergebnis: Farbe[] = Array.from({ length: WORTLAENGE }, () => 'x');
  const vorrat = new Map<string, number>();
  for (let i = 0; i < WORTLAENGE; i += 1) {
    if (versuch[i] === loesung[i]) {
      ergebnis[i] = 'g';
    } else {
      vorrat.set(loesung[i]!, (vorrat.get(loesung[i]!) ?? 0) + 1);
    }
  }
  for (let i = 0; i < WORTLAENGE; i += 1) {
    if (ergebnis[i] === 'g') continue;
    const rest = vorrat.get(versuch[i]!) ?? 0;
    if (rest > 0) {
      ergebnis[i] = 'v';
      vorrat.set(versuch[i]!, rest - 1);
    }
  }
  return ergebnis;
}

/** Kleiner, fester Zufall aus einer Zahl (mulberry32) — gleiche Saat, gleiche Folge. */
function zufall(saat: number): () => number {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (const zeichen of text) {
    h ^= zeichen.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Erster Tag des Kalenders. Davor gibt es kein Browort. */
export const START_TAG = '2026-10-23';

/**
 * Das Tageswort.
 *
 * Die Loesungsliste wird EINMAL mit einer festen Saat gemischt und dann Tag
 * fuer Tag abgelaufen — so kommt kein Wort wieder, bevor alle dran waren,
 * und jeder bekommt am selben Tag dasselbe Wort. Das `salz` (Umgebung
 * BROWORT_SALZ) mischt mit: Die Liste steht im Repo, und ohne Salz liesse
 * sich der Kalender daraus nachrechnen.
 */
export function tageswort(tag: string, salz: string, liste: readonly string[] = LOESUNGEN): string {
  const gemischt = [...liste];
  const naechste = zufall(hash(`browort:${salz}`));
  for (let i = gemischt.length - 1; i > 0; i -= 1) {
    const j = Math.floor(naechste() * (i + 1));
    [gemischt[i], gemischt[j]] = [gemischt[j]!, gemischt[i]!];
  }
  const tage = Math.round((Date.parse(`${tag}T00:00:00Z`) - Date.parse(`${START_TAG}T00:00:00Z`)) / 86_400_000);
  const stelle = ((tage % gemischt.length) + gemischt.length) % gemischt.length;
  return gemischt[stelle]!;
}

/**
 * Belohnung fuers Loesen: weniger Versuche, mehr Muenzen. Index = Versuche - 1.
 * Erraten in sechs gibt noch etwas — auch knapp geschafft ist geschafft.
 */
export const MUENZEN_BROWORT: readonly number[] = [60, 50, 40, 30, 25, 20];
export const XP_BROWORT: readonly number[] = [40, 35, 30, 25, 20, 15];
/** Das Clanwort zahlt etwas weniger: Der Reiz ist dort die Rangliste. */
export const MUENZEN_CLANWORT: readonly number[] = [40, 35, 30, 25, 20, 15];
export const XP_CLANWORT: readonly number[] = [25, 20, 20, 15, 15, 10];

/** Schnitt der Versuche bei geloesten Woertern, eine Nachkommastelle; null ohne Loesung. */
export function schnitt(versucheSumme: number, geloest: number): number | null {
  if (geloest <= 0) return null;
  return Math.round((versucheSumme / geloest) * 10) / 10;
}
