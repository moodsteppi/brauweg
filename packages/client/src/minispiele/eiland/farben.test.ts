import { describe, expect, it } from 'vitest';

import { GEBIET, STUFEN_MAX, gebietsfarbe, kampffarbe, mischfarbe, stufenfarbe } from './farben';

/** Helligkeit einer `#rrggbb`-Farbe, wie HSL sie rechnet (0–1). */
function helligkeit(farbe: string): number {
  const kanal = (i: number): number => parseInt(farbe.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  const werte = [kanal(0), kanal(1), kanal(2)];
  return (Math.max(...werte) + Math.min(...werte)) / 2;
}

describe('stufenfarbe', () => {
  it('wird mit jeder Stufe dunkler, fuer beide Sitze', () => {
    for (const sitz of [0, 1]) {
      for (let stufe = 1; stufe <= STUFEN_MAX; stufe++) {
        expect(helligkeit(stufenfarbe(sitz, stufe))).toBeLessThan(helligkeit(stufenfarbe(sitz, stufe - 1)));
      }
    }
  });

  it('gibt derselben Stufe bei beiden Sitzen dieselbe Helligkeit', () => {
    // Das ist die Auskunft am Brett: Gleich tief heisst gleich stark — egal
    // ob Orange oder Violett. Ein Hundertstel Toleranz fuers Runden.
    for (let stufe = 0; stufe <= STUFEN_MAX; stufe++) {
      expect(Math.abs(helligkeit(stufenfarbe(0, stufe)) - helligkeit(stufenfarbe(1, stufe)))).toBeLessThan(0.02);
    }
  });

  it('behaelt den Farbton des Gebiets und liefert immer Hex', () => {
    for (const sitz of [0, 1]) {
      for (let stufe = 0; stufe <= STUFEN_MAX; stufe++) {
        expect(stufenfarbe(sitz, stufe)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    // Orange bleibt warm (Rot ueber Blau), Violett bleibt kalt (Blau ueber Rot).
    const kanal = (farbe: string, i: number): number => parseInt(farbe.slice(1 + i * 2, 3 + i * 2), 16);
    expect(kanal(stufenfarbe(0, 4), 0)).toBeGreaterThan(kanal(stufenfarbe(0, 4), 2));
    expect(kanal(stufenfarbe(1, 4), 2)).toBeGreaterThan(kanal(stufenfarbe(1, 4), 0));
  });

  it('deckelt die Stufe an beiden Enden', () => {
    expect(stufenfarbe(0, -3)).toBe(stufenfarbe(0, 0));
    expect(stufenfarbe(0, 20)).toBe(stufenfarbe(0, STUFEN_MAX));
  });
});

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
