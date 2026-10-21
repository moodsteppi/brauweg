import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Kartenlobby im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026).
 * Geprüft wird, dass der neue Look dieselben Wege hat wie der alte: Tisch
 * beitreten, Tisch erstellen mit gewählten Plätzen, Regeln als Blatt.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { createTable, joinTable } = vi.hoisted(() => ({
  createTable: vi.fn(() => Promise.resolve({ id: 'neu-1' })),
  joinTable: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      tables: () =>
        Promise.resolve([
          { id: 't7', gameId: 'doppelkopf', host: 'Kiebitz', seats: 4, occupied: 2, maxRounds: 8, ruleCount: 0, visibility: 'public' },
        ]),
      defaults: () =>
        Promise.resolve({
          seatCounts: [4, 5],
          rounds: { '4': [4, 8, 12], '5': [5, 10] },
          config: { pflichtsolo: false, deck: 'with9' },
        }),
      createTable,
      joinTable,
    },
  };
});

import { Lobby } from './Lobby';

async function zeige(): Promise<{ onEnter: ReturnType<typeof vi.fn> }> {
  const onEnter = vi.fn();
  render(<Lobby gameId="doppelkopf" onEnter={onEnter} onBack={vi.fn()} />);
  await act(async () => {});
  return { onEnter };
}

describe('Kartenlobby im neuen Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('zeigt offene Tische und tritt mit einem Tipp bei', async () => {
    const { onEnter } = await zeige();
    fireEvent.click(screen.getByRole('button', { name: /Runde von Kiebitz/ }));
    await act(async () => {});
    expect(joinTable).toHaveBeenCalledWith('t7');
    expect(onEnter).toHaveBeenCalledWith('t7');
  });

  it('erstellt einen Tisch mit den gewählten Plätzen', async () => {
    const { onEnter } = await zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Tisch erstellen' }));
    fireEvent.click(screen.getByRole('button', { name: /^5 Spieler/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tisch erstellen' }));
    await act(async () => {});
    expect(createTable).toHaveBeenCalledWith(expect.objectContaining({ gameId: 'doppelkopf', seats: 5, rounds: 5 }));
    expect(onEnter).toHaveBeenCalledWith('neu-1');
  });

  it('öffnet die Regeln als Blatt und schließt es mit „Fertig"', async () => {
    await zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Tisch erstellen' }));
    fireEvent.click(screen.getByRole('button', { name: /Antippen zum Einstellen/ }));
    expect(screen.getByRole('dialog', { name: 'Regeln für diesen Tisch' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('dialog', { name: 'Regeln für diesen Tisch' })).not.toBeInTheDocument();
  });
});
