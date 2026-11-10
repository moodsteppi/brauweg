// @vitest-environment node
/**
 * Flying Bro: die Partie mit echter rapier-Physik.
 *
 * Die Ruheprobe steht so in der Spezifikation (Bauwerk, Prüfung): Jedes
 * Level fünf Sekunden ohne Schuss — nichts darf sich nennenswert bewegen,
 * keine Giraffe umfallen. Ein Level, das von allein einstürzt, ist ein
 * geschenkter Sieg und fiele sonst erst am Handy auf.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { BRO_WERTE, LEVELS, levelNach, hoechstpunkte, SPIELABLAUF } from '@brauweg/flyingbro-kern';

import { Partie, ladeRapier } from './partie';
import { abschuss, zugAus } from './zielen';

let R: Awaited<ReturnType<typeof ladeRapier>>;
beforeAll(async () => {
  R = await ladeRapier();
});

function lageAller(p: Partie): { x: number; y: number }[] {
  return [...p.teile.map((t) => t.koerper), ...p.giraffen.map((g) => g.koerper)].map((k) => {
    if (!k) return { x: NaN, y: NaN };
    const v = k.translation();
    return { x: v.x, y: v.y };
  });
}

describe('Flying Bro Partie', () => {
  it('Ruheprobe: alle 45 Level stehen fünf Sekunden ohne Schuss', () => {
    const wackelig: string[] = [];
    for (const level of LEVELS) {
      const p = new Partie(R, level);
      // Erst ein Bro nach links ins Leere: Danach zählt Schaden scharf (vor
      // dem ersten Schuss setzt sich das Bauwerk nur), und genau so steht
      // das Level, während man zielt. Vorher eine Sekunde stehen lassen wie
      // am Bildschirm: Vor dem ersten Schritt springt jeder Anfangskontakt
      // von null auf seine Last, und das sähe wie ein Stoß aus.
      for (let i = 0; i < 60; i++) p.schritt();
      p.schiessen({ x: -20, y: 5 });
      const vorher = lageAller(p);
      for (let i = 0; i < 300; i++) p.schritt();
      const nachher = lageAller(p);
      let weit = 0;
      vorher.forEach((a, i) => {
        const b = nachher[i]!;
        weit = Math.max(weit, Number.isNaN(b.x) ? Infinity : Math.hypot(b.x - a.x, b.y - a.y));
      });
      const umgefallen = p.giraffen.filter((g) => g.umgefallen).length;
      const gebrochen = p.teile.filter((t) => !t.koerper).length;
      if (weit > 0.05 || umgefallen > 0 || gebrochen > 0 || p.punkte > 0) {
        wackelig.push(`${level.id}: ${weit.toFixed(3)} m, ${umgefallen} Giraffen um, ${gebrochen} gebrochen, ${p.punkte} Punkte`);
      }
      p.freigeben();
    }
    expect(wackelig).toEqual([]);
  });

  it('ein voller Schuss ins erste Level trifft, bringt Punkte und endet mit Ruhe', () => {
    const level = levelNach('w1-01')!;
    const p = new Partie(R, level);
    expect(p.phase).toBe('zielen');
    expect(p.imBand()).toBe(level.bros[0]);
    // Flach nach rechts oben, voll gezogen.
    const v = abschuss(p.imBand()!, zugAus(-200, 60, 200))!;
    expect(p.schiessen(v)).toBe(true);
    expect(p.phase).toBe('flug');
    expect(p.verschossen).toBe(1);
    let n = 0;
    while (p.phase === 'flug' && n < 60 * (SPIELABLAUF.ruheMaxS + 1)) {
      p.schritt();
      n++;
    }
    expect(p.phase).not.toBe('flug');
    expect(p.bro).toBeNull();
    expect(p.punkte).toBeLessThanOrEqual(hoechstpunkte(level));
    p.freigeben();
  });

  it('die ersten Level sind mit vollen Schüssen zu schaffen', () => {
    // Gegenprobe zur Ruheprobe: Wer Schaden nur zu zögerlich zählt, bekommt
    // stehende Level, aber keine, die man gewinnen kann.
    const geschafft: string[] = [];
    for (const id of ['w1-01', 'w1-02', 'w1-03']) {
      const level = levelNach(id)!;
      for (let grad = 0; grad <= 70 && !geschafft.includes(id); grad += 2) {
        const p = new Partie(R, level);
        for (let i = 0; i < 30; i++) p.schritt();
        while (p.imBand()) {
          const tempo = BRO_WERTE[p.imBand()!].hoechsttempo;
          const w = (grad * Math.PI) / 180;
          p.schiessen({ x: Math.cos(w) * tempo, y: Math.sin(w) * tempo });
          let n = 0;
          while (p.phase === 'flug' && n++ < 600) p.schritt();
        }
        if (p.phase === 'gewonnen') {
          geschafft.push(id);
          expect(p.punkte).toBeLessThanOrEqual(hoechstpunkte(level));
        }
        p.freigeben();
      }
    }
    expect(geschafft).toEqual(['w1-01', 'w1-02', 'w1-03']);
  });

  it('zu kurzer Zug schießt nicht', () => {
    const p = new Partie(R, levelNach('w1-01')!);
    expect(abschuss('pelle', zugAus(-5, 0, 200))).toBeNull();
    expect(p.phase).toBe('zielen');
    p.freigeben();
  });

  it('Fähigkeit nur im Flug und nur einmal; Gleitflug endet beim Loslassen', () => {
    const level = LEVELS.find((l) => l.bros.includes('malve'))!;
    const p = new Partie(R, level);
    expect(p.tippen()).toBe(false); // noch nicht geschossen
    // Bis Malve dran ist, die anderen ins Leere schießen (nach links weg).
    while (p.imBand() !== 'malve') {
      p.schiessen({ x: -20, y: 5 });
      while (p.phase === 'flug') p.schritt();
    }
    p.schiessen({ x: 8, y: 14 });
    p.schritt();
    expect(p.tippen()).toBe(true);
    expect(p.bro!.form).toBe('gleit');
    expect(p.tippen()).toBe(false);
    for (let i = 0; i < 10; i++) p.schritt();
    p.loslassen();
    expect(p.bro!.form).toBe('kreis');
    expect(p.bro!.ausgeloest).toBe(true);
    p.freigeben();
  });

  it('Bauchrutscher und Eisblock tauschen die Form', () => {
    for (const [art, form] of [['pelle', 'rutsch'], ['tjark', 'eis']] as const) {
      const level = LEVELS.find((l) => l.bros[0] === art)!;
      const p = new Partie(R, level);
      p.schiessen({ x: 6, y: 10 });
      p.schritt();
      expect(p.tippen()).toBe(true);
      expect(p.bro!.form).toBe(form);
      for (let i = 0; i < 30; i++) p.schritt();
      p.freigeben();
    }
  });

  it('alle Bros verschossen ohne Treffer: verloren, kein Bonus', () => {
    const level = levelNach('w1-01')!;
    const p = new Partie(R, level);
    while (p.imBand()) {
      p.schiessen({ x: -20, y: 5 });
      let n = 0;
      while (p.phase === 'flug' && n++ < 600) p.schritt();
    }
    expect(p.phase).toBe('verloren');
    expect(p.verschossen).toBe(level.bros.length);
    p.freigeben();
  });
});
