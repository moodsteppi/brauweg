import { describe, expect, it } from 'vitest';

import { loeseBahnen } from '../karte';
import { BAHN_DATEIEN, DATEIEN_OHNE_BAHN, KARTEN, bahnNummer, karteMitId } from './index';

/*
 * Der Katalog des Clients, seit dem 22.09.2026 eine Datei je Bahn und per
 * `import.meta.glob` eingesammelt. Die Bahnen selbst prüfen die
 * Bereichstests (`k01-k10.test.ts` …); hier geht es darum, dass der Katalog
 * vollständig, eindeutig und auf jedem Gerät gleich ist.
 */
describe('Bahnkatalog des Clients', () => {
  it('sammelt alle Dateien ein — keine im Muster ohne `export const bahn`', () => {
    expect(DATEIEN_OHNE_BAHN).toEqual([]);
    expect(KARTEN.length).toBeGreaterThanOrEqual(40);
  });

  it('hat keine Kennung doppelt', () => {
    const ids = KARTEN.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('nennt jede Datei nach der Kennung ihrer Bahn', () => {
    // Sonst sucht, wer eine Kennung aus der Sicht vor sich hat, die falsche Datei.
    for (const { datei, karte } of BAHN_DATEIEN) expect(datei).toBe(`./${karte.id}.ts`);
  });

  it('ist stabil nach Kennung geordnet und jede Kennung traegt ihre Nummer vorn', () => {
    const ids = KARTEN.map((k) => k.id);
    expect(ids).toEqual([...ids].sort());
    for (const id of ids) expect(Number.isFinite(bahnNummer(id)), id).toBe(true);
    expect(ids[0]).toBe('k01-der-erste-schlag');
  });

  it('findet eine Bahn zur Kennung und nichts zu einer fremden', () => {
    expect(karteMitId('k23-portal-in-die-sandkammer')?.name).toBe('Portal in die Sandkammer');
    expect(karteMitId('k99-gibt-es-nicht')).toBeUndefined();
  });
});

describe('loeseBahnen', () => {
  it('liefert die Bahnen in der Folge der Kennungen, auch doppelt', () => {
    const r = loeseBahnen(['k40-meisterzirkel', 'k01-der-erste-schlag', 'k40-meisterzirkel'], KARTEN);
    expect(r.unbekannt).toEqual([]);
    expect(r.karten?.map((k) => k.id)).toEqual([
      'k40-meisterzirkel',
      'k01-der-erste-schlag',
      'k40-meisterzirkel',
    ]);
  });

  it('liefert bei einer unbekannten Kennung KEINE halbe Liste, sondern die fehlenden', () => {
    const r = loeseBahnen(['k01-der-erste-schlag', 'k41-neu', 'k42-auch-neu'], KARTEN);
    expect(r.karten).toBeNull();
    expect(r.unbekannt).toEqual(['k41-neu', 'k42-auch-neu']);
  });
});
