import { describe, expect, it } from 'vitest';

import { TASTEN_REIHEN, buchstabeVon, tastenFarben } from './tasten';

describe('Browort-Tastatur', () => {
  it('nimmt je Buchstabe die beste Farbe', () => {
    const karte = tastenFarben([
      { wort: 'ESSEN', farben: ['g', 'x', 'x', 'v', 'x'] },
      { wort: 'NASEN', farben: ['v', 'x', 'g', 'x', 'g'] },
    ]);
    expect(karte.get('E')).toBe('g');
    expect(karte.get('S')).toBe('g');
    expect(karte.get('N')).toBe('g');
    expect(karte.get('A')).toBe('x');
    expect(karte.has('Q')).toBe(false);
  });

  it('hat alle Buchstaben und Umlaute, aber kein ß', () => {
    const tasten = TASTEN_REIHEN.flat().filter((t) => t.length === 1);
    expect(tasten).toHaveLength(29);
    expect(tasten).toEqual(expect.arrayContaining(['Ä', 'Ö', 'Ü']));
    expect(tasten).not.toContain('ß');
  });

  it('übersetzt die echte Tastatur', () => {
    expect(buchstabeVon('a')).toBe('A');
    expect(buchstabeVon('ö')).toBe('Ö');
    expect(buchstabeVon('Enter')).toBeNull();
    expect(buchstabeVon('1')).toBeNull();
  });
});
