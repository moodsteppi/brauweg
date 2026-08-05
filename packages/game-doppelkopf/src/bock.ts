/**
 * Bockrunden.
 *
 * Verbindliches Modell: Jeder Ausloeser erzeugt ein eigenes Fenster von
 * bockWindowLength Runden, beginnend mit der FOLGERUNDE. Der Multiplikator
 * einer Runde ist bockFactor hoch der Anzahl der auf sie ueberlappenden
 * Fenster. Kein Limit.
 *
 * Bockrunden verlaengern eine Partie nie. Reicht die Rundenzahl nicht aus,
 * endet die Partie regulaer und der Rest verfaellt.
 */

import type { RuleSet } from './ruleset.js';

export interface BockWindow {
  /** Erste betroffene Runde (0-basiert). */
  readonly from: number;
  /** Letzte betroffene Runde, inklusive. */
  readonly to: number;
}

export class BockState {
  private windows: BockWindow[] = [];

  constructor(private readonly rs: RuleSet) {}

  /**
   * Stellt die Fenster aus einem Snapshot wieder her.
   *
   * Noetig fuer die Persistenz: Die Fenster lassen sich NICHT aus der
   * Rundenhistorie rekonstruieren, weil ein Schmeissen mit Neugabe ein Fenster
   * oeffnet, ohne eine gewertete Runde und damit ohne Historieneintrag zu
   * hinterlassen.
   */
  static restore(rs: RuleSet, windows: readonly BockWindow[]): BockState {
    const state = new BockState(rs);
    state.windows = windows.map((w) => ({ from: w.from, to: w.to }));
    return state;
  }

  /** Registriert einen Ausloeser, der in Runde `roundIndex` aufgetreten ist. */
  trigger(roundIndex: number): void {
    if (!this.rs.bock) return;
    this.windows.push({
      from: roundIndex + 1,
      to: roundIndex + this.rs.bockWindowLength,
    });
  }

  /** Anzahl der auf eine Runde ueberlappenden Fenster. */
  depth(roundIndex: number): number {
    return this.windows.filter((w) => roundIndex >= w.from && roundIndex <= w.to)
      .length;
  }

  /** Multiplikator der Runde. 1, wenn kein Fenster greift. */
  multiplier(roundIndex: number): number {
    return Math.pow(this.rs.bockFactor, this.depth(roundIndex));
  }

  snapshot(): readonly BockWindow[] {
    return [...this.windows];
  }
}
