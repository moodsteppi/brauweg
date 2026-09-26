import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Einstieg von Filler im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026).
 * Dieselben Wege wie im alten Menü: Spielart-Kacheln (gemerkt im Browser),
 * Suche je Spielart, Bot-Tisch mit `config.variante`, Wischen, Anleitung.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { sucheStarten, createTable, defaults } = vi.hoisted(() => ({
  sucheStarten: vi.fn(),
  createTable: vi.fn(),
  defaults: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    sucheStarten,
    sucheStand: vi.fn(() => new Promise(() => {})),
    sucheAbbrechen: vi.fn(() => Promise.resolve({ ok: true })),
    createTable,
    defaults,
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(() => Promise.resolve({ ok: true })),
    aktiveSpieler: () => Promise.resolve({ aktiv: 3 }),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({ view: null, party: null, table: null, status: 'connecting', send: () => {} }),
}));

import { Filler } from './Filler';

const VORGABE = { spalten: 8, zeilen: 7, farben: 6, variante: 'nebel', barrieren: 10 };

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const kachel = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('Filler im neuen Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    createTable.mockResolvedValue({ id: 'tisch-1', joinCode: null });
    defaults.mockResolvedValue({ config: VORGABE, protocolVersion: 1, seatCounts: [2], rounds: {} });
  });

  it('„Gegen Bot spielen" macht den Tisch mit der gewählten Spielart auf', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    expect(document.querySelector('.spe')).not.toBeNull();
    expect(kachel('Nebel')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(kachel('Build'));
    expect(localStorage.getItem('filler.variante')).toBe('build');
    expect(screen.getByText(/zehn Mauern je Spieler/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bot spielen' }));
    await durchatmen();
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'filler',
      seats: 2,
      fillWithBots: true,
      config: { ...VORGABE, variante: 'build' },
    });
  });

  it('„Online Match suchen…" ist der goldene Hauptknopf und sucht', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    render(<Filler onBack={() => {}} />);
    const knopf = screen.getByRole('button', { name: 'Online Match suchen…' });
    expect(knopf).toHaveClass('hb-kn', 'is-gold');
    fireEvent.click(knopf);
    await durchatmen();
    expect(sucheStarten).toHaveBeenCalledWith('filler', expect.anything());
    expect(screen.getByRole('heading', { name: 'Gegner suchen' })).toBeInTheDocument();
    expect(screen.getByText(/spielst du gegen einen Bot/)).toBeInTheDocument();
  });

  it('Wischen wechselt weiter die Spielart', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    const flaeche = document.querySelector('.spe [data-wischbar]') as HTMLElement;
    fireEvent.pointerDown(flaeche, { pointerId: 1, clientX: 200, clientY: 100, pointerType: 'touch' });
    fireEvent.pointerMove(flaeche, { pointerId: 1, clientX: 120, clientY: 104, pointerType: 'touch' });
    fireEvent.pointerUp(flaeche, { pointerId: 1, clientX: 120, clientY: 104, pointerType: 'touch' });
    expect(kachel('Normal')).toHaveAttribute('aria-pressed', 'true');
  });

  it('öffnet die Anleitung als Blatt', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: /So spielt man Filler/ }));
    expect(screen.getByRole('dialog', { name: 'So spielt man Filler' })).toBeInTheDocument();
    expect(screen.getByText(/Die vier Spielarten/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog', { name: 'So spielt man Filler' })).not.toBeInTheDocument();
  });
});
