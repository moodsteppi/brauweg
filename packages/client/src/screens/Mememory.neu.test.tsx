import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Einstieg von Mememory im neuen Hub (Spieleinstieg-Baukasten,
 * 26.09.2026). Das Heim bleibt (Sammlung · Menü · Mehr, Leiste unten), die
 * mittlere Seite ist jetzt ein Spieleinstieg. Geprüft wird, dass dieselben
 * Wege gehen: Suche, KI-Match mit Stufen, Einstellungen, die Leiste.
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
    aktiveSpieler: () => Promise.resolve({ aktiv: 5 }),
    mememoryMotive: () => Promise.resolve({ grund: [], hochgeladen: [] }),
    mememorySammlung: () => Promise.resolve({ kennungen: [], gurt: [], gesperrt: [], zufall: false }),
    mememoryGurt: () => Promise.resolve({ gurt: [] }),
    mememoryZufall: () => Promise.resolve({ ok: true }),
    mememoryOffen: () => Promise.resolve({ offen: 0 }),
    mememoryEigene: () => Promise.resolve({ offen: 0, frei: null, hoechstens: 3 }),
    mememoryGesehen: () => Promise.resolve({ neu: 0, gesamt: 0 }),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({ view: null, party: null, table: null, status: 'connecting', send: () => {} }),
}));

vi.mock('../minispiele/mememory/klaenge', () => ({
  ladeMemeToene: () => {},
  spieleKlang: () => {},
  spieleMemeTon: () => {},
  lautstaerke: () => 70,
  setzeLautstaerke: () => {},
  tonAn: () => false,
}));

import { Mememory } from './Mememory';

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Mememory im neuen Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTable.mockResolvedValue({ id: 'tisch-4', joinCode: null });
    defaults.mockResolvedValue({ config: { paare: 12 }, protocolVersion: 1, seatCounts: [2, 3, 4], rounds: {} });
  });

  it('das Menü ist ein Spieleinstieg im Heim, die Leiste bleibt', async () => {
    render(<Mememory onBack={() => {}} />);
    await durchatmen();
    expect(document.querySelector('.mm-heim.is-neu .mm-blatt > .spe')).not.toBeNull();
    expect(screen.getByRole('navigation', { name: 'Seiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Online Match suchen…/ })).toHaveTextContent('(5)');
  });

  it('„Online Match suchen…" sucht direkt, ohne Zwischenschritt', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    render(<Mememory onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Online Match suchen…/ }));
    await durchatmen();
    expect(sucheStarten).toHaveBeenCalledWith('mememory');
    expect(screen.getByRole('heading', { name: 'Mitspieler suchen' })).toBeInTheDocument();
    expect(screen.getByText(/wird mit Bots aufgefüllt/)).toBeInTheDocument();
  });

  it('KI-Match: zwei Gegner mit eigener Stufe gehen sitzweise an den Tisch', async () => {
    render(<Mememory onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen die KI spielen' }));
    expect(screen.getByRole('heading', { name: 'KI-Match erstellen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gegner hinzufügen/ }));
    fireEvent.change(screen.getByRole('slider', { name: 'Spielstärke von Gegner 2' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Match starten' }));
    await durchatmen();
    await durchatmen();
    expect(createTable).toHaveBeenCalledTimes(1);
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'mememory',
      seats: 3,
      fillWithBots: true,
      config: { paare: 12, botStufen: { 1: 'mittel', 2: 'experte' } },
    });
  });

  it('das Zahnrad öffnet die Einstellungen als Blatt', async () => {
    render(<Mememory onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen öffnen' }));
    expect(screen.getByRole('dialog', { name: 'Einstellungen' })).toBeInTheDocument();
    expect(screen.getByText('Lautstärke')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog', { name: 'Einstellungen' })).not.toBeInTheDocument();
  });
});
