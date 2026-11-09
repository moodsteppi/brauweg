// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { kameraBedarf, kameraSchritt } from './kamera';

describe('Ruhige Baukamera', () => {
  it('plant im Ziel keinen weiteren hohen Spawn und hält das Rennen bei höchstens 46 Metern Ausschnitt', () => {
    expect(kameraBedarf(0, 14, true)).toBe(17);
    expect(kameraBedarf(15.9, 41.8, true)).toBeCloseTo(44.8);
    expect(kameraSchritt(undefined, kameraBedarf(24, undefined, true), 0).oben).toBe(46);
    expect(kameraBedarf(24, undefined, false)).toBe(61);
  });
  it('behält nach Fallteilen und einem kompletten Einsturz den Bildausschnitt', () => {
    let k = kameraSchritt(undefined, 17, 0);
    expect(k.oben).toBe(22);
    for (let i = 0; i < 300; i++) k = kameraSchritt(k, 31, 1 / 30);
    expect(k.oben).toBe(38);
    for (const hoehe of [28, 15, 5, 0, 17, 30, 17]) {
      const vorher = k.oben; k = kameraSchritt(k, hoehe, 1 / 30);
      expect(k.oben).toBe(vorher); expect(k.ziel).toBe(38);
    }
  });
  it('fährt langsam und bildratenunabhängig; kleine Höhenänderungen erzeugen keine neue Fahrt', () => {
    const start = kameraSchritt(undefined, 17, 0);
    const erster = kameraSchritt(start, 23, 1 / 30);
    expect(erster.oben - start.oben).toBeLessThan(.25);
    let a = start, b = start;
    for (let i = 0; i < 30; i++) a = kameraSchritt(a, 23 + i / 10, 1 / 30);
    for (let i = 0; i < 60; i++) b = kameraSchritt(b, 26, 1 / 60);
    expect(a.oben).toBeCloseTo(b.oben, 5); expect(a.ziel).toBe(30);
    expect(kameraSchritt(start, 23, 100).oben).toBeLessThan(23);
  });
  it('beginnt jede neue Runde nah und respektiert reduzierte Bewegung', () => {
    const weit = kameraSchritt(undefined, 40, 0);
    expect(weit.oben).toBe(46);
    expect(kameraSchritt(undefined, 17, 0).oben).toBe(22);
    expect(kameraSchritt({ oben: 22, ziel: 22 }, 31, 1 / 30, true).oben).toBe(38);
  });
});
