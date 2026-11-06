/**
 * Zahlen und Zeiten folgen der aktiven Sprache (`format.ts`).
 *
 * jsdom meldet `en-US` als Gerätesprache; Deutsch bekommt darum die Vorgabe
 * `de-DE`, Englisch die Region des Geräts.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { kompakteZahl, restzeit, setzeSprachwahl, uhrzeit, zahl } from '.';
import { gebietsschema } from './format';

afterEach(() => setzeSprachwahl('de'));

describe('gebietsschema', () => {
  it('nimmt die Region des Geräts, wenn die Sprache passt', () => {
    expect(gebietsschema('en', ['en-GB', 'de-DE'])).toBe('en-GB');
    expect(gebietsschema('de', ['fr-FR', 'de-CH'])).toBe('de-CH');
    expect(gebietsschema('en', ['en_au'])).toBe('en-AU');
  });

  it('nie die Region einer anderen Sprache — sonst die Vorgabe', () => {
    expect(gebietsschema('en', ['de-DE'])).toBe('en-US');
    expect(gebietsschema('de', ['en-US'])).toBe('de-DE');
    expect(gebietsschema('de', ['de'])).toBe('de-DE');
    expect(gebietsschema('en', [])).toBe('en-US');
  });
});

describe('zahl', () => {
  it('Tausendertrenner und Komma je Sprache', () => {
    setzeSprachwahl('de');
    expect(zahl(1234567)).toBe('1.234.567');
    expect(zahl(2.5, { maximumFractionDigits: 1 })).toBe('2,5');
    setzeSprachwahl('en');
    expect(zahl(1234567)).toBe('1,234,567');
    expect(zahl(2.5, { maximumFractionDigits: 1 })).toBe('2.5');
  });
});

describe('kompakteZahl', () => {
  it('Deutsch wie bisher', () => {
    setzeSprachwahl('de');
    expect(kompakteZahl(550)).toBe('550');
    expect(kompakteZahl(1500)).toBe('1,5K');
    expect(kompakteZahl(1000)).toBe('1K');
    expect(kompakteZahl(9960)).toBe('10K');
    expect(kompakteZahl(12_345)).toBe('12K');
    expect(kompakteZahl(999_999)).toBe('1M');
    expect(kompakteZahl(9_999_999)).toBe('10M');
  });

  it('Englisch mit Punkt', () => {
    setzeSprachwahl('en');
    expect(kompakteZahl(1500)).toBe('1.5K');
    expect(kompakteZahl(2_400_000)).toBe('2.4M');
  });
});

describe('uhrzeit und restzeit', () => {
  const nachmittag = new Date(2026, 10, 6, 14, 5);

  it('Uhrzeit: 24 Stunden im Deutschen, AM/PM im amerikanischen Englisch', () => {
    setzeSprachwahl('de');
    expect(uhrzeit(nachmittag)).toBe('14:05');
    setzeSprachwahl('en');
    expect(uhrzeit(nachmittag)).toMatch(/^02:05\s?PM$/);
  });

  it('Restzeit mit Einheiten aus Intl, Rahmen aus dem Wörterbuch', () => {
    const jetzt = Date.UTC(2026, 10, 6, 12, 0);
    const in_ = (min: number) => new Date(jetzt + min * 60_000).toISOString();
    setzeSprachwahl('de');
    expect(restzeit(in_(40), jetzt)).toBe('noch 40 Min.');
    expect(restzeit(in_(12 * 60), jetzt)).toBe('noch 12 Std.');
    expect(restzeit(in_(27 * 60), jetzt)).toBe('noch 1 Tg. 3 Std.');
    expect(restzeit(in_(-1), jetzt)).toBe('gleich vorbei');
    expect(restzeit(null, jetzt)).toBe('');
    setzeSprachwahl('en');
    expect(restzeit(in_(12 * 60), jetzt)).toBe('12 hr left');
    expect(restzeit(in_(27 * 60), jetzt)).toBe('1 day 3 hr left');
    expect(restzeit(in_(-1), jetzt)).toBe('ending now');
  });
});
