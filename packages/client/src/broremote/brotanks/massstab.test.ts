// @vitest-environment node
import { it, expect } from 'vitest';
import { SCHLACHTFELD, bildEinpassen } from './massstab';
it('30 Panzer überspannen die feste Zeichenwelt', () => {
 expect(SCHLACHTFELD.breite / SCHLACHTFELD.panzerBreite).toBe(30);
});
it('passt die ganze Welt ohne Verzerrung oder Abschneiden ein', () => {
 for (const [w,h] of [[390,211.25],[1200,650],[1920,1080],[800,300]]) {
  const r=bildEinpassen(w,h);
  expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);
  expect(1200*r.faktor+2*r.x).toBeCloseTo(w);
  expect(650*r.faktor+2*r.y).toBeCloseTo(h);
  expect((40*r.faktor)/(1200*r.faktor)).toBeCloseTo(1/30);
 }
});
