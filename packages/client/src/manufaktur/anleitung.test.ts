import { describe, expect, it } from 'vitest';

import { handle, meisterKosten, neuerStand, vorspulen } from '@brauweg/manufaktur-kern';

import { anleitungsSchritt } from './anleitung';

const T0 = Date.parse('2026-10-23T10:00:00Z');

describe('Fingeranleitung', () => {
  it('führt einmal durch die Kette: Presse, Paternoster, Wagen', () => {
    let stand = neuerStand(T0);
    expect(anleitungsSchritt(stand)).toEqual({ wo: 'presse', index: 0 });
    stand = handle(stand, { typ: 'arbeiten', ziel: { art: 'presse', index: 0 } }, T0).stand;
    expect(anleitungsSchritt(stand)).toBeNull(); // während die Presse arbeitet, wartet der Finger
    stand = vorspulen(stand, T0 + 10_000);
    expect(anleitungsSchritt(stand)).toEqual({ wo: 'paternoster' });
    stand = handle(stand, { typ: 'arbeiten', ziel: { art: 'paternoster' } }, T0 + 10_000).stand;
    stand = vorspulen(stand, T0 + 20_000);
    expect(anleitungsSchritt(stand)).toEqual({ wo: 'wagen' });
  });

  it('dann das erste Upgrade und der erste Meister — danach nichts mehr', () => {
    const verkauft = { ...neuerStand(T0), verdient: 5, taler: 5 };
    expect(anleitungsSchritt(verkauft)).toEqual({ wo: 'schild', index: 0 });
    const reich = { ...verkauft, taler: meisterKosten({ art: 'versand' }, 1), pressen: [{ ...verkauft.pressen[0]!, stufe: 2 }] };
    expect(anleitungsSchritt(reich)).toEqual({ wo: 'meister', art: 'versand' });
    expect(anleitungsSchritt({ ...reich, versand: { ...reich.versand, meister: true } })).toBeNull();
  });
});
