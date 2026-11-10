// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TanksPartie, rangfolge, schadenBei, type TanksSpieler } from './partie';
import { REGELN, VORRAT_START, WAFFEN, zufallsstrom } from './regeln';
import type { Einschlag } from './flug';

const leute = (n: number): TanksSpieler[] => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `Bro ${i}`, farbe: ['#70dfc4', '#ffc961', '#ad9eff', '#ff8ca5'][i] }));
type Innen = { g: Float32Array; bros: { id: string; x: number; y: number; lp: number; munition: number[]; raus: boolean }[]; wind: number; meer: number };
const innen = (p: TanksPartie): Innen => p as unknown as Innen;
function schritte(p: TanksPartie, n: number): void { for (let i = 0; i < n; i++) p.schritt(); }
function bis(p: TanksPartie, f: () => boolean, max = 400_000): void { for (let i = 0; i < max && !f(); i++) p.schritt(); }
/** Ebenes Gelände, Bros an festen Plätzen: macht die Szenarien ohne Zufallsinsel nachrechenbar. */
function flachMit(p: TanksPartie, hoehe: number, xs: number[]): void {
  const m = innen(p); m.g.fill(hoehe);
  m.bros.forEach((b, i) => { b.x = xs[i]; b.y = hoehe; });
  m.wind = 0;
}
function zielenBereit(p: TanksPartie): void { bis(p, () => p.sicht().phase === 'zielen'); }
const schiessen = (p: TanksPartie, winkel: number, staerke: number, waffe = 0): void => {
  const s = p.sicht();
  p.eingabe(s.amZug, { art: 'feuer', zug: s.zug, winkel, staerke, waffe });
};
const ende = (p: TanksPartie): void => bis(p, () => p.sicht().phase === 'nachlauf' || p.sicht().phase === 'ende');

describe('Spielregeln BroTanks', () => {
  it('verlangt zwei bis vier verschiedene Spieler', () => {
    expect(() => new TanksPartie(leute(1), 1)).toThrow();
    expect(() => new TanksPartie(leute(5), 1)).toThrow();
    expect(() => new TanksPartie([leute(2)[0], leute(2)[0]], 1)).toThrow();
    expect(() => new TanksPartie(leute(2), 1)).not.toThrow();
    expect(() => new TanksPartie(leute(4), 1)).not.toThrow();
  });
  it('Insel, Startplätze und Zugfolge kommen aus dem Seed, nicht aus der Sitzreihenfolge', () => {
    const a = new TanksPartie(leute(4), 42).sicht(), b = new TanksPartie(leute(4), 42).sicht();
    expect(a.reihe).toEqual(b.reihe);
    expect(a.bros.map(x => x.x)).toEqual(b.bros.map(x => x.x));
    const ersten = new Set(Array.from({ length: 30 }, (_, i) => new TanksPartie(leute(4), i + 1).sicht().reihe[0]));
    expect(ersten.size).toBeGreaterThan(1);
    const platz0 = new Set(Array.from({ length: 30 }, (_, i) => new TanksPartie(leute(4), i + 1).sicht().bros[0].x.toFixed(1)));
    expect(platz0.size).toBeGreaterThan(1);
    expect(new TanksPartie(leute(2), 1).sicht().gelaende).toEqual(new TanksPartie(leute(2), 1).sicht().gelaende);
  });
  it('alle starten mit 100 LP, voller Kiste und genug Wasser unter dem Boden', () => {
    const s = new TanksPartie(leute(4), 9).sicht();
    for (const b of s.bros) { expect(b.lp).toBe(100); expect(b.munition).toEqual([...VORRAT_START]); expect(b.y).toBeGreaterThan(s.meer + 1); }
    expect(s.runde).toBe(1); expect(s.zug).toBe(1); expect(s.phase).toBe('countdown');
  });
  it('Countdown dauert genau 3 Sekunden, dann beginnt das Zielen mit 20 s', () => {
    const p = new TanksPartie(leute(2), 1);
    schritte(p, 179); expect(p.sicht().phase).toBe('countdown');
    schritte(p, 1); expect(p.sicht().phase).toBe('zielen');
    expect(p.sicht().rest).toBeCloseTo(20, 9);
  });
  it('Zielen und Feuern nimmt nur der Bro am Zug an', () => {
    const p = new TanksPartie(leute(3), 5); zielenBereit(p);
    const am = p.sicht().amZug, fremd = p.sicht().reihe.find(i => i !== am)!;
    p.eingabe(fremd, { art: 'zielen', winkel: 11, staerke: 22, waffe: 1 });
    expect(p.sicht().bros.find(b => b.id === fremd)).toMatchObject({ staerke: 50 });
    p.eingabe(fremd, { art: 'feuer', zug: p.sicht().zug, winkel: 10, staerke: 10, waffe: 0 });
    expect(p.sicht().phase).toBe('zielen');
    p.eingabe(am, { art: 'zielen', winkel: 11, staerke: 22, waffe: 1 });
    expect(p.sicht().bros.find(b => b.id === am)).toMatchObject({ winkel: 11, staerke: 22, waffe: 1 });
  });
  it('Ungültige Zielwerte und leere Waffen werden nicht übernommen', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p);
    const am = p.sicht().amZug, b = () => p.sicht().bros.find(x => x.id === am)!;
    for (const w of [{ winkel: 181, staerke: 10, waffe: 0 }, { winkel: 10.5, staerke: 10, waffe: 0 }, { winkel: 10, staerke: 101, waffe: 0 }, { winkel: 10, staerke: 10, waffe: 8 }, { winkel: Number.NaN, staerke: 10, waffe: 0 }]) {
      p.eingabe(am, { art: 'zielen', ...w }); expect(b()).toMatchObject({ winkel: expect.any(Number), staerke: 50, waffe: 0 });
    }
    innen(p).bros.find(x => x.id === am)!.munition[5] = 0;
    p.eingabe(am, { art: 'zielen', winkel: 70, staerke: 30, waffe: 5 });
    expect(b()).toMatchObject({ winkel: 70, staerke: 30, waffe: 0 });
    p.eingabe(am, { art: 'feuer', zug: p.sicht().zug, winkel: 70, staerke: 30, waffe: 5 });
    expect(p.sicht().phase).toBe('zielen');
  });
  it('Ein doppeltes oder veraltetes Feuer bleibt wirkungslos und verbraucht nichts zweimal', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [15, 50]);
    const am = p.sicht().amZug, zug = p.sicht().zug;
    p.eingabe(am, { art: 'feuer', zug: zug + 1, winkel: 45, staerke: 40, waffe: 1 });
    expect(p.sicht().phase).toBe('zielen');
    p.eingabe(am, { art: 'feuer', zug, winkel: 45, staerke: 40, waffe: 1 });
    expect(p.sicht().phase).toBe('flug');
    p.eingabe(am, { art: 'feuer', zug, winkel: 45, staerke: 40, waffe: 1 });
    expect(p.sicht().bros.find(b => b.id === am)!.munition[1]).toBe(WAFFEN[1].vorrat - 1);
    ende(p); bis(p, () => p.sicht().zug === zug + 1);
    p.eingabe(am, { art: 'feuer', zug, winkel: 45, staerke: 40, waffe: 0 });
    expect(p.sicht().phase).toBe('zielen');
  });
  it('Die Grundwaffe ist unbegrenzt, andere zählen herunter', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [15, 50]);
    const am = p.sicht().amZug; schiessen(p, 45, 40, 0);
    expect(p.sicht().bros.find(b => b.id === am)!.munition[0]).toBe(-1);
  });
  it('Läuft die Zeit ab, verfällt der Zug ohne Schuss und ohne Munitionsverbrauch', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p);
    const vorher = p.sicht(); schritte(p, 20 * 60 - 1);
    expect(p.sicht().phase).toBe('zielen');
    schritte(p, 1);
    expect(p.sicht().phase).toBe('nachlauf'); expect(p.sicht().schuss).toBeUndefined();
    bis(p, () => p.sicht().phase === 'zielen');
    const nach = p.sicht();
    expect(nach.zug).toBe(2); expect(nach.amZug).not.toBe(vorher.amZug);
    expect(nach.bros.map(b => b.munition)).toEqual(vorher.bros.map(b => b.munition));
    expect(nach.bros.map(b => b.lp)).toEqual(vorher.bros.map(b => b.lp));
  });
  it('Fahren stoppt 600 ms nach der letzten Eingabe', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [15, 50]);
    const am = p.sicht().amZug, x = () => p.sicht().bros.find(b => b.id === am)!.x, x0 = x();
    p.eingabe(am, { art: 'steuerung', x: 1, y: 0, tasten: [] });
    schritte(p, 30); expect(x() - x0).toBeGreaterThan(0.5);
    schritte(p, 20); const x1 = x(); // 50 Schritte > 600 ms: der Verfall hat gegriffen
    expect(x1 - x0).toBeLessThan(1.5 * 0.65);
    schritte(p, 120); expect(x()).toBe(x1);
  });
  it('Fahren ist durch den Tank auf rund 5 m begrenzt, auch bei dauernder Eingabe', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [15, 50]);
    const am = p.sicht().amZug, x = () => p.sicht().bros.find(b => b.id === am)!.x, x0 = x();
    for (let i = 0; i < 600; i++) { if (i % 9 === 0) p.eingabe(am, { art: 'steuerung', x: 1, y: 0, tasten: [] }); p.schritt(); }
    expect(x() - x0).toBeGreaterThan(4.5); expect(x() - x0).toBeLessThan(5.3);
    expect(p.privatFuer(am)!.tank).toBe(0);
  });
  it('reset und neutralisieren halten den Bro an; Nicht-Zugbros fahren gar nicht', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [15, 50]);
    const am = p.sicht().amZug, fremd = p.sicht().reihe.find(i => i !== am)!, x = (id: string) => p.sicht().bros.find(b => b.id === id)!.x;
    const f0 = x(fremd), a0 = x(am);
    p.eingabe(fremd, { art: 'steuerung', x: 1, y: 0, tasten: [] });
    p.eingabe(am, { art: 'steuerung', x: -1, y: 0, tasten: [] }); schritte(p, 10);
    p.neutralisieren(); const a1 = x(am); schritte(p, 20);
    expect(x(fremd)).toBe(f0); expect(a1).toBeLessThan(a0); expect(x(am)).toBe(a1);
    p.eingabe(am, { art: 'steuerung', x: 1, y: 0, tasten: [] }); schritte(p, 5); p.eingabe(am, { art: 'reset' });
    const a2 = x(am); schritte(p, 20); expect(x(am)).toBe(a2);
  });
  it('Zu steile Wände blockieren das Fahren', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [15, 50]);
    const am = p.sicht().amZug, b = innen(p).bros.find(o => o.id === am)!;
    for (let i = 0; i < REGELN.spalten; i++) if ((i + 0.5) * REGELN.spaltenbreite > b.x + 1) innen(p).g[i] = 14;
    const x0 = b.x;
    for (let i = 0; i < 200; i++) { if (i % 9 === 0) p.eingabe(am, { art: 'steuerung', x: 1, y: 0, tasten: [] }); p.schritt(); }
    expect(b.x - x0).toBeLessThan(1.1);
  });
  it('Der Schuss wirkt erst, wenn der Flug vorbei ist, und löst dann Krater und Schaden aus', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [15, 25]);
    const s0 = p.sicht(), am = s0.amZug, gegner = s0.reihe.find(i => i !== am)!;
    const links = s0.bros.find(b => b.id === am)!.x < s0.bros.find(b => b.id === gegner)!.x;
    schiessen(p, links ? 45 : 135, 24); // v=7,2: Reichweite etwa 5 m, also kurz vor dem Gegner
    expect(p.sicht().schuss).toBeUndefined(); expect(p.sicht().gelaendeStand).toBe(0);
    ende(p);
    const s = p.sicht();
    expect(s.schuss!.flug.einschlaege.length).toBeGreaterThan(0);
    expect(s.gelaendeStand).toBeGreaterThan(0);
    expect(Math.min(...Array.from(s.gelaende))).toBeLessThan(8);
  });
  it('Ein Treffer kostet Lebenspunkte, zählt als verursachter Schaden; der eigene Bro nimmt die Hälfte', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [30, 31.5]);
    const am = p.sicht().amZug, gegner = p.sicht().reihe.find(i => i !== am)!;
    schiessen(p, 90, 0); ende(p);
    const s = p.sicht(), a = s.bros.find(b => b.id === am)!, g = s.bros.find(b => b.id === gegner)!;
    // Eigener Bro: halber Schaden (Abstand 0,5 m zum Mittelpunkt).
    expect(100 - a.lp).toBe(Math.round(25 * (1 - 0.5 / 2.4) * 0.5));
    expect(100 - g.lp).toBeGreaterThan(0);
    expect(a.schaden).toBe(100 - g.lp);
    expect(g.schaden).toBe(0);
  });
  it('Schadensfunktion: linear, Selbstschaden halb, Ausgeschiedene bleiben unberührt', () => {
    const e = { schaden: 20, sr: 4, sx: 10, sy: 5 } as Einschlag;
    const b = (id: string, x: number, raus = false) => ({ id, x, y: 4.5, raus });
    const r = schadenBei(e, [b('a', 10), b('b', 12), b('c', 14), b('d', 10, true), b('e', 11)], 'e');
    expect(r).toEqual([{ id: 'a', schaden: 20, selbst: false }, { id: 'b', schaden: 10, selbst: false }, { id: 'e', schaden: 8, selbst: true }]);
  });
  it('Fallschaden: über 2 m Fallhöhe 5 LP je Meter', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 10, [15, 50]);
    const am = p.sicht().amZug, gegner = p.sicht().reihe.find(i => i !== am)!;
    const gb = innen(p).bros.find(b => b.id === gegner)!;
    for (let i = 0; i < REGELN.spalten; i++) if (Math.abs((i + 0.5) * REGELN.spaltenbreite - gb.x) < 3) innen(p).g[i] = 6; // 4 m tiefer
    schiessen(p, 45, 20); ende(p);
    const g = p.sicht().bros.find(b => b.id === gegner)!;
    expect(g.lp).toBe(100 - 10); expect(g.y).toBeCloseTo(6, 3);
  });
  it('Wer ins Meer fällt, scheidet sofort aus; der andere gewinnt', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [15, 50]);
    const am = p.sicht().amZug, gegner = p.sicht().reihe.find(i => i !== am)!;
    const gb = innen(p).bros.find(b => b.id === gegner)!;
    for (let i = 0; i < REGELN.spalten; i++) if (Math.abs((i + 0.5) * REGELN.spaltenbreite - gb.x) < 3) innen(p).g[i] = -2;
    schiessen(p, 45, 20); ende(p);
    const s = p.sicht();
    expect(s.bros.find(b => b.id === gegner)!.raus).toBe(true);
    expect(s.phase).toBe('ende'); expect(s.gewinner).toEqual([am]); expect(s.grund).toBe('letzter');
    expect(s.schuss!.ausgeschieden).toContain(gegner);
    expect(p.privatFuer(am)).toMatchObject({ gewonnen: true, platz: 1 });
    expect(p.privatFuer(gegner)).toMatchObject({ gewonnen: false, platz: 2, raus: true });
  });
  it('Der Letzte mit Lebenspunkten gewinnt; verursachter Schaden ist durch die Restlebenspunkte gedeckelt', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [30, 31.5]);
    const am = p.sicht().amZug, gegner = p.sicht().reihe.find(i => i !== am)!;
    innen(p).bros.find(b => b.id === gegner)!.lp = 1;
    schiessen(p, 90, 0); ende(p);
    const s = p.sicht();
    expect(s.gewinner).toEqual([am]); expect(s.grund).toBe('letzter');
    expect(s.bros.find(b => b.id === am)!.schaden).toBe(1);
  });
  it('Scheiden die Letzten gleichzeitig aus, ist es ein Gleichstand, kein erfundener Sieg', () => {
    const p = new TanksPartie(leute(2), 5); zielenBereit(p); flachMit(p, 8, [30, 31.5]);
    for (const b of innen(p).bros) b.lp = 1;
    schiessen(p, 90, 0); ende(p);
    const s = p.sicht();
    expect(s.phase).toBe('ende'); expect(s.grund).toBe('gleichstand');
    expect([...s.gewinner].sort()).toEqual(['s0', 's1']);
    expect(s.bros.every(b => b.platz === 1)).toBe(true);
  });
  it('Bei drei Bros bleibt die Partie nach einem Ausscheiden offen', () => {
    const p = new TanksPartie(leute(3), 5); zielenBereit(p); flachMit(p, 8, [30, 31.5, 55]);
    const am = p.sicht().amZug;
    for (const b of innen(p).bros) if (b.id !== am && b.x < 40) b.lp = 1;
    schiessen(p, 90, 0); ende(p);
    expect(p.sicht().phase).not.toBe('ende');
  });
  it('Der Wind wechselt vor jedem Zug und hängt nicht von den Schüssen ab', () => {
    const a = new TanksPartie(leute(2), 77), b = new TanksPartie(leute(2), 77);
    zielenBereit(a); zielenBereit(b); flachMit(a, 8, [15, 50]);
    schiessen(a, 45, 40, 1); // a schießt, b lässt die Zeit ablaufen
    const winde: number[][] = [[], []];
    for (let z = 0; z < 6; z++) {
      for (const [i, p] of [a, b].entries()) { bis(p, () => p.sicht().zug === z + 2 && p.sicht().phase === 'zielen'); winde[i].push(p.sicht().wind); }
      if (a.sicht().phase === 'ende') break;
    }
    expect(winde[0]).toEqual(winde[1]);
    expect(new Set(winde[0]).size).toBeGreaterThan(1);
    expect(winde[0].every(w => Number.isInteger(w) && Math.abs(w) <= 10)).toBe(true);
  });
  it('Flut ab Runde 6: das Meer steigt je Runde um 0,5 m, die Partie endet nach zwölf Runden', () => {
    const p = new TanksPartie(leute(2), 5); flachMit(p, 8, [15, 50]);
    const meerBeiRunde: Record<number, number> = {};
    for (let i = 0; i < 400_000 && p.sicht().phase !== 'ende'; i++) { p.schritt(); const s = p.sicht(); meerBeiRunde[s.runde] ??= s.meer; }
    expect([1, 2, 3, 4, 5].map(r => meerBeiRunde[r])).toEqual([0, 0, 0, 0, 0]);
    expect([6, 7, 8, 9, 10, 11, 12].map(r => meerBeiRunde[r])).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    const s = p.sicht();
    expect(s.phase).toBe('ende'); expect(s.runde).toBe(12); expect(s.grund).toBe('grenze');
    // Gleichstand an Lebenspunkten und Schaden bleibt ein Gleichstand.
    expect([...s.gewinner].sort()).toEqual(['s0', 's1']);
  });
  it('Nach zwölf Runden entscheiden Lebenspunkte, dann verursachter Schaden', () => {
    const p = new TanksPartie(leute(3), 5); flachMit(p, 8, [15, 32, 50]);
    const m = innen(p).bros as unknown as { id: string; lp: number; schaden: number }[];
    m[0].lp = 60; m[1].lp = 60; m[2].lp = 30; m[0].schaden = 5; m[1].schaden = 9; m[2].schaden = 99;
    bis(p, () => p.sicht().phase === 'ende');
    const s = p.sicht();
    expect(s.grund).toBe('grenze'); expect(s.gewinner).toEqual(['s1']);
    expect(s.bros.map(b => b.platz)).toEqual([2, 1, 3]);
  });
  it('Steigendes Meer lässt tiefe Bros ertrinken', () => {
    const p = new TanksPartie(leute(2), 5); flachMit(p, 8, [15, 50]);
    const b1 = innen(p).bros[1];
    for (let i = 0; i < REGELN.spalten; i++) if (Math.abs((i + 0.5) * REGELN.spaltenbreite - 50) < 3) innen(p).g[i] = 1.2;
    b1.y = 1.2;
    bis(p, () => p.sicht().phase === 'ende');
    const s = p.sicht();
    expect(s.runde).toBe(8); expect(s.gewinner).toEqual(['s0']); expect(s.grund).toBe('letzter');
  });
  it('Aufgeben: Der Bro scheidet aus; am Zug springt die Runde weiter, bei Rest 1 endet die Partie', () => {
    const p = new TanksPartie(leute(3), 5); zielenBereit(p);
    const am = p.sicht().amZug; p.aufgeben(am);
    expect(p.sicht().phase).toBe('nachlauf');
    bis(p, () => p.sicht().phase === 'zielen');
    expect(p.sicht().amZug).not.toBe(am);
    expect(p.sicht().bros.find(b => b.id === am)).toMatchObject({ raus: true, aufgegeben: true, lp: 0 });
    const rest = p.sicht().reihe.filter(i => i !== am);
    p.aufgeben(rest[0]);
    expect(p.sicht().phase).toBe('ende'); expect(p.sicht().gewinner).toEqual([rest[1]]);
  });
  it('Gibt bei zwei Bros einer auf, gewinnt der andere sofort', () => {
    const p = new TanksPartie(leute(2), 5); p.aufgeben('s0');
    expect(p.sicht().phase).toBe('ende'); expect(p.sicht().gewinner).toEqual(['s1']); expect(p.sicht().grund).toBe('letzter');
    p.aufgeben('s1'); expect(p.sicht().gewinner).toEqual(['s1']);
  });
  it('privatFuer: Zugstand, Wartezeit in Zügen und nur eigene Werte', () => {
    const p = new TanksPartie(leute(4), 3); zielenBereit(p);
    const s = p.sicht(), reihe = s.reihe;
    const priv = reihe.map(id => p.privatFuer(id)!);
    expect(priv.map(x => x.amZug)).toEqual([true, false, false, false]);
    expect(priv.map(x => x.inZuegen)).toEqual([0, 1, 2, 3]);
    expect(priv[0].munition).toHaveLength(8); expect(priv[0].rest).toBe(20);
    expect(priv.every(x => x.wind === s.wind && x.zug === 1 && x.runde === 1 && x.phase === 'zielen')).toBe(true);
    schiessen(p, 45, 30);
    expect(p.privatFuer(reihe[0])).toMatchObject({ amZug: false, phase: 'flug', inZuegen: 3 });
    expect(p.privatFuer('gibtsnicht')).toBeUndefined();
  });
  it('Revanche: erst nach dem Ende, dann dieselben Bros mit neuer Insel und neuem Seed', () => {
    const p = new TanksPartie(leute(2), 5);
    expect(() => p.revanche(6)).toThrow();
    p.aufgeben('s0');
    const r = p.revanche(6), s = r.sicht();
    expect(s.phase).toBe('countdown'); expect(s.seed).toBe(6); expect(s.bros.map(b => b.id)).toEqual(['s0', 's1']);
    expect(s.bros.every(b => !b.raus && b.lp === 100)).toBe(true);
    expect(s.gelaende).not.toEqual(p.sicht().gelaende);
  });
  it('Rangfolge: Sieger vor Lebenspunkten vor Schaden, Gleiches teilt sich einen Platz', () => {
    const r = rangfolge([{ id: 'a', lp: 0, schaden: 0 }, { id: 'b', lp: 50, schaden: 10 }, { id: 'c', lp: 50, schaden: 10 }, { id: 'd', lp: 50, schaden: 30 }]);
    expect(r.map(x => [x.id, x.platz])).toEqual([['d', 1], ['b', 2], ['c', 2], ['a', 4]]);
    expect(rangfolge([{ id: 'a', lp: 0, schaden: 0 }, { id: 'b', lp: 50, schaden: 10 }], ['a'])[0]).toMatchObject({ id: 'a', platz: 1 });
  });
  it('Vier Bots spielen eine ganze Partie deterministisch zu Ende (mehrere Seeds)', () => {
    const spielen = (seed: number) => {
      const p = new TanksPartie(leute(4), seed), z = zufallsstrom(seed ^ 0xb07);
      let ticks = 0, letzterZug = 0;
      while (p.sicht().phase !== 'ende' && ticks++ < 600_000) {
        const s = p.sicht();
        if (s.phase === 'zielen' && s.zug !== letzterZug) {
          letzterZug = s.zug;
          const m = p.privatFuer(s.amZug)!.munition, frei = m.map((v, i) => (v !== 0 ? i : -1)).filter(i => i >= 0);
          p.eingabe(s.amZug, { art: 'feuer', zug: s.zug, winkel: 20 + Math.floor(z() * 140), staerke: 30 + Math.floor(z() * 70), waffe: frei[Math.floor(z() * frei.length)] });
        }
        p.schritt();
      }
      const s = p.sicht();
      return { ...s, gelaende: Array.from(s.gelaende), ticks };
    };
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const a = spielen(seed), b = spielen(seed);
      expect(a).toEqual(b);
      expect(a.phase).toBe('ende'); expect(a.runde).toBeLessThanOrEqual(12);
      expect(a.gewinner.length).toBeGreaterThanOrEqual(0);
      expect(a.bros.every(x => x.lp >= 0 && x.lp <= 100 && x.munition.every(m => m >= -1 && m <= 3))).toBe(true);
      if (a.grund === 'letzter') expect(a.bros.filter(x => !x.raus)).toHaveLength(1);
    }
  });
});
