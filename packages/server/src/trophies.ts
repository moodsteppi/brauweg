/**
 * Trophaeen.
 *
 * Bewusst hier und nicht im Spielmodul: Ein Modul liefert nur Platzierungen,
 * die Wertung rechnet die Plattform. Genau deshalb funktioniert eine
 * spieluebergreifende Rangliste, ohne dass ein Spiel etwas davon weiss.
 *
 * Trophaeen entstehen aus der Platzierung ueber die gesamte Partie, nie aus
 * Spielpunkten. Andernfalls wuerde ein Tisch mit hohen Multiplikatoren zur
 * Trophaeenfarm, und man suchte den varianzreichsten Regelsatz statt der
 * besten Gegner.
 */

/**
 * Die Werte sind so gewaehlt, dass die Mittelwertbildung bei Gleichstand
 * ganzzahlig bleibt: Jede zusammenhaengende Platzgruppe hat eine durch ihre
 * Groesse teilbare Summe.
 */
export const PLACEMENT_TROPHIES: Readonly<Record<number, readonly number[]>> = {
  3: [6, 0, -6],
  4: [9, 3, -3, -9],
  5: [12, 6, 0, -6, -12],
};

export const LEAVE_PENALTY = -10;

export interface Placement {
  readonly seat: number;
  /** 1 = bester Platz. Gleichstand vergibt denselben Rang mehrfach. */
  readonly place: number;
  readonly left: boolean;
}

export interface TrophyAward {
  readonly seat: number;
  readonly delta: number;
  readonly reason: 'party_result' | 'leave_penalty';
}

/**
 * Verteilt die Trophaeen einer Partie.
 *
 * Bei Gleichstand teilen sich die Beteiligten den Mittelwert der betroffenen
 * Plaetze. Das erhaelt die Nullsumme der Grundverteilung; die Verlassen-Strafe
 * kommt bewusst obendrauf und durchbricht sie.
 */
export function awardForParty(placements: readonly Placement[]): TrophyAward[] {
  const scale = PLACEMENT_TROPHIES[placements.length];
  if (!scale) throw new Error(`keine Trophaeenverteilung fuer ${placements.length} Sitze`);

  const awards: TrophyAward[] = [];

  for (const p of placements) {
    // Alle mit derselben Platzziffer teilen sich die Werte der Plaetze, die
    // sie gemeinsam belegen.
    const tied = placements.filter((o) => o.place === p.place);
    const from = p.place - 1;
    const share =
      tied.reduce((sum, _, i) => sum + (scale[from + i] ?? 0), 0) / tied.length;

    awards.push({ seat: p.seat, delta: share, reason: 'party_result' });
    if (p.left) {
      awards.push({ seat: p.seat, delta: LEAVE_PENALTY, reason: 'leave_penalty' });
    }
  }

  return awards;
}

/**
 * Checkpoints alle 100 bis 1000, danach in 250er-Schritten.
 *
 * Der hoechste erreichte Checkpoint ist die Untergrenze fuer kuenftige
 * Verluste. Das bricht die Nullsumme und erzeugt Inflation — bewusst
 * akzeptiert, weil ein Absturz unter eine einmal erreichte Marke Spieler
 * verlaesslich vertreibt.
 */
export function checkpointFor(trophies: number): number {
  if (trophies < 100) return 0;
  if (trophies <= 1000) return Math.floor(trophies / 100) * 100;
  return Math.min(Math.floor(trophies / 250) * 250, 1_000_000);
}

export interface StatUpdate {
  readonly trophies: number;
  readonly highestCheckpoint: number;
}

/**
 * Wendet eine Buchung auf den Stand eines Kontos an.
 *
 * `breaksProtection` gilt fuer die Verlassen-Strafe: Sie ist die einzige
 * Buchung, die unter den erreichten Checkpoint drueckt.
 */
export function applyDelta(
  current: StatUpdate,
  delta: number,
  breaksProtection = false,
): StatUpdate {
  const raw = current.trophies + delta;
  const floor = breaksProtection ? 0 : Math.max(0, current.highestCheckpoint);
  const trophies = Math.max(floor, raw, 0);

  return {
    trophies,
    highestCheckpoint: Math.max(current.highestCheckpoint, checkpointFor(trophies)),
  };
}
