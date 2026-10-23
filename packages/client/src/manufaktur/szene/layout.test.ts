import { describe, expect, it } from 'vitest';

import { BREITE, TIPP_MIN, etage, gesamtHoehe, halle, reihen } from './layout';

/*
 * Das Layout ist die eine Quelle fuer Szene und Knoepfe. Geprueft wird, was
 * sonst erst am Handy auffaellt: Tippflaechen zu klein, Teile ausserhalb der
 * Breite, Etagen, die ineinander ragen.
 */

describe('Manufaktur-Layout', () => {
  it('jede Tippfläche ist mindestens 44 pt groß, auch auf dem kleinsten Handy', () => {
    const faktor = 375 / BREITE; // iPhone SE
    const h = halle();
    for (const r of [etage(0).meister, etage(0).schild, etage(0).arbeit, h.wagen, h.kopf, h.versandSchild, h.paternosterSchild, h.versandMeister, h.paternosterMeister]) {
      expect(r.b * faktor).toBeGreaterThanOrEqual(TIPP_MIN);
      expect(r.h * faktor).toBeGreaterThanOrEqual(TIPP_MIN);
    }
  });

  it('alles bleibt in der Breite und in seiner Etage', () => {
    for (let i = 0; i < 8; i += 1) {
      const e = etage(i);
      for (const r of [e.kiste, e.meister, e.arbeit, e.presse, e.schild]) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.b).toBeLessThanOrEqual(BREITE);
        expect(r.y).toBeGreaterThanOrEqual(e.reihe.y);
        expect(r.y + r.h).toBeLessThanOrEqual(e.reihe.y + e.reihe.h);
      }
    }
  });

  it('die gesperrte Etage gibt es nur, solange noch eine fehlt', () => {
    expect(reihen(1)).toBe(2);
    expect(reihen(8)).toBe(8);
    expect(gesamtHoehe(8)).toBeGreaterThan(gesamtHoehe(1));
  });
});
