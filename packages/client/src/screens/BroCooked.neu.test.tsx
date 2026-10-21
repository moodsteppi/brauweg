import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * BroCooked im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026).
 *
 * Geprüft wird, dass der neue Look dieselben Wege hat wie das alte Menü:
 * „Am Tisch" tritt einem offenen Tisch bei oder macht einen mit der gewählten
 * Rundenzahl auf, die Gruppe startet mit dieser Zahl, „Allein kochen" öffnet
 * die Küche ohne Server, und die Rezeptkarte liegt als Blatt dahinter.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { tables, joinTable, createTable, leaveTable, startNow, addBot } = vi.hoisted(() => ({
  tables: vi.fn(),
  joinTable: vi.fn(),
  createTable: vi.fn(),
  leaveTable: vi.fn(),
  startNow: vi.fn(),
  addBot: vi.fn(),
}));

vi.mock('../api', () => ({
  api: { tables, joinTable, createTable, leaveTable },
}));

/** Was `useTable` gerade zurückgibt — ohne Sicht, also Menü oder Gruppe. */
let tischStand: unknown = null;
vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { BroCooked } from './BroCooked';

function stand(sitze: { seat: number; displayName: string | null; isBot: boolean }[] = []): unknown {
  return {
    view: null,
    table: sitze.length > 0 ? { seats: sitze, status: 'waiting' } : null,
    error: null,
    send: () => {},
    startNow,
    addBot,
  };
}

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
}

describe('BroCooked im neuen Hub', () => {
  beforeEach(() => {
    for (const f of [tables, joinTable, createTable, leaveTable, startNow, addBot]) f.mockReset();
    tables.mockResolvedValue([]);
    joinTable.mockResolvedValue({ ok: true });
    createTable.mockResolvedValue({ id: 'kueche-1', joinCode: null });
    leaveTable.mockResolvedValue({ ok: true });
    tischStand = stand();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('macht mit „Am Tisch" einen Tisch mit der gewählten Rundenzahl auf', async () => {
    render(<BroCooked onBack={() => {}} />);
    expect(screen.getByRole('heading', { name: 'BroCooked' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Am Tisch (2–4 Geräte)' }));
    await durchatmen();

    expect(tables).toHaveBeenCalledWith('brocooked');
    expect(createTable).toHaveBeenCalledWith({ gameId: 'brocooked', seats: 4, rounds: 4, visibility: 'public' });
    // Die Wahl bleibt für morgen im Browser, wie im alten Menü.
    expect(localStorage.getItem('brocooked.runden')).toBe('4');
  });

  it('tritt einem offenen Tisch bei, statt einen zweiten aufzumachen', async () => {
    tables.mockResolvedValue([{ id: 'offen-3', gameId: 'brocooked', seats: 4, occupied: 1 }]);
    render(<BroCooked onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Am Tisch (2–4 Geräte)' }));
    await durchatmen();

    expect(joinTable).toHaveBeenCalledWith('offen-3');
    expect(createTable).not.toHaveBeenCalled();
  });

  it('startet die Gruppe mit der Rundenzahl und setzt einen Hilfskoch auf den ersten freien Platz', async () => {
    localStorage.setItem('brocooked.runden', '3');
    tischStand = stand([
      { seat: 0, displayName: 'Ich', isBot: false },
      { seat: 1, displayName: null, isBot: false },
    ]);
    render(<BroCooked startTisch="kueche-9" onBack={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Küche füllt sich' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hilfskoch dazu' }));
    expect(addBot).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt anfangen' }));
    expect(startNow).toHaveBeenCalledWith(3);
  });

  it('öffnet mit „Allein kochen" die Küche ohne Tisch', async () => {
    // jsdom hat keine Leinwand; ohne Zeichenfläche überspringt der Bildtakt das Malen.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { unmount } = render(<BroCooked onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Allein kochen' }));

    expect(screen.getByRole('button', { name: 'Küche verlassen' })).toBeInTheDocument();
    expect(tables).not.toHaveBeenCalled();
    expect(createTable).not.toHaveBeenCalled();
    unmount();
  });

  it('zeigt die Rezepte als Blatt und schließt es mit „Fertig"', () => {
    render(<BroCooked onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Rezepte/ }));
    expect(screen.getByRole('dialog', { name: 'Rezepte' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('dialog', { name: 'Rezepte' })).not.toBeInTheDocument();
  });
});
