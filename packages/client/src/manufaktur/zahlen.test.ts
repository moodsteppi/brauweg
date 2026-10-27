import { describe, expect, it } from 'vitest';

import { dauer, kurz, sekunden } from './zahlen';

describe('Manufaktur-Zahlen', () => {
  it('zeigt ganze Zahlen, ab Mio. höchstens eine Nachkommastelle', () => {
    expect(kurz(0)).toBe('0');
    expect(kurz(12.5)).toBe('12');
    expect(kurz(9.5)).toBe('9');
    expect(kurz(1240)).toBe('1.240');
    expect(kurz(9999.9)).toBe('9.999');
    expect(kurz(12_345)).toBe('12 Tsd.');
    expect(kurz(999_999)).toBe('999 Tsd.');
    expect(kurz(3_400_000)).toBe('3,4 Mio.');
    expect(kurz(3_499_999)).toBe('3,4 Mio.');
    expect(kurz(34_900_000)).toBe('34 Mio.');
    expect(kurz(1.2e9)).toBe('1,2 Mrd.');
    expect(kurz(5e12)).toBe('5 Bio.');
    expect(kurz(1e15)).toBe('1 aa');
    expect(kurz(7.5e18)).toBe('7,5 ab');
  });

  it('rundet nie auf', () => {
    expect(kurz(1999.99)).toBe('1.999');
    expect(kurz(4_560_000)).toBe('4,5 Mio.');
  });

  it('nennt Sekunden und Dauern menschlich', () => {
    expect(sekunden(4)).toBe('4 s');
    expect(sekunden(3.94)).toBe('3,9 s');
    expect(sekunden(13.3)).toBe('13 s');
    expect(dauer(30)).toBe('1 Min.');
    expect(dauer(3600)).toBe('1 Std.');
    expect(dauer(11_520)).toBe('3 Std. 12 Min.');
  });
});
