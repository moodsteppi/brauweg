/**
 * Hochzeit.
 *
 * Die Braut haelt beide Kreuz-Damen.
 *
 * Angesagte Hochzeit: Partner wird der erste Spieler, der einen Stich gewinnt,
 * den nicht die Braut macht. Die Klaerungsfrist umfasst die ersten
 * `hochzeitClarifyTricks` Stiche. Klaert sich bis dahin niemand, wird das
 * Spiel zum Solo, die Braut spielt allein.
 *
 * Stille Hochzeit: Die Braut sagt nichts an und spielt von Anfang an allein.
 * Sie wird wie ein Solo gewertet und erfuellt das Pflichtsolo, hat aber KEIN
 * Aufspiel, weil sie eben still ist.
 */

import { type Card, isClubQueen } from './cards.js';
import type { RuleSet } from './ruleset.js';
import type { TrickRecord } from './scoring.js';

export function isBride(hand: readonly Card[]): boolean {
  return hand.filter(isClubQueen).length === 2;
}

export interface HochzeitOutcome {
  /** Sitz des geklaerten Partners, null wenn ungeklaert. */
  readonly partnerSeat: number | null;
  /** Ungeklaert nach Ablauf der Frist: die Braut spielt allein. */
  readonly becameSolo: boolean;
  /** Index des klaerenden Stichs, null wenn ungeklaert. */
  readonly clarifiedAtTrick: number | null;
}

export function resolveHochzeit(
  tricks: readonly TrickRecord[],
  brideSeat: number,
  rs: RuleSet,
): HochzeitOutcome {
  const limit = Math.min(rs.hochzeitClarifyTricks, tricks.length);

  for (let i = 0; i < limit; i++) {
    if (tricks[i].winnerSeat !== brideSeat) {
      return {
        partnerSeat: tricks[i].winnerSeat,
        becameSolo: false,
        clarifiedAtTrick: i,
      };
    }
  }

  return { partnerSeat: null, becameSolo: true, clarifiedAtTrick: null };
}

/** Re-Partei einer Hochzeit, abhaengig vom Klaerungsergebnis. */
export function hochzeitReSeats(
  brideSeat: number,
  outcome: HochzeitOutcome,
): number[] {
  return outcome.partnerSeat === null
    ? [brideSeat]
    : [brideSeat, outcome.partnerSeat];
}

export interface StilleHochzeit {
  readonly seat: number;
  /** Wird wie ein Solo abgerechnet. */
  readonly scoresAsSolo: true;
  /** Erfuellt das Pflichtsolo. */
  readonly fulfillsPflichtsolo: true;
  /** Kein Aufspiel, die Hochzeit ist ja still. */
  readonly leadsOut: false;
}

export function stilleHochzeit(seat: number): StilleHochzeit {
  return {
    seat,
    scoresAsSolo: true,
    fulfillsPflichtsolo: true,
    leadsOut: false,
  };
}
