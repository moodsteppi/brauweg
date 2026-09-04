/**
 * Die Wirtschaft: Einkommen, Zins, Serienbonus — und was die drei Knoepfe
 * kosten (kaufen, neu wuerfeln, Level auf).
 *
 * Reine Rechnung ohne Zustand: kein Netz, keine Datenbank, keine Uhr, kein
 * Zufall. Hier liegen ausschliesslich Zahlen und Formeln; wer sie ausgibt,
 * steht in laden.ts.
 *
 * Alle Stellschrauben stehen als Tabelle da und nicht in Bedingungen. Das ist
 * Absicht: Am Balancing wird nach den ersten Partien geschraubt, und eine
 * Zahl in einer Tabelle aendert man ohne Angst — eine Zahl in einer
 * verschachtelten `if`-Kette nicht.
 */

import { type Einheit, einheitVonId } from './einheiten.js';
import { type Exemplar, bausteine } from './verschmelzen.js';

// ---------------------------------------------------------------------------
// Level
// ---------------------------------------------------------------------------

/**
 * Das Spielerlevel, 1 bis 9.
 *
 * Es steht in dieser Datei und nicht in laden.ts oder brett.ts, obwohl beide
 * es brauchen — schlicht, weil es GEKAUFT wird. So bleibt die
 * Abhaengigkeitsrichtung geradeaus (gold -> brett -> laden) und es entsteht
 * kein Kreis zwischen den drei Dateien.
 */
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const HOECHSTES_LEVEL: Level = 9;

/**
 * Mit welchem Level eine Partie beginnt.
 *
 * Nicht 1: Auf Level 1 stuende in der ersten Runde genau eine Einheit auf dem
 * Brett (brett.ts: Plaetze = Level), und der erste Kampf waere ein Muenzwurf
 * ohne jede Entscheidung.
 */
export const STARTLEVEL: Level = 2;

/** Startgold. Reicht fuer zwei Einheiten der ersten Stufe und einen Wurf. */
export const STARTGOLD = 3;

/**
 * Was der Schritt AUF das genannte Level kostet.
 *
 * Level 1 fehlt, weil dorthin niemand aufsteigt. Die Kurve zieht bewusst ab
 * Level 6 an: Bis dahin soll Aufsteigen die normale Antwort sein, danach eine
 * Entscheidung gegen das Wuerfeln nach starken Einheiten.
 */
export const PREIS_LEVEL_AUF: Readonly<Record<Exclude<Level, 1>, number>> = {
  2: 2,
  3: 4,
  4: 6,
  5: 10,
  6: 14,
  7: 20,
  8: 26,
  9: 34,
};

/** Was es kostet, von `level` aus aufzusteigen. `null` auf dem hoechsten Level. */
export function preisLevelAuf(level: Level): number | null {
  if (level >= HOECHSTES_LEVEL) return null;
  return PREIS_LEVEL_AUF[(level + 1) as Exclude<Level, 1>];
}

// ---------------------------------------------------------------------------
// Preise
// ---------------------------------------------------------------------------

/** Ein Wurf im Laden. Zwei Gold — teuer genug, dass Wuerfeln eine Entscheidung bleibt. */
export const PREIS_NEU_WUERFELN = 2;

/** Eine Einheit aus dem Laden kostet ihre Kostenstufe. */
export function preisKaufen(einheit: Einheit): number {
  return einheit.kosten;
}

/** Dasselbe ueber die Kennung — wirft bei unbekannter Einheit. */
export function preisKaufenVonId(id: string): number {
  return preisKaufen(einheitVonId(id));
}

/**
 * Was ein Exemplar beim Verkauf einbringt: genau das, was es gekostet hat.
 *
 * Eine Stufe-2-Einheit besteht aus drei Karten, bringt also das Dreifache.
 * Voller Gegenwert ist Absicht und erzeugt trotzdem kein Gold aus dem Nichts:
 * Gekauft wurde derselbe Betrag. Der wirkliche Preis des Verkaufens steht
 * woanders — die Karten gehen zurueck in den gemeinsamen Vorrat, wo jeder
 * andere sie ziehen kann.
 */
export function verkaufsWert(exemplar: Exemplar): number {
  return einheitVonId(exemplar.einheitId).kosten * bausteine(exemplar.stufe);
}

// ---------------------------------------------------------------------------
// Einkommen
// ---------------------------------------------------------------------------

/** Grundeinkommen je Runde, unabhaengig von allem anderen. */
export const GRUNDEINKOMMEN = 5;

/** Je volle zehn Gold auf der Hand ein Gold Zins ... */
export const ZINS_JE = 10;

/** ... und bei fuenf ist Schluss, sonst gewinnt Sparen von allein. */
export const ZINS_HOECHSTENS = 5;

/**
 * Zins auf das Ersparte: 1 Gold je volle 10, hoechstens 5.
 *
 * Ohne Deckel waere die beste Antwort auf jede Lage "nichts kaufen": Bei 100
 * Gold kaemen 10 je Runde dazu, und wer einmal vorn liegt, bliebe es.
 */
export function zins(gold: number): number {
  if (gold <= 0) return 0;
  return Math.min(ZINS_HOECHSTENS, Math.floor(gold / ZINS_JE));
}

/**
 * Der Serienbonus, als Staffel und nicht als Formel.
 *
 * `ab` ist die Laenge der Serie, `gold` der Zuschlag. Gelesen wird von unten
 * nach oben: die letzte passende Zeile gilt.
 */
export const SERIEN_STAFFEL: readonly { readonly ab: number; readonly gold: number }[] = [
  { ab: 2, gold: 1 },
  { ab: 4, gold: 2 },
  { ab: 6, gold: 3 },
];

/**
 * Bonus fuer eine Serie. Positiv sind Siege, negativ Niederlagen, 0 ist keine
 * Serie.
 *
 * Siege und Niederlagen bringen ausdruecklich DASSELBE. Das sieht falsch aus,
 * ist aber der Kern: Wer verliert, soll aufholen koennen, ohne dass jemand
 * ihm etwas schenkt — und wer absichtlich verliert, zahlt dafuer mit Leben.
 * Ein signierter Zaehler statt eines Objekts, weil er so ohne Umweg durch
 * JSON in den Partiezustand passt.
 */
export function serienBonus(serie: number): number {
  const laenge = Math.abs(serie);
  let bonus = 0;
  for (const stufe of SERIEN_STAFFEL) {
    if (laenge >= stufe.ab) bonus = stufe.gold;
  }
  return bonus;
}

/** Die Aufschluesselung des Rundeneinkommens — die Oberflaeche zeigt sie einzeln an. */
export interface Einkommen {
  readonly grund: number;
  readonly zins: number;
  readonly serie: number;
  readonly gesamt: number;
}

/**
 * Das Einkommen einer Runde.
 *
 * Aufgeschluesselt und nicht als eine Zahl, weil die Oberflaeche "5 + 2 Zins
 * + 1 Serie" anzeigen soll. Wer nur die Summe sieht, versteht das
 * Zins-System nie — und dann spielt er es auch nicht.
 */
export function einkommen(gold: number, serie: number): Einkommen {
  const grund = GRUNDEINKOMMEN;
  const zinsen = zins(gold);
  const bonus = serienBonus(serie);
  return { grund, zins: zinsen, serie: bonus, gesamt: grund + zinsen + bonus };
}

/**
 * Die Serie nach einem Kampf fortschreiben.
 *
 * Ein Wechsel setzt auf 1 bzw. -1 und nicht auf 0: Die neue Serie hat mit
 * diesem Kampf ja schon begonnen.
 */
export function serieNach(serie: number, gewonnen: boolean): number {
  if (gewonnen) return serie >= 0 ? serie + 1 : 1;
  return serie <= 0 ? serie - 1 : -1;
}

/** Reicht das Gold? Getrennt von der Zahlung, damit die Oberflaeche Knoepfe ausgrauen kann. */
export function kannZahlen(gold: number, preis: number): boolean {
  return gold >= preis;
}

/**
 * Zahlt und wirft, wenn das Gold nicht reicht.
 *
 * Kein "dann eben nichts abziehen": Ein Kauf ohne Deckung waere ein stiller
 * Regelbruch, und der faellt erst auf, wenn jemand mit 30 Einheiten dasteht.
 */
export function zahle(gold: number, preis: number): number {
  if (!kannZahlen(gold, preis)) throw new Error(`Zu wenig Gold: ${gold} < ${preis}`);
  return gold - preis;
}
