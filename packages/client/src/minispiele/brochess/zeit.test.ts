import { describe, expect, it } from 'vitest';

import { ZEITKONTROLLEN, regelnFuer, uhrText, zeitText, zeitkontrolle } from './zeit';

describe('Zeitkontrollen', () => {
  it('beschriftet wie die Auswahl', () => {
    expect(ZEITKONTROLLEN.map(zeitText)).toEqual([
      '1 min', '1 + 1', '2 + 1', '30 Sek', '20 Sek + 1',
      '3 min', '3 + 2', '5 min', '5 + 5', '5 + 2',
      '10 min', '15 + 10', '30 min', '10 + 5', '20 min', '60 min',
    ]);
  });

  it('Unbekanntes und Fehlendes fällt auf zehn Minuten', () => {
    expect(zeitkontrolle('quatsch').id).toBe('10+0');
    expect(zeitkontrolle(null).id).toBe('10+0');
    expect(regelnFuer(zeitkontrolle('3+2'))).toEqual({ bedenkzeitMs: 180_000, zuschlagMs: 2_000 });
  });

  it('zeigt die Uhr mit Zehnteln erst unter 20 Sekunden', () => {
    expect(uhrText(600_000)).toBe('10:00');
    expect(uhrText(59_001)).toBe('1:00');
    expect(uhrText(20_000)).toBe('0:20');
    expect(uhrText(19_950)).toBe('0:19.9');
    expect(uhrText(4_321)).toBe('0:04.3');
    expect(uhrText(-5)).toBe('0:00.0');
    expect(uhrText(3_600_000)).toBe('1:00:00');
  });
});
