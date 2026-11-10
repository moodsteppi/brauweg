import { expect, it } from 'vitest';
import { TanksPartie } from './partie';
import { flugNachrechnen, flugZeit } from './abspiel';
import { WAFFEN_ANZAHL } from './regeln';

// Die Bühne zeigt eine nachgerechnete Bahn. Weicht sie von der Partie ab, landet die Kugel woanders als der Schaden.
it('die nachgerechnete Bahn ist für jede Waffe dieselbe, die die Partie auflöst', () => {
  for (let waffe = 0; waffe < WAFFEN_ANZAHL; waffe++) {
    const k = new TanksPartie([{ id: 'a', name: 'A', farbe: '#fff' }, { id: 'b', name: 'B', farbe: '#000' }, { id: 'c', name: 'C', farbe: '#f00' }], 1000 + waffe);
    while (k.sicht().phase !== 'zielen') k.schritt();
    const dran = k.sicht().amZug;
    k.eingabe(dran, { art: 'steuerung', x: 1, y: 0, tasten: [] });
    for (let i = 0; i < 20; i++) k.schritt();
    k.eingabe(dran, { art: 'feuer', zug: 1, winkel: 40 + waffe * 12, staerke: 55 + waffe * 4, waffe });
    const s = k.sicht();
    expect(s.phase).toBe('flug');
    const nach = flugNachrechnen(s)!;
    let n = 0;
    while (k.sicht().phase === 'flug' && n++ < 2000) k.schritt();
    expect(nach).toEqual(k.sicht().schuss!.flug);
  }
});

it('die Abspielzeit läuft von 0 bis zur Flugdauer, lange Flüge schneller', () => {
  const kurz = { teile: [], einschlaege: [], dauer: 2 };
  expect(flugZeit(kurz, 2)).toBe(0);
  expect(flugZeit(kurz, 1)).toBeCloseTo(1);
  expect(flugZeit(kurz, 0)).toBe(2);
  const lang = { teile: [], einschlaege: [], dauer: 10 };
  expect(flugZeit(lang, 2.5)).toBeCloseTo(5);
  expect(flugZeit(lang, 0)).toBe(10);
});
