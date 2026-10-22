import { describe, expect, it } from 'vitest';

import { dauer, kurz } from './zahlen';

describe('Manufaktur-Zahlen', () => {
  it('kürzt große Zahlen', () => {
    expect(kurz(0)).toBe('0');
    expect(kurz(12.34)).toBe('12,3');
    expect(kurz(999)).toBe('999');
    expect(kurz(1234)).toBe('1,23 Tsd.');
    expect(kurz(56_789)).toBe('56,7 Tsd.');
    expect(kurz(4_560_000)).toBe('4,56 Mio.');
    expect(kurz(1e10)).toBe('10 Mrd.');
    expect(kurz(2.5e15)).toBe('2,5 Brd.');
    expect(kurz(1e18)).toBe('1 aa');
    expect(kurz(3e21)).toBe('3 ab');
  });

  it('nennt Dauern menschlich', () => {
    expect(dauer(30)).toBe('1 Min.');
    expect(dauer(3600)).toBe('1 Std.');
    expect(dauer(11_520)).toBe('3 Std. 12 Min.');
  });
});
