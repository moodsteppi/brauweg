// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { flugBerechnen } from './flug';
import { hoeheBei, inselAusSeed } from './gelaende';
import { KETTE, REGELN, WAFFEN, WEHE, type Waffe } from './regeln';

const flach = (h = 5): Float32Array => new Float32Array(REGELN.spalten).fill(h);
const start = { x: 32, y: 5 };
const lande = (w: Waffe, winkel: number, staerke: number, wind = 0, g = flach(), s = start) => flugBerechnen(s, winkel, staerke, wind, w, g);

describe('Flugbahn', () => {
  it('verändert das übergebene Gelände nicht und ist reproduzierbar', () => {
    const g = inselAusSeed(3), kopie = Float32Array.from(g);
    const a = flugBerechnen({ x: 20, y: hoeheBei(g, 20) }, 50, 70, 3, 2, g), b = flugBerechnen({ x: 20, y: hoeheBei(g, 20) }, 50, 70, 3, 2, g);
    expect(Array.from(g)).toEqual(Array.from(kopie));
    expect(a).toEqual(b);
  });
  it('ohne Wind ist die Bahn spiegelsymmetrisch', () => {
    const r = lande(0, 45, 40).einschlaege[0], l = lande(0, 135, 40).einschlaege[0];
    expect(r.x - start.x).toBeGreaterThan(10);
    expect(r.x - start.x).toBeCloseTo(start.x - l.x, 1);
  });
  it('Wind verschiebt den Einschlag in Windrichtung', () => {
    const [links, ohne, rechts] = [-10, 0, 10].map(w => lande(0, 60, 40, w).einschlaege[0].x);
    expect(links).toBeLessThan(ohne); expect(ohne).toBeLessThan(rechts);
  });
  it('mehr Stärke fliegt weiter', () => {
    expect(lande(0, 45, 50).einschlaege[0].x).toBeGreaterThan(lande(0, 45, 30).einschlaege[0].x);
  });
  it('ein Flug über den Rand hinaus verpufft ohne Einschlag', () => {
    const f = flugBerechnen({ x: 5, y: 5 }, 180, 100, 0, 0, flach());
    expect(f.einschlaege).toEqual([]);
  });
  it('ein Schuss in die Luft ohne Boden endet nach höchstens 12 s', () => {
    const f = flugBerechnen({ x: 32, y: 5 }, 90, 100, 0, 0, flach(-50));
    for (const t of f.teile) expect(t.t0 + (t.punkte.length - 1) / 60).toBeLessThanOrEqual(REGELN.flugMax + 0.02);
  });
  it('jede Waffe hält Teilgeschoss-, Einschlag- und Zeitgrenze, auch auf echtem Gelände', () => {
    const g = inselAusSeed(11);
    for (let w = 0; w < 8; w++) for (const wind of [-10, 0, 10]) for (let a = 10; a <= 170; a += 20) for (let s = 10; s <= 100; s += 15) {
      const f = flugBerechnen({ x: 20, y: hoeheBei(g, 20) }, a, s, wind, w as Waffe, g);
      expect(f.teile.length).toBeLessThanOrEqual(REGELN.maxTeilgeschosse);
      expect(f.einschlaege.length).toBeLessThanOrEqual(REGELN.maxEinschlaege);
      expect(f.dauer).toBeLessThanOrEqual(REGELN.flugMax + KETTE.funken * KETTE.pause + 1e-9);
      for (const t of f.teile) expect(t.t0 + (t.punkte.length - 1) / 60).toBeLessThanOrEqual(REGELN.flugMax + 0.02);
      for (const e of f.einschlaege) expect(Number.isFinite(e.x + e.y + e.sx + e.sy + e.t)).toBe(true);
    }
  });
  it('Schneekugel: ein Krater mit den Werten aus der Waffenliste', () => {
    const e = lande(0, 45, 40).einschlaege;
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ art: 'krater', r: WAFFEN[0].krater, schaden: WAFFEN[0].schaden, sr: WAFFEN[0].radius });
  });
  it('Heringsfächer teilt sich in drei Fische mit eigenen Einschlägen', () => {
    const f = lande(1, 45, 45);
    expect(f.teile).toHaveLength(4);
    expect(f.einschlaege).toHaveLength(3);
    expect(new Set(f.einschlaege.map(e => Math.round(e.x))).size).toBe(3);
    expect(f.einschlaege.every(e => e.schaden === 12)).toBe(true);
  });
  it('Hüpfeis prallt zweimal ab (Delle ohne Schaden), erst der dritte Aufprall zündet', () => {
    const e = lande(3, 45, 40).einschlaege;
    expect(e).toHaveLength(3);
    expect(e[0].schaden).toBe(0); expect(e[1].schaden).toBe(0); expect(e[2].schaden).toBe(20);
    expect(e[1].x).toBeGreaterThan(e[0].x); expect(e[2].x).toBeGreaterThan(e[1].x);
    expect(e[0].t).toBeLessThan(e[2].t);
  });
  it('Polterfass rollt bergab, bevor es zündet', () => {
    const hang = new Float32Array(REGELN.spalten).map((_, i) => Math.max(0.5, 14 - 0.18 * (i + 0.5) * REGELN.spaltenbreite));
    const s = { x: 8, y: hoeheBei(hang, 8) };
    const kugel = lande(0, 55, 45, 0, hang, s).einschlaege[0], fass = lande(2, 55, 45, 0, hang, s).einschlaege[0];
    expect(fass.x).toBeGreaterThan(kugel.x + 1);
    expect(fass.r).toBe(2.5); expect(fass.schaden).toBe(35);
    const teil = lande(2, 55, 45, 0, hang, s).teile[0];
    expect(teil.punkte.length / 60).toBeLessThanOrEqual(REGELN.flugMax);
  });
  it('Polterfass bleibt in einer Mulde liegen und zündet dort', () => {
    const mulde = new Float32Array(REGELN.spalten).map((_, i) => 2 + 0.3 * Math.abs((i + 0.5) * REGELN.spaltenbreite - 40));
    const s = { x: 8, y: hoeheBei(mulde, 8) };
    let a: number | undefined;
    for (let st = 30; st <= 100 && a === undefined; st += 1) {
      const x = lande(0, 60, st, 0, mulde, s).einschlaege[0]?.x;
      if (x !== undefined && x > 31 && x < 37) a = st;
    }
    expect(a).toBeDefined();
    const kugel = lande(0, 60, a!, 0, mulde, s).einschlaege[0].x, fass = lande(2, 60, a!, 0, mulde, s).einschlaege[0].x;
    expect(Math.abs(fass - 40)).toBeLessThan(Math.abs(kugel - 40));
    expect(Math.abs(fass - 40)).toBeLessThan(3);
  });
  it('Polterfass auf ebenem Grund zündet fast sofort', () => {
    const k = lande(0, 45, 40).einschlaege[0].x, f = lande(2, 45, 40).einschlaege[0];
    expect(Math.abs(f.x - k)).toBeLessThan(0.5);
  });
  it('Meißelbolzen wirkt 4 m tief im Gelände, mit tiefer Grube am Eintritt', () => {
    const e = lande(4, 45, 40).einschlaege;
    expect(e).toHaveLength(1);
    expect(e[0].schaden).toBe(30);
    expect(Math.hypot(e[0].sx - e[0].x, e[0].sy - 5)).toBeCloseTo(4, 3);
    expect(e[0].sy).toBeLessThan(5);
    expect(e[0].y).toBeLessThan(5);
  });
  it('Schneewehe baut einen Hügel und schadet nicht', () => {
    const e = lande(5, 45, 40).einschlaege;
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ art: 'huegel', breite: WEHE.breite, hoehe: WEHE.hoehe, schaden: 0 });
  });
  it('Korkenknall: wenig Schaden, starker Rückstoß', () => {
    const e = lande(6, 45, 40).einschlaege[0];
    expect(e.schaden).toBe(8); expect(e.stoss).toBeGreaterThan(0); expect(e.sr).toBe(3);
  });
  it('Lichterkette: fünf Funken von links nach rechts, nacheinander, je 10 Schaden', () => {
    const e = lande(7, 45, 40).einschlaege;
    expect(e).toHaveLength(5);
    for (let i = 1; i < 5; i++) { expect(e[i].t).toBeGreaterThan(e[i - 1].t); expect(e[i].x - e[i - 1].x).toBeCloseTo(KETTE.abstand, 5); }
    expect(e.every(x => x.schaden === 10)).toBe(true);
  });
  it('ein Treffer am Bro zündet in der Luft; der Schütze selbst ist kurz geschont', () => {
    const frei = lande(0, 45, 40), mitte = frei.teile[0].punkte[Math.floor(frei.teile[0].punkte.length / 2)];
    const treffer = flugBerechnen(start, 45, 40, 0, 0, flach(), [{ x: mitte[0], y: mitte[1] - REGELN.broHoehe }]);
    expect(treffer.einschlaege).toHaveLength(1);
    expect(Math.hypot(treffer.einschlaege[0].sx - mitte[0], treffer.einschlaege[0].sy - mitte[1])).toBeLessThan(REGELN.broRadius);
    expect(treffer.einschlaege[0].t).toBeLessThan(frei.einschlaege[0].t);
    const selbst = flugBerechnen(start, 45, 40, 0, 0, flach(), [{ ...start, schuetze: true }]);
    expect(selbst.einschlaege[0].x).toBeCloseTo(frei.einschlaege[0].x, 5);
  });
});
