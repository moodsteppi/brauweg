import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Mitspielersuche von Filler am Bildschirm.
 *
 * Dieselbe Anlage wie Tafelrunde.suche.test.tsx, und aus demselben Grund: Der
 * Bildschirm fragt im Sekundentakt nach, und wer das mit echten Netzaufrufen
 * prueft, prueft nichts.
 *
 * Die Regeln der Schlange selbst (30 Sekunden ab dem Ersten, Bots als Rest)
 * liegen im Server und sind dort geprueft (packages/server/test/suche.test.ts).
 * Hier geht es um die Verdrahtung — und um das, was beim Umbau vom
 * 06.09.2026 leicht liegenbleibt: dass der Bot-Tisch weiterhin seine
 * Spielart mitschickt, obwohl die Suche keine mehr kennt.
 */

// `vi.hoisted`, weil `vi.mock` an den Dateianfang wandert: Ohne das stehen die
// Attrappen zum Zeitpunkt des Ersetzens noch nicht.
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
    aktiveSpieler: () => Promise.resolve({ aktiv: 3 }),
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

import { Filler } from './Filler';

/** Laesst die Zusagen durchlaufen, die der Effekt angestossen hat. */
async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Einen Abruf des Suchtakts ausloesen. */
async function einTakt(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  await durchatmen();
}

describe('Filler: Mitspieler suchen', () => {
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
    render(<Filler onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Online Match suchen…' }));
    await durchatmen();
  }

  it('zeigt Countdown und Zahl der Gefundenen', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: true, suchende: 2, restMs: 21_400, tischId: null });

    await suchen();
    expect(screen.getByText('30')).toBeTruthy();
    // Allein ist keine Zahl, sondern eine Zusage: Es wird trotzdem gespielt.
    expect(screen.getByText(/spielst du gegen einen Bot/)).toBeTruthy();

    await einTakt();
    // Aufgerundet, damit die Anzeige nicht bei 0 haengt, solange noch gewartet
    // wird: 21,4 Sekunden sind "22".
    expect(screen.getByText('22')).toBeTruthy();
    expect(screen.getByText('2 Spieler gefunden')).toBeTruthy();
  });

  it('sucht nicht mehr ueber die Tischliste', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: true, suchende: 1, restMs: 29_000, tischId: null });

    await suchen();
    await einTakt();

    /*
     * Der Kern des Umbaus vom 06.09.2026: Kein `tables`, kein `joinTable`,
     * kein selbst aufgemachter Tisch. Genau daraus bestand die alte Suche —
     * samt dem Wettrennen, das im 2,5-Sekunden-Takt zwei Tische wieder
     * zusammenfuehren musste.
     */
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
    await einTakt();
    expect(sucheStand).toHaveBeenCalledTimes(3);
  });

  it('geht mit der Tischkennung ohne Rueckfrage in die Partie', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: false, suchende: 0, restMs: 0, tischId: 'tisch-7' });

    await suchen();
    await einTakt();

    // Kein Knopf dazwischen: Der Suchbildschirm ist weg, der Tisch baut sich auf.
    expect(screen.queryByRole('button', { name: 'Online Match suchen…' })).toBeNull();
    expect(screen.getByText('Tisch wird aufgebaut')).toBeTruthy();

    // Und es wird nicht weiter nachgefragt, wenn die Suche vorbei ist.
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

    expect(sucheAbbrechen).toHaveBeenCalledWith('filler');
    expect(screen.getByRole('button', { name: 'Online Match suchen…' })).toBeTruthy();

    // Kein Nachfragen mehr — sonst haenge man weiter in der Schlange.
    const bisher = sucheStand.mock.calls.length;
    await einTakt();
    expect(sucheStand.mock.calls.length).toBe(bisher);
  });

  it('sagt es, wenn der Server die Suche nicht mehr kennt', async () => {
    // Passiert nach einem Neustart des Servers: Die Schlange liegt im
    // Arbeitsspeicher und ist dann weg. Stumm weiterdrehen waere das
    // Schlimmste, was der Bildschirm hier tun kann.
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: false, suchende: 0, restMs: 0, tischId: null });

    await suchen();
    await einTakt();

    expect(screen.getByText(/Suche wurde beendet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Online Match suchen…' })).toBeTruthy();
  });

  it('der Bot-Tisch behaelt die gewaehlte Spielart', async () => {
    /*
     * Der Schalter wirkt seit dem Umbau nur noch auf diesen Knopf — die
     * Schlange nimmt den Regelsatz des Moduls. Waere die Spielart hier
     * mitgestrichen worden, liesse sich "Build" ueberhaupt nicht mehr spielen.
     */
    createTable.mockResolvedValue({ id: 'tisch-9', joinCode: null });
    render(<Filler onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bot spielen' }));
    await durchatmen();

    expect(createTable).toHaveBeenCalledTimes(1);
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'filler',
      seats: 2,
      fillWithBots: true,
      config: { variante: 'build' },
    });
  });
});
