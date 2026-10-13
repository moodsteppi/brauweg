import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * Beitritt mit Zusage aus der Lobby (tables/anfragen.ts im Server).
 *
 * Antwortet der Server auf den Beitritt mit `angefragt`, darf der Bildschirm
 * nicht an den Tisch springen — dort ließe ihn niemand herein. Er wartet,
 * bis die Zusage kommt, und geht erst dann hinein.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { joinTable, anfrageStand } = vi.hoisted(() => ({
  joinTable: vi.fn(() => Promise.resolve({ ok: true, angefragt: true })),
  anfrageStand: vi.fn(() => Promise.resolve({ stand: 'offen' as 'offen' | 'angenommen' | 'abgelehnt' })),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      tables: () =>
        Promise.resolve([
          { id: 'c1', gameId: 'doppelkopf', host: 'Kiebitz', seats: 4, occupied: 1, maxRounds: 8, ruleCount: 0, visibility: 'club_only' },
        ]),
      defaults: () => Promise.resolve({ seatCounts: [4], rounds: { '4': [4, 8] }, config: {} }),
      joinTable,
      anfrageStand,
      zieheAnfrageZurueck: vi.fn(() => Promise.resolve({ ok: true })),
    },
  };
});

import { Lobby } from './Lobby';

describe('Beitritt mit Zusage', () => {
  it('wartet auf den Gastgeber und geht erst nach der Zusage an den Tisch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onEnter = vi.fn();
    render(<Lobby gameId="doppelkopf" onEnter={onEnter} onBack={vi.fn()} />);
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: /Runde von Kiebitz/ }));
    await act(async () => {});
    expect(screen.getByText('Anfrage gesendet')).toBeTruthy();
    expect(screen.getByText(/Kiebitz muss dich hereinlassen/)).toBeTruthy();
    expect(onEnter).not.toHaveBeenCalled();

    anfrageStand.mockResolvedValue({ stand: 'angenommen' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onEnter).toHaveBeenCalledWith('c1');
    vi.useRealTimers();
  });
});
