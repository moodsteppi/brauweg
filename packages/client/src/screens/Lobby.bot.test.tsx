import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * BroChess allein gegen den Bot (Emile, 13.10.2026).
 *
 * Geprüft wird der Weg aus der Lobby: „Gegen Bot spielen", Stärke wählen,
 * „Partie starten" — und dass der Tisch dabei so aufgemacht wird, wie es der
 * Server für einen Bot-Tisch braucht: freier Platz sofort mit Bot besetzt,
 * nicht in der öffentlichen Liste, mit der gewählten Stärke. Andere Spiele
 * bekommen den Knopf nicht.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { createTable } = vi.hoisted(() => ({
  createTable: vi.fn(() => Promise.resolve({ id: 'bot-1' })),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      tables: () => Promise.resolve([]),
      defaults: (gameId: string) =>
        Promise.resolve(
          gameId === 'brochess'
            ? { seatCounts: [2], rounds: { '2': [1] }, config: {} }
            : { seatCounts: [4, 5], rounds: { '4': [4, 8], '5': [5] }, config: {} },
        ),
      createTable,
    },
  };
});

import { Lobby } from './Lobby';

async function zeige(gameId: string): Promise<{ onEnter: ReturnType<typeof vi.fn> }> {
  const onEnter = vi.fn();
  render(<Lobby gameId={gameId} onEnter={onEnter} onBack={vi.fn()} />);
  await act(async () => {});
  return { onEnter };
}

describe('BroChess gegen den Bot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('startet eine Partie gegen den Bot mit der gewählten Stärke', async () => {
    const { onEnter } = await zeige('brochess');
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bot spielen' }));
    fireEvent.click(screen.getByRole('button', { name: /^Anfänger/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    await act(async () => {});
    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'brochess',
        seats: 2,
        rounds: 1,
        fillWithBots: true,
        visibility: 'on_request',
        botLevel: 'anfaenger',
      }),
    );
    expect(onEnter).toHaveBeenCalledWith('bot-1');
  });

  it('bietet den Weg nur bei BroChess an', async () => {
    await zeige('doppelkopf');
    expect(screen.queryByRole('button', { name: 'Gegen Bot spielen' })).toBeNull();
  });
});
