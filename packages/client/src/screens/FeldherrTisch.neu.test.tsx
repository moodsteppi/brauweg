import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Einstieg von Feldherr im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026).
 * Geprüft wird, dass der neue Look dieselben Wege hat wie der alte: Tisch
 * erstellen, offenen Tisch beitreten, Werte einer Einheit als Blatt.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { tables, createTable, joinTable } = vi.hoisted(() => ({
  tables: vi.fn(),
  createTable: vi.fn(),
  joinTable: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    tables,
    createTable,
    joinTable,
    leaveTable: () => Promise.resolve({ ok: true }),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({
    view: null,
    table: null,
    party: null,
    error: null,
    send: () => {},
    sendTakt: () => {},
    reconnect: () => {},
  }),
}));

// Die 3D-Bühne zieht three.js; im Menü kommt sie nie vor.
vi.mock('../minispiele/feldherr/Buehne3D', () => ({ Buehne3D: () => null }));

import { FeldherrTisch } from './FeldherrTisch';

async function zeige(): Promise<{ onEnter: ReturnType<typeof vi.fn> }> {
  const onEnter = vi.fn();
  render(<FeldherrTisch onBack={() => {}} onEnter={onEnter} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return { onEnter };
}

describe('Feldherr im neuen Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tables.mockResolvedValue([{ id: 'f-7', gameId: 'feldherr', host: 'Kiebitz', seats: 2, occupied: 1, maxRounds: 1 }]);
  });

  it('„Tisch erstellen" (goldener Fuß) legt denselben Tisch an', async () => {
    createTable.mockResolvedValue({ id: 'f-neu' });
    const { onEnter } = await zeige();
    expect(document.querySelector('.spe')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tisch erstellen' }));
    await act(async () => {});
    expect(createTable).toHaveBeenCalledWith({ gameId: 'feldherr', config: { feld: 'mittel' }, seats: 2, rounds: 1 });
    expect(onEnter).toHaveBeenCalledWith('f-neu');
  });

  it('tritt einem offenen Tisch mit einem Tipp bei', async () => {
    joinTable.mockResolvedValue({ ok: true });
    const { onEnter } = await zeige();
    fireEvent.click(screen.getByRole('button', { name: /Kiebitz/ }));
    await act(async () => {});
    expect(joinTable).toHaveBeenCalledWith('f-7');
    expect(onEnter).toHaveBeenCalledWith('f-7');
  });

  it('zeigt Charakter, „Bald" und die KI-Stärke, Normal vorgewählt', async () => {
    await zeige();
    expect(screen.getByRole('button', { name: /Engineer/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Nächster Charakter/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Schwer' }));
    expect(screen.getByRole('button', { name: 'Schwer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Übungspartie starten' })).toBeInTheDocument();
  });

  it('öffnet die Werte einer Einheit als Blatt', async () => {
    await zeige();
    fireEvent.click(screen.getByRole('button', { name: /^Schwert/ }));
    expect(screen.getByRole('dialog', { name: 'Werte: Schwert' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
