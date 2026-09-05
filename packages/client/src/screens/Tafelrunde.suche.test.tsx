import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Mitspielersuche am Bildschirm.
 *
 * Eigene Datei und nicht in Tafelrunde.test.tsx: Dort steht die Ruestkammer
 * unter Pruefung, und die braucht `../api` NICHT ersetzt. Hier ist genau das
 * der Kern — der Bildschirm fragt im Sekundentakt nach, und wer das mit
 * echten Netzaufrufen prueft, prueft nichts.
 *
 * Die Regeln der Schlange selbst (30 Sekunden ab dem Ersten, Bots als Rest)
 * liegen im Server und sind dort geprueft (packages/server/test/suche.test.ts).
 * Hier geht es nur um die Verdrahtung: Wird nachgefragt? Kommt der Countdown
 * an? Fuehrt eine Tischkennung ohne Rueckfrage in die Partie?
 */

// `vi.hoisted`, weil `vi.mock` an den Dateianfang wandert: Ohne das stehen die
// Attrappen zum Zeitpunkt des Ersetzens noch nicht.
const { sucheStarten, sucheStand, sucheAbbrechen, createTable, leaveTable } = vi.hoisted(() => ({
  sucheStarten: vi.fn(),
  sucheStand: vi.fn(),
  sucheAbbrechen: vi.fn(),
  createTable: vi.fn(),
  leaveTable: vi.fn(),
}));

vi.mock('../api', () => ({
  // Die Fehlerklasse gehoert in jede Attrappe dieses Moduls: Der Bildschirm
  // prueft mit `instanceof`, und gegen `undefined` wirft das.
  ApiError: class ApiError extends Error {
    constructor(readonly messageKey: string) {
      super(messageKey);
    }
  },
  api: {
    sucheStarten,
    sucheStand,
    sucheAbbrechen,
    createTable,
    leaveTable,
    aktiveSpieler: () => Promise.resolve({ aktiv: 3 }),
  },
}));

/** Kein Tisch, keine Sicht: der Zustand waehrend und kurz nach der Suche. */
let tischStand: unknown = {
  view: null,
  party: null,
  table: null,
  status: 'connecting',
  send: () => {},
};

vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { Tafelrunde } from './Tafelrunde';

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

describe('Tafelrunde: Mitspieler suchen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sucheStarten.mockReset();
    sucheStand.mockReset();
    sucheAbbrechen.mockReset().mockResolvedValue({ ok: true });
    createTable.mockReset();
    leaveTable.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function suchen(): Promise<void> {
    render(<Tafelrunde onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mitspieler suchen' }));
    await durchatmen();
  }

  it('zeigt Countdown und Zahl der Gefundenen', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: true, suchende: 3, restMs: 21_400, tischId: null });

    await suchen();
    expect(screen.getByText('30')).toBeTruthy();
    // Allein ist keine Zahl, sondern eine Zusage: Es wird trotzdem gespielt.
    expect(screen.getByText(/wird mit Bots aufgefüllt/)).toBeTruthy();

    await einTakt();
    // Aufgerundet, damit die Anzeige nicht bei 0 haengt, solange noch gewartet
    // wird: 21,4 Sekunden sind "22".
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
    await einTakt();
    expect(sucheStand).toHaveBeenCalledTimes(3);
  });

  it('geht mit der Tischkennung ohne Rueckfrage in die Partie', async () => {
    sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
    sucheStand.mockResolvedValue({ sucht: false, suchende: 0, restMs: 0, tischId: 'tisch-7' });

    await suchen();
    await einTakt();

    // Kein Knopf dazwischen: Der Suchbildschirm ist weg, der Tisch baut sich auf.
    expect(screen.queryByRole('button', { name: 'Mitspieler suchen' })).toBeNull();
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

    expect(sucheAbbrechen).toHaveBeenCalledWith('tafelrunde');
    expect(screen.getByRole('button', { name: 'Mitspieler suchen' })).toBeTruthy();

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
    expect(screen.getByRole('button', { name: 'Mitspieler suchen' })).toBeTruthy();
  });
});
