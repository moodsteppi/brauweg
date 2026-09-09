import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Mitspielersuche von Eiland am Bildschirm.
 *
 * Dieselbe Anlage wie Filler.suche.test.tsx und Tafelrunde.suche.test.tsx: Der
 * Bildschirm fragt im Sekundentakt nach, und wer das mit echten Netzaufrufen
 * prueft, prueft nichts. Die Regeln der Schlange selbst liegen im Server
 * (packages/server/test/suche.test.ts).
 */

const { sucheStarten, sucheStand, sucheAbbrechen, createTable, joinTable, tables, leaveTable, defaults } =
  vi.hoisted(() => ({
    sucheStarten: vi.fn(),
    sucheStand: vi.fn(),
    sucheAbbrechen: vi.fn(),
    createTable: vi.fn(),
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(),
    defaults: vi.fn(),
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
    defaults,
    aktiveSpieler: () => Promise.resolve({ aktiv: 4 }),
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

import { Eiland } from './Eiland';

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

/** Was `GET /games/<spiel>/defaults` liefert — die Vorgabe des Moduls. */
const VORGABE = {
  spalten: 10,
  zeilen: 10,
  seen: 2,
  berge: 4,
  ornamente: 4,
  sichtweite: 3,
  kontingentMax: 6,
  variante: 'nebel',
};

describe('Eiland: Mitspieler suchen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sucheStarten.mockReset();
    sucheStand.mockReset();
    sucheAbbrechen.mockReset().mockResolvedValue({ ok: true });
    createTable.mockReset();
    joinTable.mockReset();
    tables.mockReset().mockResolvedValue([]);
    leaveTable.mockReset().mockResolvedValue({ ok: true });
    /*
     * Der Bildschirm holt den Regelsatz seit dem 07.09.2026 beim Server,
     * statt ihn abzuschreiben (src/spiel-vorgabe.ts). Hier steht deshalb die
     * ANTWORT DES SERVERS und nicht eine zweite Abschrift: Was das Modul
     * wirklich vorgibt, prueft der Vertrag in src/vertrag/.
     */
    defaults.mockReset().mockResolvedValue({
      config: VORGABE,
      protocolVersion: 1,
      seatCounts: [2],
      rounds: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function suchen(): Promise<void> {
    render(<Eiland onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Online Match suchen…' }));
    await durchatmen();
  }

  it('zeigt Countdown und Zahl der Gefundenen', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: true, suchende: 2, restMs: 21_400, tischId: null });

    await suchen();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText(/spielst du gegen die KI/)).toBeTruthy();

    await einTakt();
    expect(screen.getByText('22')).toBeTruthy();
    expect(screen.getByText('2 Spieler gefunden')).toBeTruthy();
  });

  it('sucht nicht mehr ueber die Tischliste', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: true, suchende: 1, restMs: 29_000, tischId: null });

    await suchen();
    await einTakt();

    expect(tables).not.toHaveBeenCalled();
    expect(joinTable).not.toHaveBeenCalled();
    expect(createTable).not.toHaveBeenCalled();
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
    sucheStand.mockResolvedValue({ sucht: false, suchende: 0, restMs: 0, tischId: 'tisch-3' });

    await suchen();
    await einTakt();

    expect(screen.queryByRole('button', { name: 'Online Match suchen…' })).toBeNull();
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

    expect(sucheAbbrechen).toHaveBeenCalledWith('eiland');
    expect(screen.getByRole('button', { name: 'Online Match suchen…' })).toBeTruthy();
  });

  it('sagt es, wenn der Server die Suche nicht mehr kennt', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: false, suchende: 0, restMs: 0, tischId: null });

    await suchen();
    await einTakt();

    expect(screen.getByText(/Suche wurde beendet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Online Match suchen…' })).toBeTruthy();
  });

  it('der KI-Tisch behaelt die gewaehlte Spielart', async () => {
    /*
     * Der Schalter wirkt seit dem 06.09.2026 nur noch auf diesen Knopf. Waere
     * die Spielart hier mitgestrichen worden, gaebe es die offene Karte
     * nirgends mehr — und genau sie ist seit dem 04.09.2026 die Vorgabe.
     */
    createTable.mockResolvedValue({ id: 'tisch-9', joinCode: null });
    render(<Eiland onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gegen die KI spielen' }));
    await durchatmen();

    expect(createTable).toHaveBeenCalledTimes(1);
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'eiland',
      seats: 2,
      fillWithBots: true,
      config: { variante: 'klar' },
    });
  });

  it('legt die Spielart auf den Regelsatz des Servers, statt ihn abzuschreiben', async () => {
    /*
     * Bis zum 07.09.2026 stand der Regelsatz als Konstante im Bildschirm. Der
     * Server schreibt eine mitgeschickte `config` unveraendert als Regelsatz
     * des Tisches fest — die Abschrift UEBERSTIMMTE also das Modul, und beim
     * Auseinanderlaufen wurde nichts rot. Diese Probe haelt beides fest: dass
     * gefragt wird, und dass die Antwort ungekuerzt mitgeht.
     */
    createTable.mockResolvedValue({ id: 'tisch-10', joinCode: null });
    render(<Eiland onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen die KI spielen' }));
    await durchatmen();

    expect(defaults).toHaveBeenCalledWith('eiland');
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      // `variante` ueberschreibt die des Moduls — das ist die Wahl des Nutzers.
      config: { ...VORGABE, variante: 'klar' },
    });
  });
});
