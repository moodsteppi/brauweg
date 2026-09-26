import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Golf im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026).
 *
 * Geprüft wird, dass der neue Look dieselben Wege hat wie das alte Menü:
 * „Online spielen" sucht eine Gruppe, „Gegen Bots" öffnet eine eigene Ansicht
 * und „Los" legt den Bot-Tisch mit denselben Zahlen an, der Zurück-Knopf
 * führt aus ihr ins Menü statt aus dem Spiel. Die Verdrahtung im Einzelnen
 * (Regelsatz, Bahnwahl, Farben) steht in Golf.lobby.test.tsx und
 * Golf.bahnauswahl.test.tsx — beide laufen ohne Schalter ebenfalls im neuen Hub.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { createTable, joinTable, tables, leaveTable, me, startNow } = vi.hoisted(() => ({
  createTable: vi.fn(),
  joinTable: vi.fn(),
  tables: vi.fn(),
  leaveTable: vi.fn(),
  me: vi.fn(),
  startNow: vi.fn(),
}));

vi.mock('../api', () => ({
  api: { createTable, joinTable, tables, leaveTable, me },
}));

let tischStand: unknown = null;
vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { Golf } from './Golf';

function stand(sitze: unknown[] | null): unknown {
  return {
    view: null,
    party: null,
    table: sitze === null ? null : { seats: sitze, status: 'waiting', rounds: 9 },
    status: sitze === null ? 'connecting' : 'open',
    send: () => {},
    sendTakt: () => {},
    reconnect: () => {},
    startNow,
    setSeatColor: () => {},
  };
}

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  for (const f of [createTable, joinTable, tables, leaveTable, me, startNow]) f.mockReset();
  createTable.mockResolvedValue({ id: 'neu-1', joinCode: null });
  joinTable.mockResolvedValue({ ok: true });
  tables.mockResolvedValue([]);
  leaveTable.mockResolvedValue({ ok: true });
  me.mockResolvedValue({ id: 'konto-1', displayName: 'Ich' });
  tischStand = stand(null);
  localStorage.clear();
});

describe('Golf im neuen Hub', () => {
  it('zeigt das Menü im Spielrahmen und sucht mit „Online spielen" eine Gruppe', async () => {
    render(<Golf onBack={() => {}} />);
    await durchatmen();
    expect(screen.getByRole('heading', { name: 'Golf' })).toBeInTheDocument();
    expect(document.querySelector('.spe')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Online spielen' }));
    await durchatmen();
    expect(tables).toHaveBeenCalledWith('golf');
    expect(createTable).toHaveBeenCalledWith({ gameId: 'golf', seats: 8, rounds: 9, visibility: 'public' });
  });

  it('„Gegen Bots" öffnet eine eigene Ansicht, „Los" legt den Bot-Tisch an', async () => {
    render(<Golf onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    expect(screen.getByRole('heading', { name: 'Gegen Bots' })).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anfänger' }));
    expect(screen.getByRole('button', { name: 'Anfänger' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Los' }));
    await durchatmen();

    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'golf',
      seats: 3,
      rounds: 9,
      visibility: 'on_request',
      fillWithBots: true,
      botLevel: 'anfaenger',
    });
  });

  it('der Zurück-Knopf der Bot-Ansicht führt ins Menü, nicht aus dem Spiel', async () => {
    const onBack = vi.fn();
    render(<Golf onBack={onBack} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zum Golfmenü' }));

    expect(screen.getByRole('heading', { name: 'Golf' })).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('startet die Gruppe als Sitz 0 mit dem goldenen Knopf', async () => {
    tischStand = stand([
      { seat: 0, displayName: 'Ich', accountId: 'konto-1', isBot: false, avatarUrl: null, farbe: null },
      { seat: 1, displayName: null, accountId: null, isBot: false, avatarUrl: null, farbe: null },
    ]);
    render(<Golf startTisch="tisch-1" onBack={() => {}} />);
    await durchatmen();

    expect(screen.getByRole('heading', { name: 'Gruppe' })).toBeInTheDocument();
    const start = screen.getByRole('button', { name: 'Starten' });
    expect(start).toHaveClass('is-gold');
    fireEvent.click(start);
    expect(startNow).toHaveBeenCalledWith(9);
  });
});
