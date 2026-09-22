import { describe, expect, it } from 'vitest';

import { parName, relativeToParList } from './zu-par';

describe('parName', () => {
  it('Albatross for -3', () => {
    expect(parName(-3)).toBe('Albatross');
  });

  it('Eagle for -2', () => {
    expect(parName(-2)).toBe('Eagle');
  });

  it('Birdie for -1', () => {
    expect(parName(-1)).toBe('Birdie');
  });

  it('Par for 0', () => {
    expect(parName(0)).toBe('Par');
  });

  it('Bogey for +1', () => {
    expect(parName(1)).toBe('Bogey');
  });

  it('Double-Bogey for +2', () => {
    expect(parName(2)).toBe('Double-Bogey');
  });

  it('+3 for 3', () => {
    expect(parName(3)).toBe('+3');
  });

  it('+4 for 4', () => {
    expect(parName(4)).toBe('+4');
  });
});

describe('relativeToParList', () => {
  it('compute total relative to par for each player', () => {
    // 3 players, 3 holes with par [3, 4, 4]
    // Hole 0: [4, 5, 8], Hole 1: [3, 3, 4], Hole 2: [3, 5, 4]
    const result = relativeToParList([3, 4, 4], [[4, 5, 8], [3, 3, 4], [3, 5, 4]]);
    // Player 0: (4-3) + (3-4) + (3-4) = 1 + (-1) + (-1) = -1
    // Player 1: (5-3) + (3-4) + (5-4) = 2 + (-1) + 1 = 2
    // Player 2: (8-3) + (4-4) + (4-4) = 5 + 0 + 0 = 5
    expect(result).toEqual([-1, 2, 5]);
  });

  it('handle partial hole results', () => {
    // Only 1 hole completed (hole 0), 2 players, course has more holes
    const result = relativeToParList([3, 4, 4], [[4, 5]]);
    // Hole 0, par 3: [4, 5]
    // Player 0: 4-3 = 1
    // Player 1: 5-3 = 2
    // Player 2: no strokes yet = 0
    expect(result).toEqual([1, 2, 0]);
  });
});
