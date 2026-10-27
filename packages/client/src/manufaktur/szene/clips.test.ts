import { describe, expect, it } from 'vitest';

import { CLIPS, RUHE, mische, poseBei } from './clips';

describe('Bewegungsabläufe', () => {
  it('Watscheln pendelt um ±6° und hebt in der Mitte ab', () => {
    expect(poseBei(CLIPS.laufen, 0).dreh).toBeCloseTo(-6);
    expect(poseBei(CLIPS.laufen, 0.5).dreh).toBeCloseTo(6);
    expect(poseBei(CLIPS.laufen, 0.25).hoch).toBeGreaterThan(0);
    // Schleife: nach einem Durchlauf wieder am Anfang.
    expect(poseBei(CLIPS.laufen, 1.0).dreh).toBeCloseTo(poseBei(CLIPS.laufen, 0).dreh);
  });

  it('einmalige Abläufe bleiben am Ende stehen, statt von vorn zu beginnen', () => {
    expect(poseBei(CLIPS.jubeln, 3)).toEqual(poseBei(CLIPS.jubeln, 1));
    expect(poseBei(CLIPS.jubeln, 1)).toEqual(RUHE);
  });

  it('Überblenden mischt zwei Posen gleichmäßig', () => {
    const a = { ...RUHE, dreh: -10 };
    const b = { ...RUHE, dreh: 10 };
    expect(mische(a, b, 0.5).dreh).toBeCloseTo(0);
    expect(mische(a, b, 2).dreh).toBeCloseTo(10);
  });

  it('jeder Ablauf beginnt bei 0 und endet bei 1', () => {
    for (const clip of Object.values(CLIPS)) {
      expect(clip.keyframes[0]!.t).toBe(0);
      expect(clip.keyframes[clip.keyframes.length - 1]!.t).toBe(1);
    }
  });
});
