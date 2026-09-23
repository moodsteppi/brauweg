import { describe, expect, it } from 'vitest';

import {
  OHNE_MODIFIKATOR,
  ROULETTE,
  WIND_STAERKEN,
  modifikatorenFuerLoch,
  modusAus,
  rouletteFuerLoch,
  windFuerLoch,
} from './modifikator';

/*
 * Die Ziehung des Fun-Modus. Sie muss auf jedem Gerät dieselbe sein und darf
 * an nichts hängen als Saat und Lochindex — das Replay rechnet sie nach, und
 * ein Gerät, das mitten im Match neu lädt, ebenso.
 */

describe('Roulette je Loch', () => {
  it('ist festgeschrieben: dieselbe Saat zieht auf jedem Stand dieselbe Folge', () => {
    // Ändert sich diese Zeile, zieht dieselbe Saat andere Modifikatoren —
    // ein Protokollbruch (GOLF_MODULE_VERSION), siehe modifikator.ts.
    const folge = Array.from({ length: 15 }, (_, i) => rouletteFuerLoch(4711, i));
    expect(folge.join(',')).toBe(
      'riesenball,regen,miniball,schwerelos,wind,gummiwaende,zeitlupe,miniball,riesenball,zeitlupe,regen,wind,schwerelos,gummiwaende,schwerelos',
    );
    expect(windFuerLoch(4711, 3)).toEqual({ rx: 0, ry: -1, staerke: 0.4 });
    expect(windFuerLoch(1, 0)).toEqual({ rx: -0.707107, ry: -0.707107, staerke: 0.6 });
  });

  it('hängt an keinem Zustand: dieselbe Frage in beliebiger Reihenfolge, dieselbe Antwort', () => {
    const vorwaerts = Array.from({ length: 15 }, (_, i) => modifikatorenFuerLoch('fun', 99, i));
    const rueckwaerts = Array.from({ length: 15 }, (_, i) => modifikatorenFuerLoch('fun', 99, 14 - i)).reverse();
    expect(rueckwaerts).toEqual(vorwaerts);
  });

  it('bringt in sieben Löchern jeden Modifikator genau einmal', () => {
    for (let saat = 1; saat <= 200; saat += 1) {
      for (const runde of [0, 1]) {
        const sieben = Array.from({ length: 7 }, (_, i) => rouletteFuerLoch(saat, runde * 7 + i));
        expect(new Set(sieben).size).toBe(ROULETTE.length);
      }
    }
  });

  it('zieht nie zweimal hintereinander denselben — auch nicht über die Rundengrenze', () => {
    for (let saat = 1; saat <= 500; saat += 1) {
      for (let loch = 1; loch < 15; loch += 1) {
        expect(rouletteFuerLoch(saat, loch)).not.toBe(rouletteFuerLoch(saat, loch - 1));
      }
    }
  });

  it('Wind nur beim Wind, als Einheitsvektor aus der Tabelle, unter der Rollreibung', () => {
    for (let saat = 1; saat <= 100; saat += 1) {
      for (let loch = 0; loch < 15; loch += 1) {
        const mod = modifikatorenFuerLoch('fun', saat, loch);
        if (mod.roulette !== 'wind') {
          expect(mod.wind).toBeNull();
          continue;
        }
        expect(mod.wind).not.toBeNull();
        const w = mod.wind!;
        expect(Math.abs(Math.sqrt(w.rx * w.rx + w.ry * w.ry) - 1)).toBeLessThan(1e-5);
        expect(WIND_STAERKEN).toContain(w.staerke);
        expect(w.staerke).toBeLessThan(0.9);
      }
    }
  });

  it('klassisch gibt es nichts zu ziehen', () => {
    expect(modifikatorenFuerLoch('klassisch', 4711, 3)).toBe(OHNE_MODIFIKATOR);
    expect(modusAus(undefined)).toBe('klassisch');
    expect(modusAus('quatsch')).toBe('klassisch');
    expect(modusAus('fun')).toBe('fun');
  });

  it('die Modifikatoren eines Lochs sind eingefroren — Schnappschüsse teilen sie', () => {
    const mod = modifikatorenFuerLoch('fun', 4711, 4);
    expect(Object.isFrozen(mod)).toBe(true);
    if (mod.wind !== null) expect(Object.isFrozen(mod.wind)).toBe(true);
  });
});
