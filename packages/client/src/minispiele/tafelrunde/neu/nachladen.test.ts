import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { nachladenZuruecksetzen, useNachladen } from './nachladen';

/*
 * Das Nachladen von TafelrundeNeu: fertig, wenn alles da oder ausgefallen ist
 * — und spaetestens nach der Ruhefrist. Ein einmal geholtes Bild wird nicht
 * noch einmal geholt.
 */

describe('useNachladen', () => {
  beforeEach(() => {
    nachladenZuruecksetzen();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('zaehlt erledigte Dateien, auch ausgefallene, und meldet dann fertig', async () => {
    const offen: Record<string, { ja: () => void; nein: () => void }> = {};
    const holen = vi.fn(
      (pfad: string) =>
        new Promise<void>((ja, nein) => {
          offen[pfad] = { ja, nein: () => nein(new Error('weg')) };
        }),
    );
    const { result } = renderHook(() => useNachladen(['/a.webp', '/b.webp'], { holen }));
    expect(result.current).toEqual({ fertig: false, erledigt: 0, gesamt: 2 });
    await act(async () => {
      offen['/a.webp']!.ja();
    });
    expect(result.current.erledigt).toBe(1);
    await act(async () => {
      offen['/b.webp']!.nein();
    });
    expect(result.current).toEqual({ fertig: true, erledigt: 2, gesamt: 2 });
  });

  it('gibt nach der Ruhefrist auf, statt den Tisch zu sperren', () => {
    const holen = vi.fn(() => new Promise<void>(() => {}));
    const { result } = renderHook(() => useNachladen(['/haengt.webp'], { holen, fristMs: 1000 }));
    expect(result.current.fertig).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.fertig).toBe(true);
  });

  it('holt jede Datei nur einmal, auch ueber zwei Bildschirme', async () => {
    const holen = vi.fn(() => Promise.resolve());
    const erster = renderHook(() => useNachladen(['/x.webp'], { holen }));
    await act(async () => {});
    erster.unmount();
    const zweiter = renderHook(() => useNachladen(['/x.webp'], { holen }));
    expect(zweiter.result.current.fertig).toBe(true);
    expect(holen).toHaveBeenCalledTimes(1);
  });

  it('eine leere Liste ist sofort fertig', () => {
    const { result } = renderHook(() => useNachladen([]));
    expect(result.current).toEqual({ fertig: true, erledigt: 0, gesamt: 0 });
  });
});
