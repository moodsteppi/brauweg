/**
 * Wer sitzt in welcher Ecke, und in welcher Farbe.
 *
 * Reine Zuordnung, kein React — damit sie sich ohne Bildschirm nachrechnen
 * laesst. Zwei Regeln stecken darin, und beide sind absichtlich verschieden:
 *
 *   - **Die Farbe haengt am SITZ.** Sitz 0 ist blau, Sitz 1 rot, Sitz 2 gelb,
 *     Sitz 3 gruen — auf JEDEM Geraet dasselbe. Wer bei sich blau ist, ist
 *     auch beim Gegner blau. Sonst widerspraeche ein Bildschirmfoto des einen
 *     dem des anderen, und "der Blaue hat das Paar" waere kein Satz mehr,
 *     den zwei Leute im selben Raum sagen koennen.
 *   - **Die Ecke haengt daran, WER ZUSIEHT.** Jeder sieht sich selbst unten
 *     links. Der naechste Sitz sitzt einem gegenueber (oben rechts), erst der
 *     dritte fuellt oben links, der vierte unten rechts. Zu zweit ist das die
 *     Diagonale — der groesstmoegliche Abstand auf einem Handy.
 *
 * Der Sitz ist zugleich die Beitrittsreihenfolge: Die Plattform setzt jeden
 * Neuen auf den kleinsten freien Platz.
 */

export type Spielerfarbe = 'blau' | 'rot' | 'gelb' | 'gruen';

/**
 * Die vier Spielerfarben in der Reihenfolge der Sitze.
 *
 * Mattere Toene, keine Signalfarben: Sie stehen auf einer dunklen
 * Tischdecke, tragen die Punktzahl und faerben die Decke selbst. Ein reines
 * Gelb neben einem reinen Gruen waere auf 24 Karten Laerm.
 */
export const SPIELERFARBEN: readonly Spielerfarbe[] = ['blau', 'rot', 'gelb', 'gruen'];

export function farbeVon(sitz: number): Spielerfarbe {
  return SPIELERFARBEN[sitz] ?? 'blau';
}

/** Unten links, oben rechts, oben links, unten rechts. */
export type Ecke = 'ul' | 'or' | 'ol' | 'ur';

/**
 * In dieser Reihenfolge werden die Ecken belegt, vom eigenen Sitz aus
 * gezaehlt. Nicht im Uhrzeigersinn: Zu zweit soll der Gegner gegenueber
 * sitzen, nicht daneben.
 */
const REIHE: readonly Ecke[] = ['ul', 'or', 'ol', 'ur'];

/**
 * Die Ecke eines Sitzes aus Sicht eines Zuschauenden.
 *
 * Gezaehlt wird ueber die POSITION in der Sitzliste und nicht ueber die
 * Sitznummer: Ein Tisch muss nicht bei 0 anfangen und nicht luecklos sein.
 *
 * `eigenerSitz` ausserhalb der Liste heisst Zuschauer — dann gibt es kein
 * "unten links fuer mich", und die Ecken werden schlicht der Reihe nach
 * vergeben. Sitz 0 sitzt dann unten links, wie fuer ihn selbst.
 */
export function eckeVon(
  sitz: number,
  eigenerSitz: number,
  sitze: readonly number[],
): Ecke {
  const platz = sitze.indexOf(sitz);
  if (platz < 0) return 'ol';
  const ich = sitze.indexOf(eigenerSitz);
  const versatz = ich < 0 ? platz : (platz - ich + sitze.length) % sitze.length;
  return REIHE[versatz] ?? 'ol';
}

/** Die Sitze eines Tisches, aufsteigend. Grundlage der Eckenverteilung. */
export function sitzeAus(punkte: Readonly<Record<number, number>>): number[] {
  return Object.keys(punkte)
    .map(Number)
    .filter((sitz) => Number.isInteger(sitz))
    .sort((a, b) => a - b);
}
