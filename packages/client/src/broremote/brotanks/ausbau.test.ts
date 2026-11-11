// @vitest-environment node
import { it, expect } from 'vitest';
import { flugBerechnen, einschlagAnwenden } from './flug';
import { inselAusSeed, karteAusSeed } from './gelaende';
import { REGELN } from './regeln';
it('neue Geschosse schlagen ein, schieben oder bauen einen Wall', () => {
 const g = new Float32Array(REGELN.spalten).fill(5);
 const hammer = flugBerechnen({x:20,y:5},45,35,0,8,g);
 const sturm = flugBerechnen({x:20,y:5},45,35,0,9,g);
 const wall = flugBerechnen({x:20,y:5},45,35,0,10,g);
 expect(hammer.einschlaege[0].schaden).toBe(42);
 expect(sturm.einschlaege[0].stoss).toBe(6);
 expect(sturm.einschlaege[0].r).toBe(0);
 expect(wall.einschlaege[0].art).toBe('huegel');
 einschlagAnwenden(g,wall.einschlaege[0]);
 expect(Math.max(...g)).toBeGreaterThan(7.9);
});
it('alle drei Landschaften sind reproduzierbar und haben sichere Startbereiche', () => {
 expect([0,1,2].map(karteAusSeed)).toEqual([0,1,2]);
 for(let seed=0;seed<90;seed++) {
  const g=inselAusSeed(seed);expect(g).toEqual(inselAusSeed(seed));
  expect(g.every(Number.isFinite)).toBe(true);
  for(let x=16;x<=48;x+=8)expect(g[Math.floor(x/REGELN.spaltenbreite)]).toBeGreaterThan(0);
 }
});
