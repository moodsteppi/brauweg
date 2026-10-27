import { describe, expect, it } from 'vitest';
import { truhenPose, TRUHEN_STIL, TRUHEN_ZEIT } from './truhen-ablauf';

describe('Truhenchoreografie', () => {
  it('zeigt während des Spannens noch keine Münzen und lässt den Deckel zu', () => {
    for (const t of [0, 0.2, 0.59]) {
      const p = truhenPose(t);
      expect(p.deckel).toBeCloseTo(0);
      expect(p.muenzen).toBeLessThan(0);
      expect(p.licht).toBe(0);
    }
  });
  it('öffnet, bevor die Münzen starten, und beruhigt sich vor Weiter', () => {
    expect(truhenPose(0.82).deckel).toBeLessThan(-0.1);
    expect(truhenPose(0.82).muenzen).toBeLessThan(0);
    const ende = truhenPose(TRUHEN_ZEIT.fertig);
    expect(ende.deckel).toBeCloseTo(-1.72, 2);
    expect(ende.wackeln).toBe(0);
    expect(ende.stauchen).toBe(1);
    expect(ende.muenzen).toBeGreaterThan(1.7);
  });
  it('alle fünf Grade haben ein eigenes Material und eine passende Beschriftung', () => {
    expect(Object.keys(TRUHEN_STIL)).toHaveLength(5);
    expect(new Set(Object.values(TRUHEN_STIL).map(s => s.metall))).toHaveLength(5);
    expect(TRUHEN_STIL.diamant.funken).toBeGreaterThan(TRUHEN_STIL.holz.funken);
  });
});
