// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aufstellen, hoeheBei, huegelSetzen, inselAusSeed, kraterSchlagen } from './gelaende';
import { REGELN } from './regeln';

describe('Gelände', () => {
  it('derselbe Seed ergibt dieselbe Insel, andere Seeds andere', () => {
    expect(Array.from(inselAusSeed(7))).toEqual(Array.from(inselAusSeed(7)));
    expect(Array.from(inselAusSeed(7))).not.toEqual(Array.from(inselAusSeed(8)));
    expect(inselAusSeed(7)).toHaveLength(REGELN.spalten);
  });
  it('bleibt endlich, fällt zum Meer ab und lässt die Mitte über dem Wasser', () => {
    for (const seed of [1, 2, 99, 12345, 4294967295]) {
      const g = inselAusSeed(seed);
      expect(Array.from(g).every(h => Number.isFinite(h) && h >= REGELN.meeresgrund - 0.01 && h < 14)).toBe(true);
      expect(g[0]).toBeCloseTo(REGELN.meeresgrund, 3);
      expect(g[g.length - 1]).toBeCloseTo(REGELN.meeresgrund, 3);
      for (let x = 12; x <= 52; x += 0.5) expect(hoeheBei(g, x)).toBeGreaterThan(1.5);
    }
  });
  it('hoeheBei interpoliert und kennt außerhalb nur den Meeresgrund', () => {
    const g = new Float32Array(REGELN.spalten).fill(4);
    g[100] = 6; g[101] = 8;
    expect(hoeheBei(g, (100 + 0.5) * REGELN.spaltenbreite)).toBeCloseTo(6, 5);
    expect(hoeheBei(g, 101 * REGELN.spaltenbreite)).toBeCloseTo(7, 5);
    expect(hoeheBei(g, -0.1)).toBe(REGELN.meeresgrund);
    expect(hoeheBei(g, 64.1)).toBe(REGELN.meeresgrund);
    expect(hoeheBei(g, Number.NaN)).toBe(REGELN.meeresgrund);
  });
  it('ein Krater senkt nur im Radius und bis zur Tiefe r', () => {
    const g = new Float32Array(REGELN.spalten).fill(5), vorher = Float32Array.from(g);
    kraterSchlagen(g, 20, 2);
    for (let i = 0; i < g.length; i++) {
      const x = (i + 0.5) * REGELN.spaltenbreite;
      if (Math.abs(x - 20) >= 2) expect(g[i]).toBe(vorher[i]); else expect(g[i]).toBeLessThanOrEqual(vorher[i]);
    }
    expect(hoeheBei(g, 20)).toBeCloseTo(3, 1);
    // Wiederholte Einschläge graben nie unter die Untergrenze.
    for (let i = 0; i < 20; i++) kraterSchlagen(g, 20, 2);
    expect(Math.min(...Array.from(g))).toBeGreaterThanOrEqual(REGELN.tiefstens);
  });
  it('ein Krater am Rand der Welt bleibt gültig', () => {
    const g = new Float32Array(REGELN.spalten).fill(5);
    kraterSchlagen(g, 0, 3); kraterSchlagen(g, 64, 3);
    expect(Array.from(g).every(Number.isFinite)).toBe(true);
  });
  it('ein Hügel hebt nur in seiner Breite, in der Mitte um die Höhe', () => {
    const g = new Float32Array(REGELN.spalten).fill(5), vorher = Float32Array.from(g);
    huegelSetzen(g, 30, 3, 1.5);
    for (let i = 0; i < g.length; i++) {
      const x = (i + 0.5) * REGELN.spaltenbreite;
      if (Math.abs(x - 30) >= 1.5) expect(g[i]).toBe(vorher[i]); else expect(g[i]).toBeGreaterThanOrEqual(vorher[i]);
    }
    expect(hoeheBei(g, 30)).toBeCloseTo(6.5, 1);
  });
  it('Startplätze liegen gleichmäßig auf der Insel und sind 2 m breit eben', () => {
    const g = inselAusSeed(5), xs = aufstellen(g, 4, 5);
    expect(xs).toHaveLength(4);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThan(12); expect(x).toBeLessThan(52);
      expect(hoeheBei(g, x - 0.9)).toBeCloseTo(hoeheBei(g, x + 0.9), 4);
    }
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(5);
    expect(aufstellen(inselAusSeed(5), 4, 5)).toEqual(xs);
  });
});
