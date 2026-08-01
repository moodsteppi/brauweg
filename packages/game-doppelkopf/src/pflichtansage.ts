/**
 * Pflichtansage.
 *
 * Ausloeser: der erste Stich enthaelt mindestens `pflichtansageThreshold`
 * Augen. Verpflichtet ist ausschliesslich der Gewinner dieses Stichs.
 *
 * Bei Hochzeit erfolgt die Pruefung nach dem Klaerungsstich, nicht nach dem
 * ersten Stich. Der Aufrufer uebergibt daher den relevanten Stich.
 *
 * Verhalten in der UI: Popup mit Bestaetigen-Button. Ablehnen ist ausgegraut,
 * die Ansage erfolgt zwingend. Bei der moralischen Schwelle ist Ablehnen
 * moeglich.
 */

import { sumValues } from './cards.js';
import type { RuleSet } from './ruleset.js';
import type { TrickRecord } from './scoring.js';

export type PflichtansageKind = 'mandatory' | 'moral' | 'none';

export interface PflichtansageCheck {
  readonly kind: PflichtansageKind;
  readonly seat: number | null;
  readonly trickPoints: number;
  /** Darf der Spieler im Popup ablehnen? */
  readonly canDecline: boolean;
}

export function checkPflichtansage(
  rs: RuleSet,
  trick: TrickRecord,
): PflichtansageCheck {
  const trickPoints = sumValues(trick.played.map((p) => p.card));

  if (!rs.pflichtansage) {
    return { kind: 'none', seat: null, trickPoints, canDecline: true };
  }

  if (trickPoints >= rs.pflichtansageThreshold) {
    return {
      kind: 'mandatory',
      seat: trick.winnerSeat,
      trickPoints,
      canDecline: false,
    };
  }

  if (trickPoints >= rs.pflichtansageMoralThreshold) {
    return {
      kind: 'moral',
      seat: trick.winnerSeat,
      trickPoints,
      canDecline: true,
    };
  }

  return { kind: 'none', seat: null, trickPoints, canDecline: true };
}

/**
 * Fristen fuer Ansagen und Absagen.
 *
 * Re/Kontra bis unmittelbar vor der zweiten eigenen Karte, danach je Stufe
 * eine Karte spaeter.
 */
export function announcementDeadline(level: 0 | 1 | 2 | 3 | 4): number {
  return level + 2; // 0 -> vor eigener Karte 2, 1 -> 3, ... 4 -> 6
}

export function mayAnnounce(
  level: 0 | 1 | 2 | 3 | 4,
  ownCardsPlayed: number,
): boolean {
  return ownCardsPlayed < announcementDeadline(level) - 1;
}
