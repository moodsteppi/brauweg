import { describe, expect, it } from 'vitest';

import { GEBIET, gebietsfarbe, kampffarbe, mischfarbe } from './farben';

describe('mischfarbe', () => {
  it('mischt kanalweise zur Mitte', () => {
    expect(mischfarbe('#000000', '#ffffff')).toBe('#808080');
    expect(mischfarbe('#ff0000', '#0000ff')).toBe('#800080');
  });

  it('ist kommutativ und laesst eine Farbe mit sich selbst unveraendert', () => {
    expect(mischfarbe(GEBIET[0], GEBIET[1])).toBe(mischfarbe(GEBIET[1], GEBIET[0]));
    expect(mischfarbe(GEBIET[0], GEBIET[0])).toBe(GEBIET[0]);
  });

  it('liefert immer sechsstelliges Hex, auch bei kleinen Werten', () => {
    // 0x0a und 0x00 gemischt = 5 -> "05", nicht "5".
    expect(mischfarbe('#0a0a0a', '#000000')).toBe('#050505');
  });
});

describe('kampffarbe', () => {
  it('ist bei einem Zahler dessen Gebietsfarbe', () => {
    expect(kampffarbe([0])).toBe(gebietsfarbe(0));
    expect(kampffarbe([1])).toBe(gebietsfarbe(1));
  });

  it('ist bei zwei Zahlern die Mischung beider — der Hinweis auf den Muenzwurf', () => {
    const gemischt = kampffarbe([0, 1]);
    expect(gemischt).toBe(mischfarbe(GEBIET[0], GEBIET[1]));
    expect(gemischt).not.toBe(GEBIET[0]);
    expect(gemischt).not.toBe(GEBIET[1]);
  });

  it('faellt ohne Zahler auf Weiss zurueck statt auf einen leeren Wert', () => {
    expect(kampffarbe([])).toBe('#ffffff');
  });
});
