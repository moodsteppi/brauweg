/**
 * Rangfolge der Vorbehalte.
 *
 * Sagen mehrere Spieler einen Vorbehalt an, entscheidet zuerst die Art des
 * Vorbehalts, erst danach die Sitzreihenfolge ab Vorhand.
 *
 * Festgelegte Reihenfolge: Solo, Schmeissen, Armut, Hochzeit.
 */

export type VorbehaltKind = 'solo' | 'schmeiss' | 'armut' | 'hochzeit';

export const VORBEHALT_RANK: Record<VorbehaltKind, number> = {
  solo: 0,
  schmeiss: 1,
  armut: 2,
  hochzeit: 3,
};

export interface VorbehaltClaim {
  readonly seat: number;
  readonly kind: VorbehaltKind;
}

/**
 * Ermittelt den Vorbehalt, der zum Zuge kommt.
 *
 * @param claims  Alle angemeldeten Vorbehalte.
 * @param seats   Sitzreihenfolge des Tisches.
 * @param vorhand Sitz der Vorhand.
 */
export function resolveVorbehalte(
  claims: readonly VorbehaltClaim[],
  seats: readonly number[],
  vorhand: number,
): VorbehaltClaim | null {
  if (claims.length === 0) return null;

  const start = seats.indexOf(vorhand);
  const seatOrder = (seat: number) => {
    const i = seats.indexOf(seat);
    return (i - start + seats.length) % seats.length;
  };

  return [...claims].sort((a, b) => {
    const byKind = VORBEHALT_RANK[a.kind] - VORBEHALT_RANK[b.kind];
    return byKind !== 0 ? byKind : seatOrder(a.seat) - seatOrder(b.seat);
  })[0];
}
