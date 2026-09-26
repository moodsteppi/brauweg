import { describe, expect, it } from 'vitest';
import { BIOME } from './screens/Pfad';
import { sicherAb } from './screens/StartNeu';
import { STATIONEN, zwischenCheckpoints } from './trophaeenweg';

describe('Trophäenweg im neuen Hub', () => {
  it('hat dieselben Stationen und Schwellen wie der Pfad', () => {
    // Zwei Listen derselben Sache: Laufen sie auseinander, zeigt der Weg
    // andere Schwellen als der Server zählt.
    expect(STATIONEN.map((s) => [s.name, s.ab])).toEqual(BIOME.map((b) => [b.name, b.cp]));
  });

  it('legt alle 100 bis 1.000 einen Checkpoint zwischen die Stationen', () => {
    expect(zwischenCheckpoints()).toEqual([200, 300, 400, 600, 700, 800, 900]);
  });

  it('nennt den Checkpoint, unter den man nicht mehr fällt', () => {
    expect(sicherAb(0)).toBe(0);
    expect(sicherAb(773)).toBe(700);
    expect(sicherAb(1000)).toBe(1000);
    expect(sicherAb(1249)).toBe(1000);
    expect(sicherAb(1250)).toBe(1250);
  });

  it('gibt jeder Station außer der Heimat eine Truhe und einen Gegenstand', () => {
    for (const s of STATIONEN.slice(1)) {
      expect(s.truhe).not.toBeNull();
      expect(s.gegenstand).toBeTruthy();
    }
    expect(STATIONEN[0]!.truhe).toBeNull();
  });
});
