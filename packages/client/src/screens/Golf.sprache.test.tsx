import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Golf auf Englisch (Projekt „BroweGGames Language", 06.11.2026).
 *
 * Die übrigen Golf-Tests laufen auf deutschem Gerät (vitest.setup.ts) und
 * sähen nicht, wenn ein Text wieder fest im Bildschirm stünde: Deutsch wäre
 * dann ja richtig. Diese Probe stellt auf Englisch und geht Menü, Gegen-Bots-
 * Ansicht mit Bahnauswahl und Gruppe ab — ein deutscher Rest fiele hier als
 * fehlender englischer Text auf.
 */

const { createTable, joinTable, tables, leaveTable, me } = vi.hoisted(() => ({
  createTable: vi.fn(),
  joinTable: vi.fn(),
  tables: vi.fn(),
  leaveTable: vi.fn(),
  me: vi.fn(),
}));

vi.mock('../api', () => ({
  api: { createTable, joinTable, tables, leaveTable, me },
}));

let tischStand: unknown = null;
vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { setzeSprachwahl } from '../i18n';
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
    startNow: () => {},
    setSeatColor: () => {},
  };
}

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  for (const f of [createTable, joinTable, tables, leaveTable, me]) f.mockReset();
  createTable.mockResolvedValue({ id: 'neu-1', joinCode: null });
  joinTable.mockResolvedValue({ ok: true });
  tables.mockResolvedValue([]);
  leaveTable.mockResolvedValue({ ok: true });
  me.mockResolvedValue({ id: 'konto-1', displayName: 'Me' });
  tischStand = stand(null);
  localStorage.clear();
  setzeSprachwahl('en');
});

afterEach(() => setzeSprachwahl('de'));

describe('Golf auf Englisch', () => {
  it('Menü und Gegen-Bots-Ansicht sprechen Englisch, Zahlen mit Einzahl und Mehrzahl', async () => {
    render(<Golf onBack={() => {}} />);
    await durchatmen();
    expect(screen.getByRole('button', { name: 'Play online' })).toBeInTheDocument();
    expect(screen.getByText(/Minigolf from above/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Against bots' }));
    expect(screen.getByRole('heading', { name: 'Against bots' })).toBeInTheDocument();
    // Vorgabe: 3 Bots, 9 Löcher.
    expect(screen.getByText('3 bots · 9 holes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beginner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to the golf menu' })).toBeInTheDocument();
  });

  it('die Gruppe wartet auf Englisch auf den Gastgeber', async () => {
    tischStand = stand([
      { seat: 0, accountId: 'konto-2', displayName: 'Bea', isBot: false },
      { seat: 1, accountId: 'konto-1', displayName: 'Me', isBot: false },
      { seat: 2, accountId: null, displayName: null, isBot: false },
    ]);
    render(<Golf startTisch="t-1" onBack={() => {}} />);
    await durchatmen();
    expect(screen.getByRole('heading', { name: 'Group' })).toBeInTheDocument();
    expect(screen.getByText('2/3 in the group')).toBeInTheDocument();
    expect(screen.getByText('Waiting for Bea to start')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
  });
});
