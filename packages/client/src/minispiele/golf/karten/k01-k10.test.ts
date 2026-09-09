/**
 * Prüft die zehn Einstiegsbahnen k01–k10.
 *
 * Zwei Dinge je Bahn: `pruefeKarte` muss leer bleiben (Geometrie, Abstände,
 * Erreichbarkeit), und der Bot der Stufe „genie" muss sie lösen — nicht nur
 * irgendwie, sondern in höchstens `schlagLimit` UND höchstens `par + 2`
 * Schlägen. Die zweite Grenze ist strenger als `pruefeKarteMitBot` aus
 * `karten-pruefen.ts` (die nur gegen `schlagLimit` prüft) und stammt aus dem
 * Auftrag für diesen Bereich: Ein Par, das der beste Bot um mehr als zwei
 * Schläge verfehlt, wäre unehrlich gesetzt.
 */
import { describe, expect, it } from 'vitest';

import { botLoestKarte, pruefeKarte } from '../karten-pruefen';
import { KARTEN_K01_K10 } from './k01-k10';

describe('KARTEN_K01_K10', () => {
  it('enthaelt genau zehn Karten mit den Kennungen k01..k10', () => {
    expect(KARTEN_K01_K10).toHaveLength(10);
    const ids = KARTEN_K01_K10.map((k) => k.id);
    for (let i = 1; i <= 10; i += 1) {
      const nr = String(i).padStart(2, '0');
      expect(ids.some((id) => id.startsWith(`k${nr}-`))).toBe(true);
    }
  });

  it('setzt k01-k08 auf Schwierigkeit 1 und k09-k10 auf Schwierigkeit 2', () => {
    const sortiert = [...KARTEN_K01_K10].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < 8; i += 1) expect(sortiert[i].schwierigkeit).toBe(1);
    for (let i = 8; i < 10; i += 1) expect(sortiert[i].schwierigkeit).toBe(2);
  });

  it('zeigt jede der neun Zonenarten mindestens zweimal', () => {
    const arten = ['beschleuniger', 'sand', 'eis', 'wasser', 'portal', 'bumper', 'strudel', 'sprungfeld', 'drehkreuz'] as const;
    const zaehler = new Map<string, number>();
    for (const karte of KARTEN_K01_K10) {
      for (const zone of karte.zonen) {
        zaehler.set(zone.art, (zaehler.get(zone.art) ?? 0) + 1);
      }
    }
    for (const art of arten) {
      expect(zaehler.get(art) ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('mischt die Groessen: sechs klein, drei mittel, eine gross', () => {
    const groesse = (k: (typeof KARTEN_K01_K10)[number]): 'klein' | 'mittel' | 'gross' => {
      if (k.breite <= 16 && k.hoehe <= 24) return 'klein';
      if (k.breite >= 28 && k.hoehe >= 44) return 'gross';
      return 'mittel';
    };
    const zaehlung = { klein: 0, mittel: 0, gross: 0 };
    for (const karte of KARTEN_K01_K10) zaehlung[groesse(karte)] += 1;
    expect(zaehlung).toEqual({ klein: 6, mittel: 3, gross: 1 });
  });

  for (const karte of KARTEN_K01_K10) {
    describe(karte.id, () => {
      it('besteht die Geometrie- und Erreichbarkeitspruefung', () => {
        expect(pruefeKarte(karte, KARTEN_K01_K10)).toEqual([]);
      });

      it('wird vom Bot "genie" innerhalb von Schlaglimit und Par+2 geloest', () => {
        const ergebnis = botLoestKarte(karte, 'genie');
        expect(ergebnis.geloest).toBe(true);
        expect(ergebnis.schlaege).toBeLessThanOrEqual(karte.schlagLimit);
        expect(ergebnis.schlaege).toBeLessThanOrEqual(karte.par + 2);
      });
    });
  }
});
