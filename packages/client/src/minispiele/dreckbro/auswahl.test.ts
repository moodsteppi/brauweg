import { describe, expect, it } from 'vitest';

import { angebotFuer, spielbar, zugFuer } from './auswahl';
import type { DreckBroZug } from './sicht';

const ZUEGE: DreckBroZug[] = [
  { type: 'spielen', karte: 1, eigen: 0 },
  { type: 'spielen', karte: 1, eigen: 2 },
  { type: 'spielen', karte: 2, ziel: { sitz: 1, pinguin: 0 } },
  { type: 'spielen', karte: 2, ziel: { sitz: 2, pinguin: 1 } },
  { type: 'spielen', karte: 3, eigen: 0, ziel: { sitz: 1, pinguin: 0 } },
  { type: 'spielen', karte: 3, eigen: 1, ziel: { sitz: 1, pinguin: 2 } },
  { type: 'abwerfen', karte: 1 },
  { type: 'abwerfen', karte: 2 },
  { type: 'abwerfen', karte: 3 },
  { type: 'abwerfen', karte: 4 },
];

describe('DreckBro-Auswahl', () => {
  it('Pfuetze: nur die eigenen Pinguine aus der Liste leuchten', () => {
    const a = angebotFuer(ZUEGE, 1);
    expect(a.eigen).toEqual([0, 2]);
    expect(a.fremd).toEqual([]);
    expect(a.ohneZiel).toBeNull();
    expect(a.abwerfen).toEqual({ type: 'abwerfen', karte: 1 });
  });

  it('Schneeball: fremde Ziele, kein eigenes', () => {
    const a = angebotFuer(ZUEGE, 2);
    expect(a.eigen).toEqual([]);
    expect(a.fremd).toEqual([{ sitz: 1, pinguin: 0 }, { sitz: 2, pinguin: 1 }]);
    expect(zugFuer(ZUEGE, 2, null, { sitz: 2, pinguin: 1 })).toEqual(ZUEGE[3]);
  });

  it('Robbenklau: erst eigen, dann nur die dazu passenden fremden', () => {
    expect(angebotFuer(ZUEGE, 3).zweiZiele).toBe(true);
    expect(angebotFuer(ZUEGE, 3).fremd).toEqual([]);
    expect(angebotFuer(ZUEGE, 3, 1).fremd).toEqual([{ sitz: 1, pinguin: 2 }]);
    expect(zugFuer(ZUEGE, 3, 1, { sitz: 1, pinguin: 2 })).toEqual(ZUEGE[5]);
    expect(zugFuer(ZUEGE, 3, 0, { sitz: 1, pinguin: 2 })).toBeNull();
  });

  it('Karte nur zum Abwerfen', () => {
    expect(spielbar(ZUEGE, 4)).toBe(false);
    expect(spielbar(ZUEGE, 1)).toBe(true);
    const a = angebotFuer(ZUEGE, 4);
    expect(a.eigen).toEqual([]);
    expect(a.ohneZiel).toBeNull();
    expect(a.abwerfen).not.toBeNull();
  });

  it('Karte ohne Ziel', () => {
    const zuege: DreckBroZug[] = [{ type: 'spielen', karte: 7 }, { type: 'abwerfen', karte: 7 }];
    expect(angebotFuer(zuege, 7).ohneZiel).toEqual({ type: 'spielen', karte: 7 });
    expect(zugFuer(zuege, 7, null, null)).toEqual({ type: 'spielen', karte: 7 });
  });
});
