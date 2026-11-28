import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Einstieg von Eiland im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026).
 * Geprüft wird, dass der neue Look dieselben Wege hat wie der alte: Suche über
 * die Schlange, KI-Tisch mit der gewählten Spielart, Anleitung als Blatt.
 */

const { sucheStarten, sucheAbbrechen, createTable, defaults } = vi.hoisted(() => ({
  sucheStarten: vi.fn(),
  sucheAbbrechen: vi.fn(),
  createTable: vi.fn(),
  defaults: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    sucheStarten,
    sucheStand: vi.fn(() => new Promise(() => {})),
    sucheAbbrechen,
    createTable,
    defaults,
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(() => Promise.resolve({ ok: true })),
    aktiveSpieler: () => Promise.resolve({ aktiv: 4 }),
  },
  spielartenApi: {
    liste: () =>
      Promise.resolve({
        spielarten: [
          { id: 'klar', config: { spalten: 10, zeilen: 10, variante: 'klar' } },
          { id: 'nebel', config: { spalten: 10, zeilen: 10, variante: 'nebel' } },
        ],
      }),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({ view: null, party: null, table: null, status: 'connecting', send: () => {} }),
}));

import { Eiland } from './Eiland';

const VORGABE = { spalten: 10, zeilen: 10, variante: 'nebel' };

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Eiland im neuen Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaults.mockResolvedValue({ config: VORGABE, protocolVersion: 1, seatCounts: [2], rounds: {} });
    sucheAbbrechen.mockResolvedValue({ ok: true });
  });

  it('steht im Spieleinstieg und zeigt die Spielerzahl im Fuß', async () => {
    render(<Eiland onBack={() => {}} />);
    await durchatmen();
    expect(document.querySelector('.spe')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Eiland' })).toBeInTheDocument();
    expect(screen.getByText('4 Spieler gerade in Eiland')).toBeInTheDocument();
  });

  it('Quick-Play stellt sich mit der Spielart in die Schlange und zählt herunter', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    render(<Eiland onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: /^Quick-Play/ }));
    await durchatmen();
    expect(sucheStarten).toHaveBeenCalledWith('eiland', { spalten: 10, zeilen: 10, variante: 'klar' });
    expect(screen.getByRole('heading', { name: 'Gegner suchen' })).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await durchatmen();
    expect(sucheAbbrechen).toHaveBeenCalledWith('eiland');
    expect(screen.getByRole('button', { name: /^Quick-Play/ })).toBeInTheDocument();
  });

  it('der KI-Tisch nimmt die gewählte Spielart', async () => {
    createTable.mockResolvedValue({ id: 'tisch-9', joinCode: null });
    render(<Eiland onBack={() => {}} />);
    await durchatmen();
    // Vorgabe ist die offene Karte (Nutzerwunsch vom 04.09.2026) — die erste Spielart des Moduls.
    expect(screen.getByRole('button', { name: 'Klar' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Nebel' }));
    expect(screen.getByRole('button', { name: 'Nebel' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    await durchatmen();
    expect(createTable).toHaveBeenCalledTimes(1);
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'eiland',
      seats: 2,
      fillWithBots: true,
      config: { spalten: 10, zeilen: 10, variante: 'nebel' },
    });
  });

  it('öffnet die Anleitung als Blatt und schließt es wieder', async () => {
    render(<Eiland onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: /So spielt man Eiland/ }));
    expect(screen.getByRole('dialog', { name: 'So spielt man Eiland' })).toBeInTheDocument();
    expect(screen.getByText(/Wer am Ende die meisten Felder hält/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog', { name: 'So spielt man Eiland' })).not.toBeInTheDocument();
  });

  it('Zurück führt zur Spielseite', async () => {
    const onBack = vi.fn();
    render(<Eiland onBack={onBack} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zur Spielseite' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
