import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Einstieg von Tafelrunde im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026).
 * Geprüft wird, dass der neue Look dieselben Wege hat wie der alte: Suche,
 * Bot-Tisch, Tisch erstellen mit gewählten Plätzen, Regeln als Blatt.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { sucheStarten, sucheAbbrechen, createTable, leaveTable, tables } = vi.hoisted(() => ({
  sucheStarten: vi.fn(),
  sucheAbbrechen: vi.fn(() => Promise.resolve({ ok: true })),
  createTable: vi.fn(),
  leaveTable: vi.fn(() => Promise.resolve({ ok: true })),
  tables: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {
    constructor(readonly messageKey: string) {
      super(messageKey);
    }
  },
  api: {
    sucheStarten,
    sucheStand: () => new Promise(() => {}),
    sucheAbbrechen,
    createTable,
    leaveTable,
    tables,
    tischPerCode: () => Promise.reject(new Error('unbekannt')),
    aktiveSpieler: () => Promise.resolve({ aktiv: 3 }),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({ view: null, party: null, table: null, status: 'connecting', send: () => {} }),
}));

import { Tafelrunde } from './Tafelrunde';

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Tafelrunde im neuen Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('steht im Spieleinstieg, mit Spielerzahl im Fuß', async () => {
    const { container } = render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();
    expect(container.querySelector('.spe')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Tafelrunde' })).toBeInTheDocument();
    expect(screen.getByText('3 Spieler gerade in Tafelrunde')).toBeInTheDocument();
  });

  it('„Mitspieler suchen" startet dieselbe Suche und zeigt den Countdown', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    render(<Tafelrunde onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mitspieler suchen' }));
    await durchatmen();
    expect(sucheStarten).toHaveBeenCalledWith('tafelrunde');
    expect(screen.getByText('30')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suche abbrechen' }));
    expect(sucheAbbrechen).toHaveBeenCalledWith('tafelrunde');
  });

  it('„Gegen Bots spielen" macht denselben Bot-Tisch auf', async () => {
    createTable.mockResolvedValue({ id: 'bot-1' });
    render(<Tafelrunde onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots spielen' }));
    await durchatmen();
    expect(createTable).toHaveBeenCalledWith({
      gameId: 'tafelrunde',
      seats: 4,
      rounds: 1,
      visibility: 'on_request',
      fillWithBots: true,
    });
    expect(screen.getByText('Tisch wird aufgebaut')).toBeInTheDocument();
  });

  it('erstellt einen Tisch mit den gewählten Plätzen', async () => {
    createTable.mockResolvedValue({ id: 'freunde-1', joinCode: 'K7X9MQ' });
    render(<Tafelrunde onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tisch erstellen' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Offen für alle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tisch aufmachen' }));
    await durchatmen();
    expect(createTable).toHaveBeenCalledWith({
      gameId: 'tafelrunde',
      seats: 6,
      rounds: 1,
      visibility: 'public',
      fillWithBots: false,
      botLevel: 'standard',
    });
    // Danach der Wartesaal mit dem Code, ebenfalls im neuen Look.
    expect(screen.getByLabelText('Beitrittscode K7X9MQ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Partie starten' })).toBeInTheDocument();
  });

  it('öffnet die Anleitung als Blatt', async () => {
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: /So spielt man Tafelrunde/ }));
    expect(screen.getByRole('dialog', { name: 'So spielt man Tafelrunde' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
