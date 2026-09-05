import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Mitspielersuche von Mememory am Bildschirm.
 *
 * Dieselbe Anlage wie Filler.suche.test.tsx und Tafelrunde.suche.test.tsx. Bei
 * Mememory kommt eine Frage dazu, die es dort nicht gab: Bis zum 06.09.2026
 * lag zwischen Knopf und Suche ein Zwischenschritt ("gegen wie viele?"), weil
 * jede Gegnerzahl ein eigener Topf war. Die Schlange hat nur einen Topf und
 * baut immer einen Tisch fuer vier — der Zwischenschritt ist deshalb weg, und
 * genau das steht hier unter Pruefung.
 */

const { sucheStarten, sucheStand, sucheAbbrechen, createTable, joinTable, tables, leaveTable } =
  vi.hoisted(() => ({
    sucheStarten: vi.fn(),
    sucheStand: vi.fn(),
    sucheAbbrechen: vi.fn(),
    createTable: vi.fn(),
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(),
  }));

vi.mock('../api', () => ({
  api: {
    sucheStarten,
    sucheStand,
    sucheAbbrechen,
    createTable,
    joinTable,
    tables,
    leaveTable,
    aktiveSpieler: () => Promise.resolve({ aktiv: 5 }),
    // Die Nebensachen des Menues: Sammlung, Motive, Vorschlaege. Sie duerfen
    // nicht ins Netz greifen, sind aber fuer die Suche ohne Belang.
    mememoryMotive: () => Promise.resolve({ grund: [], hochgeladen: [] }),
    mememorySammlung: () => Promise.resolve({ kennungen: [], gurt: [], gesperrt: [], zufall: false }),
    mememoryGurt: () => Promise.resolve({ gurt: [] }),
    mememoryZufall: () => Promise.resolve({ ok: true }),
    mememoryOffen: () => Promise.resolve({ offen: 0 }),
    mememoryEigene: () => Promise.resolve({ offen: 0, frei: null, hoechstens: 3 }),
    mememoryGesehen: () => Promise.resolve({ neu: 0, gesamt: 0 }),
  },
}));

/** Kein Tisch, keine Sicht: der Zustand waehrend und kurz nach der Suche. */
const tischStand: unknown = {
  view: null,
  party: null,
  table: null,
  status: 'connecting',
  send: () => {},
};

vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

// Die Toene laden Dateien nach. In jsdom gibt es die nicht, und fuer die
// Suche braucht sie ohnehin niemand.
vi.mock('../minispiele/mememory/klaenge', () => ({
  ladeMemeToene: () => {},
  spieleKlang: () => {},
  spieleMemeTon: () => {},
}));

import { Mememory } from './Mememory';

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function einTakt(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  await durchatmen();
}

describe('Mememory: Mitspieler suchen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sucheStarten.mockReset();
    sucheStand.mockReset();
    sucheAbbrechen.mockReset().mockResolvedValue({ ok: true });
    createTable.mockReset();
    joinTable.mockReset();
    tables.mockReset().mockResolvedValue([]);
    leaveTable.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function suchen(): Promise<void> {
    render(<Mememory onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: /Online Match suchen/ }));
    await durchatmen();
  }

  it('sucht ohne Zwischenschritt und ohne Tischliste', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: true, suchende: 1, restMs: 29_000, tischId: null });

    await suchen();

    // Direkt in der Schlange: Es gibt keine Frage "gegen wie viele?" mehr.
    expect(sucheStarten).toHaveBeenCalledWith('mememory');
    expect(screen.getByText('Mitspieler suchen')).toBeTruthy();
    expect(screen.queryByText('Gegen wie viele willst du spielen?')).toBeNull();

    await einTakt();
    expect(tables).not.toHaveBeenCalled();
    expect(joinTable).not.toHaveBeenCalled();
    expect(createTable).not.toHaveBeenCalled();
  });

  it('zeigt Countdown und Zahl der Gefundenen', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: true, suchende: 3, restMs: 21_400, tischId: null });

    await suchen();
    expect(screen.getByText('30')).toBeTruthy();
    // Der Tisch hat vier Plaetze, allein bleibt also niemand: Der Rest sind Bots.
    expect(screen.getByText(/wird mit Bots aufgefüllt/)).toBeTruthy();

    await einTakt();
    expect(screen.getByText('22')).toBeTruthy();
    expect(screen.getByText('3 Spieler gefunden')).toBeTruthy();
  });

  it('fragt weiter nach, solange gesucht wird - das ist das Lebenszeichen', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: true, suchende: 1, restMs: 28_000, tischId: null });

    await suchen();
    expect(sucheStand).not.toHaveBeenCalled();
    await einTakt();
    await einTakt();
    expect(sucheStand).toHaveBeenCalledTimes(2);
  });

  it('geht mit der Tischkennung ohne Rueckfrage in die Partie', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: false, suchende: 0, restMs: 0, tischId: 'tisch-4' });

    await suchen();
    await einTakt();

    expect(screen.getByText('Tisch wird aufgebaut')).toBeTruthy();

    const bisher = sucheStand.mock.calls.length;
    await einTakt();
    expect(sucheStand.mock.calls.length).toBe(bisher);
  });

  it('Abbrechen meldet den Austritt und fuehrt zurueck ins Menue', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 2, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: true, suchende: 2, restMs: 20_000, tischId: null });

    await suchen();
    fireEvent.click(screen.getByRole('button', { name: '← Abbrechen' }));
    await durchatmen();

    expect(sucheAbbrechen).toHaveBeenCalledWith('mememory');
    expect(screen.getByRole('button', { name: /Online Match suchen/ })).toBeTruthy();
  });

  it('sagt es, wenn der Server die Suche nicht mehr kennt', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: false, suchende: 0, restMs: 0, tischId: null });

    await suchen();
    await einTakt();

    expect(screen.getByText(/Suche wurde beendet/)).toBeTruthy();
  });
});
