import { describe, expect, it, vi } from 'vitest';

import type { Bestenliste } from '../../api';
import { Bahnrekordspeicher, neuigkeit, standAus, type Bahnrekordstand } from './rekord';

/*
 * Bahnrekord je Golf-Bahn (seit 22.09.2026): was die Zeile im Zwischenstand
 * aus der Serverliste nimmt, wann etwas „neu" ist, und dass je Bahn nur
 * einmal gefragt wird.
 */

function liste(eintraege: [string, number, boolean][], eigene: number | null): Bestenliste {
  return {
    gameId: 'golf',
    inhaltId: 'k01-der-erste-schlag',
    eintraege: eintraege.map(([name, wert, du], i) => ({
      rang: i + 1,
      accountId: `k${i}`,
      displayName: name,
      wert,
      richtung: 'tief',
      erzieltAm: '2026-09-22T20:00:00.000Z',
      du,
    })),
    eigene: eigene === null ? null : { rang: 3, wert: eigene, richtung: 'tief', erzieltAm: '2026-09-22T20:00:00.000Z' },
    anzahl: eintraege.length,
  };
}

describe('standAus', () => {
  it('nimmt den ersten Eintrag als Rekord und das eigene Beste, ohne selbst zu sortieren', () => {
    expect(standAus(liste([['Anna', 2, false], ['Bert', 3, false]], 4))).toEqual({
      rekord: { wert: 2, name: 'Anna', du: false },
      eigenes: 4,
    });
  });

  it('leere Bahn: kein Rekord, kein eigenes', () => {
    expect(standAus(liste([], null))).toEqual({ rekord: null, eigenes: null });
  });
});

describe('neuigkeit', () => {
  const stand: Bahnrekordstand = { rekord: { wert: 3, name: 'Anna', du: false }, eigenes: 5 };

  it('kleiner ist besser — Golf zaehlt Schlaege, Richtung tief', () => {
    expect(neuigkeit(stand, 2, true)).toEqual({ bahnrekord: true, eigenesBestes: true });
    expect(neuigkeit(stand, 4, true)).toEqual({ bahnrekord: false, eigenesBestes: true });
    expect(neuigkeit(stand, 6, true)).toEqual({ bahnrekord: false, eigenesBestes: false });
  });

  it('Gleichstand ist nicht neu, wie im Server', () => {
    expect(neuigkeit(stand, 3, true).bahnrekord).toBe(false);
    expect(neuigkeit(stand, 5, true).eigenesBestes).toBe(false);
  });

  it('die erste Zahl auf einer leeren Bahn ist Rekord und eigenes Bestes', () => {
    expect(neuigkeit({ rekord: null, eigenes: null }, 7, true)).toEqual({
      bahnrekord: true,
      eigenesBestes: true,
    });
  });

  it('nicht eingelocht, Tisch zaehlt nicht oder noch kein Stand: nichts leuchtet', () => {
    const nichts = { bahnrekord: false, eigenesBestes: false };
    expect(neuigkeit({ rekord: null, eigenes: null }, null, true)).toEqual(nichts);
    expect(neuigkeit(stand, 1, false)).toEqual(nichts);
    expect(neuigkeit(null, 1, true)).toEqual(nichts);
  });
});

describe('Bahnrekordspeicher', () => {
  it('fragt je Bahn genau einmal, auch bei gleichzeitigen Anfragen', async () => {
    const lade = vi.fn(async (_id: string) => liste([['Anna', 2, false]], null));
    const speicher = new Bahnrekordspeicher(lade);

    const [a, b] = await Promise.all([speicher.hole('k01'), speicher.hole('k01')]);
    await speicher.hole('k01');
    await speicher.hole('k02');

    expect(a).toEqual(b);
    expect(lade).toHaveBeenCalledTimes(2);
    expect(lade.mock.calls.map((c) => c[0])).toEqual(['k01', 'k02']);
    expect(speicher.vorhanden('k01')?.rekord?.wert).toBe(2);
    expect(speicher.vorhanden('k03')).toBeUndefined();
  });

  it('ein Fehlschlag wird als null behalten und nicht bei jedem Zeichnen neu versucht', async () => {
    const lade = vi.fn(async () => {
      throw new Error('503');
    });
    const speicher = new Bahnrekordspeicher(lade);
    expect(await speicher.hole('k01')).toBeNull();
    expect(await speicher.hole('k01')).toBeNull();
    expect(lade).toHaveBeenCalledTimes(1);
    expect(speicher.vorhanden('k01')).toBeNull();
  });
});
