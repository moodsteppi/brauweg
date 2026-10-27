import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BILD, manufakturBild, presseBild, stapelBild } from './bilder';

// Wie App.pakete.test.ts: vitest laeuft im Paketordner.
const PUBLIC = resolve(process.cwd(), 'public');

describe('Manufaktur-Bilder', () => {
  it('wechselt das Pressenbild mit den Leistungssprüngen', () => {
    expect(presseBild(1)).toBe('/manufaktur/presse-1.webp');
    expect(presseBild(24)).toBe('/manufaktur/presse-1.webp');
    expect(presseBild(25)).toBe('/manufaktur/presse-2.webp');
    expect(presseBild(99)).toBe('/manufaktur/presse-2.webp');
    expect(presseBild(100)).toBe('/manufaktur/presse-3.webp');
    expect(presseBild(200)).toBe('/manufaktur/presse-3.webp');
  });

  it('bleibt bei Stapeln und Manufakturen im gelieferten Bereich', () => {
    expect(stapelBild(0)).toBe('/manufaktur/stapel-1.webp');
    expect(stapelBild(7)).toBe('/manufaktur/stapel-8.webp');
    expect(stapelBild(12)).toBe('/manufaktur/stapel-8.webp');
    expect(manufakturBild(1)).toBe('/manufaktur/manufaktur-1.webp');
    expect(manufakturBild(6)).toBe('/manufaktur/manufaktur-5.webp');
  });

  // Kein <img> auf eine Datei, die es nicht gibt (CLAUDE.md): Jeder Pfad,
  // den der Bildschirm bauen kann, muss unter public/ liegen.
  it('zeigt nur auf Dateien, die es gibt', () => {
    const pfade = [
      ...[1, 25, 100].map(presseBild),
      ...Array.from({ length: 8 }, (_, i) => stapelBild(i)),
      ...[1, 2, 3, 4, 5].map(manufakturBild),
      ...Object.values(BILD),
      '/manufaktur/taler.webp',
      '/manufaktur/laufband.webp',
      '/manufaktur/wand-keller.webp',
      '/manufaktur/kulisse-halle.webp',
    ];
    for (const pfad of pfade) expect(existsSync(join(PUBLIC, pfad)), pfad).toBe(true);
  });
});
