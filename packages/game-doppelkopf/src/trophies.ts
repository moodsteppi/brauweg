/**
 * Trophaeen.
 *
 * Bewusst NICHT aus Spielpunkten abgeleitet, sondern aus der Platzierung ueber
 * die gesamte Partie. Andernfalls wird ein Tisch mit hohem Bock-Multiplikator
 * zur Trophaeen-Farm und Spieler suchen den varianzreichsten Regelsatz statt
 * der besten Gegner.
 *
 * Die Verteilung ist nullsummig. Gleichstand erhaelt den Mittelwert der
 * betroffenen Plaetze, wodurch die Nullsumme erhalten bleibt.
 */

/**
 * Troph\u00e4en je Platz. Nullsummig.
 *
 * Die Werte sind so gew\u00e4hlt, dass die Mittelwertbildung bei Gleichstand
 * IMMER ganzzahlig bleibt. Bedingung: Jede zusammenh\u00e4ngende Platzgruppe muss
 * eine durch ihre Gr\u00f6\u00dfe teilbare Summe haben.
 *
 * Bei vier Spielern (a, b, -b, -a) hei\u00dft das: a durch 3 teilbar und a+b
 * gerade. 9 und 3 erf\u00fcllen beides. Die urspr\u00fcnglich angedachten 8 und 3
 * taten es nicht, dort ergab ein Dreiergleichstand 8/3 Troph\u00e4en.
 *
 * Bei f\u00fcnf Spielern (a, b, 0, -b, -a): a durch 4 teilbar, b gerade und a+b
 * durch 3 teilbar. 12 und 6 erf\u00fcllen das.
 */
export const PLACEMENT_TROPHIES: Record<number, readonly number[]> = {
  3: [6, 0, -6],
  4: [9, 3, -3, -9],
  5: [12, 6, 0, -6, -12],
};

/** Trophaeenabzug fuer das Verlassen einer laufenden Partie. */
export const LEAVE_PENALTY = -10;

export interface PartyStanding {
  readonly seat: number;
  /** Endstand in Spielpunkten. */
  readonly score: number;
  /** Hat der Spieler die Partie vorzeitig verlassen? */
  readonly left?: boolean;
}

export interface TrophyResult {
  readonly seat: number;
  readonly place: number;
  readonly trophies: number;
}

export function awardTrophies(
  standings: readonly PartyStanding[],
  opts: { training?: boolean } = {},
): TrophyResult[] {
  const n = standings.length;
  const table = PLACEMENT_TROPHIES[n];
  if (!table) throw new Error(`Keine Trophaeentabelle fuer ${n} Spieler`);

  if (opts.training) {
    return standings.map((s) => ({ seat: s.seat, place: 0, trophies: 0 }));
  }

  // Aussteiger werden immer als Letzte gewertet, unabhaengig vom Punktestand.
  const sorted = [...standings].sort((a, b) => {
    if (!!a.left !== !!b.left) return a.left ? 1 : -1;
    return b.score - a.score;
  });

  const results: TrophyResult[] = [];
  let i = 0;
  while (i < sorted.length) {
    // Gleichstandsgruppe bilden. Aussteiger bilden nie eine Gruppe mit
    // regulaeren Spielern.
    let j = i;
    while (
      j + 1 < sorted.length &&
      !sorted[i].left &&
      !sorted[j + 1].left &&
      sorted[j + 1].score === sorted[i].score
    ) {
      j++;
    }
    const share =
      table.slice(i, j + 1).reduce((a, b) => a + b, 0) / (j - i + 1);
    for (let k = i; k <= j; k++) {
      const penalty = sorted[k].left ? LEAVE_PENALTY : 0;
      results.push({
        seat: sorted[k].seat,
        place: i + 1,
        trophies: share + penalty,
      });
    }
    i = j + 1;
  }

  return results.sort((a, b) => a.seat - b.seat);
}
