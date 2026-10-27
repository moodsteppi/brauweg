import { describe, expect, it } from 'vitest';

import { botLoestKarte, pruefeKarte } from '../karten-pruefen';
import { KARTEN, bahnenImBereich } from './index';

/** Eine Datei je Bahn — der Bereich wird über die Nummer gebildet. */
const KARTEN_K41_K50 = bahnenImBereich(41, 50);

/**
 * Die erste Hälfte des Nachtlaufs vom 22.09.2026 (k41–k50): Robins „viel
 * mehr Maps". Dieselben Maßstäbe wie für die vierzig davor — `pruefeKarte`
 * bleibt leer, der Genie-Bot locht in höchstens `par + 2` ein —, dazu die
 * Angaben, die seit #206 an jeder neuen Bahn stehen sollen: Die Bahnauswahl
 * filtert und beschreibt nach ihnen. Was über alle zwanzig gilt (Themen,
 * Zonenarten, Strudel), prüft `k51-k60.test.ts`.
 */
describe('Nachtlauf-Bahnen k41-k50', () => {
  it('sind genau zehn Karten mit den richtigen Kennungen', () => {
    expect(KARTEN_K41_K50.map((k) => k.id)).toEqual([
      'k41-rueckenwind',
      'k42-die-strudelpfuetze',
      'k43-der-erste-huepfer',
      'k44-turbo-auf-dem-eis',
      'k45-die-drehtuer',
      'k46-portal-in-den-strudel',
      'k47-sprung-ueber-den-bach',
      'k48-kreiselallee',
      'k49-zwei-drehtueren',
      'k50-turbokurve',
    ]);
  });

  it('verteilt die Schwierigkeit wie zugeteilt: k41-k43 Stufe 1, k44-k48 Stufe 2, k49-k50 Stufe 3', () => {
    expect(KARTEN_K41_K50.map((k) => k.schwierigkeit)).toEqual([1, 1, 1, 2, 2, 2, 2, 2, 3, 3]);
  });

  for (const karte of KARTEN_K41_K50) {
    describe(karte.id, () => {
      it('trägt Beschreibung, Thema, Autor, Schlagworte und Dekor', () => {
        expect(karte.beschreibung?.length ?? 0).toBeGreaterThan(40);
        expect(karte.thema?.length ?? 0).toBeGreaterThan(0);
        expect(karte.autor).toBe('Aufsicht (Nachtlauf 22.09.2026)');
        expect(karte.tags?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(karte.dekor).toBeDefined();
      });

      it('besteht die Geometrieprüfung', () => {
        expect(pruefeKarte(karte, KARTEN)).toEqual([]);
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
