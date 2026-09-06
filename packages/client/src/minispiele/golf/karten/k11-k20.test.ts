import { describe, expect, it } from 'vitest';

import { botLoestKarte, pruefeKarte } from '../karten-pruefen';
import { KARTEN_K11_K20 } from './k11-k20';

describe('KARTEN_K11_K20', () => {
  it('enthaelt genau zehn Karten k11..k20', () => {
    expect(KARTEN_K11_K20).toHaveLength(10);
    const ids = KARTEN_K11_K20.map((k) => k.id);
    expect(ids).toEqual([
      'k11-sandkurve',
      'k12-turbozange',
      'k13-wasserinsel',
      'k14-eistrichter',
      'k15-langer-schlauch',
      'k16-bumperkammer',
      'k17-portalzange',
      'k18-strudelgarten',
      'k19-sprungtrichter',
      'k20-eisstrudel',
    ]);
  });

  it('jede Zonenart kommt mindestens zweimal vor', () => {
    const zaehler: Record<string, number> = {};
    for (const karte of KARTEN_K11_K20) {
      for (const zone of karte.zonen) zaehler[zone.art] = (zaehler[zone.art] ?? 0) + 1;
    }
    const arten = [
      'beschleuniger',
      'sand',
      'eis',
      'wasser',
      'portal',
      'bumper',
      'strudel',
      'sprungfeld',
      'drehkreuz',
    ];
    for (const art of arten) {
      expect(zaehler[art] ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  for (const karte of KARTEN_K11_K20) {
    describe(karte.id, () => {
      it('besteht die geometrische Pruefung', () => {
        expect(pruefeKarte(karte, KARTEN_K11_K20)).toEqual([]);
      });

      it('wird vom Bot (genie) im Limit geloest', () => {
        const probe = botLoestKarte(karte, 'genie');
        expect(probe.geloest).toBe(true);
        expect(probe.schlaege).toBeLessThanOrEqual(karte.schlagLimit);
        expect(probe.schlaege).toBeLessThanOrEqual(karte.par + 2);
      });
    });
  }
});
