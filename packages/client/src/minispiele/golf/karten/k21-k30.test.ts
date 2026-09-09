import { describe, expect, it } from 'vitest';

import { botLoestKarte, pruefeKarte } from '../karten-pruefen';
import { KARTEN_K21_K30 } from './k21-k30';

/**
 * Prüft den Bereich k21–k30: zehn Bahnen, geometrisch sauber und für den
 * Bot der Stufe „genie" innerhalb von Schlaglimit UND `par + 2` lösbar.
 * Getrennt je Karte (statt einer Sammelschleife), damit ein Fehlschlag sofort
 * zeigt, WELCHE Bahn kaputt ist, ohne den Testnamen erst aufschlüsseln zu
 * müssen.
 */
describe('Karten k21-k30', () => {
  it('enthaelt genau zehn Karten mit den richtigen Kennungen', () => {
    expect(KARTEN_K21_K30).toHaveLength(10);
    const ids = KARTEN_K21_K30.map((k) => k.id);
    expect(ids).toEqual([
      'k21-eisrutsche-zum-bumpergarten',
      'k22-turbo-ueberm-teich',
      'k23-portal-in-die-sandkammer',
      'k24-drehkreuz-vorm-loch',
      'k25-strudelfalle-an-der-abkuerzung',
      'k26-sprung-ueber-die-wasserzunge',
      'k27-doppelpilz-im-eis',
      'k28-kreiselkammer',
      'k29-schmales-sprungtor',
      'k30-nadeloehr-der-portale',
    ]);
  });

  it('haelt die zugeteilten Schwierigkeiten ein (k21-k28 Stufe 3, k29-k30 Stufe 4)', () => {
    for (const karte of KARTEN_K21_K30.slice(0, 8)) {
      expect(karte.schwierigkeit, karte.id).toBe(3);
    }
    for (const karte of KARTEN_K21_K30.slice(8)) {
      expect(karte.schwierigkeit, karte.id).toBe(4);
    }
  });

  it('deckt jede der neun Zonenarten mindestens zweimal ab', () => {
    const arten = ['beschleuniger', 'sand', 'eis', 'wasser', 'portal', 'bumper', 'strudel', 'sprungfeld', 'drehkreuz'];
    const zaehler = new Map<string, number>();
    for (const karte of KARTEN_K21_K30) {
      for (const zone of karte.zonen) {
        zaehler.set(zone.art, (zaehler.get(zone.art) ?? 0) + 1);
      }
    }
    for (const art of arten) {
      expect(zaehler.get(art) ?? 0, `Zonenart ${art}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('haelt die Groessenverteilung ein (2 klein, 5 mittel, 3 gross)', () => {
    const klein = (k: (typeof KARTEN_K21_K30)[number]) => k.breite <= 16 && k.hoehe <= 24;
    const gross = (k: (typeof KARTEN_K21_K30)[number]) => k.breite >= 28 && k.hoehe >= 44;
    const anzahlKlein = KARTEN_K21_K30.filter(klein).length;
    const anzahlGross = KARTEN_K21_K30.filter(gross).length;
    expect(anzahlKlein).toBe(2);
    expect(anzahlGross).toBe(3);
    expect(KARTEN_K21_K30.length - anzahlKlein - anzahlGross).toBe(5);
  });

  for (const karte of KARTEN_K21_K30) {
    describe(karte.id, () => {
      it('besteht die geometrische Pruefung ohne Befund', () => {
        expect(pruefeKarte(karte, KARTEN_K21_K30)).toEqual([]);
      });

      it('wird vom Bot "genie" innerhalb von Schlaglimit und par+2 geloest', () => {
        const ergebnis = botLoestKarte(karte, 'genie');
        expect(ergebnis.geloest, `${karte.id}: Bot lochte nicht ein`).toBe(true);
        expect(ergebnis.schlaege, `${karte.id}: Schlaglimit ueberschritten`).toBeLessThanOrEqual(karte.schlagLimit);
        expect(ergebnis.schlaege, `${karte.id}: mehr als par+2 Schlaege`).toBeLessThanOrEqual(karte.par + 2);
      });
    });
  }
});
