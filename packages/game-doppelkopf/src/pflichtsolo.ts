/**
 * Pflichtsolo.
 *
 * Genau ein Pflichtsolo pro Spieler pro Partie. Das ERSTE von einem Spieler
 * angesagte Solo ist automatisch sein Pflichtsolo, inklusive Aufspiel. Jedes
 * weitere Solo desselben Spielers ist ein Lustsolo. Wer bereits ein Solo
 * gespielt hat, wird nie vorgefuehrt.
 */

import type { RuleSet } from './ruleset.js';

export type SoloRole = 'pflicht' | 'lust';

export class PflichtsoloState {
  private played = new Set<number>();

  constructor(
    private readonly rs: RuleSet,
    private readonly seats: readonly number[],
  ) {}

  /** Sitze mit noch offenem Pflichtsolo. */
  open(): number[] {
    if (!this.rs.pflichtsolo) return [];
    return this.seats.filter((s) => !this.played.has(s));
  }

  hasPlayedSolo(seat: number): boolean {
    return this.played.has(seat);
  }

  /** Rolle des Solos, das dieser Spieler jetzt ansagt. */
  roleFor(seat: number): SoloRole {
    if (!this.rs.pflichtsolo) return 'lust';
    return this.played.has(seat) ? 'lust' : 'pflicht';
  }

  /** Spielt der Solist aus? Pflichtsolo hat IMMER Aufspiel. */
  leadsOut(seat: number): boolean {
    return this.roleFor(seat) === 'pflicht' ? true : this.rs.soloLeadsOut;
  }

  register(seat: number): void {
    this.played.add(seat);
  }

  /**
   * Vorfuehr-Regel: Ist die Anzahl der verbleibenden Runden (einschliesslich
   * der aktuellen) gleich der Anzahl der Spieler mit offenem Pflichtsolo, wird
   * vorgefuehrt.
   *
   * Reihenfolge bei mehreren Vorgefuehrten: nach Sitzreihenfolge ab Vorhand.
   * Zurueckgegeben wird der Sitz, der in DIESER Runde vorgefuehrt wird.
   */
  forcedSeat(remainingRounds: number, vorhandSeat: number): number | null {
    if (!this.rs.pflichtsolo) return null;
    const open = this.open();
    if (open.length === 0) return null;
    if (remainingRounds > open.length) return null;

    const n = this.seats.length;
    const start = this.seats.indexOf(vorhandSeat);
    for (let i = 0; i < n; i++) {
      const seat = this.seats[(start + i) % n];
      if (open.includes(seat)) return seat;
    }
    return null;
  }
}
