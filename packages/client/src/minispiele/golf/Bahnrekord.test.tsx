import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Bahnrekord-Zeile im Zwischenstand von Golf (seit 22.09.2026).
 *
 * `api.bestenliste` ist ersetzt: Geprueft wird, dass die Zeile so aussieht,
 * wie die Karte sie verlangt, und dass der Haken je Bahn EINMAL fragt —
 * auch wenn die Tafel jede Sekunde neu gezeichnet wird.
 */

const bestenliste = vi.fn();
vi.mock('../../api', () => ({ api: { bestenliste: (...a: unknown[]) => bestenliste(...a) } }));

import { Bahnrekord, useBahnrekord } from './Bahnrekord';

beforeEach(() => {
  bestenliste.mockReset();
  bestenliste.mockImplementation(async (_spiel: string, bahn: string) => ({
    gameId: 'golf',
    inhaltId: bahn,
    eintraege: [
      { rang: 1, accountId: 'a', displayName: 'Anna', wert: bahn === 'k02' ? 4 : 3, richtung: 'tief', erzieltAm: '', du: false },
    ],
    eigene: { rang: 2, wert: 5, richtung: 'tief', erzieltAm: '' },
    anzahl: 2,
  }));
});

describe('Bahnrekord', () => {
  const stand = { rekord: { wert: 3, name: 'Anna', du: false }, eigenes: 5 };

  it('zeigt „Bahnrekord: N (Name) · dein Bestes: M"', () => {
    const { container } = render(<Bahnrekord stand={stand} schlaege={6} zaehlt />);
    expect(container.querySelector('.grek-zeile')?.textContent).toBe(
      'Bahnrekord: 3 (Anna) · dein Bestes: 5',
    );
    expect(container.querySelector('[data-grek-neu]')).toBeNull();
  });

  it('hebt einen eigenen neuen Bahnrekord hervor', () => {
    const { container } = render(<Bahnrekord stand={stand} schlaege={2} zaehlt />);
    expect(screen.getByText('Neuer Bahnrekord!')).toBeTruthy();
    expect(container.querySelector('[data-grek-neu]')).not.toBeNull();
    expect(container.querySelector('[data-grek-art="bahn"]')).not.toBeNull();
  });

  it('ein neues eigenes Bestes ohne Bahnrekord heisst so', () => {
    render(<Bahnrekord stand={stand} schlaege={4} zaehlt />);
    expect(screen.getByText('Neues persönliches Bestes!')).toBeTruthy();
  });

  it('am Gasttisch leuchtet nichts — der Server traegt dort nichts ein', () => {
    const { container } = render(<Bahnrekord stand={stand} schlaege={1} zaehlt={false} />);
    expect(container.querySelector('[data-grek-neu]')).toBeNull();
    expect(container.querySelector('.grek-zeile')).not.toBeNull();
  });

  it('eigener Rekord und leere Bahn', () => {
    const { container, rerender } = render(
      <Bahnrekord stand={{ rekord: { wert: 2, name: 'Anna', du: true }, eigenes: 2 }} schlaege={null} zaehlt />,
    );
    expect(container.querySelector('.grek-zeile')?.textContent).toBe('Bahnrekord: 2 (du) · dein Bestes: 2');
    rerender(<Bahnrekord stand={{ rekord: null, eigenes: null }} schlaege={null} zaehlt />);
    expect(container.querySelector('.grek-zeile')?.textContent).toBe(
      'Bahnrekord: noch keiner · dein Bestes: –',
    );
  });

  it('ohne Stand zeigt sie nichts', () => {
    const { container } = render(<Bahnrekord stand={null} schlaege={2} zaehlt />);
    expect(container.innerHTML).toBe('');
  });
});

describe('useBahnrekord', () => {
  it('holt je Bahn einmal, nicht je Neuzeichnen und nicht beim Zurueckkehren', async () => {
    const { result, rerender } = renderHook(({ bahn }: { bahn: string | null }) => useBahnrekord(bahn), {
      initialProps: { bahn: 'k01' as string | null },
    });
    await waitFor(() => expect(result.current?.rekord?.wert).toBe(3));

    rerender({ bahn: 'k01' });
    rerender({ bahn: 'k01' });
    rerender({ bahn: 'k02' });
    await waitFor(() => expect(result.current?.rekord?.wert).toBe(4));
    rerender({ bahn: 'k01' });
    await waitFor(() => expect(result.current?.rekord?.wert).toBe(3));

    expect(bestenliste).toHaveBeenCalledTimes(2);
    expect(bestenliste.mock.calls).toEqual([
      ['golf', 'k01'],
      ['golf', 'k02'],
    ]);
  });

  it('zeigt unter einer neuen Bahn nicht den Stand der vorigen', async () => {
    let freigeben: () => void = () => {};
    const { result, rerender } = renderHook(({ bahn }: { bahn: string | null }) => useBahnrekord(bahn), {
      initialProps: { bahn: 'k01' as string | null },
    });
    await waitFor(() => expect(result.current).not.toBeNull());

    bestenliste.mockImplementationOnce(
      () =>
        new Promise((fertig) => {
          freigeben = () => fertig({ gameId: 'golf', inhaltId: 'k09', eintraege: [], eigene: null, anzahl: 0 });
        }),
    );
    rerender({ bahn: 'k09' });
    expect(result.current).toBeNull();
    await waitFor(() => expect(bestenliste).toHaveBeenCalledTimes(2));
    expect(result.current).toBeNull();
    freigeben();
    await waitFor(() => expect(result.current).toEqual({ rekord: null, eigenes: null }));
  });
});
