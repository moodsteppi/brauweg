/** Name for strokes relative to par: Albatross (-3), Eagle (-2), Birdie (-1), Par (0), Bogey (+1), Double-Bogey (+2), then +N. */
export function parName(relativ: number): string {
  switch (relativ) {
    case -3:
      return 'Albatross';
    case -2:
      return 'Eagle';
    case -1:
      return 'Birdie';
    case 0:
      return 'Par';
    case 1:
      return 'Bogey';
    case 2:
      return 'Double-Bogey';
    default:
      return relativ > 0 ? `+${relativ}` : String(relativ);
  }
}

/** Total strokes relative to par for each player across completed holes.
 *
 * Infers player count from the first hole's results (all holes should have same width).
 */
export function relativeToParList(parValues: readonly number[], results: number[][]): number[] {
  const sitze = results[0]?.length ?? 0;
  const zuPar = new Array<number>(sitze).fill(0);

  for (let loch = 0; loch < results.length; loch += 1) {
    const reihe = results[loch];
    if (reihe === undefined) continue;
    const lochPar = parValues[loch] ?? 0;
    for (let s = 0; s < sitze; s += 1) {
      const schlaege = reihe[s];
      if (schlaege !== undefined) {
        zuPar[s] += schlaege - lochPar;
      }
    }
  }

  return zuPar;
}
