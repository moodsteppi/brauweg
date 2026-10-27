import { describe, expect, it } from 'vitest';

import { qrMatrix, qrPfad } from './qr';

/*
 * Der eigene QR-Kodierer gegen eine fremde Quelle.
 *
 * Die Erwartungen stammen aus `qrcode@1.5.4` (npm), nicht aus diesem Kodierer:
 * Ein Test, der die eigene Ausgabe festschreibt, waere bei einem Fehler im
 * Kodierer genauso gruen. Am 22.09.2026 lagen 1936 von 1936 Matrizen Feld
 * fuer Feld gleich (jede Bytelaenge bis zur Obergrenze, Stufen L und M,
 * Umlaute als UTF-8, siehe Kopf von qr.ts). Hier stehen die Waechter: eine
 * Matrix ganz ausgeschrieben, damit man im Fehlerfall SIEHT, wo es abweicht,
 * und Pruefsummen fuer jede Version bei jeder Stufe und jede der acht
 * Masken — ein Fehler in einem Teil, der erst ab Version 7 vorkommt
 * (Versionsinformation) oder nur bei mehreren Bloecken, faellt sonst nicht auf.
 */

const zeilen = (m: boolean[][]): string[] => m.map((z) => z.map((f) => (f ? '#' : '.')).join(''));

/** FNV-1a ueber die Matrix als '#.'-Zeichenkette, zeilenweise ohne Trenner. */
function pruefsumme(m: boolean[][]): string {
  let h = 0x811c9dc5;
  for (const c of zeilen(m).join('')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

describe('QR-Kodierer', () => {
  it('kodiert einen Einladungslink genau wie qrcode@1.5.4 (Version 3, Stufe M, Maske 3)', () => {
    expect(zeilen(qrMatrix('https://brauweg.de/beitritt/K7X9MQ'))).toEqual([
      '#######.#.##.###...##.#######',
      '#.....#.##..##..###...#.....#',
      '#.###.#.........#..#..#.###.#',
      '#.###.#.####..##.#.#..#.###.#',
      '#.###.#..#.#..#.####..#.###.#',
      '#.....#...##.#.###.##.#.....#',
      '#######.#.#.#.#.#.#.#.#######',
      '........#.#....###...........',
      '#.##.###...#.#.#####..#..#.##',
      '#..##......#.###.####.###...#',
      '########.....#..##..##....##.',
      '.#..#..#.###....#.#..#.#....#',
      '.#....###.###.####.....#.##..',
      '###.##......#.#.####..#...###',
      '..#..##.....##....######..###',
      '.#..##....###.###.###...#..#.',
      '##.##.#....##.##..####.###.#.',
      '..#....#.#.#..#...#....#.###.',
      '#...###....######...#.....#..',
      '..###..#..#..##..#...###..#..',
      '.#.########..###.#.########..',
      '........#...#....##.#...#####',
      '#######.##..#.#...###.#.##.#.',
      '#.....#.##..###.#.#.#...##...',
      '#.###.#..####...#...#####.##.',
      '#.###.#.#...##..#...#...##..#',
      '#.###.#.##.#..#..#.....#..#.#',
      '#.....#...#.....#...#.#..#.#.',
      '#######.##...#..#..##.##...#.',
    ]);
  });

  it.each([
    ['L', 'Brauweg', 21, 'cb0c1e5f'],
    [
      'M',
      'https://brauweg-staging.up.railway.app/beitritt/ABCDEF?von=gastgeber&runde=partykiste-am-freitag-abend-bei-tom-und-robin',
      45,
      'c5eb713b',
    ],
    ['M', 'x'.repeat(200), 57, '7769038d'],
  ] as const)('Stufe %s, %s: gleiche Groesse und Pruefsumme wie die Referenz', (stufe, text, groesse, summe) => {
    const m = qrMatrix(text, stufe);
    expect(m).toHaveLength(groesse);
    expect(pruefsumme(m)).toBe(summe);
  });

  /*
   * Je Version und Stufe ein Text, der die Version bis zum letzten Byte
   * fuellt: Dann entscheidet ein falscher Kapazitaetswert sofort ueber die
   * Groesse, und jeder Block ist voll belegt. Erzeugt mit `qrcode@1.5.4`
   * (`QRCode.create` mit Byte-Segment und fester Stufe) am 22.09.2026.
   */
  const FUELLUNG = 'abcdefghijklmnopqrstuvwxyz'.repeat(12);
  it.each([
    ['L', 1, 17, 21, '42ca8e63'],
    ['L', 2, 32, 25, '8a2ad6b1'],
    ['L', 3, 53, 29, '3ece0b03'],
    ['L', 4, 78, 33, '362cc8ab'],
    ['L', 5, 106, 37, 'eb2c8c4a'],
    ['L', 6, 134, 41, '2f603562'],
    ['L', 7, 154, 45, '811ab7d7'],
    ['L', 8, 192, 49, '1b18b4f'],
    ['L', 9, 230, 53, 'e7273de5'],
    ['L', 10, 271, 57, 'b1213dd7'],
    ['M', 1, 14, 21, '3a2ee289'],
    ['M', 2, 26, 25, '8326f8d5'],
    ['M', 3, 42, 29, '645894af'],
    ['M', 4, 62, 33, '504219d2'],
    ['M', 5, 84, 37, '76d1a67f'],
    ['M', 6, 106, 41, '10eb1575'],
    ['M', 7, 122, 45, 'b3cf42d3'],
    ['M', 8, 152, 49, '629c652f'],
    ['M', 9, 180, 53, '3025e75d'],
    ['M', 10, 213, 57, '8be757a5'],
  ] as const)('Stufe %s, Version %i randvoll (%i Bytes): wie die Referenz', (stufe, version, bytes, groesse, summe) => {
    const text = (`https://brauweg.de/beitritt/K7X9MQ#${stufe}${version}-` + FUELLUNG).slice(0, bytes);
    const m = qrMatrix(text, stufe);
    expect(m).toHaveLength(groesse);
    expect(pruefsumme(m)).toBe(summe);
  });

  /*
   * Die Masken 0 und 1 waehlt die Referenz bei keinem der Faelle oben; beide
   * sind echte Einladungslinks. Mit den obigen sind damit alle acht Masken
   * je einmal gegen die Referenz gehalten (0 bis 7: Maskenwahl samt
   * Strafpunkten).
   */
  it.each([
    ['M', 'https://brauweg.de/beitritt/ZZ2345', 29, '418e1ac3'],
    ['M', 'http://localhost:5173/beitritt/ABCDEF', 29, '9da0483f'],
  ] as const)('Stufe %s, %s: Maske wie die Referenz', (stufe, text, groesse, summe) => {
    const m = qrMatrix(text, stufe);
    expect(m).toHaveLength(groesse);
    expect(pruefsumme(m)).toBe(summe);
  });

  it('weicht auf Stufe L aus, wenn M nicht mehr bis Version 10 reicht', () => {
    // 214 Bytes: fuer M zu viel (Version 10 fasst 213), bei L reicht schon
    // Version 9 (230) — also 53 Felder und nicht 57.
    expect(qrMatrix('y'.repeat(214))).toHaveLength(53);
  });

  it('wirft bei einem Text, der in keine Version bis 10 passt — statt einen halben Code zu liefern', () => {
    expect(() => qrMatrix('z'.repeat(272))).toThrow();
  });

  it('beschreibt jedes dunkle Feld als ein Quadrat im SVG-Pfad', () => {
    const m = qrMatrix('https://brauweg.de/beitritt/K7X9MQ');
    const dunkel = m.flat().filter(Boolean).length;
    expect(qrPfad(m).match(/M\d+ \d+h1v1h-1z/g)).toHaveLength(dunkel);
  });
});
