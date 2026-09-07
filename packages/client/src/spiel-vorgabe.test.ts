import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Vorab-Ruf des Regelsatzes.
 *
 * Er ist die Antwort auf eine Falle, die man nicht sieht: Wer beim
 * Tischanlegen eine `config` mitschickt, UEBERSTIMMT das Spielmodul, und beim
 * Auseinanderlaufen wird nichts rot (siehe spiel-vorgabe.ts). Geprueft wird
 * hier deshalb genau das, was die Abschriften ersetzen soll — dass gefragt
 * wird, dass EINMAL gefragt wird, und dass ein Klick vor der Antwort nicht
 * raet, sondern wartet.
 */

const defaults = vi.hoisted(() => vi.fn());

vi.mock('./api', () => ({ api: { defaults } }));

import { useSpielVorgabe, zahlAus } from './spiel-vorgabe';

const VORGABE = { spalten: 8, zeilen: 7, farben: 6, variante: 'nebel', barrieren: 10 };

describe('useSpielVorgabe', () => {
  beforeEach(() => {
    defaults.mockReset();
  });

  it('holt den Regelsatz beim Aufbau und liefert ihn zum Anzeigen nach', async () => {
    defaults.mockResolvedValue({ config: VORGABE, protocolVersion: 1, seatCounts: [2], rounds: {} });

    const { result } = renderHook(() => useSpielVorgabe('filler'));

    expect(defaults).toHaveBeenCalledWith('filler');
    // Vor der Antwort steht nichts da — und ausdruecklich keine Ersatzzahl.
    expect(result.current.vorgabe).toBeNull();
    await waitFor(() => expect(result.current.vorgabe).toEqual(VORGABE));
  });

  it('fragt kein zweites Mal, auch wenn zwei Klicks zugleich kommen', async () => {
    let loese: (wert: unknown) => void = () => {};
    defaults.mockReturnValue(
      new Promise((fertig) => {
        loese = fertig;
      }),
    );

    const { result } = renderHook(() => useSpielVorgabe('eiland'));
    // Zwei Klicks, waehrend der Vorab-Ruf noch laeuft. Ohne die festgehaltene
    // Anfrage waeren das drei Rufe an denselben Endpunkt.
    const beide = Promise.all([result.current.holen(), result.current.holen()]);
    // In `act`, weil die eintreffende Antwort den Zustand fuer die Anzeige
    // setzt — sonst schimpft React ueber ein Neuzeichnen ausserhalb.
    await act(async () => {
      loese({ config: VORGABE, protocolVersion: 1, seatCounts: [2], rounds: {} });
      await beide;
    });

    expect(await beide).toEqual([VORGABE, VORGABE]);
    expect(defaults).toHaveBeenCalledTimes(1);
  });

  it('gibt einen Fehler an den Knopf weiter, statt eine Zahl zu erfinden', async () => {
    defaults.mockRejectedValue(new Error('Netz weg'));

    const { result } = renderHook(() => useSpielVorgabe('mememory'));

    await expect(result.current.holen()).rejects.toThrow('Netz weg');
    expect(result.current.vorgabe).toBeNull();
  });
});

describe('zahlAus', () => {
  it('nimmt die Zahl aus dem Regelsatz, sonst den Ersatz', () => {
    expect(zahlAus(VORGABE, 'farben', 99)).toBe(6);
    expect(zahlAus(null, 'farben', 99)).toBe(99);
    // Der Regelsatz kommt als `unknown` vom Server: Was keine Zahl ist, zaehlt
    // nicht als eine.
    expect(zahlAus({ farben: 'sechs' }, 'farben', 99)).toBe(99);
  });
});
