import { describe, expect, it } from 'vitest';

import { parName, relativeToParList } from './zu-par';

/**
 * Integration test: par display across a complete 9-hole round with 2 players.
 * Par [3, 4, 3, 5, 4, 4, 3, 5, 4] — 36 total.
 * Player 0 (even) vs Player 1 (odd).
 */
describe('Golf par-relative scoring integration', () => {
  it('complete round: calculate and name par-relative scores', () => {
    const par = [3, 4, 3, 5, 4, 4, 3, 5, 4];
    const results = [
      [3, 4], // H1: par (0), bogey (+1)
      [4, 3], // H2: par (0), birdie (-1)
      [2, 3], // H3: birdie (-1), par (0)
      [5, 6], // H4: par (0), double-bogey (+1)
      [4, 3], // H5: par (0), birdie (-1)
      [5, 4], // H6: bogey (+1), par (0)
      [3, 2], // H7: par (0), eagle (-1)
      [5, 6], // H8: par (0), bogey (+1)
      [5, 4], // H9: bogey (+1), par (0)
    ];

    const zuPar = relativeToParList(par, results);
    // Player 0: 0 + 0 - 1 + 0 + 0 + 1 + 0 + 0 + 1 = 1
    // Player 1: 1 - 1 + 0 + 1 - 1 + 0 - 1 + 1 + 0 = 0
    expect(zuPar).toEqual([1, 0]);
  });

  it('par names match expected scoring terminology', () => {
    const scores = {
      '-3': 'Albatross',
      '-2': 'Eagle',
      '-1': 'Birdie',
      '0': 'Par',
      '1': 'Bogey',
      '2': 'Double-Bogey',
      '3': '+3',
      '4': '+4',
      '5': '+5',
    };

    Object.entries(scores).forEach(([key, expected]) => {
      expect(parName(Number(key))).toBe(expected);
    });
  });

  it('par display for leading vs trailing player', () => {
    // 18 holes: par mostly 4, one 3, one 5
    const par = [
      3, 4, 4, 4, 4, 5, // F1
      4, 4, 4, 4, 4, 3, // F2
      4, 4, 4, 4, 4, 5, // F3
    ];
    // Leader: mostly par and birdies
    const leader = [3, 4, 3, 4, 3, 5, 4, 3, 4, 3, 4, 3, 3, 4, 4, 3, 4, 5];
    // Trailer: mostly bogeys
    const trailer = [4, 5, 5, 5, 5, 6, 5, 5, 5, 5, 5, 4, 5, 5, 5, 5, 5, 6];

    const results = leader.map((_, i) => [leader[i], trailer[i]]);
    const zuPar = relativeToParList(par, results);

    // Leader: 11 birdies (-11) + 7 par (0) = -11
    // Trailer: 18 bogeys mostly (+18) + some double-bogeys
    // Leader should be significantly under par
    expect(zuPar[0]).toBeLessThan(0);
    // Trailer should be significantly over par
    expect(zuPar[1]).toBeGreaterThan(0);
  });
});
