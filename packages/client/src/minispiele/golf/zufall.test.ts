import { describe, expect, it } from 'vitest';

import {
  COS,
  SIN,
  betrag,
  bruch,
  drehe,
  dreheHundertstel,
  fnv1a,
  ganzzahl,
  mulberry32,
  naechste,
  normiere,
  stromFuerSitz,
} from './zufall';

describe('mulberry32', () => {
  it('liefert aus demselben Zustand immer dieselbe Folge', () => {
    let a = mulberry32(4711);
    let b = mulberry32(4711);
    const folgeA: number[] = [];
    const folgeB: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      const sa = naechste(a);
      a = sa.zustand;
      folgeA.push(sa.wert);
      const sb = naechste(b);
      b = sb.zustand;
      folgeB.push(sb.wert);
    }
    expect(folgeA).toEqual(folgeB);
    // Und sie ist nicht konstant — ein kaputter Generator faellt sonst nicht auf.
    expect(new Set(folgeA).size).toBeGreaterThan(40);
  });

  it('bleibt im Wertebereich', () => {
    let z = mulberry32(-9);
    for (let i = 0; i < 500; i += 1) {
      const s = naechste(z);
      z = s.zustand;
      expect(s.wert).toBeGreaterThanOrEqual(0);
      expect(s.wert).toBeLessThan(1);
      const g = ganzzahl(z, 3, 7);
      expect(g.wert).toBeGreaterThanOrEqual(3);
      expect(g.wert).toBeLessThanOrEqual(7);
      const b = bruch(z, -2, 2);
      expect(b.wert).toBeGreaterThanOrEqual(-2);
      expect(b.wert).toBeLessThan(2);
    }
  });

  it('gibt jedem Sitz einen eigenen Strom', () => {
    const stroeme = [0, 1, 2, 3, 4, 5, 6, 7].map((s) => stromFuerSitz(99, s));
    expect(new Set(stroeme).size).toBe(8);
  });
});

describe('fnv1a', () => {
  it('ist stabil und unterscheidet aehnliche Texte', () => {
    expect(fnv1a('3,4;2,5')).toBe(fnv1a('3,4;2,5'));
    expect(fnv1a('3,4;2,5')).not.toBe(fnv1a('3,4;2,6'));
    expect(fnv1a('')).toHaveLength(8);
  });
});

describe('Winkeltabellen', () => {
  it('sind auf sechs Nachkommastellen quantisiert', () => {
    for (let g = 0; g < 360; g += 1) {
      expect(SIN[g]).toBe(Math.round(SIN[g] * 1e6) / 1e6);
      expect(COS[g]).toBe(Math.round(COS[g] * 1e6) / 1e6);
    }
    expect(SIN[0]).toBe(0);
    expect(COS[0]).toBe(1);
    expect(SIN[90]).toBe(1);
  });

  it('drehen ohne die Laenge zu aendern', () => {
    for (const grad of [0, 1, 37, 90, 180, 271, 359, -30, 400]) {
      const r = drehe(1, 0, grad);
      expect(betrag(r.x, r.y)).toBeCloseTo(1, 5);
    }
  });

  it('setzt Hundertstelgrad aus beiden Tabellen zusammen', () => {
    // 80 Hundertstel = 0,8 Grad: mit ganzen Grad waere das gar keine Drehung.
    const fein = dreheHundertstel(1, 0, 80);
    expect(fein.x).not.toBe(1);
    expect(fein.y).toBeCloseTo(Math.sin((0.8 * Math.PI) / 180), 5);
    // Ganze Grad muessen mit `drehe` uebereinstimmen.
    const ganz = dreheHundertstel(1, 0, 4500);
    const direkt = drehe(1, 0, 45);
    expect(ganz.x).toBeCloseTo(direkt.x, 12);
    expect(ganz.y).toBeCloseTo(direkt.y, 12);
  });
});

describe('normiere', () => {
  it('macht Einheitsvektoren und faellt bei Null nicht auf NaN zurueck', () => {
    const r = normiere(3, 4);
    expect(r.x).toBeCloseTo(0.6, 12);
    expect(r.y).toBeCloseTo(0.8, 12);
    const null0 = normiere(0, 0);
    expect(Number.isNaN(null0.x)).toBe(false);
    expect(betrag(null0.x, null0.y)).toBe(1);
  });
});
