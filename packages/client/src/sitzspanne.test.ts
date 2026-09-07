import { describe, expect, it } from 'vitest';

import { sitzSpanne } from './sitzspanne';

/*
 * Die Spielkarte zeigt die erlaubten Sitzzahlen als Spanne. Was hier falsch
 * waere, verspraeche einen Tisch, den es nicht gibt — oder verschwiege einen.
 */
describe('sitzSpanne', () => {
  it('fasst eine lueckenlose Reihe zu einer Spanne zusammen (Golf)', () => {
    expect(sitzSpanne([1, 2, 3, 4, 5, 6, 7, 8])).toBe('1–8');
  });

  it('laesst eine einzelne Zahl stehen (Skat, Feldherr)', () => {
    expect(sitzSpanne([3])).toBe('3');
    expect(sitzSpanne([2])).toBe('2');
  });

  it('macht auch aus zwei Nachbarn eine Spanne (Doppelkopf)', () => {
    expect(sitzSpanne([4, 5])).toBe('4–5');
  });

  it('haelt Luecken sichtbar, statt sie zu ueberbruecken', () => {
    expect(sitzSpanne([2, 4])).toBe('2, 4');
    expect(sitzSpanne([2, 3, 4, 6])).toBe('2–4, 6');
    expect(sitzSpanne([1, 3, 4, 5, 8, 9])).toBe('1, 3–5, 8–9');
  });

  it('ist gegen Reihenfolge und Doppelte unempfindlich', () => {
    expect(sitzSpanne([6, 3, 5, 4, 4])).toBe('3–6');
  });

  it('gibt bei leerer Liste nichts aus', () => {
    expect(sitzSpanne([])).toBe('');
  });
});
