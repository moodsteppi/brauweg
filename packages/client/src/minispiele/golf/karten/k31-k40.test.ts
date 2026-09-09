import { describe, expect, it } from 'vitest';

import { botLoestKarte, pruefeKarte } from '../karten-pruefen';
import { KARTEN_K31_K40 } from './k31-k40';

/**
 * Die Meisterbahnen (k31–k40): Geometrie und Bot-Probe je Karte.
 *
 * Zwei Massstaebe nebeneinander, wie im Auftrag verlangt: `pruefeKarte` muss
 * leer bleiben, und der Bot der Stufe „genie" muss nicht nur ueberhaupt
 * einlochen (das prueft `pruefeKarteMitBot` schon global), sondern das mit
 * ehrlichem Par tun — mehr als `par + 2` Schlaege hiessen, der Par waere
 * schöngerechnet.
 */
describe('Meisterbahnen k31-k40', () => {
  it('sind genau zehn Karten mit den richtigen Kennungen', () => {
    expect(KARTEN_K31_K40).toHaveLength(10);
    const ids = KARTEN_K31_K40.map((k) => k.id);
    expect(ids).toEqual([
      'k31-zwillingsstrom',
      'k32-eisrutsche',
      'k33-seeplatte',
      'k34-katapultkorridor',
      'k35-sandsprint',
      'k36-nadeloehr',
      'k37-portalkarussell',
      'k38-sprungfeldkaskade',
      'k39-drehkreuzgasse',
      'k40-meisterzirkel',
    ]);
  });

  it('verteilt die Schwierigkeit wie zugeteilt: k31-k36 Stufe 4, k37-k40 Stufe 5', () => {
    for (const karte of KARTEN_K31_K40.slice(0, 6)) expect(karte.schwierigkeit).toBe(4);
    for (const karte of KARTEN_K31_K40.slice(6)) expect(karte.schwierigkeit).toBe(5);
  });

  it('nutzt jede der neun Zonenarten mindestens zweimal', () => {
    const zaehler = new Map<string, number>();
    for (const karte of KARTEN_K31_K40) {
      for (const zone of karte.zonen) zaehler.set(zone.art, (zaehler.get(zone.art) ?? 0) + 1);
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
    for (const art of arten) expect(zaehler.get(art) ?? 0).toBeGreaterThanOrEqual(2);
  });

  for (const karte of KARTEN_K31_K40) {
    describe(karte.id, () => {
      it('besteht die Geometrieprüfung', () => {
        expect(pruefeKarte(karte, KARTEN_K31_K40)).toEqual([]);
      });

      it('wird vom Bot "genie" in ≤ schlagLimit und ≤ par + 2 Schlaegen geloest', () => {
        const probe = botLoestKarte(karte, 'genie');
        expect(probe.geloest).toBe(true);
        expect(probe.schlaege).toBeLessThanOrEqual(karte.schlagLimit);
        expect(probe.schlaege).toBeLessThanOrEqual(karte.par + 2);
      });
    });
  }
});
