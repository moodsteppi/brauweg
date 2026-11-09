// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BauPartie, ladeBauphysik } from './partie';

let r: Awaited<ReturnType<typeof ladeBauphysik>>;
const offen: BauPartie[] = [];
beforeAll(async () => { r = await ladeBauphysik(); });
afterEach(() => { offen.splice(0).forEach(p => p.freigeben()); });
function partie(modus: 'rennen' | 'standfest' = 'rennen', anzahl = 1): BauPartie {
  const p = new BauPartie(r, Array.from({ length: anzahl }, (_, i) => ({ id: String(i), name: `Spieler ${i}`, farbe: '#79e3c9' })), modus, 217);
  offen.push(p); return p;
}
function schritte(p: BauPartie, n: number): void { for (let i = 0; i < n; i++) p.schritt(); }
function start(p: BauPartie): void { schritte(p, 181); }
function taste(p: BauPartie, id: string, t: string): void {
  p.eingabe(id, { art: 'steuerung', x: 0, y: 0, tasten: [t] });
  p.eingabe(id, { art: 'steuerung', x: 0, y: 0, tasten: [] });
}

describe('Bro Building Battle mit echter Physik', () => {
  it('startet erst nach Countdown und hält die Bauteilfolge für alle gleich', () => {
    const p = partie('rennen', 4);
    expect(p.sicht().phase).toBe('countdown'); schritte(p, 170);
    expect(p.sicht().bahnen.every(b => b.steine.length === 0)).toBe(true);
    schritte(p, 11);
    expect(p.sicht().phase).toBe('spiel');
    expect(new Set(p.sicht().bahnen.map(b => b.steine[0].form)).size).toBe(1);
  });
  it('behält kurze Tastenflanken, dreht einmal und beschleunigt nur das aktuelle Teil', () => {
    const p = partie(); start(p);
    taste(p, '0', 'drehen'); schritte(p, 1);
    expect(p.sicht().bahnen[0].steine[0].winkel).toBeCloseTo(-Math.PI / 2, 3);
    const y = p.sicht().bahnen[0].steine[0].y;
    taste(p, '0', 'fallen'); schritte(p, 10);
    expect(y - p.sicht().bahnen[0].steine[0].y).toBeGreaterThan(2);
    schritte(p, 80);
    const b = p.sicht().bahnen[0];
    expect(b.gebaut).toBeGreaterThanOrEqual(1);
    expect(b.steine.some(s => s.aktiv)).toBe(true);
  });
  it('ignoriert unbekannte Spieler und setzt hängende Eingaben nach 600 ms zurück', () => {
    const p = partie(); start(p);
    p.eingabe('fremd', { art: 'steuerung', x: 1, y: 0, tasten: [] });
    schritte(p, 5); expect(p.sicht().bahnen[0].steine[0].x).toBe(0);
    p.eingabe('0', { art: 'steuerung', x: 1, y: 0, tasten: [] });
    schritte(p, 38); const x = p.sicht().bahnen[0].steine[0].x;
    schritte(p, 10); expect(p.sicht().bahnen[0].steine[0].x).toBeCloseTo(x, 2);
  });
  it('jeder abgestürzte Körper kostet genau ein Leben, bei drei endet Solo', () => {
    const p = partie('standfest'); start(p);
    for (let i = 0; i < 6000 && p.sicht().phase !== 'ende'; i++) {
      if (i % 10 === 0) p.eingabe('0', { art: 'steuerung', x: 1, y: 0, tasten: [] });
      p.schritt();
    }
    const s = p.sicht(); expect(s.phase).toBe('ende');
    expect(s.bahnen[0].leben).toBe(0); expect(s.bahnen[0].verloren).toBe(3); expect(s.gewinner).toEqual([]);
  });
  it('vier gleich gesteuerte Türme verhalten sich gleich und eine ganze Runde bleibt begrenzt', () => {
    const p = partie('rennen', 4); start(p);
    for (let i = 0; i < 10_900 && p.sicht().phase !== 'ende'; i++) {
      if (i % 90 === 0) for (let j = 0; j < 4; j++) taste(p, String(j), 'fallen');
      p.schritt();
    }
    const s = p.sicht(); expect(s.phase).toBe('ende');
    expect(s.bahnen.every(b => b.verbraucht <= 30 && b.steine.length <= 30 && Number.isFinite(b.hoehe))).toBe(true);
    expect(new Set(s.bahnen.map(b => b.hoehe)).size).toBe(1);
    expect(new Set(s.bahnen.map(b => b.platz)).size).toBe(1);
  });
  it('gestapelte Bauteile bleiben echte Körper und können kippen', () => {
    const p = partie(); start(p); let gekippt = false;
    for (let i = 0; i < 1800; i++) {
      if (i % 90 === 0) taste(p, '0', 'fallen'); p.schritt();
      if (i % 30 === 0) gekippt ||= p.sicht().bahnen[0].steine.some(s => !s.aktiv && Math.abs(s.winkel) > .03);
    }
    expect(gekippt).toBe(true);
  });
  it('gleichzeitig abgestürzte Türme bekommen keinen erfundenen Sieg', () => {
    const p = partie('standfest', 2); start(p);
    for (let i = 0; i < 6000 && p.sicht().phase !== 'ende'; i++) {
      if (i % 10 === 0) for (const id of ['0', '1']) p.eingabe(id, { art: 'steuerung', x: 1, y: 0, tasten: [] });
      p.schritt();
    }
    expect(p.sicht().bahnen.every(b => b.leben === 0)).toBe(true);
    expect(p.sicht().gewinner).toEqual([]); expect(p.sicht().grund).toBe('Keine Leben mehr.');
  });
  it('Aufgeben entscheidet das Duell und eine neue Partie beginnt ohne Restzustand', () => {
    const p = partie('standfest', 2); start(p); p.aufgeben('0'); p.schritt();
    expect(p.sicht().gewinner).toEqual(['1']);
    p.freigeben(); p.freigeben();
    const neu = partie('standfest', 2); expect(neu.sicht().bahnen.every(b => b.leben === 3 && b.verbraucht === 0)).toBe(true);
  });
});
